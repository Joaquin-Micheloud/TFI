import { ElaboracionPor, Moneda, Prisma, TipoProducto } from '../generated/prisma/client.js';
import {
  calcularCosto,
  calcularHechuraUsd,
  calcularPrecio,
  precioGramoPonderado,
  type DatosCosto,
} from './calculo-precio.js';

const D = (v: number | string) => new Prisma.Decimal(v);

const base: DatosCosto = {
  tipo: TipoProducto.REVENTA,
  pesoGramos: null,
  precioCompra: null,
  monedaCompra: null,
  elaboracionUsd: null,
  elaboracionPor: null,
  insumosArs: null,
  hechuraUsd: null,
};

// Ejemplo de la sección 6 del documento: anillo de oro 18k de 4 g
describe('reventa (ejemplo del documento)', () => {
  it('calcula la hechura del proveedor en USD al dar de alta', () => {
    // Comprado a $460.000 con el gramo 18k a $100.000 y el dólar a $1.200
    const hechura = calcularHechuraUsd(D(460_000), D(4), D(100_000), D(1_200));
    expect(hechura.toNumber()).toBe(50);
  });

  it('recalcula el costo con el gramo y el dólar de hoy', () => {
    // Meses después: gramo a $110.000 y dólar a $1.300
    const r = calcularCosto(
      { ...base, pesoGramos: D(4), hechuraUsd: D(50) },
      { precioGramo: D(110_000), dolar: D(1_300) },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.costo.toNumber()).toBe(505_000);
      expect(r.detalle.metal.toNumber()).toBe(440_000);
      expect(r.detalle.hechura.toNumber()).toBe(65_000);
    }
  });

  it('aplica el margen y redondea con la regla del negocio', () => {
    const { precio } = calcularPrecio(D(505_000), D(40), 100);
    expect(precio.toNumber()).toBe(707_000);
  });

  it('permite hechura negativa (pieza comprada por debajo del valor del metal)', () => {
    const hechura = calcularHechuraUsd(D(380_000), D(4), D(100_000), D(1_200));
    expect(hechura.isNegative()).toBe(true);
  });

  it('sin hechura no puede calcular el costo de reventa', () => {
    const r = calcularCosto({ ...base, pesoGramos: D(4) }, { precioGramo: D(110_000), dolar: D(1_300) });
    expect(r.ok).toBe(false);
  });
});

describe('fantasía', () => {
  it('en pesos, el costo es el precio de compra', () => {
    const r = calcularCosto(
      { ...base, tipo: TipoProducto.FANTASIA, precioCompra: D(8_000), monedaCompra: Moneda.ARS },
      { precioGramo: null, dolar: D(1_300) },
    );
    expect(r.ok && r.costo.toNumber()).toBe(8_000);
  });

  it('en dólares, se convierte con el dólar de hoy', () => {
    const r = calcularCosto(
      { ...base, tipo: TipoProducto.FANTASIA, precioCompra: D(10), monedaCompra: Moneda.USD },
      { precioGramo: null, dolar: D(1_300) },
    );
    expect(r.ok && r.costo.toNumber()).toBe(13_000);
  });
});

describe('elaboración propia', () => {
  const pieza = {
    ...base,
    tipo: TipoProducto.ELABORACION,
    pesoGramos: D(5),
    elaboracionUsd: D(20),
    insumosArs: D(15_000),
  };

  it('por pieza: metal + elaboración × dólar + insumos', () => {
    const r = calcularCosto(
      { ...pieza, elaboracionPor: ElaboracionPor.PIEZA },
      { precioGramo: D(2_000), dolar: D(1_000) },
    );
    // 5 × 2.000 + 20 × 1.000 + 15.000
    expect(r.ok && r.costo.toNumber()).toBe(45_000);
  });

  it('por gramo: la elaboración se multiplica por el peso', () => {
    const r = calcularCosto(
      { ...pieza, elaboracionPor: ElaboracionPor.GRAMO },
      { precioGramo: D(2_000), dolar: D(1_000) },
    );
    // 5 × 2.000 + 20 × 5 × 1.000 + 15.000
    expect(r.ok && r.costo.toNumber()).toBe(125_000);
  });
});

describe('piezas con varios metales', () => {
  it('el gramo de la pieza es el promedio ponderado por el porcentaje del peso', () => {
    // 80 % plata 925 a $2.250 + 20 % oro 18k a $150.000
    const gramo = precioGramoPonderado([
      { porcentaje: D(80), precioGramo: D(2_250) },
      { porcentaje: D(20), precioGramo: D(150_000) },
    ]);
    expect(gramo.toNumber()).toBe(31_800);
  });

  it('con un solo metal al 100 % es el precio de ese metal', () => {
    const gramo = precioGramoPonderado([{ porcentaje: D(100), precioGramo: D(110_000) }]);
    expect(gramo.toNumber()).toBe(110_000);
  });
});
