export type EstadoTransferencia = 'ENVIADA' | 'RECIBIDA' | 'CANCELADA';

export const NOMBRE_ESTADO_TRANSFERENCIA: Record<EstadoTransferencia, string> = {
  ENVIADA: 'En tránsito',
  RECIBIDA: 'Recibida',
  CANCELADA: 'Cancelada',
};

export const COLOR_ESTADO_TRANSFERENCIA: Record<EstadoTransferencia, string> = {
  ENVIADA: 'cyan',
  RECIBIDA: 'green',
  CANCELADA: 'gray',
};

interface UsuarioResumen {
  nombre: string | null;
  email: string;
}

export interface ItemTransferencia {
  id: string;
  cantidad: number;
  piezaId: string | null;
  loteOrigenId: string | null;
  loteDestinoId: string | null;
  producto: { id: string; codigo: string; nombre: string };
  pieza: { codigo: string; pesoGramos: string } | null;
  loteOrigen: { fechaIngreso: string; pesoTotalGramos: string | null; cantidadInicial: number } | null;
}

export interface Transferencia {
  id: string;
  estado: EstadoTransferencia;
  nota: string | null;
  enviadaEn: string;
  recibidaEn: string | null;
  canceladaEn: string | null;
  origen: { id: string; nombre: string };
  destino: { id: string; nombre: string };
  enviadaPor: UsuarioResumen;
  recibidaPor: UsuarioResumen | null;
  canceladaPor: UsuarioResumen | null;
  items: ItemTransferencia[];
}

export const nombreUsuario = (u: UsuarioResumen) => u.nombre ?? u.email;

// Total de unidades que viajan
export const unidades = (t: Transferencia) => t.items.reduce((s, i) => s + i.cantidad, 0);
