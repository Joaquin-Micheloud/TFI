import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StockService } from '../stock/stock.service.js';
import { ProductosService, incluir as incluirProducto } from '../productos/productos.service.js';
import {
  EstadoPieza,
  EstadoVenta,
  MedioPago,
  Metal,
  Prisma,
  Rol,
  TipoProducto,
} from '../generated/prisma/client.js';
import type { UsuarioActual } from '../auth/types.js';
import { diaArgentina, haceDias, hoyArgentina, rangoDeFechas } from '../common/fechas.js';
import { QueryCajaDto, QueryPeriodoDto, QueryValorizacionDto } from './dto/reportes.dto.js';

type Dec = Prisma.Decimal;
const cero = () => new Prisma.Decimal(0);

const MEDIOS: MedioPago[] = [
  MedioPago.EFECTIVO_ARS,
  MedioPago.EFECTIVO_USD,
  MedioPago.TRANSFERENCIA,
  MedioPago.DEBITO,
  MedioPago.CREDITO,
];

export interface Valor {
  unidades: number;
  costo: Dec;
  precio: Dec;
  sinPrecio: number; // unidades que no se pudieron valorizar (ej.: falta margen)
}

const nuevoValor = (): Valor => ({ unidades: 0, costo: cero(), precio: cero(), sinPrecio: 0 });

export interface FilaCaja {
  medio: MedioPago;
  cobrado: Dec; // en pesos
  dolares: Dec; // solo efectivo en dólares: cuántos USD entraron
  reintegrado: Dec;
}

export interface Acumulado {
  cantidad: number;
  total: Dec;
  costo: Dec;
}

const nuevoAcumulado = (): Acumulado => ({ cantidad: 0, total: cero(), costo: cero() });

// Agrega el ticket promedio y el margen bruto
const conPromedio = (a: Acumulado) => ({
  cantidad: a.cantidad,
  total: a.total,
  ticketPromedio: a.cantidad ? a.total.div(a.cantidad).toDecimalPlaces(2) : cero(),
  costo: a.costo,
  margenBruto: a.total.minus(a.costo),
});

@Injectable()
export class ReportesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly productos: ProductosService,
  ) {}

  /**
   * Valorización del inventario con la cotización de hoy (el reporte diferencial, sección 11):
   * valor del stock disponible a costo y a precio de venta, y gramos de oro y plata por ley.
   */
  async valorizacion(query: QueryValorizacionDto, user: UsuarioActual) {
    const tiendaId = await this.stock.filtroTiendas(user, query.tiendaId);
    const incluir = { producto: { include: incluirProducto }, tienda: { select: { id: true, nombre: true } } };

    const [piezas, lotes] = await Promise.all([
      this.prisma.pieza.findMany({
        where: { negocioId: user.negocioId, tiendaId, estado: EstadoPieza.DISPONIBLE },
        include: incluir,
      }),
      this.prisma.lote.findMany({
        where: { negocioId: user.negocioId, tiendaId, cantidadDisponible: { gt: 0 } },
        include: incluir,
      }),
    ]);

    const { cotizar, cotizacion } = await this.productos.crearCotizador(user.negocioId);
    const total = nuevoValor();
    const porTienda = new Map<string, { tienda: string } & Valor>();
    const porTipo = new Map<TipoProducto, Valor>();
    const gramos = new Map<string, { metal: Metal; ley: Dec; gramos: Dec }>();

    const sumar = (
      tienda: { id: string; nombre: string },
      tipo: TipoProducto,
      unidades: number,
      r: { costoArs: Dec | null; precioArs: Dec | null },
    ) => {
      const filaTienda = porTienda.get(tienda.id) ?? { tienda: tienda.nombre, ...nuevoValor() };
      const filaTipo = porTipo.get(tipo) ?? nuevoValor();
      for (const v of [total, filaTienda, filaTipo]) {
        v.unidades += unidades;
        if (r.costoArs) v.costo = v.costo.plus(r.costoArs.times(unidades));
        if (r.precioArs) v.precio = v.precio.plus(r.precioArs.times(unidades));
        else v.sinPrecio += unidades;
      }
      porTienda.set(tienda.id, filaTienda);
      porTipo.set(tipo, filaTipo);
    };

    const sumarGramos = (
      componentes: { metal: Metal; ley: Dec; porcentaje: Dec }[],
      pesoTotal: Dec | null,
    ) => {
      if (!pesoTotal) return;
      for (const c of componentes) {
        const clave = `${c.metal}-${c.ley.toString()}`;
        const fila = gramos.get(clave) ?? { metal: c.metal, ley: c.ley, gramos: cero() };
        fila.gramos = fila.gramos.plus(pesoTotal.times(c.porcentaje).div(100));
        gramos.set(clave, fila);
      }
    };

    for (const { producto, tienda, ...pieza } of piezas) {
      const r = await cotizar(producto, { pesoGramos: pieza.pesoGramos, hechuraUsd: pieza.hechuraUsd });
      sumar(tienda, producto.tipo, 1, r);
      sumarGramos(producto.componentes, pieza.pesoGramos);
    }

    for (const { producto, tienda, ...lote } of lotes) {
      const pesoUnitario = lote.pesoTotalGramos
        ? lote.pesoTotalGramos.div(lote.cantidadInicial).toDecimalPlaces(3)
        : null;
      const r = await cotizar(producto, { pesoGramos: pesoUnitario, hechuraUsd: lote.hechuraUsdUnitaria });
      sumar(tienda, producto.tipo, lote.cantidadDisponible, r);
      sumarGramos(producto.componentes, pesoUnitario ? pesoUnitario.times(lote.cantidadDisponible) : null);
    }

    return {
      cotizacion,
      total,
      porTienda: [...porTienda.values()].sort((a, b) => a.tienda.localeCompare(b.tienda)),
      porTipo: [...porTipo.entries()].map(([tipo, v]) => ({ tipo, ...v })),
      gramos: [...gramos.values()]
        .map((g) => ({ ...g, gramos: g.gramos.toDecimalPlaces(3) }))
        .sort((a, b) => a.metal.localeCompare(b.metal) || b.ley.comparedTo(a.ley)),
    };
  }

  /**
   * Ventas por período: total, tickets, ticket promedio y margen bruto (venta menos costo
   * del snapshot), por día, por tienda y por vendedor. Las devoluciones se informan aparte.
   */
  async ventas(query: QueryPeriodoDto, user: UsuarioActual) {
    const desde = query.desde?.slice(0, 10) ?? haceDias(29);
    const hasta = query.hasta?.slice(0, 10) ?? hoyArgentina();
    if (desde > hasta) throw new BadRequestException('La fecha "desde" es posterior a "hasta"');

    const tiendaId = await this.stock.filtroTiendas(user, query.tiendaId);
    const fecha = rangoDeFechas(desde, hasta);

    const [ventas, devoluciones] = await Promise.all([
      this.prisma.venta.findMany({
        where: { negocioId: user.negocioId, tiendaId, estado: EstadoVenta.CONFIRMADA, fecha },
        select: {
          fecha: true,
          total: true,
          tiendaId: true,
          usuarioId: true,
          tienda: { select: { nombre: true } },
          usuario: { select: { nombre: true, email: true } },
          items: { select: { cantidad: true, costoUnitario: true } },
        },
      }),
      this.prisma.devolucion.findMany({
        where: { negocioId: user.negocioId, fecha, venta: { tiendaId } },
        select: { montoArs: true },
      }),
    ]);

    const total = nuevoAcumulado();
    const porDia = new Map<string, Acumulado>();
    const porTienda = new Map<string, { tienda: string } & Acumulado>();
    const porVendedor = new Map<string, { vendedor: string } & Acumulado>();

    for (const v of ventas) {
      const costo = v.items.reduce((s, i) => s.plus(i.costoUnitario.times(i.cantidad)), cero());
      const dia = diaArgentina(v.fecha);
      const filas = [
        total,
        porDia.get(dia) ?? nuevoAcumulado(),
        porTienda.get(v.tiendaId) ?? { tienda: v.tienda.nombre, ...nuevoAcumulado() },
        porVendedor.get(v.usuarioId) ?? { vendedor: v.usuario.nombre ?? v.usuario.email, ...nuevoAcumulado() },
      ] as const;
      for (const a of filas) {
        a.cantidad += 1;
        a.total = a.total.plus(v.total);
        a.costo = a.costo.plus(costo);
      }
      porDia.set(dia, filas[1]);
      porTienda.set(v.tiendaId, filas[2]);
      porVendedor.set(v.usuarioId, filas[3]);
    }

    const devuelto = devoluciones.reduce((s, d) => s.plus(d.montoArs), cero());

    return {
      desde,
      hasta,
      total: { ...conPromedio(total), devuelto, neto: total.total.minus(devuelto) },
      porDia: [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([dia, a]) => ({ dia, ...conPromedio(a) })),
      porTienda: [...porTienda.values()]
        .map((a) => ({ tienda: a.tienda, ...conPromedio(a) }))
        .sort((a, b) => b.total.comparedTo(a.total)),
      porVendedor: [...porVendedor.values()]
        .map((a) => ({ vendedor: a.vendedor, ...conPromedio(a) }))
        .sort((a, b) => b.total.comparedTo(a.total)),
    };
  }

  /**
   * Caja del día: cobros por medio de pago, menos el vuelto y los reintegros de devoluciones.
   * El vendedor ve solo lo suyo (sección 4).
   */
  async caja(query: QueryCajaDto, user: UsuarioActual) {
    const dia = query.fecha?.slice(0, 10) ?? hoyArgentina();
    const tiendaId = await this.stock.filtroTiendas(user, query.tiendaId);
    const fecha = rangoDeFechas(dia, dia);
    const soloMias = user.rol === Rol.VENDEDOR ? { usuarioId: user.usuarioId } : {};

    const [ventas, devoluciones] = await Promise.all([
      this.prisma.venta.findMany({
        where: { negocioId: user.negocioId, tiendaId, estado: EstadoVenta.CONFIRMADA, fecha, ...soloMias },
        select: { total: true, vuelto: true, pagos: { select: { medio: true, monto: true, montoArs: true } } },
      }),
      this.prisma.devolucion.findMany({
        where: { negocioId: user.negocioId, fecha, venta: { tiendaId, ...soloMias } },
        select: { medioReintegro: true, montoArs: true },
      }),
    ]);

    const filas = new Map<MedioPago, FilaCaja>(
      MEDIOS.map((medio): [MedioPago, FilaCaja] => [
        medio,
        { medio, cobrado: cero(), dolares: cero(), reintegrado: cero() },
      ]),
    );
    let vuelto = cero();
    let vendido = cero();

    for (const v of ventas) {
      vendido = vendido.plus(v.total);
      vuelto = vuelto.plus(v.vuelto);
      for (const p of v.pagos) {
        const fila = filas.get(p.medio)!;
        fila.cobrado = fila.cobrado.plus(p.montoArs);
        if (p.medio === MedioPago.EFECTIVO_USD) fila.dolares = fila.dolares.plus(p.monto);
      }
    }
    for (const d of devoluciones) {
      const fila = filas.get(d.medioReintegro)!;
      fila.reintegrado = fila.reintegrado.plus(d.montoArs);
    }

    // El vuelto se da en pesos: sale del efectivo
    const porMedio = [...filas.values()].map((f) => ({
      ...f,
      vuelto: f.medio === MedioPago.EFECTIVO_ARS ? vuelto : cero(),
      neto: f.cobrado.minus(f.reintegrado).minus(f.medio === MedioPago.EFECTIVO_ARS ? vuelto : cero()),
    }));
    const reintegrado = devoluciones.reduce((s, d) => s.plus(d.montoArs), cero());

    return {
      fecha: dia,
      soloMias: user.rol === Rol.VENDEDOR,
      tickets: ventas.length,
      vendido,
      reintegrado,
      neto: vendido.minus(reintegrado),
      porMedio,
    };
  }
}
