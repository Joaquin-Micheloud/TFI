import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StockService } from '../stock/stock.service.js';
import {
  EstadoPieza,
  EstadoTransferencia,
  Prisma,
  Rol,
  TipoMovimiento,
} from '../generated/prisma/client.js';
import type { UsuarioActual } from '../auth/types.js';
import { CrearTransferenciaDto, QueryTransferenciasDto } from './dto/transferencia.dto.js';

const usuarioResumen = { select: { nombre: true, email: true } } as const;

const incluirTransferencia = {
  origen: { select: { id: true, nombre: true } },
  destino: { select: { id: true, nombre: true } },
  enviadaPor: usuarioResumen,
  recibidaPor: usuarioResumen,
  canceladaPor: usuarioResumen,
  items: {
    include: {
      producto: { select: { id: true, codigo: true, nombre: true } },
      pieza: { select: { codigo: true, pesoGramos: true } },
      loteOrigen: { select: { fechaIngreso: true, pesoTotalGramos: true, cantidadInicial: true } },
    },
  },
} satisfies Prisma.TransferenciaInclude;

export type TransferenciaCompleta = Prisma.TransferenciaGetPayload<{ include: typeof incluirTransferencia }>;

interface DatosMovimiento {
  productoId: string;
  tiendaId: string;
  piezaId?: string | null;
  loteId?: string | null;
  tipo: TipoMovimiento;
  cantidad: number;
  referencia: string;
  detalle?: string;
}

/**
 * Transferencias de stock entre tiendas del mismo negocio (sección 7 del documento):
 *  - Al enviar, las piezas quedan EN_TRANSITO y la cantidad sale del lote de origen.
 *  - Al recibir, las piezas pasan a la tienda destino y por cada lote se crea uno
 *    nuevo en destino con la cantidad enviada, el peso proporcional y los mismos datos de alta.
 *  - Mientras no se reciba, se puede cancelar y todo vuelve al origen.
 */
@Injectable()
export class TransferenciasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
  ) {}

  // ---------- Consultas ----------

  // Las transferencias donde alguna de mis tiendas es origen o destino
  async listar(query: QueryTransferenciasDto, user: UsuarioActual): Promise<TransferenciaCompleta[]> {
    const tiendas = await this.stock.filtroTiendas(user, query.tiendaId);
    const where: Prisma.TransferenciaWhereInput = { negocioId: user.negocioId, estado: query.estado };
    if (tiendas) where.OR = [{ origenId: tiendas }, { destinoId: tiendas }];

    return this.prisma.transferencia.findMany({
      where,
      include: incluirTransferencia,
      orderBy: { enviadaEn: 'desc' },
      take: 100,
    });
  }

  async findOne(id: string, user: UsuarioActual): Promise<TransferenciaCompleta> {
    const t = await this.prisma.transferencia.findFirst({
      where: { id, negocioId: user.negocioId },
      include: incluirTransferencia,
    });
    if (!t) throw new NotFoundException('Transferencia no encontrada');

    if (user.rol !== Rol.ADMIN) {
      const mias = await this.tiendasAsignadas(user);
      if (!mias.includes(t.origenId) && !mias.includes(t.destinoId)) {
        throw new NotFoundException('Transferencia no encontrada');
      }
    }
    return t;
  }

  // ---------- Enviar ----------

  async crear(dto: CrearTransferenciaDto, user: UsuarioActual) {
    if (user.rol === Rol.VENDEDOR) {
      throw new ForbiddenException('Solo un administrador o gerente puede enviar transferencias');
    }
    if (dto.origenId === dto.destinoId) {
      throw new BadRequestException('La tienda de origen y la de destino tienen que ser distintas');
    }
    // El gerente tiene que tener asignadas las dos tiendas (sección 4 del documento)
    await this.stock.asegurarTienda(dto.origenId, user);
    await this.stock.asegurarTienda(dto.destinoId, user);

    const piezaIds = dto.items.filter((i) => i.piezaId).map((i) => i.piezaId!);
    if (new Set(piezaIds).size !== piezaIds.length) throw new BadRequestException('Hay una pieza repetida');

    const id = await this.prisma.$transaction(async (tx) => {
      const t = await tx.transferencia.create({
        data: {
          negocioId: user.negocioId,
          origenId: dto.origenId,
          destinoId: dto.destinoId,
          nota: dto.nota?.trim() || null,
          enviadaPorId: user.usuarioId,
        },
      });

      for (const [i, item] of dto.items.entries()) {
        const n = i + 1;

        if (item.piezaId) {
          // ----- Pieza única: queda en tránsito -----
          const pieza = await tx.pieza.findFirst({ where: { id: item.piezaId, negocioId: user.negocioId } });
          if (!pieza) throw new NotFoundException(`Ítem ${n}: pieza no encontrada`);
          if (pieza.tiendaId !== dto.origenId) {
            throw new BadRequestException(`Ítem ${n}: la pieza ${pieza.codigo} no está en la tienda de origen`);
          }
          // Solo cambia si sigue disponible (evita enviar una pieza que se acaba de vender)
          const r = await tx.pieza.updateMany({
            where: { id: pieza.id, estado: EstadoPieza.DISPONIBLE },
            data: { estado: EstadoPieza.EN_TRANSITO },
          });
          if (r.count === 0) throw new ConflictException(`Ítem ${n}: la pieza ${pieza.codigo} no está disponible`);

          await tx.transferenciaItem.create({
            data: { transferenciaId: t.id, productoId: pieza.productoId, piezaId: pieza.id, cantidad: 1 },
          });
          await this.movimiento(tx, user, {
            productoId: pieza.productoId,
            tiendaId: dto.origenId,
            piezaId: pieza.id,
            tipo: TipoMovimiento.TRANSFERENCIA_SALIDA,
            cantidad: -1,
            referencia: t.id,
          });
        } else if (item.loteId) {
          // ----- Cantidad de un lote: sale del lote de origen -----
          const cantidad = item.cantidad ?? 1;
          const lote = await tx.lote.findFirst({ where: { id: item.loteId, negocioId: user.negocioId } });
          if (!lote) throw new NotFoundException(`Ítem ${n}: lote no encontrado`);
          if (lote.tiendaId !== dto.origenId) {
            throw new BadRequestException(`Ítem ${n}: el lote no está en la tienda de origen`);
          }
          await this.stock.descontarLote(tx, lote.id, cantidad); // falla si no alcanza

          await tx.transferenciaItem.create({
            data: { transferenciaId: t.id, productoId: lote.productoId, loteOrigenId: lote.id, cantidad },
          });
          await this.movimiento(tx, user, {
            productoId: lote.productoId,
            tiendaId: dto.origenId,
            loteId: lote.id,
            tipo: TipoMovimiento.TRANSFERENCIA_SALIDA,
            cantidad: -cantidad,
            referencia: t.id,
          });
        } else {
          throw new BadRequestException(`Ítem ${n}: indicá piezaId o loteId`);
        }
      }
      return t.id;
    });

    return this.findOne(id, user);
  }

  // ---------- Recibir ----------

  async recibir(id: string, user: UsuarioActual) {
    const t = await this.buscarPendiente(id, user);
    await this.stock.asegurarTienda(t.destinoId, user); // hay que tener asignada la tienda destino

    await this.prisma.$transaction(async (tx) => {
      // Solo si sigue ENVIADA: evita recibirla dos veces
      const r = await tx.transferencia.updateMany({
        where: { id, estado: EstadoTransferencia.ENVIADA },
        data: { estado: EstadoTransferencia.RECIBIDA, recibidaPorId: user.usuarioId, recibidaEn: new Date() },
      });
      if (r.count === 0) throw new ConflictException('La transferencia ya fue recibida o cancelada');

      for (const item of t.items) {
        if (item.piezaId) {
          await tx.pieza.update({
            where: { id: item.piezaId },
            data: { tiendaId: t.destinoId, estado: EstadoPieza.DISPONIBLE },
          });
          await this.movimiento(tx, user, {
            productoId: item.productoId,
            tiendaId: t.destinoId,
            piezaId: item.piezaId,
            tipo: TipoMovimiento.TRANSFERENCIA_ENTRADA,
            cantidad: 1,
            referencia: t.id,
          });
        } else if (item.loteOrigenId) {
          // Lote nuevo en el destino con los mismos datos de alta (proporcionales a la cantidad)
          const origen = await tx.lote.findUniqueOrThrow({ where: { id: item.loteOrigenId } });
          const proporcion = new Prisma.Decimal(item.cantidad).div(origen.cantidadInicial);

          const nuevo = await tx.lote.create({
            data: {
              negocioId: user.negocioId,
              productoId: origen.productoId,
              tiendaId: t.destinoId,
              cantidadInicial: item.cantidad,
              cantidadDisponible: item.cantidad,
              pesoTotalGramos: origen.pesoTotalGramos?.times(proporcion).toDecimalPlaces(3) ?? null,
              precioCompraTotal: origen.precioCompraTotal?.times(proporcion).toDecimalPlaces(2) ?? null,
              monedaCompra: origen.monedaCompra,
              hechuraUsdUnitaria: origen.hechuraUsdUnitaria,
              dolarAlta: origen.dolarAlta,
              gramoAlta: origen.gramoAlta,
              fechaIngreso: origen.fechaIngreso, // conserva la antigüedad para el orden FIFO
            },
          });
          await tx.transferenciaItem.update({ where: { id: item.id }, data: { loteDestinoId: nuevo.id } });
          await this.movimiento(tx, user, {
            productoId: item.productoId,
            tiendaId: t.destinoId,
            loteId: nuevo.id,
            tipo: TipoMovimiento.TRANSFERENCIA_ENTRADA,
            cantidad: item.cantidad,
            referencia: t.id,
          });
        }
      }
    });

    return this.findOne(id, user);
  }

  // ---------- Cancelar ----------

  async cancelar(id: string, user: UsuarioActual) {
    if (user.rol === Rol.VENDEDOR) {
      throw new ForbiddenException('Solo un administrador o gerente puede cancelar transferencias');
    }
    const t = await this.buscarPendiente(id, user);
    await this.stock.asegurarTienda(t.origenId, user, false);

    await this.prisma.$transaction(async (tx) => {
      const r = await tx.transferencia.updateMany({
        where: { id, estado: EstadoTransferencia.ENVIADA },
        data: { estado: EstadoTransferencia.CANCELADA, canceladaPorId: user.usuarioId, canceladaEn: new Date() },
      });
      if (r.count === 0) throw new ConflictException('La transferencia ya fue recibida o cancelada');

      // Todo vuelve a la tienda de origen
      for (const item of t.items) {
        if (item.piezaId) {
          await tx.pieza.update({ where: { id: item.piezaId }, data: { estado: EstadoPieza.DISPONIBLE } });
        } else if (item.loteOrigenId) {
          await tx.lote.update({
            where: { id: item.loteOrigenId },
            data: { cantidadDisponible: { increment: item.cantidad } },
          });
        }
        await this.movimiento(tx, user, {
          productoId: item.productoId,
          tiendaId: t.origenId,
          piezaId: item.piezaId,
          loteId: item.loteOrigenId,
          tipo: TipoMovimiento.TRANSFERENCIA_ENTRADA,
          cantidad: item.cantidad,
          referencia: t.id,
          detalle: 'Transferencia cancelada: vuelve al origen',
        });
      }
    });

    return this.findOne(id, user);
  }

  // ---------- Internos ----------

  private async buscarPendiente(id: string, user: UsuarioActual) {
    const t = await this.prisma.transferencia.findFirst({
      where: { id, negocioId: user.negocioId },
      include: { items: true },
    });
    if (!t) throw new NotFoundException('Transferencia no encontrada');
    if (t.estado !== EstadoTransferencia.ENVIADA) {
      throw new ConflictException(`La transferencia ya está ${t.estado.toLowerCase()}`);
    }
    return t;
  }

  private async tiendasAsignadas(user: UsuarioActual) {
    const filas = await this.prisma.usuarioTienda.findMany({
      where: { membresiaId: user.membresiaId },
      select: { tiendaId: true },
    });
    return filas.map((f) => f.tiendaId);
  }

  private movimiento(tx: Prisma.TransactionClient, user: UsuarioActual, d: DatosMovimiento) {
    return tx.movimientoStock.create({
      data: { negocioId: user.negocioId, usuarioId: user.usuarioId, ...d },
    });
  }
}
