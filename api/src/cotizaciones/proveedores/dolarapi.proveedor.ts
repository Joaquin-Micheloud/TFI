import { Injectable } from '@nestjs/common';
import { TipoCotizacion } from '../../generated/prisma/client.js';
import type { LecturaCotizacion, ProveedorCotizaciones } from './proveedor.js';

interface DolarApiItem {
  casa: string;
  compra: number | null;
  venta: number | null;
  fechaActualizacion: string;
}

// Qué "casa" de dolarapi corresponde a cada tipo de cotización
const CASAS: Record<string, TipoCotizacion> = {
  oficial: TipoCotizacion.DOLAR_OFICIAL,
  blue: TipoCotizacion.DOLAR_BLUE,
  bolsa: TipoCotizacion.DOLAR_MEP,
  contadoconliqui: TipoCotizacion.DOLAR_CCL,
  tarjeta: TipoCotizacion.DOLAR_TARJETA,
  mayorista: TipoCotizacion.DOLAR_MAYORISTA,
};

@Injectable()
export class DolarApiProveedor implements ProveedorCotizaciones {
  readonly nombre = 'dolarapi.com';

  async obtener(): Promise<LecturaCotizacion[]> {
    const res = await fetch('https://dolarapi.com/v1/dolares', {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`dolarapi.com respondió ${res.status}`);

    const items = (await res.json()) as DolarApiItem[];

    return items
      .filter((i) => CASAS[i.casa] && i.venta != null)
      .map((i) => ({
        tipo: CASAS[i.casa],
        valorCompra: i.compra,
        valorVenta: i.venta as number,
        unidad: 'ARS/USD',
        fuente: this.nombre,
        fechaHora: new Date(i.fechaActualizacion),
      }));
  }
}