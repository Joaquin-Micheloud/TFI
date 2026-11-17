export type MedioPago = 'EFECTIVO_ARS' | 'EFECTIVO_USD' | 'TRANSFERENCIA' | 'DEBITO' | 'CREDITO';

export const MEDIOS: MedioPago[] = ['EFECTIVO_ARS', 'EFECTIVO_USD', 'TRANSFERENCIA', 'DEBITO', 'CREDITO'];

export const NOMBRE_MEDIO: Record<MedioPago, string> = {
  EFECTIVO_ARS: 'Efectivo',
  EFECTIVO_USD: 'Dólares',
  TRANSFERENCIA: 'Transferencia',
  DEBITO: 'Débito',
  CREDITO: 'Crédito',
};

// Un ítem del carrito: una pieza única o un producto por lote con cantidad
export interface ItemCarrito {
  clave: string;
  piezaId?: string;
  productoId?: string;
  cantidad: number;
  descuentoPct: number;
  etiqueta: string;
  detalle: string;
  maximo?: number;
  loteId?: string;
}

export interface PagoCarrito {
  clave: string;
  medio: MedioPago;
  monto: number;
  cuotas?: number;
}

// Respuesta de /ventas/buscar
export interface PiezaEncontrada {
  piezaId: string;
  codigo: string;
  pesoGramos: string;
  precioArs: string | null;
  producto: { id: string; codigo: string; nombre: string };
}

export interface LoteEncontrado {
  loteId: string;
  numeroLote: number;
  fechaIngreso: string;
  disponible: number;
  pesoUnitario: string | null;
  precioArs: string | null;
  producto: { id: string; codigo: string; nombre: string };
}

export interface ResultadoBusqueda {
  piezas: PiezaEncontrada[];
  lotes: LoteEncontrado[];
}

// Respuesta de /ventas/cotizar
export interface LineaCotizada {
  numeroItem: number;
  codigo: string;
  cantidad: number;
  precioListaUnitario: string;
  subtotal: string;
}

export interface Cotizacion {
  lineas: LineaCotizada[];
  subtotal: string;
  descuentoTotal: string;
  total: string;
  tipoDolar: string;
  dolar: string;
  cotizacionFecha: string;
}

export interface VentaConfirmada {
  id: string;
  numeroFormateado: string;
  total: string;
  vuelto: string;
}

const redondear = (n: number) => Math.round(n * 100) / 100;

// Cuánto se pagó, cuánto falta y cuánto hay que devolver (solo para mostrar;
// el backend vuelve a calcular todo al confirmar)
export function calcularPagos(pagos: PagoCarrito[], total: number, dolar: number) {
  const pagado = redondear(
    pagos.reduce((suma, p) => suma + (p.medio === 'EFECTIVO_USD' ? redondear(p.monto * dolar) : p.monto), 0),
  );
  const falta = redondear(Math.max(total - pagado, 0));
  const vuelto = redondear(Math.max(pagado - total, 0));
  const hayEfectivo = pagos.some((p) => p.medio === 'EFECTIVO_ARS' || p.medio === 'EFECTIVO_USD');
  return { pagado, falta, vuelto, vueltoSinEfectivo: vuelto > 0 && !hayEfectivo };
}

export type EstadoPagos = ReturnType<typeof calcularPagos>;