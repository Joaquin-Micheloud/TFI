import type { TipoCotizacion } from '../../generated/prisma/client.js';

// Una lectura ya normalizada, lista para guardar en la tabla cotizaciones
export interface LecturaCotizacion {
  tipo: TipoCotizacion;
  valorCompra: number | null;
  valorVenta: number;
  unidad: string;
  fuente: string;
  fechaHora: Date;
}

// Contrato que cumple cada adaptador. Para cambiar de API se escribe otro adaptador.
export interface ProveedorCotizaciones {
  readonly nombre: string;
  obtener(): Promise<LecturaCotizacion[]>;
}

export const PROVEEDOR_DOLAR = 'PROVEEDOR_DOLAR';
export const PROVEEDOR_METALES = 'PROVEEDOR_METALES';