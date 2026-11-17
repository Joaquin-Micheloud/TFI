import type { Rol } from '../../lib/tipos';

export const COLOR_ROL: Record<Rol, string> = {
  ADMIN: 'grape',
  GERENTE: 'blue',
  VENDEDOR: 'teal',
};

export interface Miembro {
  id: string; // id de la membresía
  usuario: { id: string; email: string; nombre: string | null };
  rol: Rol;
  topeDescuento: string;
  activo: boolean;
  tiendas: { id: string; nombre: string }[];
}

export type EstadoInvitacion = 'PENDIENTE' | 'ACEPTADA' | 'CANCELADA' | 'VENCIDA';

export interface Invitacion {
  id: string;
  email: string;
  rol: Rol;
  topeDescuento: string;
  tiendaIds: string[];
  venceEn: string;
  estado: EstadoInvitacion;
  creadoEn: string;
  invitadoPor: { nombre: string | null; email: string };
}

export const COLOR_ESTADO_INVITACION: Record<EstadoInvitacion, string> = {
  PENDIENTE: 'yellow',
  ACEPTADA: 'green',
  CANCELADA: 'gray',
  VENCIDA: 'red',
};

export const NOMBRE_ESTADO_INVITACION: Record<EstadoInvitacion, string> = {
  PENDIENTE: 'Pendiente',
  ACEPTADA: 'Aceptada',
  CANCELADA: 'Cancelada',
  VENCIDA: 'Vencida',
};