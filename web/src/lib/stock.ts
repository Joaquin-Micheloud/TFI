import type { Metal, ModoStock, PrecioProducto, TipoProducto } from './catalogo';

export type EstadoPieza = 'DISPONIBLE' | 'RESERVADA' | 'VENDIDA' | 'EN_TRANSITO' | 'BAJA';
export type MotivoBaja = 'ROTURA' | 'PERDIDA' | 'FUNDICION' | 'OTRO';
export type TipoMovimiento =
  | 'INGRESO_COMPRA'
  | 'INGRESO_ELABORACION'
  | 'VENTA'
  | 'DEVOLUCION'
  | 'TRANSFERENCIA_SALIDA'
  | 'TRANSFERENCIA_ENTRADA'
  | 'AJUSTE_INVENTARIO'
  | 'BAJA';

export const NOMBRE_ESTADO: Record<EstadoPieza, string> = {
  DISPONIBLE: 'Disponible',
  RESERVADA: 'Reservada',
  VENDIDA: 'Vendida',
  EN_TRANSITO: 'En tránsito',
  BAJA: 'Dada de baja',
};

export const COLOR_ESTADO: Record<EstadoPieza, string> = {
  DISPONIBLE: 'green',
  RESERVADA: 'yellow',
  VENDIDA: 'blue',
  EN_TRANSITO: 'cyan',
  BAJA: 'gray',
};

export const NOMBRE_MOTIVO: Record<MotivoBaja, string> = {
  ROTURA: 'Rotura',
  PERDIDA: 'Pérdida',
  FUNDICION: 'Fundición',
  OTRO: 'Otro',
};

export const NOMBRE_MOVIMIENTO: Record<TipoMovimiento, string> = {
  INGRESO_COMPRA: 'Ingreso por compra',
  INGRESO_ELABORACION: 'Ingreso por elaboración',
  VENTA: 'Venta',
  DEVOLUCION: 'Devolución',
  TRANSFERENCIA_SALIDA: 'Transferencia (salida)',
  TRANSFERENCIA_ENTRADA: 'Transferencia (entrada)',
  AJUSTE_INVENTARIO: 'Ajuste de inventario',
  BAJA: 'Baja',
};

export const COLOR_MOVIMIENTO: Record<TipoMovimiento, string> = {
  INGRESO_COMPRA: 'green',
  INGRESO_ELABORACION: 'teal',
  VENTA: 'blue',
  DEVOLUCION: 'grape',
  TRANSFERENCIA_SALIDA: 'orange',
  TRANSFERENCIA_ENTRADA: 'cyan',
  AJUSTE_INVENTARIO: 'yellow',
  BAJA: 'red',
};

interface ProductoStock {
  id: string;
  codigo: string;
  nombre: string;
  tipo: TipoProducto;
  componentes: { metal: Metal; ley: string; porcentaje: string }[];
}

// Al vendedor la API no le manda precioCompra, hechura, dolarAlta ni gramoAlta
export interface Pieza {
  id: string;
  codigo: string;
  pesoGramos: string;
  precioCompra?: string | null;
  hechuraUsd?: string | null;
  estado: EstadoPieza;
  creadoEn: string;
  tienda: { id: string; nombre: string };
  producto: ProductoStock;
  precio: PrecioProducto;
}

export interface Lote {
  id: string;
  cantidadInicial: number;
  cantidadDisponible: number;
  pesoTotalGramos: string | null;
  pesoUnitario: string | null;
  precioCompraTotal?: string | null;
  monedaCompra?: 'ARS' | 'USD';
  hechuraUsdUnitaria?: string | null;
  fechaIngreso: string;
  tienda: { id: string; nombre: string };
  producto: ProductoStock;
  precio: PrecioProducto;
}

export interface FilaResumen {
  productoId: string;
  codigo: string;
  nombre: string;
  modoStock: ModoStock;
  tiendaId: string;
  tienda: string;
  cantidad: number;
  stockMinimo: number | null;
  bajoMinimo: boolean;
}

export interface Movimiento {
  id: string;
  tipo: TipoMovimiento;
  cantidad: number;
  motivoBaja: MotivoBaja | null;
  detalle: string | null;
  fecha: string;
  producto: { codigo: string; nombre: string };
  tienda: { nombre: string };
  pieza: { codigo: string } | null;
  usuario: { nombre: string | null; email: string };
}

// Numera los lotes igual que el punto de venta: por producto y tienda, del más
// antiguo al más nuevo, contando solo los que tienen unidades.
// Espera los lotes ordenados por fecha de ingreso (la API ya los devuelve así).
export function numerarLotes(lotes: Lote[]) {
  const contador = new Map<string, number>();
  const numeros = new Map<string, number>();
  for (const l of lotes) {
    if (l.cantidadDisponible <= 0) continue;
    const clave = `${l.producto.id}-${l.tienda.id}`;
    const numero = (contador.get(clave) ?? 0) + 1;
    contador.set(clave, numero);
    numeros.set(l.id, numero);
  }
  return numeros;
}