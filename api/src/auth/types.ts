import type { Rol } from '../generated/prisma/client.js';

// Lo que guardamos dentro del token
export interface JwtPayload {
  sub: string; // id del usuario
  email: string;
  negocioId: string;
  rol: Rol;
}

// Lo que queda disponible en cada request autenticado
export interface UsuarioActual {
  usuarioId: string;
  email: string;
  negocioId: string;
  rol: Rol;
}