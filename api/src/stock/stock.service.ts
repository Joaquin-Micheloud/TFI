import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PrecioGramoService } from '../precios/precio-gramo.service.js';
import {
  ProductosService,
  incluir as incluirProducto,
  type PrecioCalculado,
  type ProductoConCategoria,
} from '../productos/productos.service.js';
import {
  EstadoPieza,
  ModoStock,
  Moneda,
  Prisma,
  Rol,
  TipoMovimiento,
  TipoProducto,
} from '../generated/prisma/client.js';
import { calcularHechuraUsd } from '../productos/calculo-precio.js';
import { esErrorUnico } from '../common/prisma-errors.js';
import type { UsuarioActual } from '../auth/types.js';
import { IngresoPiezasDto } from './dto/ingreso-piezas.dto.js';
import { IngresoLoteDto } from './dto/ingreso-lote.dto.js';
import { BajaLoteDto, BajaPiezaDto } from './dto/baja.dto.js';
import { AjusteLoteDto } from './dto/ajuste-lote.dto.js';
import { QueryMovimientosDto, QueryStockDto } from './dto/query-stock.dto.js';

const D = (v: number | string | Prisma.Decimal) => new Prisma.Decimal(v);

// Campos que el vendedor no puede ver
const CAMPOS_COSTO = [
  'precioCompra',
  'hechuraUsd',
  'hechuraUsdUnitaria',
  'precioCompraTotal',
  'monedaCompra',
  'dolarAlta',
  'gramoAlta',
];

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly precioGramo: PrecioGramoService,
    private readonly productos: ProductosService,
  ) {}

  // ---------- Ingresos ----------

  async ingresarPiezas(dto: IngresoPiezasDto, user: UsuarioActual) {
    const producto = await this.buscarProducto(dto.productoId, user);
    if (producto.modoStock !== ModoStock.UNICO) {
      throw new BadRequestException('Este producto se maneja por lote: usá POST /stock/lotes');
    }
    await this.asegurarTienda(dto.tiendaId, user);

    const alta = await this.cotizacionAlta(producto, user);
    const advertencias: string[] = [];

    // Se calcula todo antes de escribir: si una pieza tiene un error, no se guarda ninguna
    const datos = dto.piezas.map((p, i) => {
      const peso = D(p.pesoGramos);
      let precioCompra: Prisma.Decimal | null = null;
      let hechuraUsd: Prisma.Decimal | null = null;

      if (producto.tipo === TipoProducto.REVENTA) {
        if (p.precioCompra == null) {
          throw new BadRequestException(`Pieza ${i + 1}: precioCompra es obligatorio en reventa`);
        }
        precioCompra = D(p.precioCompra);
        hechuraUsd = calcularHechuraUsd(precioCompra, peso, alta.gramo!, alta.dolar);
        if (hechuraUsd.isNegative()) {
          advertencias.push(
            `Pieza ${i + 1}: se compró por debajo del valor del metal (hechura USD ${hechuraUsd.toFixed(2)})`,
          );
        }
      }
      return { peso, precioCompra, hechuraUsd, codigo: p.codigo?.trim().toUpperCase() };
    });

    const tipoMovimiento =
      producto.tipo === TipoProducto.ELABORACION
        ? TipoMovimiento.INGRESO_ELABORACION
        : TipoMovimiento.INGRESO_COMPRA;

    try {
      const piezas = await this.prisma.$transaction(async (tx) => {
        let siguiente = (await tx.pieza.count({ where: { productoId: producto.id } })) + 1;
        const creadas = [];

        for (const d of datos) {
          const codigo = d.codigo ?? `${producto.codigo}-${String(siguiente++).padStart(4, '0')}`;
          const pieza = await tx.pieza.create({
            data: {
              negocioId: user.negocioId,
              productoId: producto.id,
              tiendaId: dto.tiendaId,
              codigo,
              pesoGramos: d.peso,
              precioCompra: d.precioCompra,
              hechuraUsd: d.hechuraUsd,
              dolarAlta: alta.dolar,
              gramoAlta: alta.gramo,
            },
          });
          await tx.movimientoStock.create({
            data: {
              negocioId: user.negocioId,
              productoId: producto.id,
              tiendaId: dto.tiendaId,
              piezaId: pieza.id,
              usuarioId: user.usuarioId,
              tipo: tipoMovimiento,
              cantidad: 1,
            },
          });
          creadas.push(pieza);
        }
        return creadas;
      });

      return { piezas, advertencias };
    } catch (e) {
      if (esErrorUnico(e)) throw new ConflictException('Ya existe una pieza con alguno de esos códigos');
      throw e;
    }
  }

  async ingresarLote(dto: IngresoLoteDto, user: UsuarioActual) {
    const producto = await this.buscarProducto(dto.productoId, user);
    if (producto.modoStock !== ModoStock.LOTE) {
      throw new BadRequestException('Este producto se maneja por pieza única: usá POST /stock/piezas');
    }
    await this.asegurarTienda(dto.tiendaId, user);

    const esFantasia = producto.tipo === TipoProducto.FANTASIA;
    const errores: string[] = [];
    if (!esFantasia && dto.pesoTotalGramos == null) {
      errores.push('pesoTotalGramos es obligatorio en productos de metal');
    }
    if (producto.tipo === TipoProducto.REVENTA && dto.precioCompraTotal == null) {
      errores.push('precioCompraTotal es obligatorio en reventa');
    }
    if (errores.length > 0) throw new BadRequestException(errores);

    const alta = await this.cotizacionAlta(producto, user);
    const advertencias: string[] = [];
    let hechuraUsdUnitaria: Prisma.Decimal | null = null;

    // En un lote se trabaja con valores por unidad
    if (producto.tipo === TipoProducto.REVENTA) {
      const cantidad = D(dto.cantidad);
      hechuraUsdUnitaria = calcularHechuraUsd(
        D(dto.precioCompraTotal!).div(cantidad),
        D(dto.pesoTotalGramos!).div(cantidad),
        alta.gramo!,
        alta.dolar,
      );
      if (hechuraUsdUnitaria.isNegative()) {
        advertencias.push(
          `El lote se compró por debajo del valor del metal (hechura USD ${hechuraUsdUnitaria.toFixed(2)} por unidad)`,
        );
      }
    }

    const tipoMovimiento =
      producto.tipo === TipoProducto.ELABORACION
        ? TipoMovimiento.INGRESO_ELABORACION
        : TipoMovimiento.INGRESO_COMPRA;

    const lote = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.lote.create({
        data: {
          negocioId: user.negocioId,
          productoId: producto.id,
          tiendaId: dto.tiendaId,
          cantidadInicial: dto.cantidad,
          cantidadDisponible: dto.cantidad,
          pesoTotalGramos: esFantasia ? null : dto.pesoTotalGramos,
          precioCompraTotal: dto.precioCompraTotal,
          monedaCompra: esFantasia ? (producto.monedaCompra ?? Moneda.ARS) : Moneda.ARS,
          hechuraUsdUnitaria,
          dolarAlta: alta.dolar,
          gramoAlta: alta.gramo,
        },
      });
      await tx.movimientoStock.create({
        data: {
          negocioId: user.negocioId,
          productoId: producto.id,
          tiendaId: dto.tiendaId,
          loteId: creado.id,
          usuarioId: user.usuarioId,
          tipo: tipoMovimiento,
          cantidad: dto.cantidad,
        },
      });
      return creado;
    });

    return { lote, advertencias };
  }

  // ---------- Bajas y ajustes ----------

  async bajaPieza(id: string, dto: BajaPiezaDto, user: UsuarioActual) {
    const pieza = await this.prisma.pieza.findFirst({ where: { id, negocioId: user.negocioId } });
    if (!pieza) throw new NotFoundException('Pieza no encontrada');
    await this.asegurarTienda(pieza.tiendaId, user, false);

    if (pieza.estado !== EstadoPieza.DISPONIBLE) {
      throw new ConflictException(`La pieza está en estado ${pieza.estado} y no se puede dar de baja`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Solo cambia si sigue disponible (evita dar de baja una pieza que se acaba de vender)
      const r = await tx.pieza.updateMany({
        where: { id, estado: EstadoPieza.DISPONIBLE },
        data: { estado: EstadoPieza.BAJA },
      });
      if (r.count === 0) throw new ConflictException('La pieza cambió de estado, volvé a intentar');

      await tx.movimientoStock.create({
        data: {
          negocioId: user.negocioId,
          productoId: pieza.productoId,
          tiendaId: pieza.tiendaId,
          piezaId: pieza.id,
          usuarioId: user.usuarioId,
          tipo: TipoMovimiento.BAJA,
          cantidad: -1,
          motivoBaja: dto.motivo,
          detalle: dto.detalle,
        },
      });
      return tx.pieza.findUniqueOrThrow({ where: { id } });
    });
  }

  async bajaLote(id: string, dto: BajaLoteDto, user: UsuarioActual) {
    const lote = await this.buscarLote(id, user);

    return this.prisma.$transaction(async (tx) => {
      await this.descontarLote(tx, lote.id, dto.cantidad);
      await tx.movimientoStock.create({
        data: {
          negocioId: user.negocioId,
          productoId: lote.productoId,
          tiendaId: lote.tiendaId,
          loteId: lote.id,
          usuarioId: user.usuarioId,
          tipo: TipoMovimiento.BAJA,
          cantidad: -dto.cantidad,
          motivoBaja: dto.motivo,
          detalle: dto.detalle,
        },
      });
      return tx.lote.findUniqueOrThrow({ where: { id } });
    });
  }

  async ajustarLote(id: string, dto: AjusteLoteDto, user: UsuarioActual) {
    const lote = await this.buscarLote(id, user);
    const diferencia = dto.cantidadContada - lote.cantidadDisponible;
    if (diferencia === 0) {
      throw new BadRequestException('La cantidad contada coincide con el sistema: no hay nada que ajustar');
    }

    return this.prisma.$transaction(async (tx) => {
      // Solo ajusta si nadie modificó el lote mientras tanto
      const r = await tx.lote.updateMany({
        where: { id, cantidadDisponible: lote.cantidadDisponible },
        data: { cantidadDisponible: dto.cantidadContada },
      });
      if (r.count === 0) throw new ConflictException('El lote cambió mientras ajustabas, volvé a intentar');

      await tx.movimientoStock.create({
        data: {
          negocioId: user.negocioId,
          productoId: lote.productoId,
          tiendaId: lote.tiendaId,
          loteId: lote.id,
          usuarioId: user.usuarioId,
          tipo: TipoMovimiento.AJUSTE_INVENTARIO,
          cantidad: diferencia,
          detalle: dto.detalle,
        },
      });
      return tx.lote.findUniqueOrThrow({ where: { id } });
    });
  }

  // Descuenta de forma atómica: si no alcanza, no toca nada. El stock nunca queda negativo.
  // La vamos a reutilizar en las ventas.
  async descontarLote(tx: Prisma.TransactionClient, loteId: string, cantidad: number) {
    const r = await tx.lote.updateMany({
      where: { id: loteId, cantidadDisponible: { gte: cantidad } },
      data: { cantidadDisponible: { decrement: cantidad } },
    });
    if (r.count === 0) throw new ConflictException('Stock insuficiente en el lote');
  }

  // ---------- Consultas ----------

  async listarPiezas(query: QueryStockDto, user: UsuarioActual) {
    const piezas = await this.prisma.pieza.findMany({
      where: {
        negocioId: user.negocioId,
        productoId: query.productoId,
        tiendaId: await this.filtroTiendas(user, query.tiendaId),
        estado: query.estado ?? EstadoPieza.DISPONIBLE,
      },
      include: {
        producto: { include: incluirProducto },
        tienda: { select: { id: true, nombre: true } },
      },
      orderBy: { creadoEn: 'desc' },
      take: 200,
    });

    const { cotizar, cotizacion } = await this.productos.crearCotizador(user.negocioId);
    const items = await Promise.all(
      piezas.map(async ({ producto, ...pieza }) => {
        const precio = await cotizar(producto, {
          pesoGramos: pieza.pesoGramos,
          hechuraUsd: pieza.hechuraUsd,
        });
        return this.presentar({ ...pieza, producto: this.resumenProducto(producto), precio }, user);
      }),
    );
    return { items, cotizacion };
  }

  async listarLotes(query: QueryStockDto, user: UsuarioActual) {
    const lotes = await this.prisma.lote.findMany({
      where: {
        negocioId: user.negocioId,
        productoId: query.productoId,
        tiendaId: await this.filtroTiendas(user, query.tiendaId),
        cantidadDisponible: query.incluirAgotados === 'true' ? undefined : { gt: 0 },
      },
      include: {
        producto: { include: incluirProducto },
        tienda: { select: { id: true, nombre: true } },
      },
      orderBy: { fechaIngreso: 'asc' }, // el más antiguo primero (orden FIFO)
      take: 200,
    });

    const { cotizar, cotizacion } = await this.productos.crearCotizador(user.negocioId);
    const items = await Promise.all(
      lotes.map(async ({ producto, ...lote }) => {
        // En un lote, el peso por unidad es el promedio
        const pesoUnitario = lote.pesoTotalGramos
          ? lote.pesoTotalGramos.div(lote.cantidadInicial).toDecimalPlaces(3)
          : null;
        const precio = await cotizar(producto, {
          pesoGramos: pesoUnitario,
          hechuraUsd: lote.hechuraUsdUnitaria,
        });
        return this.presentar(
          { ...lote, pesoUnitario, producto: this.resumenProducto(producto), precio },
          user,
        );
      }),
    );
    return { items, cotizacion };
  }

  // Cantidad disponible por producto y tienda, con alerta de stock mínimo
  async resumen(query: QueryStockDto, user: UsuarioActual) {
    const tiendaId = await this.filtroTiendas(user, query.tiendaId);

    const [piezas, lotes, tiendas, productos] = await Promise.all([
      this.prisma.pieza.groupBy({
        by: ['productoId', 'tiendaId'],
        where: { negocioId: user.negocioId, tiendaId, estado: EstadoPieza.DISPONIBLE },
        _count: { _all: true },
      }),
      this.prisma.lote.groupBy({
        by: ['productoId', 'tiendaId'],
        where: { negocioId: user.negocioId, tiendaId, cantidadDisponible: { gt: 0 } },
        _sum: { cantidadDisponible: true },
      }),
      this.prisma.tienda.findMany({
        where: { negocioId: user.negocioId, activa: true, id: tiendaId },
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.producto.findMany({
        where: { negocioId: user.negocioId, activo: true, id: query.productoId },
        select: { id: true, codigo: true, nombre: true, modoStock: true, stockMinimo: true },
        orderBy: { nombre: 'asc' },
      }),
    ]);

    const filas = [];
    for (const p of productos) {
      for (const t of tiendas) {
        const cantidad =
          p.modoStock === ModoStock.UNICO
            ? (piezas.find((x) => x.productoId === p.id && x.tiendaId === t.id)?._count._all ?? 0)
            : (lotes.find((x) => x.productoId === p.id && x.tiendaId === t.id)?._sum.cantidadDisponible ?? 0);

        const bajoMinimo =
          p.modoStock === ModoStock.LOTE && p.stockMinimo != null && cantidad < p.stockMinimo;

        if (cantidad > 0 || bajoMinimo) {
          filas.push({
            productoId: p.id,
            codigo: p.codigo,
            nombre: p.nombre,
            modoStock: p.modoStock,
            tiendaId: t.id,
            tienda: t.nombre,
            cantidad,
            stockMinimo: p.stockMinimo,
            bajoMinimo,
          });
        }
      }
    }
    return filas;
  }

  async movimientos(query: QueryMovimientosDto, user: UsuarioActual) {
    const where: Prisma.MovimientoStockWhereInput = {
      negocioId: user.negocioId,
      productoId: query.productoId,
      tipo: query.tipo,
      tiendaId: await this.filtroTiendas(user, query.tiendaId),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.movimientoStock.findMany({
        where,
        include: {
          producto: { select: { codigo: true, nombre: true } },
          tienda: { select: { nombre: true } },
          pieza: { select: { codigo: true } },
          usuario: { select: { nombre: true, email: true } },
        },
        orderBy: { fecha: 'desc' },
        skip: (query.pagina - 1) * query.porPagina,
        take: query.porPagina,
      }),
      this.prisma.movimientoStock.count({ where }),
    ]);

    return { items, total, pagina: query.pagina, porPagina: query.porPagina };
  }

  // ---------- Internos ----------

  private async buscarProducto(id: string, user: UsuarioActual) {
    const producto = await this.prisma.producto.findFirst({
      where: { id, negocioId: user.negocioId, activo: true },
      include: incluirProducto,
    });
    if (!producto) throw new NotFoundException('Producto no encontrado o inactivo');
    return producto;
  }

  private async buscarLote(id: string, user: UsuarioActual) {
    const lote = await this.prisma.lote.findFirst({ where: { id, negocioId: user.negocioId } });
    if (!lote) throw new NotFoundException('Lote no encontrado');
    await this.asegurarTienda(lote.tiendaId, user, false);
    return lote;
  }

  // Cotización del momento del alta: dólar del negocio y precio del gramo del metal y la ley
  private async cotizacionAlta(producto: ProductoConCategoria, user: UsuarioActual) {
    const { dolar } = await this.precioGramo.contextoNegocio(user.negocioId);
    let gramo: Prisma.Decimal | null = null;
    if (producto.metal && producto.ley) {
      const r = await this.precioGramo.calcular(user.negocioId, producto.metal, producto.ley.toNumber());
      gramo = r.precioArs;
    }
    return { dolar: dolar.valorVenta, gramo };
  }

  // La tienda tiene que ser del negocio y, salvo para el ADMIN, estar asignada al usuario
  async asegurarTienda(tiendaId: string, user: UsuarioActual, exigirActiva = true) {
    const tienda = await this.prisma.tienda.findFirst({
      where: { id: tiendaId, negocioId: user.negocioId },
    });
    if (!tienda) throw new NotFoundException('Tienda no encontrada');
    if (exigirActiva && !tienda.activa) throw new BadRequestException('La tienda está inactiva');

    if (user.rol !== Rol.ADMIN) {
      const asignada = await this.prisma.usuarioTienda.findUnique({
        where: { membresiaId_tiendaId: { membresiaId: user.membresiaId, tiendaId } },
      });
      if (!asignada) throw new ForbiddenException('No tenés asignada esta tienda');
    }
    return tienda;
  }

  // Filtro de tiendas para las consultas
  async filtroTiendas(user: UsuarioActual, tiendaId?: string) {
    if (tiendaId) {
      await this.asegurarTienda(tiendaId, user, false);
      return tiendaId;
    }
    if (user.rol === Rol.ADMIN) return undefined;

    const asignadas = await this.prisma.usuarioTienda.findMany({
      where: { membresiaId: user.membresiaId },
      select: { tiendaId: true },
    });
    return { in: asignadas.map((a) => a.tiendaId) };
  }

  private resumenProducto(p: ProductoConCategoria) {
    return { id: p.id, codigo: p.codigo, nombre: p.nombre, tipo: p.tipo, metal: p.metal, ley: p.ley };
  }

  private presentar<T extends { precio: PrecioCalculado }>(item: T, user: UsuarioActual) {
    if (user.rol !== Rol.VENDEDOR) return item;
    const copia: Record<string, unknown> = {
      ...item,
      precio: { precioArs: item.precio.precioArs, motivo: item.precio.motivo },
    };
    for (const campo of CAMPOS_COSTO) delete copia[campo];
    return copia;
  }
}