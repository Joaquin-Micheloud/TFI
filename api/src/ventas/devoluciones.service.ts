import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StockService } from '../stock/stock.service.js';
import {
  DestinoDevolucion,
  EstadoPieza,
  EstadoVenta,
  MotivoBaja,
  Prisma,
  TipoMovimiento,
  TipoVenta,
} from '../generated/prisma/client.js';
import type { UsuarioActual } from '../auth/types.js';
import { AnularVentaDto, DevolucionDto } from './dto/devolucion.dto.js';

type VentaConItems = Prisma.VentaGetPayload<{
  include: { items: true; devoluciones: { include: { items: true } } };
}>;
type ItemDeVenta = VentaConItems['items'][number];

@Injectable()
export class DevolucionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
  ) {}

  // Anula la venta completa: devuelve todo el stock y la marca ANULADA (nunca se borra)
  async anular(id: string, dto: AnularVentaDto, user: UsuarioActual) {
    const venta = await this.buscarVenta(id, user);
    this.rechazarServicio(venta);
    if (venta.estado === EstadoVenta.ANULADA) throw new ConflictException('La venta ya está anulada');
    if (venta.devoluciones.length > 0) {
      throw new ConflictException(
        'La venta tiene devoluciones registradas: no se puede anular. Registrá una devolución de lo que queda.',
      );
    }

    const motivo = dto.motivo.trim();
    await this.prisma.$transaction(async (tx) => {
      // Solo cambia si sigue confirmada (evita anular dos veces a la vez)
      const r = await tx.venta.updateMany({
        where: { id, estado: EstadoVenta.CONFIRMADA },
        data: {
          estado: EstadoVenta.ANULADA,
          motivoAnulacion: motivo,
          anuladaEn: new Date(),
          anuladaPorId: user.usuarioId,
        },
      });
      if (r.count === 0) throw new ConflictException('La venta ya fue anulada');

      for (const item of venta.items) {
        await this.reponer(tx, venta, item, item.cantidad, DestinoDevolucion.STOCK, `Anulación: ${motivo}`, user);
      }
    });
  }

  // Devuelve algunos ítems o unidades de una venta
  async devolver(id: string, dto: DevolucionDto, user: UsuarioActual) {
    const venta = await this.buscarVenta(id, user);
    this.rechazarServicio(venta);
    if (venta.estado === EstadoVenta.ANULADA) {
      throw new ConflictException('No se puede registrar una devolución sobre una venta anulada');
    }

    // Cuánto se devolvió ya de cada ítem
    const yaDevuelto = new Map<string, number>();
    for (const d of venta.devoluciones) {
      for (const i of d.items) yaDevuelto.set(i.ventaItemId, (yaDevuelto.get(i.ventaItemId) ?? 0) + i.cantidad);
    }

    // Se reintegra lo que efectivamente se cobró: el subtotal del ítem
    // (ya con su descuento) y además el descuento sobre el total
    const factorGlobal = new Prisma.Decimal(1).minus(venta.descuentoPct.div(100));
    const vistos = new Set<string>();

    const lineas = dto.items.map((i) => {
      if (vistos.has(i.ventaItemId)) throw new BadRequestException('Hay un ítem repetido en la devolución');
      vistos.add(i.ventaItemId);

      const item = venta.items.find((x) => x.id === i.ventaItemId);
      if (!item) throw new BadRequestException('Uno de los ítems no pertenece a esta venta');

      const disponible = item.cantidad - (yaDevuelto.get(item.id) ?? 0);
      if (i.cantidad > disponible) {
        throw new BadRequestException(`${item.codigo}: se pueden devolver como máximo ${disponible} unidades`);
      }

      const monto = item.subtotal.div(item.cantidad).times(i.cantidad).times(factorGlobal).toDecimalPlaces(2);
      return { item, cantidad: i.cantidad, destino: i.destino, monto };
    });

    const total = lineas.reduce((suma, l) => suma.plus(l.monto), new Prisma.Decimal(0));
    const motivo = dto.motivo.trim();

    return this.prisma.$transaction(async (tx) => {
      const devolucion = await tx.devolucion.create({
        data: {
          negocioId: user.negocioId,
          ventaId: venta.id,
          usuarioId: user.usuarioId,
          motivo,
          medioReintegro: dto.medioReintegro,
          montoArs: total,
          items: {
            create: lineas.map((l) => ({
              ventaItemId: l.item.id,
              cantidad: l.cantidad,
              montoArs: l.monto,
              destino: l.destino,
            })),
          },
        },
      });

      for (const l of lineas) {
        await this.reponer(tx, venta, l.item, l.cantidad, l.destino, `Devolución: ${motivo}`, user);
      }
      return devolucion;
    });
  }

  // ---------- Internos ----------

  // La entrega de una compostura no mueve stock: no se anula ni se devuelve desde acá
  private rechazarServicio(venta: VentaConItems) {
    if (venta.tipo === TipoVenta.SERVICIO) {
      throw new ConflictException('Es el cobro de una compostura: no se puede anular ni devolver como una venta');
    }
  }

  private async buscarVenta(id: string, user: UsuarioActual) {
    const venta = await this.prisma.venta.findFirst({
      where: { id, negocioId: user.negocioId },
      include: { items: true, devoluciones: { include: { items: true } } },
    });
    if (!venta) throw new NotFoundException('Venta no encontrada');
    await this.stock.asegurarTienda(venta.tiendaId, user, false); // el gerente, solo en sus tiendas
    return venta;
  }

  // Devuelve unidades al stock (o las da de baja) y registra los movimientos
  private async reponer(
    tx: Prisma.TransactionClient,
    venta: VentaConItems,
    item: ItemDeVenta,
    cantidad: number,
    destino: DestinoDevolucion,
    detalle: string,
    user: UsuarioActual,
  ) {
    if (!item.productoId) return; // ítem de servicio: no hay stock que reponer
    if (item.piezaId) {
      await tx.pieza.update({
        where: { id: item.piezaId },
        data: { estado: destino === DestinoDevolucion.STOCK ? EstadoPieza.DISPONIBLE : EstadoPieza.BAJA },
      });
    } else if (item.loteId && destino === DestinoDevolucion.STOCK) {
      await tx.lote.update({
        where: { id: item.loteId },
        data: { cantidadDisponible: { increment: cantidad } },
      });
    }

    const base = {
      negocioId: venta.negocioId,
      productoId: item.productoId,
      tiendaId: venta.tiendaId,
      piezaId: item.piezaId,
      loteId: item.loteId,
      usuarioId: user.usuarioId,
      referencia: venta.id,
    };

    // La mercadería vuelve…
    await tx.movimientoStock.create({
      data: { ...base, tipo: TipoMovimiento.DEVOLUCION, cantidad, detalle },
    });
    // …y si vino dañada, sale de nuevo como baja. El historial muestra los dos pasos.
    if (destino === DestinoDevolucion.BAJA) {
      await tx.movimientoStock.create({
        data: {
          ...base,
          tipo: TipoMovimiento.BAJA,
          cantidad: -cantidad,
          motivoBaja: MotivoBaja.ROTURA,
          detalle: 'Devuelto dañado',
        },
      });
    }
  }
}