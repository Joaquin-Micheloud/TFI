export type Rol = 'ADMIN' | 'GERENTE' | 'VENDEDOR';

export interface UsuarioSesion {
  id: string;
  email: string;
  nombre: string | null;
}

export interface NegocioSesion {
  id: string;
  nombre: string;
}

export interface Sesion {
  usuario: UsuarioSesion;
  negocio: NegocioSesion;
  rol: Rol;
  tiendas?: { id: string; nombre: string }[];
}

// Lo que devuelven /auth/login, /auth/register y /invitaciones/aceptar
export interface RespuestaLogin extends Sesion {
  accessToken: string;
}

// Lo que devuelve /auth/me
export interface RespuestaMe {
  usuario: UsuarioSesion & { verificado: boolean };
  negocio: NegocioSesion & { tipoDolar: string };
  rol: Rol;
  tiendas: { id: string; nombre: string }[];
}

export const NOMBRE_ROL: Record<Rol, string> = {
  ADMIN: 'Administrador',
  GERENTE: 'Gerente',
  VENDEDOR: 'Vendedor',
};