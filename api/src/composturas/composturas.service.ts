import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PrecioGramoService } from '../precios/precio-gramo.service.js';
import { StockService } from '../stock/stock.service.js';
import { VentasService } from '../ventas/ventas.service.js';
import { numeroTicket } from '../ventas/ticket.service.js';
import {
  EstadoCompostura,
  MedioPago,
  Metal,
  Moneda,
  Prisma,
  TipoVenta,
} from '../generated/prisma/client.js';
import type { UsuarioActual } from '../auth/types.js';
import {
  CambiarEstadoDto,
  CotizarComposturaDto,
  CrearComposturaDto,
  EntregarComposturaDto,
  PresupuestoDto,
  QueryComposturasDto,
} from './dto/compostura.dto.js';

type Dec = Prisma.Decimal;
type Num = number | string | Prisma.Decimal;
const D = (v: Num) => new Prisma.Decimal(v);

// Piezas listas que el cliente no retira: se avisa pasados estos días
export const DIAS_SIN_RETIRAR = 15;

const ABIERTAS: EstadoCompostura[] = [
  EstadoCompostura.RECIBIDA,
  EstadoCompostura.PRESUPUESTADA,
  EstadoCompostura.EN_TALLER,
  EstadoCompostura.LISTA,
];
// Las que todavía no están listas (para "vencidas")
const EN_PROCESO: EstadoCompostura[] = [
  EstadoCompostura.RECIBIDA,
  EstadoCompostura.PRESUPUESTADA,
  EstadoCompostura.EN_TALLER,
];

// Cambios de estado permitidos desde POST /composturas/:id/estado
const TRANSICIONES: Record<EstadoCompostura, EstadoCompostura[]> = {
  RECIBIDA: [EstadoCompostura.CANCELADA],
  PRESUPUESTADA: [EstadoCompostura.EN_TALLER, EstadoCompostura.CANCELADA], // el cliente acepta o rechaza
  EN_TALLER: [EstadoCompostura.LISTA],
  LISTA: [], // se entrega con POST /composturas/:id/entregar
  ENTREGADA: [],
  CANCELADA: [],
};

const usuarioResumen = { select: { nombre: true, email: true } } as const;

const incluirCompostura = {
  tienda: { select: { id: true, nombre: true, direccion: true, localidad: true } },
  cliente: { select: { id: true, nombre: true, telefono: true, dni: true } },
  usuario: usuarioResumen,
  venta: { select: { id: true, puntoVenta: true, numero: true, total: true } },
  historial: { include: { usuario: usuarioResumen }, orderBy: { fecha: 'asc' } },
} satisfies Prisma.ComposturaInclude;

export type ComposturaCompleta = Prisma.ComposturaGetPayload<{ include: typeof incluirCompostura }>;

const incluirResumen = {
  tienda: { select: { id: true, nombre: true } },
  cliente: { select: { id: true, nombre: true, telefono: true } },
} satisfies Prisma.ComposturaInclude;

type ComposturaResumen = Prisma.ComposturaGetPayload<{ include: typeof incluirResumen }>;

interface DatosPrecio {
  metal?: Metal | null;
  ley?: Num | null;
  manoObra: Num;
  pesoAgregado?: Num | null;
  margenPct?: Num | null;
}

export interface PrecioCompostura {
  precio: Dec;
  manoObra: Dec;
  material: Dec; // costo del metal agregado
  pesoAgregado: Dec;
  margenPct: Dec;
  gramo: Dec | null;
  cotizacionMetalId: string | null;
}

// 000123
export const numeroOrden = (numero: number) => String(numero).padStart(6, '0');

// Hoy en Argentina (UTC-3), como fecha sin hora: para comparar con fechaEstimada
function hoyArgentina() {
  return new Date(new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10));
}

@Injectable()
export class ComposturasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly precioGramo: PrecioGramoService,
    private readonly stock: StockService,
    private readonly ventas: VentasService,
  ) {}

  // ---------- Consultas ----------

  async listar(query: QueryComposturasDto, user: UsuarioActual) {
    const where: Prisma.ComposturaWhereInput = {
      negocioId: user.negocioId,
      tiendaId: await this.stock.filtroTiendas(user, query.tiendaId),
      clienteId: query.clienteId,
      estado: query.estado ?? (query.abiertas === 'true' ? { in: ABIERTAS } : undefined),
    };
    const texto = query.buscar?.trim();
    if (texto) {
      const numero = Number(texto.replace(/\D/g, ''));
      where.OR = [
        { descripcion: { contains: texto, mode: 'insensitive' } },
        { cliente: { nombre: { contains: texto, mode: 'insensitive' } } },
        ...(numero ? [{ numero }] : []),
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.compostura.findMany({
        where,
        include: incluirResumen,
        orderBy: { numero: 'desc' },
        skip: (query.pagina - 1) * query.porPagina,
        take: query.porPagina,
      }),
      this.prisma.compostura.count({ where }),
    ]);

    return {
      items: items.map((c) => this.conAlertas(c)),
      total,
      pagina: query.pagina,
      porPagina: query.porPagina,
    };
  }

  async findOne(id: string, user: UsuarioActual) {
    const c = await this.prisma.compostura.findFirst({
      where: { id, negocioId: user.negocioId },
      include: incluirCompostura,
    });
    if (!c) throw new NotFoundException('Compostura no encontrada');
    await this.stock.asegurarTienda(c.tiendaId, user, false);
    return this.conAlertas(c);
  }

  // Abiertas por estado, vencidas y listas sin retirar (sección 9 y reporte de composturas)
  async alertas(user: UsuarioActual, tiendaId?: string) {
    const tiendas = await this.stock.filtroTiendas(user, tiendaId);
    const base: Prisma.ComposturaWhereInput = { negocioId: user.negocioId, tiendaId: tiendas };
    const limiteRetiro = new Date(Date.now() - DIAS_SIN_RETIRAR * 86_400_000);

    const [porEstado, vencidas, sinRetirar] = await Promise.all([
      this.prisma.compostura.groupBy({ by: ['estado'], where: base, _count: { _all: true } }),
      this.prisma.compostura.findMany({
        where: { ...base, estado: { in: EN_PROCESO }, fechaEstimada: { lt: hoyArgentina() } },
        include: incluirResumen,
        orderBy: { fechaEstimada: 'asc' },
        take: 50,
      }),
      this.prisma.compostura.findMany({
        where: { ...base, estado: EstadoCompostura.LISTA, listaEn: { lt: limiteRetiro } },
        include: incluirResumen,
        orderBy: { listaEn: 'asc' },
        take: 50,
      }),
    ]);

    const conteo = Object.fromEntries(Object.values(EstadoCompostura).map((e) => [e, 0])) as Record<
      EstadoCompostura,
      number
    >;
    for (const fila of porEstado) conteo[fila.estado] = fila._count._all;

    return {
      porEstado: conteo,
      vencidas: vencidas.map((c) => this.conAlertas(c)),
      sinRetirar: sinRetirar.map((c) => this.conAlertas(c)),
      diasSinRetirar: DIAS_SIN_RETIRAR,
    };
  }

  // Vista previa del precio (presupuesto o entrega), con el gramo de hoy
  async cotizar(dto: CotizarComposturaDto, user: UsuarioActual) {
    const ctx = await this.precioGramo.contextoNegocio(user.negocioId);
    const precio = await this.calcularPrecio(user.negocioId, dto, ctx.reglaRedondeo);
    return { ...precio, dolar: ctx.dolar.valorVenta };
  }

  // ---------- Alta ----------

  async crear(dto: CrearComposturaDto, user: UsuarioActual) {
    await this.stock.asegurarTienda(dto.tiendaId, user);
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: dto.clienteId, negocioId: user.negocioId },
      select: { id: true },
    });
    if (!cliente) throw new BadRequestException('El cliente no existe en tu negocio');
    if ((dto.metal && dto.ley == null) || (!dto.metal && dto.ley != null)) {
      throw new BadRequestException('Indicá el metal junto con su ley');
    }

    const sena = D(dto.sena ?? 0);
    if (sena.greaterThan(0) && !dto.medioSena) throw new BadRequestException('Indicá cómo se cobró la seña');

    // Si se presupuesta en el momento, la orden queda esperando la respuesta del cliente
    let presupuesto: PrecioCompostura | null = null;
    if (dto.manoObra != null) {
      const { reglaRedondeo } = await this.precioGramo.contextoNegocio(user.negocioId);
      presupuesto = await this.calcularPrecio(
        user.negocioId,
        { metal: dto.metal, ley: dto.ley, manoObra: dto.manoObra, pesoAgregado: dto.pesoAgregado, margenPct: dto.margenPct },
        reglaRedondeo,
      );
      if (sena.greaterThan(presupuesto.precio)) {
        throw new BadRequestException('La seña no puede superar el presupuesto');
      }
    }

    const id = await this.prisma.$transaction(async (tx) => {
      // Número de orden correlativo del negocio (si la transacción falla, se deshace)
      const { ultimoNumeroCompostura: numero } = await tx.negocio.update({
        where: { id: user.negocioId },
        data: { ultimoNumeroCompostura: { increment: 1 } },
        select: { ultimoNumeroCompostura: true },
      });

      const historial: Prisma.ComposturaEstadoUncheckedCreateWithoutComposturaInput[] = [
        {
          estado: EstadoCompostura.RECIBIDA,
          usuarioId: user.usuarioId,
          nota: sena.greaterThan(0) ? `Seña de $${sena.toFixed(2)}` : null,
        },
      ];
      if (presupuesto) {
        historial.push({
          estado: EstadoCompostura.PRESUPUESTADA,
          usuarioId: user.usuarioId,
          nota: `Presupuesto de $${presupuesto.precio.toFixed(2)}`,
        });
      }

      const creada = await tx.compostura.create({
        data: {
          negocioId: user.negocioId,
          tiendaId: dto.tiendaId,
          clienteId: dto.clienteId,
          usuarioId: user.usuarioId,
          numero,
          estado: presupuesto ? EstadoCompostura.PRESUPUESTADA : EstadoCompostura.RECIBIDA,
          descripcion: dto.descripcion.trim(),
          metal: dto.metal ?? null,
          ley: dto.ley ?? null,
          pesoEntrada: dto.pesoEntrada,
          pesoAportado: dto.pesoAportado ?? 0,
          fechaEstimada: dto.fechaEstimada ? new Date(dto.fechaEstimada.slice(0, 10)) : null,
          observaciones: dto.observaciones?.trim() || null,
          sena,
          medioSena: sena.greaterThan(0) ? dto.medioSena : null,
          manoObra: presupuesto?.manoObra ?? null,
          pesoAgregado: presupuesto?.pesoAgregado ?? null,
          margenPct: presupuesto?.margenPct ?? null,
          presupuesto: presupuesto?.precio ?? null,
          historial: { create: historial },
        },
      });
      return creada.id;
    });

    return this.findOne(id, user);
  }

  // ---------- Cambios de estado ----------

  // Presupuesto nuevo o corregido (antes de que pase al taller)
  async presupuestar(id: string, dto: PresupuestoDto, user: UsuarioActual) {
    const c = await this.buscar(id, user);
    if (c.estado !== EstadoCompostura.RECIBIDA && c.estado !== EstadoCompostura.PRESUPUESTADA) {
      throw new ConflictException('Solo se puede presupuestar antes de que la pieza pase al taller');
    }
    const { reglaRedondeo } = await this.precioGramo.contextoNegocio(user.negocioId);
    const p = await this.calcularPrecio(user.negocioId, { ...dto, metal: c.metal, ley: c.ley }, reglaRedondeo);
    if (c.sena.greaterThan(p.precio)) throw new BadRequestException('El presupuesto no puede ser menor que la seña');

    await this.prisma.$transaction(async (tx) => {
      await this.actualizarSiSigue(tx, c.id, c.estado, {
        estado: EstadoCompostura.PRESUPUESTADA,
        manoObra: p.manoObra,
        pesoAgregado: p.pesoAgregado,
        margenPct: p.margenPct,
        presupuesto: p.precio,
      });
      await this.registrar(tx, c.id, EstadoCompostura.PRESUPUESTADA, user, `Presupuesto de $${p.precio.toFixed(2)}`);
    });
    return this.findOne(id, user);
  }

  async cambiarEstado(id: string, dto: CambiarEstadoDto, user: UsuarioActual) {
    const c = await this.buscar(id, user);
    if (!TRANSICIONES[c.estado].includes(dto.estado)) {
      throw new ConflictException(`No se puede pasar de ${c.estado} a ${dto.estado}`);
    }
    const nota = dto.nota?.trim() || null;
    if (dto.estado === EstadoCompostura.CANCELADA && !nota) {
      throw new BadRequestException('Indicá el motivo de la cancelación');
    }

    const datos: Prisma.ComposturaUpdateManyMutationInput = { estado: dto.estado };
    if (dto.estado === EstadoCompostura.LISTA) datos.listaEn = new Date();
    if (dto.estado === EstadoCompostura.CANCELADA) datos.motivoCancelacion = nota;

    await this.prisma.$transaction(async (tx) => {
      await this.actualizarSiSigue(tx, c.id, c.estado, datos);
      await this.registrar(tx, c.id, dto.estado, user, nota);
    });
    return this.findOne(id, user);
  }

  // ---------- Entrega ----------

  /**
   * Registra el peso de salida y el precio final, cobra el saldo y genera una venta
   * de tipo SERVICIO con el snapshot de la cotización (sección 9 del documento).
   * La seña cobrada al recibir figura como un pago más de esa venta.
   */
  async entregar(id: string, dto: EntregarComposturaDto, user: UsuarioActual) {
    const c = await this.buscar(id, user);
    if (c.estado !== EstadoCompostura.LISTA) {
      throw new ConflictException('Solo se puede entregar una compostura que está lista');
    }
    await this.stock.asegurarTienda(c.tiendaId, user);

    const ctx = await this.precioGramo.contextoNegocio(user.negocioId);
    const p = await this.calcularPrecio(user.negocioId, { ...dto, metal: c.metal, ley: c.ley }, ctx.reglaRedondeo);
    const saldo = p.precio.minus(c.sena);
    if (saldo.isNegative()) throw new BadRequestException('La seña supera el precio final');

    const { pagos, vuelto } = this.ventas.calcularPagos(dto.pagos, saldo, ctx.dolar.valorVenta);
    if (c.sena.greaterThan(0)) {
      pagos.unshift({
        medio: c.medioSena ?? MedioPago.EFECTIVO_ARS,
        moneda: Moneda.ARS,
        monto: c.sena,
        montoArs: c.sena,
        cuotas: null,
        referencia: 'Seña al recibir',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const tienda = await tx.tienda.update({
        where: { id: c.tiendaId },
        data: { ultimoNumeroVenta: { increment: 1 } },
        select: { puntoVenta: true, ultimoNumeroVenta: true },
      });

      const venta = await tx.venta.create({
        data: {
          negocioId: user.negocioId,
          tiendaId: c.tiendaId,
          usuarioId: user.usuarioId,
          clienteId: c.clienteId,
          tipo: TipoVenta.SERVICIO,
          puntoVenta: tienda.puntoVenta,
          numero: tienda.ultimoNumeroVenta,
          subtotal: p.precio,
          descuentoPct: 0,
          descuentoTotal: 0,
          total: p.precio,
          vuelto,
          tipoDolar: ctx.tipoDolar,
          dolarUsado: ctx.dolar.valorVenta,
          cotizacionDolarId: ctx.dolar.id,
          items: {
            create: [
              {
                orden: 1,
                codigo: `CMP-${numeroOrden(c.numero)}`,
                descripcion: `Compostura: ${c.descripcion}`.slice(0, 200),
                cantidad: 1,
                precioListaUnitario: p.precio,
                descuentoPct: 0,
                subtotal: p.precio,
                costoUnitario: p.material, // el costo es el metal agregado; la mano de obra es ganancia
                margenPct: p.margenPct,
                metal: c.metal,
                ley: c.ley,
                pesoGramos: p.pesoAgregado.greaterThan(0) ? p.pesoAgregado : null,
                gramoUsado: p.gramo,
                cotizacionMetalId: p.cotizacionMetalId,
              },
            ],
          },
          pagos: { create: pagos },
        },
      });

      await this.actualizarSiSigue(tx, c.id, EstadoCompostura.LISTA, {
        estado: EstadoCompostura.ENTREGADA,
        pesoSalida: dto.pesoSalida,
        manoObra: p.manoObra,
        pesoAgregado: p.pesoAgregado,
        margenPct: p.margenPct,
        precioFinal: p.precio,
        entregadaEn: new Date(),
        ventaId: venta.id,
      });
      await this.registrar(
        tx,
        c.id,
        EstadoCompostura.ENTREGADA,
        user,
        `Ticket ${numeroTicket(tienda.puntoVenta, tienda.ultimoNumeroVenta)}`,
      );
    });

    return this.findOne(id, user);
  }

  // ---------- Internos ----------

  private async buscar(id: string, user: UsuarioActual) {
    const c = await this.prisma.compostura.findFirst({ where: { id, negocioId: user.negocioId } });
    if (!c) throw new NotFoundException('Compostura no encontrada');
    await this.stock.asegurarTienda(c.tiendaId, user, false);
    return c;
  }

  private async calcularPrecio(negocioId: string, d: DatosPrecio, redondeo: number): Promise<PrecioCompostura> {
    const manoObra = D(d.manoObra);
    const pesoAgregado = D(d.pesoAgregado ?? 0);
    const margenPct = D(d.margenPct ?? 0);

    let gramo: Dec | null = null;
    let cotizacionMetalId: string | null = null;
    let material = D(0);
    if (pesoAgregado.greaterThan(0)) {
      if (!d.metal || d.ley == null) {
        throw new BadRequestException('Para cobrar metal agregado, la compostura tiene que tener metal y ley');
      }
      const calculado = await this.precioGramo.calcular(negocioId, d.metal, D(d.ley).toNumber());
      gramo = calculado.precioArs;
      cotizacionMetalId = calculado.metalUsdOz?.cotizacionId ?? null;
      material = pesoAgregado.times(gramo).toDecimalPlaces(2);
    }

    // Mano de obra + material × (1 + margen), redondeado con la regla del negocio
    const sinRedondear = manoObra.plus(material.times(margenPct.div(100).plus(1)));
    const precio = sinRedondear.div(redondeo).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).times(redondeo);

    return { precio, manoObra, material, pesoAgregado, margenPct, gramo, cotizacionMetalId };
  }

  // Cambia solo si nadie la modificó mientras tanto
  private async actualizarSiSigue(
    tx: Prisma.TransactionClient,
    id: string,
    estadoActual: EstadoCompostura,
    datos: Prisma.ComposturaUpdateManyMutationInput,
  ) {
    const r = await tx.compostura.updateMany({ where: { id, estado: estadoActual }, data: datos });
    if (r.count === 0) throw new ConflictException('La compostura cambió de estado, volvé a intentar');
  }

  private registrar(
    tx: Prisma.TransactionClient,
    composturaId: string,
    estado: EstadoCompostura,
    user: UsuarioActual,
    nota: string | null,
  ) {
    return tx.composturaEstado.create({ data: { composturaId, estado, usuarioId: user.usuarioId, nota } });
  }

  // Agrega las marcas de alerta que muestran las pantallas
  private conAlertas<T extends ComposturaResumen | ComposturaCompleta>(c: T) {
    const hoy = hoyArgentina();
    const limiteRetiro = new Date(Date.now() - DIAS_SIN_RETIRAR * 86_400_000);
    return {
      ...c,
      numeroFormateado: numeroOrden(c.numero),
      vencida: EN_PROCESO.includes(c.estado) && c.fechaEstimada !== null && c.fechaEstimada < hoy,
      sinRetirar: c.estado === EstadoCompostura.LISTA && c.listaEn !== null && c.listaEn < limiteRetiro,
    };
  }
}
