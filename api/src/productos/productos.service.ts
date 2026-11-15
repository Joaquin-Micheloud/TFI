import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PrecioGramoService } from '../precios/precio-gramo.service.js';
import {
  ElaboracionPor,
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

const incluir = {
  categoria: { select: { id: true, nombre: true, margenDefectoPct: true } },
} satisfies Prisma.ProductoInclude;

export type ProductoConCategoria = Prisma.ProductoGetPayload<{ include: typeof incluir }>;

type Num = Prisma.Decimal | number | null;

// Campos que dependen del tipo de producto
interface CamposTipo {
  metal?: Metal | null;
  ley?: Num;
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
      metal: query.metal,
    };
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
    const items = await Promise.all(
      productos.map(async (p) => this.presentar(p, await cotizar(p), user)),
    );

    return { items, total, pagina: query.pagina, porPagina: query.porPagina, cotizacion };
  }

  async findOne(id: string, user: UsuarioActual) {
    const producto = await this.buscar(id, user);
    const { cotizar, cotizacion } = await this.crearCotizador(user.negocioId);
    return { ...this.presentar(producto, await cotizar(producto), user), cotizacion };
  }

  async create(dto: CreateProductoDto, user: UsuarioActual) {
    const modoStock =
      dto.tipo === TipoProducto.FANTASIA ? ModoStock.LOTE : (dto.modoStock ?? ModoStock.UNICO);
    const campos = this.validarPorTipo(dto.tipo, { ...dto });
    await this.validarCategoria(dto.categoriaId, user);

    try {
      const producto = await this.prisma.producto.create({
        data: {
          ...dto,
          ...campos,
          modoStock,
          codigo: this.normalizarCodigo(dto.codigo),
          codigoBarras: dto.codigoBarras?.trim() || null,
          nombre: dto.nombre.trim(),
          negocioId: user.negocioId,
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
    const cambios = sinIndefinidos(dto);

    // Se valida el producto como quedaría después del cambio
    const campos = this.validarPorTipo(actual.tipo, {
      metal: actual.metal,
      ley: actual.ley,
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

  // ---------- Internos ----------

  private async buscar(id: string, user: UsuarioActual) {
    const producto = await this.prisma.producto.findFirst({
      where: { id, negocioId: user.negocioId },
      include: incluir,
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    return producto;
  }

  // Exige los campos de cada tipo y limpia los que no corresponden
  private validarPorTipo<T extends CamposTipo>(tipo: TipoProducto, datos: T): T {
    const errores: string[] = [];

    if (tipo === TipoProducto.FANTASIA) {
      if (datos.precioCompra == null) errores.push('precioCompra es obligatorio para fantasía');
      if (!datos.monedaCompra) errores.push('monedaCompra es obligatoria para fantasía (ARS o USD)');
      Object.assign(datos, {
        metal: null,
        ley: null,
        elaboracionUsd: null,
        elaboracionPor: null,
        insumosArs: null,
      });
    } else {
      if (!datos.metal) errores.push('metal es obligatorio para reventa y elaboración propia');
      if (datos.ley == null) errores.push('ley es obligatoria para reventa y elaboración propia');
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

  /**
   * Devuelve una función que calcula el precio de un producto.
   * Guarda en caché el precio del gramo por metal y ley, para no repetir consultas en un listado.
   */
  private async crearCotizador(negocioId: string) {
    const ctx = await this.precioGramo.contextoNegocio(negocioId);
    const gramos = new Map<string, Promise<Prisma.Decimal | null>>();

    const precioGramo = (metal: Metal, ley: Prisma.Decimal) => {
      const clave = `${metal}-${ley.toString()}`;
      if (!gramos.has(clave)) {
        gramos.set(
          clave,
          this.precioGramo.calcular(negocioId, metal, ley.toNumber()).then(
            (r) => r.precioArs,
            () => null,
          ),
        );
      }
      return gramos.get(clave)!;
    };

    const cotizar = async (p: ProductoConCategoria): Promise<PrecioCalculado> => {
      const margenPct = p.margenPct ?? p.categoria?.margenDefectoPct ?? null;
      const gramo = p.metal && p.ley ? await precioGramo(p.metal, p.ley) : null;

      const costo = calcularCosto(
        { ...p, hechuraUsd: null },
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