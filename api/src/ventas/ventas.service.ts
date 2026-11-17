import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PrecioGramoService } from '../precios/precio-gramo.service.js';
import { StockService } from '../stock/stock.service.js';
import {
  ProductosService,
  incluir as incluirProducto,
  type ProductoConCategoria,
} from '../productos/productos.service.js';
import { calcularCosto, calcularPrecio } from '../productos/calculo-precio.js';
import {
  EstadoPieza,
  MedioPago,
  Metal,
  ModoStock,
  Moneda,
  Prisma,
  Rol,
  TipoDolar,
  TipoMovimiento,
} from '../generated/prisma/client.js';
import type { UsuarioActual } from '../auth/types.js';
import { TicketService, numeroTicket } from './ticket.service.js';
import { CotizarVentaDto, CrearVentaDto, PagoDto } from './dto/crear-venta.dto.js';
import { BuscarParaVenderDto, QueryVentasDto } from './dto/query-ventas.dto.js';

type Dec = Prisma.Decimal;
const D = (v: number | string | Prisma.Decimal) => new Prisma.Decimal(v);

type GramoCalculado = Awaited<ReturnType<PrecioGramoService['calcular']>>;
type ContextoNegocio = Awaited<ReturnType<PrecioGramoService['contextoNegocio']>>;

const incluirVenta = {
  items: { orderBy: { orden: 'asc' } },
  pagos: true,
  tienda: { select: { id: true, nombre: true, direccion: true, localidad: true } },
  usuario: { select: { nombre: true, email: true } },
  anuladaPor: { select: { nombre: true, email: true } },
  devoluciones: {
    include: { items: true, usuario: { select: { nombre: true, email: true } } },
    orderBy: { fecha: 'asc' },
  },
} satisfies Prisma.VentaInclude;

export type VentaCompleta = Prisma.VentaGetPayload<{ include: typeof incluirVenta }>;

// Una línea del ticket ya calculada (todavía sin guardar)
export interface LineaVenta {
  orden: number;
  numeroItem: number; // a qué ítem del carrito pertenece (un ítem por lote puede partirse en varias líneas)
  productoId: string;
  piezaId: string | null;
  loteId: string | null;
  codigo: string;
  descripcion: string;
  cantidad: number;
  precioListaUnitario: Dec;
  descuentoPct: Dec;
  subtotal: Dec;
  costoUnitario: Dec;
  margenPct: Dec;
  metal: Metal | null;
  ley: Dec | null;
  pesoGramos: Dec | null;
  gramoUsado: Dec | null;
  cotizacionMetalId: string | null;
  detalleCosto: Record<string, Dec>;
}

export interface VentaPreparada {
  tiendaId: string;
  lineas: LineaVenta[];
  subtotal: Dec;
  descuentoPct: Dec;
  descuentoTotal: Dec;
  descuentoEfectivoPct: Dec;
  total: Dec;
  tipoDolar: TipoDolar;
  dolar: Dec;
  cotizacionDolarId: string;
  cotizacionFecha: Date;
}

@Injectable()
export class VentasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly precioGramo: PrecioGramoService,
    private readonly stock: StockService,
    private readonly productos: ProductosService,
    private readonly tickets: TicketService,
  ) {}

  // ---------- Cotizar y confirmar ----------

  // Calcula todo sin guardar nada (vista previa del carrito)
  async cotizar(dto: CotizarVentaDto, user: UsuarioActual) {
    return this.presentarPreparada(await this.preparar(dto, user), user);
  }

  async crear(dto: CrearVentaDto, user: UsuarioActual) {
    const p = await this.preparar(dto, user);
    const { pagos, vuelto } = this.calcularPagos(dto.pagos, p.total, p.dolar);

    const venta = await this.prisma.$transaction(async (tx) => {
      // Número correlativo de la tienda. Si la transacción falla, el incremento se deshace.
      const tienda = await tx.tienda.update({
        where: { id: p.tiendaId },
        data: { ultimoNumeroVenta: { increment: 1 } },
        select: { puntoVenta: true, ultimoNumeroVenta: true },
      });

      const creada = await tx.venta.create({
        data: {
          negocioId: user.negocioId,
          tiendaId: p.tiendaId,
          usuarioId: user.usuarioId,
          puntoVenta: tienda.puntoVenta,
          numero: tienda.ultimoNumeroVenta,
          subtotal: p.subtotal,
          descuentoPct: p.descuentoPct,
          descuentoTotal: p.descuentoTotal,
          total: p.total,
          vuelto,
          tipoDolar: p.tipoDolar,
          dolarUsado: p.dolar,
          cotizacionDolarId: p.cotizacionDolarId,
          items: {
            create: p.lineas.map(({ detalleCosto, numeroItem, ...linea }) => linea),
          },
          pagos: { create: pagos },
        },
      });

      // Descuento de stock: atómico, si alguien vendió lo mismo un instante antes, falla todo
      for (const l of p.lineas) {
        if (l.piezaId) {
          const r = await tx.pieza.updateMany({
            where: { id: l.piezaId, estado: EstadoPieza.DISPONIBLE },
            data: { estado: EstadoPieza.VENDIDA },
          });
          if (r.count === 0) {
            throw new ConflictException(`La pieza ${l.codigo} se acaba de vender o cambió de estado`);
          }
        } else {
          await this.stock.descontarLote(tx, l.loteId!, l.cantidad);
        }

        await tx.movimientoStock.create({
          data: {
            negocioId: user.negocioId,
            productoId: l.productoId,
            tiendaId: p.tiendaId,
            piezaId: l.piezaId,
            loteId: l.loteId,
            usuarioId: user.usuarioId,
            tipo: TipoMovimiento.VENTA,
            cantidad: -l.cantidad,
            referencia: creada.id,
          },
        });
      }
      return creada;
    });

    return this.findOne(venta.id, user);
  }

  // ---------- Consultas ----------

  async listar(query: QueryVentasDto, user: UsuarioActual) {
    const where: Prisma.VentaWhereInput = await this.filtroVisibilidad(user);
    if (query.tiendaId) {
      await this.stock.asegurarTienda(query.tiendaId, user, false);
      where.tiendaId = query.tiendaId;
    }
    // Las fechas se interpretan en hora de Argentina (UTC-3, sin horario de verano)
    if (query.desde || query.hasta) {
      const inicioDelDia = (fecha: string) => new Date(`${fecha.slice(0, 10)}T00:00:00-03:00`);
      where.fecha = {
        gte: query.desde ? inicioDelDia(query.desde) : undefined,
        // "hasta" incluye todo ese día
        lt: query.hasta ? new Date(inicioDelDia(query.hasta).getTime() + 86_400_000) : undefined,
      };
    }

    const [ventas, total] = await this.prisma.$transaction([
      this.prisma.venta.findMany({
        where,
        select: {
          id: true,
          puntoVenta: true,
          numero: true,
          fecha: true,
          total: true,
          estado: true,
          tienda: { select: { nombre: true } },
          usuario: { select: { nombre: true } },
          _count: { select: { items: true, devoluciones: true } },
        },
        orderBy: { fecha: 'desc' },
        skip: (query.pagina - 1) * query.porPagina,
        take: query.porPagina,
      }),
      this.prisma.venta.count({ where }),
    ]);

    return {
      items: ventas.map((v) => ({ ...v, numeroFormateado: numeroTicket(v.puntoVenta, v.numero) })),
      total,
      pagina: query.pagina,
      porPagina: query.porPagina,
    };
  }

  async findOne(id: string, user: UsuarioActual) {
    return this.presentarVenta(await this.buscar(id, user), user);
  }

  async ticket(id: string, user: UsuarioActual) {
    const venta = await this.buscar(id, user);
    const negocio = await this.prisma.negocio.findUniqueOrThrow({
      where: { id: user.negocioId },
      select: { nombre: true, cuit: true },
    });
    const buffer = await this.tickets.generar(venta, negocio);
    return { buffer, nombreArchivo: `ticket-${numeroTicket(venta.puntoVenta, venta.numero)}.pdf` };
  }
  // Piezas disponibles y productos por lote con stock en la tienda, para el buscador del punto de venta
  // Piezas disponibles y lotes con stock en la tienda, cada uno con su precio de hoy.
  // Cada lote aparece por separado para que el vendedor elija de cuál vende.
  async buscarParaVender(dto: BuscarParaVenderDto, user: UsuarioActual) {
    await this.stock.asegurarTienda(dto.tiendaId, user);
    const texto = dto.q.trim();

    const productos = await this.prisma.producto.findMany({
      where: {
        negocioId: user.negocioId,
        activo: true,
        OR: [
          { nombre: { contains: texto, mode: 'insensitive' } },
          { codigo: { contains: texto, mode: 'insensitive' } },
          { codigoBarras: texto },
        ],
      },
      include: incluirProducto,
      orderBy: { nombre: 'asc' },
      take: 20,
    });

    const idsUnicos = productos.filter((p) => p.modoStock === ModoStock.UNICO).map((p) => p.id);
    const idsLote = productos.filter((p) => p.modoStock === ModoStock.LOTE).map((p) => p.id);

    const [piezas, lotes] = await Promise.all([
      this.prisma.pieza.findMany({
        where: {
          negocioId: user.negocioId,
          tiendaId: dto.tiendaId,
          estado: EstadoPieza.DISPONIBLE,
          OR: [{ codigo: { contains: texto, mode: 'insensitive' } }, { productoId: { in: idsUnicos } }],
        },
        include: { producto: { include: incluirProducto } },
        orderBy: { codigo: 'asc' },
        take: 30,
      }),
      this.prisma.lote.findMany({
        where: { productoId: { in: idsLote }, tiendaId: dto.tiendaId, cantidadDisponible: { gt: 0 } },
        orderBy: { fechaIngreso: 'asc' }, // el más antiguo primero: Lote 1, Lote 2...
      }),
    ]);

    const { cotizar } = await this.productos.crearCotizador(user.negocioId);

    const piezasConPrecio = await Promise.all(
      piezas.map(async (p) => ({
        piezaId: p.id,
        codigo: p.codigo,
        pesoGramos: p.pesoGramos,
        producto: { id: p.producto.id, codigo: p.producto.codigo, nombre: p.producto.nombre },
        precioArs: (await cotizar(p.producto, { pesoGramos: p.pesoGramos, hechuraUsd: p.hechuraUsd })).precioArs,
      })),
    );

    // Numeración por producto dentro de la tienda: Lote 1 es el más antiguo
    const numeroPorProducto = new Map<string, number>();
    const lotesNumerados = lotes.map((l) => {
      const numero = (numeroPorProducto.get(l.productoId) ?? 0) + 1;
      numeroPorProducto.set(l.productoId, numero);
      return { lote: l, numero };
    });

    const lotesConPrecio = await Promise.all(
      lotesNumerados.map(async ({ lote, numero }) => {
        const producto = productos.find((p) => p.id === lote.productoId)!;
        const pesoUnitario = lote.pesoTotalGramos
          ? lote.pesoTotalGramos.div(lote.cantidadInicial).toDecimalPlaces(3)
          : null;
        const precio = await cotizar(producto, { pesoGramos: pesoUnitario, hechuraUsd: lote.hechuraUsdUnitaria });
        return {
          loteId: lote.id,
          numeroLote: numero,
          fechaIngreso: lote.fechaIngreso,
          disponible: lote.cantidadDisponible,
          pesoUnitario,
          precioArs: precio.precioArs,
          producto: { id: producto.id, codigo: producto.codigo, nombre: producto.nombre },
        };
      }),
    );

    // Agrupados por producto y, dentro de cada uno, del más antiguo al más nuevo
    lotesConPrecio.sort(
      (a, b) => a.producto.nombre.localeCompare(b.producto.nombre) || a.numeroLote - b.numeroLote,
    );

    return { piezas: piezasConPrecio, lotes: lotesConPrecio };
  }
  // ---------- Preparación del carrito ----------

  private async preparar(dto: CotizarVentaDto, user: UsuarioActual): Promise<VentaPreparada> {
    await this.stock.asegurarTienda(dto.tiendaId, user);
    const ctx = await this.precioGramo.contextoNegocio(user.negocioId);

    const gramos = new Map<string, Promise<GramoCalculado>>();
    const piezasUsadas = new Set<string>();
    const usadoPorLote = new Map<string, number>(); // por si el mismo producto aparece dos veces
    const lineas: LineaVenta[] = [];

    for (const [i, item] of dto.items.entries()) {
      const n = i + 1;
      const descuento = item.descuentoPct ?? 0;

      if (item.piezaId) {
        // ----- Pieza única -----
        if (piezasUsadas.has(item.piezaId)) throw new BadRequestException(`Ítem ${n}: la pieza está repetida`);
        piezasUsadas.add(item.piezaId);

        const pieza = await this.prisma.pieza.findFirst({
          where: { id: item.piezaId, negocioId: user.negocioId },
          include: { producto: { include: incluirProducto } },
        });
        if (!pieza) throw new NotFoundException(`Ítem ${n}: pieza no encontrada`);
        if (pieza.tiendaId !== dto.tiendaId) {
          throw new BadRequestException(`Ítem ${n}: la pieza ${pieza.codigo} está en otra tienda`);
        }
        if (pieza.estado !== EstadoPieza.DISPONIBLE) {
          throw new ConflictException(`Ítem ${n}: la pieza ${pieza.codigo} no está disponible (${pieza.estado})`);
        }

        lineas.push(
          await this.armarLinea(
            pieza.producto,
            {
              piezaId: pieza.id,
              loteId: null,
              codigo: pieza.codigo,
              cantidad: 1,
              pesoGramos: pieza.pesoGramos,
              hechuraUsd: pieza.hechuraUsd,
            },
            descuento,
            lineas.length + 1,
            n,
            ctx,
            gramos,
            user,
          ),
        );
      } else if (item.productoId) {
        // ----- Producto por lote (FIFO) -----
        const producto = await this.prisma.producto.findFirst({
          where: { id: item.productoId, negocioId: user.negocioId, activo: true },
          include: incluirProducto,
        });
        if (!producto) throw new NotFoundException(`Ítem ${n}: producto no encontrado o inactivo`);
        if (producto.modoStock !== ModoStock.LOTE) {
          throw new BadRequestException(`Ítem ${n}: ${producto.codigo} se vende por pieza: indicá piezaId`);
        }

        const lotes = await this.prisma.lote.findMany({
          where: {
            id: item.loteId,
            productoId: producto.id,
            tiendaId: dto.tiendaId,
            cantidadDisponible: { gt: 0 },
          },
          orderBy: { fechaIngreso: 'asc' }, // el más antiguo primero
        });

        let restante = item.cantidad ?? 1;
        for (const lote of lotes) {
          if (restante === 0) break;
          const disponible = lote.cantidadDisponible - (usadoPorLote.get(lote.id) ?? 0);
          if (disponible <= 0) continue;

          const toma = Math.min(restante, disponible);
          restante -= toma;
          usadoPorLote.set(lote.id, (usadoPorLote.get(lote.id) ?? 0) + toma);

          // En un lote, el peso por unidad es el promedio
          const pesoUnitario = lote.pesoTotalGramos
            ? lote.pesoTotalGramos.div(lote.cantidadInicial).toDecimalPlaces(3)
            : null;

          lineas.push(
            await this.armarLinea(
              producto,
              {
                piezaId: null,
                loteId: lote.id,
                codigo: producto.codigo,
                cantidad: toma,
                pesoGramos: pesoUnitario,
                hechuraUsd: lote.hechuraUsdUnitaria,
              },
              descuento,
              lineas.length + 1,
              n,
              ctx,
              gramos,
              user,
            ),
          );
        }
        if (restante > 0) {
          throw new ConflictException(
            `Ítem ${n}: no hay stock suficiente de ${producto.codigo} en esta tienda (faltan ${restante})`,
          );
        }
      } else {
        throw new BadRequestException(`Ítem ${n}: indicá piezaId o productoId`);
      }
    }

    // ----- Totales -----
    const subtotal = lineas.reduce((s, l) => s.plus(l.precioListaUnitario.times(l.cantidad)), D(0));
    const sumaItems = lineas.reduce((s, l) => s.plus(l.subtotal), D(0));
    const descuentoPct = D(dto.descuentoPct ?? 0);
    const total = sumaItems.times(D(1).minus(descuentoPct.div(100))).toDecimalPlaces(2);
    const descuentoTotal = subtotal.minus(total);
    const descuentoEfectivoPct = subtotal.isZero()
      ? D(0)
      : descuentoTotal.div(subtotal).times(100).toDecimalPlaces(2);

    // El vendedor tiene un tope de descuento; admin y gerente no
    if (user.rol === Rol.VENDEDOR && descuentoEfectivoPct.greaterThan(0)) {
      const { topeDescuento } = await this.prisma.membresia.findUniqueOrThrow({
        where: { id: user.membresiaId },
        select: { topeDescuento: true },
      });
      if (descuentoEfectivoPct.greaterThan(topeDescuento)) {
        throw new ForbiddenException(
          `El descuento (${descuentoEfectivoPct.toString()} %) supera tu tope de ${topeDescuento.toString()} %`,
        );
      }
    }

    return {
      tiendaId: dto.tiendaId,
      lineas,
      subtotal,
      descuentoPct,
      descuentoTotal,
      descuentoEfectivoPct,
      total,
      tipoDolar: ctx.tipoDolar,
      dolar: ctx.dolar.valorVenta,
      cotizacionDolarId: ctx.dolar.id,
      cotizacionFecha: ctx.dolar.fechaHora,
    };
  }

  private async armarLinea(
    producto: ProductoConCategoria,
    s: {
      piezaId: string | null;
      loteId: string | null;
      codigo: string;
      cantidad: number;
      pesoGramos: Dec | null;
      hechuraUsd: Dec | null;
    },
    descuentoPct: number,
    orden: number,
    numeroItem: number,
    ctx: ContextoNegocio,
    gramos: Map<string, Promise<GramoCalculado>>,
    user: UsuarioActual,
  ): Promise<LineaVenta> {
    // Precio del gramo (una sola consulta por metal y ley)
    let gramo: GramoCalculado | null = null;
    if (producto.metal && producto.ley) {
      const clave = `${producto.metal}-${producto.ley.toString()}`;
      if (!gramos.has(clave)) {
        gramos.set(clave, this.precioGramo.calcular(user.negocioId, producto.metal, producto.ley.toNumber()));
      }
      gramo = await gramos.get(clave)!;
    }

    const pesoGramos = s.pesoGramos ?? producto.pesoGramos;
    const costo = calcularCosto(
      { ...producto, pesoGramos, hechuraUsd: s.hechuraUsd },
      { precioGramo: gramo?.precioArs ?? null, dolar: ctx.dolar.valorVenta },
    );
    if (!costo.ok) {
      throw new BadRequestException(`Ítem ${numeroItem} (${producto.codigo}): ${costo.motivo}`);
    }

    const margenPct = producto.margenPct ?? producto.categoria?.margenDefectoPct ?? null;
    if (margenPct === null) {
      throw new BadRequestException(`Ítem ${numeroItem} (${producto.codigo}): no tiene margen definido`);
    }

    const { precio } = calcularPrecio(costo.costo, margenPct, ctx.reglaRedondeo);
    const descuento = D(descuentoPct);
    const subtotal = precio
      .times(s.cantidad)
      .times(D(1).minus(descuento.div(100)))
      .toDecimalPlaces(2);

    return {
      orden,
      numeroItem,
      productoId: producto.id,
      piezaId: s.piezaId,
      loteId: s.loteId,
      codigo: s.codigo,
      descripcion: producto.nombre,
      cantidad: s.cantidad,
      precioListaUnitario: precio,
      descuentoPct: descuento,
      subtotal,
      costoUnitario: costo.costo,
      margenPct,
      metal: producto.metal,
      ley: producto.ley,
      pesoGramos,
      gramoUsado: gramo?.precioArs ?? null,
      cotizacionMetalId: gramo?.metalUsdOz?.cotizacionId ?? null,
      detalleCosto: costo.detalle,
    };
  }

  // Convierte cada pago a pesos y controla que cubran el total
  private calcularPagos(pagos: PagoDto[], total: Dec, dolar: Dec) {
    const lista = pagos.map((p) => {
      const enDolares = p.medio === MedioPago.EFECTIVO_USD;
      const monto = D(p.monto);
      return {
        medio: p.medio,
        moneda: enDolares ? Moneda.USD : Moneda.ARS,
        monto,
        montoArs: enDolares ? monto.times(dolar).toDecimalPlaces(2) : monto,
        cuotas: p.medio === MedioPago.CREDITO ? (p.cuotas ?? 1) : null,
        referencia: p.referencia ?? null,
      };
    });

    const pagado = lista.reduce((s, p) => s.plus(p.montoArs), D(0));
    if (pagado.lessThan(total)) {
      throw new BadRequestException(`Faltan $${total.minus(pagado).toFixed(2)} para cubrir el total`);
    }

    const vuelto = pagado.minus(total);
    const hayEfectivo = lista.some(
      (p) => p.medio === MedioPago.EFECTIVO_ARS || p.medio === MedioPago.EFECTIVO_USD,
    );
    if (vuelto.greaterThan(0) && !hayEfectivo) {
      throw new BadRequestException(
        `Los pagos superan el total en $${vuelto.toFixed(2)}. Solo se puede dar vuelto con efectivo.`,
      );
    }
    return { pagos: lista, vuelto };
  }

  // ---------- Internos ----------

  // ADMIN: todas. GERENTE: las de sus tiendas. VENDEDOR: solo las suyas.
  private async filtroVisibilidad(user: UsuarioActual): Promise<Prisma.VentaWhereInput> {
    if (user.rol === Rol.ADMIN) return { negocioId: user.negocioId };
    if (user.rol === Rol.VENDEDOR) return { negocioId: user.negocioId, usuarioId: user.usuarioId };
    return { negocioId: user.negocioId, tiendaId: await this.stock.filtroTiendas(user) };
  }

  private async buscar(id: string, user: UsuarioActual) {
    const venta = await this.prisma.venta.findFirst({
      where: { id, ...(await this.filtroVisibilidad(user)) },
      include: incluirVenta,
    });
    if (!venta) throw new NotFoundException('Venta no encontrada');
    return venta;
  }

  // El vendedor no ve costos ni márgenes
  // Agrega cuánto se devolvió de cada ítem. El vendedor no ve costos ni márgenes.
  private presentarVenta(v: VentaCompleta, user: UsuarioActual) {
    const devuelto = new Map<string, number>();
    for (const d of v.devoluciones) {
      for (const i of d.items) devuelto.set(i.ventaItemId, (devuelto.get(i.ventaItemId) ?? 0) + i.cantidad);
    }

    const items = v.items.map((item) => {
      const conDevuelto = { ...item, cantidadDevuelta: devuelto.get(item.id) ?? 0 };
      if (user.rol !== Rol.VENDEDOR) return conDevuelto;
      const { costoUnitario, margenPct, ...publico } = conDevuelto;
      return publico;
    });

    const totalDevuelto = v.devoluciones.reduce((s, d) => s.plus(d.montoArs), new Prisma.Decimal(0));
    return { ...v, items, totalDevuelto, numeroFormateado: numeroTicket(v.puntoVenta, v.numero) };
  }

  private presentarPreparada(p: VentaPreparada, user: UsuarioActual) {
    if (user.rol !== Rol.VENDEDOR) return p;
    return {
      ...p,
      lineas: p.lineas.map(({ costoUnitario, margenPct, detalleCosto, ...linea }) => linea),
    };
  }
}