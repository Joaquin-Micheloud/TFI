import { Injectable } from '@nestjs/common';
import { TipoCotizacion } from '../../generated/prisma/client.js';
import type { LecturaCotizacion, ProveedorCotizaciones } from './proveedor.js';

interface XausSpot {
  spot_usd_oz: number; // oro puro, USD por onza troy
  silver_usd_oz: number; // plata pura, USD por onza troy
  updated_at: string;
  price_as_of?: string;
}

@Injectable()
export class XausProveedor implements ProveedorCotizaciones {
  readonly nombre = 'xaus.com';

  async obtener(): Promise<LecturaCotizacion[]> {
    const res = await fetch('https://xaus.com/api/v1/spot', {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`xaus.com respondió ${res.status}`);

    const data = (await res.json()) as XausSpot;
    if (!data.spot_usd_oz || !data.silver_usd_oz) {
      throw new Error('xaus.com devolvió una respuesta sin precios');
    }

    const fechaHora = new Date(data.price_as_of ?? data.updated_at);
    const base = { valorCompra: null, unidad: 'USD/oz', fuente: this.nombre, fechaHora };

    return [
      { ...base, tipo: TipoCotizacion.ORO, valorVenta: data.spot_usd_oz },
      { ...base, tipo: TipoCotizacion.PLATA, valorVenta: data.silver_usd_oz },
    ];
  }
}