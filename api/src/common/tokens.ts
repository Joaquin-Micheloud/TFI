import { createHash, randomBytes } from 'node:crypto';

// El token viaja en el link. En la base solo se guarda su hash:
// si alguien lee la tabla, no puede usar las invitaciones.
export function generarToken() {
  const token = randomBytes(32).toString('hex'); // 64 caracteres
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}