import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PrecioGramoService, type GramoCalculado } from '../precios/precio-gramo.service.js';
import {
  ElaboracionPor,
  EstadoPieza,
  Metal,
  ModoStock,
  Moneda,
  Prisma,
  Rol,
  TipoProducto,
} from '../generated/prisma/client.js';
import { esErrorUnico } from '../common/prisma-errors.js';
import { sinIndefinidos } from '../common/objetos.js';
import type { UsuarioActual } from '../auth/types.js';
import { calcularCosto, calcularPrecio } from './calculo-precio.js';
import { CreateProductoDto } from './dto/create-producto.dto.js';
import { UpdateProductoDto } from './dto/update-producto.dto.js';
import { QueryProductosDto } from './dto/query-productos.dto.js';
import { AjustePrecioCompraDto } from './dto/ajuste-precio-compra.dto.js';

export const incluir = {
  categoria: { select: { id: true, nombre: true, margenDefectoPct: true } },
  componentes: { orderBy: { orden: 'asc' } },
} satisfies Prisma.ProductoInclude;

export type ProductoConCategoria = Prisma.ProductoGetPayload<{ include: typeof incluir }>;

type Num = Prisma.Decimal | number | null;

interface ComponenteEntrada {
  metal: Metal;
  ley: Prisma.Decimal | number;
  porcentaje: Prisma.Decimal | number;
}

// Campos que dependen del tipo de producto
interface CamposTipo {
  componentes?: ComponenteEntrada[] | null;
  precioCompra?: Num;
  monedaCompra?: Moneda | null;
  elaboracionUsd?: Num;
  elaboracionPor?: ElaboracionPor | null;
  insumosArs?: Num;
}

export interface PrecioCalculado {
  precioArs: Prisma.Decimal | null;
  costoArs: Prisma.Decimal | null;
  margenPct: Prisma.Decimal | null;
  detalle: Record<string, Prisma.Decimal> | null;
  motivo: string | null;
}

// Reventa: rango de precios del stock disponible (cada pieza o lote tiene su hechura)
export interface RangoStock {
  desde: Prisma.Decimal | null;
  hasta: Prisma.Decimal | null;
  unidades: number;
}

type Cotizar = (
  p: ProductoConCategoria,
  stock?: { pesoGramos: Prisma.Decimal | null; hechuraUsd: Prisma.Decimal | null },
) => Promise<PrecioCalculado>;

@Injectable()
export class ProductosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly precioGramo: PrecioGramoService,
  ) {}

  async findAll(query: QueryProductosDto, user: UsuarioActual) {
    const where: Prisma.ProductoWhereInput = {
      negocioId: user.negocioId,
      tipo: query.tipo,
      categoriaId: query.categoriaId,
    };
    // Un producto "es de oro" si alguno de sus metales es oro
    if (query.metal) where.componentes = { some: { metal: query.metal } };
    if (query.incluirInactivos !== 'true') where.activo = true;
    if (query.buscar?.trim()) {
      const texto = query.buscar.trim();
      where.OR = [
        { nombre: { contains: texto, mode: 'insensitive' } },
        { codigo: { contains: texto, mode: 'insensitive' } },
        { codigoBarras: texto },
      ];
    }

    const [productos, total] = await this.prisma.$transaction([
      this.prisma.producto.findMany({
        where,
        include: incluir,
        orderBy: { nombre: 'asc' },
        skip: (query.pagina - 1) * query.porPagina,
        take: query.porPagina,
      }),
      this.prisma.producto.count({ where }),
    ]);

    const { cotizar, cotizacion } = await this.crearCotizador(user.negocioId);
    const rangos = await this.rangosReventa(productos, cotizar);
    const items = await Promise.all(
      productos.map(async (p) => ({
        ...this.presentar(p, await cotizar(p), user),
        rangoStock: rangos.get(p.id) ?? null,
      })),
    );

    return { items, total, pagina: query.pagina, porPagina: query.porPagina, cotizacion };
  }

  async findOne(id: string, user: UsuarioActual) {
    const producto = await this.buscar(id, user);
    const { cotizar, cotizacion } = await this.crearCotizador(user.negocioId);
    const rangos = await this.rangosReventa([producto], cotizar);
    return {
      ...this.presentar(producto, await cotizar(producto), user),
      rangoStock: rangos.get(producto.id) ?? null,
      cotizacion,
    };
  }

  async create(dto: CreateProductoDto, user: UsuarioActual) {
    const modoStock =
      dto.tipo === TipoProducto.FANTASIA ? ModoStock.LOTE : (dto.modoStock ?? ModoStock.UNICO);
    const { componentes, ...campos } = this.validarPorTipo(dto.tipo, this.normalizarMetales(dto));
    await this.validarCategoria(dto.categoriaId, user);

    try {
      const producto = await this.prisma.producto.create({
        data: {
          ...campos,
          modoStock,
          codigo: this.normalizarCodigo(dto.codigo),
          codigoBarras: dto.codigoBarras?.trim() || null,
          nombre: dto.nombre.trim(),
          negocioId: user.negocioId,
          componentes: { create: this.armarComponentes(componentes) },
        },
      });
      return this.findOne(producto.id, user);
    } catch (e) {
      if (esErrorUnico(e)) throw new ConflictException('Ya existe un producto con ese código o código de barras');
      throw e;
    }
  }

  async update(id: string, dto: UpdateProductoDto, user: UsuarioActual) {
    const actual = await this.buscar(id, user);
    const { componentes: componentesNuevos, ...cambios } = sinIndefinidos(this.normalizarMetales(dto));

    // Se valida el producto como quedaría después del cambio
    const { componentes, ...campos } = this.validarPorTipo(actual.tipo, {
      componentes: componentesNuevos ?? actual.componentes,
      precioCompra: actual.precioCompra,
      monedaCompra: actual.monedaCompra,
      elaboracionUsd: actual.elaboracionUsd,
      elaboracionPor: actual.elaboracionPor,
      insumosArs: actual.insumosArs,
      ...cambios,
    });
    if (dto.categoriaId) await this.validarCategoria(dto.categoriaId, user);

    try {
      await this.prisma.producto.update({
        where: { id },
        data: {
          ...cambios,
          ...campos,
          codigo: dto.codigo ? this.normalizarCodigo(dto.codigo) : undefined,
          codigoBarras: dto.codigoBarras === undefined ? undefined : dto.codigoBarras?.trim() || null,
          nombre: dto.nombre?.trim(),
          // Si se enviaron metales, reemplazan a los anteriores
          componentes: componentesNuevos
            ? { deleteMany: {}, create: this.armarComponentes(componentes) }
            : undefined,
        },
      });
    } catch (e) {
      if (esErrorUnico(e)) throw new ConflictException('Ya existe un producto con ese código o código de barras');
      throw e;
    }
    return this.findOne(id, user);
  }

  // Baja lógica: el producto va a figurar en ventas históricas
  async remove(id: string, user: UsuarioActual) {
    await this.buscar(id, user);
    await this.prisma.producto.update({ where: { id }, data: { activo: false } });
    return this.findOne(id, user);
  }

  // Actualización masiva del precio de compra de fantasía cargada en pesos
  async ajustarPrecioCompra(dto: AjustePrecioCompraDto, user: UsuarioActual) {
    const factor = new Prisma.Decimal(dto.porcentaje).div(100).plus(1);
    const resultado = await this.prisma.producto.updateMany({
      where: {
        negocioId: user.negocioId,
        tipo: TipoProducto.FANTASIA,
        monedaCompra: Moneda.ARS,
        activo: true,
        categoriaId: dto.categoriaId,
      },
      data: { precioCompra: { multiply: factor } },
    });
    return { productosActualizados: resultado.count };
  }

  /**
   * Devuelve una función que calcula el precio de un producto (opcionalmente
   * con el peso y la hechura de una pieza o lote).
   */
  async crearCotizador(negocioId: string) {
    const ctx = await this.precioGramo.contextoNegocio(negocioId);
    const cache = new Map<string, Promise<GramoCalculado>>(); // un cálculo por metal y ley

    // Precio del gramo de la pieza: promedio ponderado de sus metales
    const gramoDe = async (p: ProductoConCategoria) => {
      if (p.componentes.length === 0) return null;
      try {
        return (await this.precioGramo.gramoCompuesto(negocioId, p.componentes, cache)).precioGramo;
      } catch {
        return null; // ej.: un metal en modo manual sin precio cargado
      }
    };

    const cotizar: Cotizar = async (p, stock) => {
      const margenPct = p.margenPct ?? p.categoria?.margenDefectoPct ?? null;
      const gramo = await gramoDe(p);

      const costo = calcularCosto(
        { ...p, hechuraUsd: null, ...stock },
        { precioGramo: gramo, dolar: ctx.dolar.valorVenta },
      );
      if (!costo.ok) {
        return { precioArs: null, costoArs: null, margenPct, detalle: null, motivo: costo.motivo };
      }
      if (margenPct === null) {
        return {
          precioArs: null,
          costoArs: costo.costo,
          margenPct,
          detalle: costo.detalle,
          motivo: 'Sin margen: definilo en el producto o en su categoría',
        };
      }

      const { precio } = calcularPrecio(costo.costo, margenPct, ctx.reglaRedondeo);
      return { precioArs: precio, costoArs: costo.costo, margenPct, detalle: costo.detalle, motivo: null };
    };

    const cotizacion = {
      tipoDolar: ctx.tipoDolar,
      dolar: ctx.dolar.valorVenta,
      fechaHora: ctx.dolar.fechaHora,
    };

    return { cotizar, cotizacion };
  }

  // ---------- Internos ----------

  // Precio de hoy de cada pieza y lote disponible de los productos de reventa
  private async rangosReventa(productos: ProductoConCategoria[], cotizar: Cotizar) {
    const rangos = new Map<string, RangoStock>();
    const reventa = productos.filter((p) => p.tipo === TipoProducto.REVENTA);
    if (reventa.length === 0) return rangos;

    const ids = reventa.map((p) => p.id);
    const [piezas, lotes] = await Promise.all([
      this.prisma.pieza.findMany({
        where: { productoId: { in: ids }, estado: EstadoPieza.DISPONIBLE },
        select: { productoId: true, pesoGramos: true, hechuraUsd: true },
      }),
      this.prisma.lote.findMany({
        where: { productoId: { in: ids }, cantidadDisponible: { gt: 0 } },
        select: {
          productoId: true,
          pesoTotalGramos: true,
          cantidadInicial: true,
          cantidadDisponible: true,
          hechuraUsdUnitaria: true,
        },
      }),
    ]);

    for (const p of reventa) {
      const precios: Prisma.Decimal[] = [];
      let unidades = 0;

      for (const pieza of piezas.filter((x) => x.productoId === p.id)) {
        const r = await cotizar(p, { pesoGramos: pieza.pesoGramos, hechuraUsd: pieza.hechuraUsd });
        if (r.precioArs) precios.push(r.precioArs);
        unidades += 1;
      }

      for (const lote of lotes.filter((x) => x.productoId === p.id)) {
        const pesoUnitario = lote.pesoTotalGramos
          ? lote.pesoTotalGramos.div(lote.cantidadInicial).toDecimalPlaces(3)
          : null;
        const r = await cotizar(p, { pesoGramos: pesoUnitario, hechuraUsd: lote.hechuraUsdUnitaria });
        if (r.precioArs) precios.push(r.precioArs);
        unidades += lote.cantidadDisponible;
      }

      rangos.set(p.id, {
        desde: precios.length ? Prisma.Decimal.min(...precios) : null,
        hasta: precios.length ? Prisma.Decimal.max(...precios) : null,
        unidades,
      });
    }
    return rangos;
  }

  private async buscar(id: string, user: UsuarioActual) {
    const producto = await this.prisma.producto.findFirst({
      where: { id, negocioId: user.negocioId },
      include: incluir,
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    return producto;
  }

  // "metal" y "ley" sueltos (carga simple) equivalen a un solo metal al 100 %
  private normalizarMetales<T extends { metal?: Metal; ley?: number; componentes?: ComponenteEntrada[] }>(dto: T) {
    const { metal, ley, ...resto } = dto;
    if (!resto.componentes && metal && ley != null) {
      return { ...resto, componentes: [{ metal, ley, porcentaje: 100 }] };
    }
    return resto;
  }

  // Exige los campos de cada tipo y limpia los que no corresponden
  private validarPorTipo<T extends CamposTipo>(tipo: TipoProducto, datos: T): T {
    const errores: string[] = [];

    if (tipo === TipoProducto.FANTASIA) {
      if (datos.precioCompra == null) errores.push('precioCompra es obligatorio para fantasía');
      if (!datos.monedaCompra) errores.push('monedaCompra es obligatoria para fantasía (ARS o USD)');
      Object.assign(datos, { componentes: [], elaboracionUsd: null, elaboracionPor: null, insumosArs: null });
    } else {
      errores.push(...this.validarComponentes(datos.componentes ?? []));
      Object.assign(datos, { precioCompra: null, monedaCompra: null });

      if (tipo === TipoProducto.ELABORACION) {
        if (datos.elaboracionUsd == null) errores.push('elaboracionUsd es obligatorio para elaboración propia');
        if (!datos.elaboracionPor) errores.push('elaboracionPor es obligatorio (PIEZA o GRAMO)');
        datos.insumosArs ??= 0;
      } else {
        Object.assign(datos, { elaboracionUsd: null, elaboracionPor: null, insumosArs: null });
      }
    }

    if (errores.length > 0) throw new BadRequestException(errores);
    return datos;
  }

  // Uno o varios metales, sin repetir metal y ley, que sumen 100 %
  private validarComponentes(componentes: ComponenteEntrada[]) {
    if (componentes.length === 0) return ['Indicá el metal y la ley'];

    const errores: string[] = [];
    const suma = componentes.reduce((s, c) => s.plus(c.porcentaje), new Prisma.Decimal(0));
    if (!suma.equals(100)) {
      errores.push(`Los porcentajes de los metales tienen que sumar 100 % (suman ${suma.toString()} %)`);
    }
    const claves = componentes.map((c) => `${c.metal}-${new Prisma.Decimal(c.ley).toString()}`);
    if (new Set(claves).size !== claves.length) errores.push('Hay un metal con la misma ley repetido');
    return errores;
  }

  private armarComponentes(componentes: ComponenteEntrada[] | null | undefined) {
    return (componentes ?? []).map((c, i) => ({
      metal: c.metal,
      ley: c.ley,
      porcentaje: c.porcentaje,
      orden: i,
    }));
  }

  private async validarCategoria(categoriaId: string | null | undefined, user: UsuarioActual) {
    if (!categoriaId) return;
    const categoria = await this.prisma.categoria.findFirst({
      where: { id: categoriaId, negocioId: user.negocioId },
      select: { id: true },
    });
    if (!categoria) throw new BadRequestException('La categoría no existe en tu negocio');
  }

  private normalizarCodigo(codigo: string) {
    return codigo.trim().toUpperCase();
  }

  // El vendedor ve el precio de venta, pero no costos ni márgenes
  private presentar(p: ProductoConCategoria, precio: PrecioCalculado, user: UsuarioActual) {
    if (user.rol !== Rol.VENDEDOR) return { ...p, precio };

    const {
      precioCompra,
      monedaCompra,
      elaboracionUsd,
      elaboracionPor,
      insumosArs,
      margenPct,
      categoria,
      ...publico
    } = p;
    return {
      ...publico,
      categoria: categoria ? { id: categoria.id, nombre: categoria.nombre } : null,
      precio: { precioArs: precio.precioArs, motivo: precio.motivo },
    };
  }
}