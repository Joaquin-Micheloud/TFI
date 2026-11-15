import {
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CotizacionesService } from '../cotizaciones/cotizaciones.service.js';
import {
  Metal,
  ModoPrecioMetal,
  Prisma,
  TipoCotizacion,
  TipoDolar,
} from '../generated/prisma/client.js';

const GRAMOS_POR_ONZA_TROY = new Prisma.Decimal('31.1035');

// Leyes que se muestran en la tabla de precios del día
const LEYES_COMUNES: Record<Metal, number[]> = {
  ORO: [1, 0.75, 0.585, 0.417], // 24k, 18k, 14k, 10k
  PLATA: [1, 0.925], // plata pura, 925
};

export function tipoCotizacionDolar(tipoDolar: TipoDolar): TipoCotizacion {
  return `DOLAR_${tipoDolar}` as TipoCotizacion;
}

@Injectable()
export class PrecioGramoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cotizaciones: CotizacionesService,
  ) {}

  /**
   * Precio del gramo en pesos para un metal y una ley, según la configuración del negocio.
   * Devuelve también los datos que se usaron (para el snapshot de las ventas).
   *
   * Fórmula (modos AUTOMATICO y AJUSTE):
   *   P = (USD por onza / 31,1035) × ley × dólar venta × (1 + ajuste/100)
   */
  async calcular(negocioId: string, metal: Metal, ley: number) {
    const leyDec = new Prisma.Decimal(ley);

    const config = await this.prisma.configPrecioMetal.findUnique({
      where: { negocioId_metal: { negocioId, metal } },
    });
    const modo = config?.modo ?? ModoPrecioMetal.AUTOMATICO;

    if (modo === ModoPrecioMetal.MANUAL) {
      const manual = await this.prisma.precioManualGramo.findFirst({
        where: { negocioId, metal, ley: leyDec, vigenteDesde: { lte: new Date() } },
        orderBy: { vigenteDesde: 'desc' },
      });
      if (!manual) {
        throw new UnprocessableEntityException(
          `${metal} está en modo manual y no hay precio cargado para la ley ${leyDec.toFixed(3)}`,
        );
      }
      return {
        metal,
        ley: leyDec,
        modo,
        precioArs: manual.precioArs,
        ajustePct: null,
        dolar: null,
        metalUsdOz: null,
        precioManual: { id: manual.id, vigenteDesde: manual.vigenteDesde },
      };
    }

    const negocio = await this.prisma.negocio.findUniqueOrThrow({
      where: { id: negocioId },
      select: { tipoDolar: true },
    });

    const [dolar, onza] = await Promise.all([
      this.cotizaciones.ultima(tipoCotizacionDolar(negocio.tipoDolar)),
      this.cotizaciones.ultima(metal === Metal.ORO ? TipoCotizacion.ORO : TipoCotizacion.PLATA),
    ]);
    if (!dolar || !onza) {
      throw new ServiceUnavailableException(
        'Todavía no hay cotizaciones guardadas. Esperá la primera lectura o forzala con POST /cotizaciones/actualizar.',
      );
    }

    const ajustePct =
      modo === ModoPrecioMetal.AJUSTE ? (config?.ajustePct ?? new Prisma.Decimal(0)) : new Prisma.Decimal(0);

    const precioArs = onza.valorVenta
      .div(GRAMOS_POR_ONZA_TROY)
      .times(leyDec)
      .times(dolar.valorVenta)
      .times(ajustePct.div(100).plus(1))
      .toDecimalPlaces(2);

    return {
      metal,
      ley: leyDec,
      modo,
      precioArs,
      ajustePct,
      dolar: {
        cotizacionId: dolar.id,
        tipo: negocio.tipoDolar,
        valor: dolar.valorVenta,
        fechaHora: dolar.fechaHora,
        leidaEn: dolar.creadoEn,
      },
      metalUsdOz: {
        cotizacionId: onza.id,
        valor: onza.valorVenta,
        fechaHora: onza.fechaHora,
        leidaEn: onza.creadoEn,
      },
      precioManual: null,
    };
  }

  // Tabla del día con las leyes más comunes. Si una falla, se informa sin cortar el resto.
  async tabla(negocioId: string) {
    const filas = [];
    for (const metal of Object.values(Metal)) {
      for (const ley of LEYES_COMUNES[metal]) {
        try {
          const r = await this.calcular(negocioId, metal, ley);
          filas.push({ metal, ley: r.ley, modo: r.modo, precioArs: r.precioArs });
        } catch (e) {
          filas.push({ metal, ley: new Prisma.Decimal(ley), error: (e as Error).message });
        }
      }
    }
    return filas;
    
  }

  async contextoNegocio(negocioId: string) {
    const negocio = await this.prisma.negocio.findUniqueOrThrow({
      where: { id: negocioId },
      select: { tipoDolar: true, reglaRedondeo: true },
    });
    const dolar = await this.cotizaciones.ultima(tipoCotizacionDolar(negocio.tipoDolar));
    if (!dolar) {
      throw new ServiceUnavailableException('Todavía no hay cotización del dólar guardada.');
    }
    return { tipoDolar: negocio.tipoDolar, dolar, reglaRedondeo: negocio.reglaRedondeo };
  }
  
  async obtenerConfig(negocioId: string) {
    const configs = await this.prisma.configPrecioMetal.findMany({ where: { negocioId } });
    return Object.values(Metal).map((metal) => {
      const c = configs.find((x) => x.metal === metal);
      return {
        metal,
        modo: c?.modo ?? ModoPrecioMetal.AUTOMATICO,
        ajustePct: c?.ajustePct ?? new Prisma.Decimal(0),
        actualizadoEn: c?.actualizadoEn ?? null,
      };
    });
  }

  guardarConfig(negocioId: string, metal: Metal, modo: ModoPrecioMetal, ajustePct?: number) {
    return this.prisma.configPrecioMetal.upsert({
      where: { negocioId_metal: { negocioId, metal } },
      create: { negocioId, metal, modo, ajustePct: ajustePct ?? 0 },
      update: { modo, ajustePct },
    });
  }

  cargarPrecioManual(negocioId: string, usuarioId: string, metal: Metal, ley: number, precioArs: number) {
    return this.prisma.precioManualGramo.create({
      data: { negocioId, usuarioId, metal, ley, precioArs },
    });
  }

  historialManual(negocioId: string, metal?: Metal) {
    return this.prisma.precioManualGramo.findMany({
      where: { negocioId, metal },
      include: { usuario: { select: { nombre: true, email: true } } },
      orderBy: { vigenteDesde: 'desc' },
      take: 100,
    });
  }
}