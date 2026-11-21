import { ElaboracionPor, Moneda, Prisma, TipoProducto } from '../generated/prisma/client.js';

type Dec = Prisma.Decimal;
const r2 = (d: Dec) => d.toDecimalPlaces(2);

export interface DatosCosto {
  tipo: TipoProducto;
  pesoGramos: Dec | null;
  precioCompra: Dec | null;
  monedaCompra: Moneda | null;
  elaboracionUsd: Dec | null;
  elaboracionPor: ElaboracionPor | null;
  insumosArs: Dec | null;
  hechuraUsd?: Dec | null; // REVENTA: sale de cada pieza o lote (Paso 8)
}

export interface ContextoCosto {
  precioGramo: Dec | null; // precio del gramo para el metal y la ley del producto
  dolar: Dec; // dólar actual del negocio
}

export type ResultadoCosto =
  | { ok: true; costo: Dec; detalle: Record<string, Dec> }
  | { ok: false; motivo: string };

/**
 * Costo actual en pesos, según el tipo (sección 6 del documento):
 *  REVENTA:     peso × gramo + hechuraUSD × dólar
 *  FANTASIA:    precio de compra (convertido si está en USD)
 *  ELABORACION: peso × gramo + elaboraciónUSD × dólar + insumos
 */
export function calcularCosto(d: DatosCosto, ctx: ContextoCosto): ResultadoCosto {
  switch (d.tipo) {
    case TipoProducto.FANTASIA: {
      if (!d.precioCompra) return { ok: false, motivo: 'Falta el precio de compra' };
      const compra =
        d.monedaCompra === Moneda.USD ? d.precioCompra.times(ctx.dolar) : d.precioCompra;
      return { ok: true, costo: r2(compra), detalle: { compra: r2(compra) } };
    }

    case TipoProducto.REVENTA: {
      if (!d.pesoGramos) return { ok: false, motivo: 'Falta el peso' };
      if (!ctx.precioGramo) return { ok: false, motivo: 'No hay precio del gramo para este metal y ley' };
      if (!d.hechuraUsd) {
        return {
          ok: false,
          motivo: 'El costo depende de la hechura de cada pieza o lote: se calcula al ingresar stock',
        };
      }
      const metal = d.pesoGramos.times(ctx.precioGramo);
      const hechura = d.hechuraUsd.times(ctx.dolar);
      return { ok: true, costo: r2(metal.plus(hechura)), detalle: { metal: r2(metal), hechura: r2(hechura) } };
    }

    case TipoProducto.ELABORACION: {
      if (!d.pesoGramos) return { ok: false, motivo: 'Falta el peso' };
      if (!ctx.precioGramo) return { ok: false, motivo: 'No hay precio del gramo para este metal y ley' };
      if (!d.elaboracionUsd) return { ok: false, motivo: 'Falta el costo de elaboración' };

      const metal = d.pesoGramos.times(ctx.precioGramo);
      const elaboracionUsd =
        d.elaboracionPor === ElaboracionPor.GRAMO
          ? d.elaboracionUsd.times(d.pesoGramos)
          : d.elaboracionUsd;
      const elaboracion = elaboracionUsd.times(ctx.dolar);
      const insumos = d.insumosArs ?? new Prisma.Decimal(0);

      return {
        ok: true,
        costo: r2(metal.plus(elaboracion).plus(insumos)),
        detalle: { metal: r2(metal), elaboracion: r2(elaboracion), insumos: r2(insumos) },
      };
    }
  }
}

/** Precio de venta = costo × (1 + margen), redondeado al múltiplo de la regla del negocio */
export function calcularPrecio(costo: Dec, margenPct: Dec, redondeo: number) {
  const sinRedondear = costo.times(margenPct.div(100).plus(1));
  const precio = sinRedondear
    .div(redondeo)
    .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
    .times(redondeo);
  return { sinRedondear: r2(sinRedondear), precio };
}

/** Hechura del proveedor en USD (la usamos en el Paso 8 al ingresar piezas y lotes) */
export function calcularHechuraUsd(precioCompra: Dec, peso: Dec, gramoAlta: Dec, dolarAlta: Dec) {
  return r2(precioCompra.minus(peso.times(gramoAlta)).div(dolarAlta));
}

export function precioGramoPonderado(componentes: { porcentaje: Dec; precioGramo: Dec }[]) {
  return r2(
    componentes.reduce((suma, c) => suma.plus(c.precioGramo.times(c.porcentaje).div(100)), new Prisma.Decimal(0)),
  );
}