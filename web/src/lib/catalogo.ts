export type TipoProducto = 'REVENTA' | 'FANTASIA' | 'ELABORACION';
export type ModoStock = 'UNICO' | 'LOTE';
export type Metal = 'ORO' | 'PLATA';

export const NOMBRE_TIPO: Record<TipoProducto, string> = {
  REVENTA: 'Reventa',
  FANTASIA: 'Fantasía',
  ELABORACION: 'Elaboración propia',
};

export const COLOR_TIPO: Record<TipoProducto, string> = {
  REVENTA: 'blue',
  FANTASIA: 'pink',
  ELABORACION: 'grape',
};

// Leyes más comunes. El value es el número que espera la API.
export const LEYES: Record<Metal, { value: string; label: string }[]> = {
  ORO: [
    { value: '1', label: '24k (1,000)' },
    { value: '0.75', label: '18k (0,750)' },
    { value: '0.585', label: '14k (0,585)' },
    { value: '0.417', label: '10k (0,417)' },
  ],
  PLATA: [
    { value: '1', label: '999 (1,000)' },
    { value: '0.95', label: '950 (0,950)' },
    { value: '0.925', label: '925 (0,925)' },
  ],
};

// Partes del costo que devuelve la API en precio.detalle
export const NOMBRE_COMPONENTE: Record<string, string> = {
  metal: 'Metal',
  hechura: 'Hechura',
  elaboracion: 'Elaboración',
  insumos: 'Insumos',
  compra: 'Compra',
};

// Al vendedor la API no le manda costoArs, margenPct ni detalle
export interface PrecioProducto {
  precioArs: string | null;
  costoArs?: string | null;
  margenPct?: string | null;
  detalle?: Record<string, string> | null;
  motivo: string | null;
}

export interface Producto {
  id: string;
  codigo: string;
  codigoBarras: string | null;
  nombre: string;
  descripcion: string | null;
  tipo: TipoProducto;
  modoStock: ModoStock;
  componentes: { metal: Metal; ley: string; porcentaje: string }[];
  pesoGramos: string | null;
  margenPct?: string | null;
  precioCompra?: string | null;
  monedaCompra?: 'ARS' | 'USD' | null;
  elaboracionUsd?: string | null;
  elaboracionPor?: 'PIEZA' | 'GRAMO' | null;
  insumosArs?: string | null;
  stockMinimo: number | null;
  activo: boolean;
  categoria: { id: string; nombre: string; margenDefectoPct?: string } | null;
  precio: PrecioProducto;
  rangoStock?: { desde: string | null; hasta: string | null; unidades: number } | null;
}

export interface ListaProductos {
  items: Producto[];
  total: number;
  pagina: number;
  porPagina: number;
}

export interface Categoria {
  id: string;
  nombre: string;
  margenDefectoPct?: string;
  _count: { productos: number };
}