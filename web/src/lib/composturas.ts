import type { Metal } from './catalogo';
import type { MedioPago } from '../pages/vender/carrito';

export type EstadoCompostura = 'RECIBIDA' | 'PRESUPUESTADA' | 'EN_TALLER' | 'LISTA' | 'ENTREGADA' | 'CANCELADA';

export const ESTADOS_COMPOSTURA: EstadoCompostura[] = [
  'RECIBIDA',
  'PRESUPUESTADA',
  'EN_TALLER',
  'LISTA',
  'ENTREGADA',
  'CANCELADA',
];

export const NOMBRE_ESTADO_COMPOSTURA: Record<EstadoCompostura, string> = {
  RECIBIDA: 'Recibida',
  PRESUPUESTADA: 'Presupuestada',
  EN_TALLER: 'En taller',
  LISTA: 'Lista para retirar',
  ENTREGADA: 'Entregada',
  CANCELADA: 'Cancelada',
};

export const COLOR_ESTADO_COMPOSTURA: Record<EstadoCompostura, string> = {
  RECIBIDA: 'gray',
  PRESUPUESTADA: 'yellow',
  EN_TALLER: 'blue',
  LISTA: 'green',
  ENTREGADA: 'teal',
  CANCELADA: 'red',
};

interface UsuarioResumen {
  nombre: string | null;
  email: string;
}

export interface ComposturaResumen {
  id: string;
  numero: number;
  numeroFormateado: string;
  estado: EstadoCompostura;
  descripcion: string;
  metal: Metal | null;
  ley: string | null;
  pesoEntrada: string;
  presupuesto: string | null;
  precioFinal: string | null;
  sena: string;
  fechaEstimada: string | null;
  creadoEn: string;
  vencida: boolean;
  sinRetirar: boolean;
  tienda: { id: string; nombre: string };
  cliente: { id: string; nombre: string; telefono: string | null };
}

export interface Compostura extends ComposturaResumen {
  pesoAportado: string;
  pesoAgregado: string | null;
  pesoSalida: string | null;
  manoObra: string | null;
  margenPct: string | null;
  medioSena: MedioPago | null;
  observaciones: string | null;
  motivoCancelacion: string | null;
  listaEn: string | null;
  entregadaEn: string | null;
  usuario: UsuarioResumen;
  cliente: { id: string; nombre: string; telefono: string | null; dni: string | null };
  venta: { id: string; puntoVenta: number; numero: number; total: string } | null;
  historial: { id: string; estado: EstadoCompostura; nota: string | null; fecha: string; usuario: UsuarioResumen }[];
}

export interface AlertasComposturas {
  porEstado: Record<EstadoCompostura, number>;
  vencidas: ComposturaResumen[];
  sinRetirar: ComposturaResumen[];
  diasSinRetirar: number;
}

// Respuesta de POST /composturas/cotizar
export interface PrecioCompostura {
  precio: string;
  manoObra: string;
  material: string;
  pesoAgregado: string;
  margenPct: string;
  gramo: string | null;
  dolar: string;
}

export const nombreUsuario = (u: UsuarioResumen) => u.nombre ?? u.email;

// La fecha estimada es una fecha sin hora ("2026-11-30T00:00:00.000Z"): se muestra tal cual
export const fechaSinHora = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');

export const gramos = (valor: string | number | null) =>
  valor == null ? '—' : `${Number(valor).toLocaleString('es-AR')} g`;
