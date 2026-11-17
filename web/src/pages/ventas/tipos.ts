import type { MedioPago } from '../vender/carrito';

export interface ItemVenta {
  id: string;
  codigo: string;
  descripcion: string;
  cantidad: number;
  cantidadDevuelta: number;
  precioListaUnitario: string;
  descuentoPct: string;
  subtotal: string;
  costoUnitario?: string;
  margenPct?: string;
  metal: 'ORO' | 'PLATA' | null;
  ley: string | null;
  pesoGramos: string | null;
  gramoUsado: string | null;
}

export interface DevolucionVenta {
  id: string;
  fecha: string;
  motivo: string;
  medioReintegro: MedioPago;
  montoArs: string;
  usuario: { nombre: string | null; email: string };
  items: { id: string; ventaItemId: string; cantidad: number; montoArs: string; destino: 'STOCK' | 'BAJA' }[];
}

export interface VentaDetalle {
  id: string;
  numeroFormateado: string;
  fecha: string;
  estado: 'CONFIRMADA' | 'ANULADA';
  subtotal: string;
  descuentoPct: string;
  descuentoTotal: string;
  total: string;
  vuelto: string;
  tipoDolar: string;
  dolarUsado: string;
  motivoAnulacion: string | null;
  anuladaEn: string | null;
  anuladaPor: { nombre: string | null; email: string } | null;
  totalDevuelto: string;
  tienda: { nombre: string };
  usuario: { nombre: string | null; email: string };
  items: ItemVenta[];
  pagos: { id: string; medio: MedioPago; moneda: 'ARS' | 'USD'; monto: string; montoArs: string; cuotas: number | null }[];
  devoluciones: DevolucionVenta[];
}