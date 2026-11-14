import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Rol } from '../generated/prisma/client.js';
import { ROLES_KEY } from './roles.decorator.js';
import type { UsuarioActual } from './types.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesRequeridos = this.reflector.getAllAndOverride<Rol[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si la ruta no pide roles, alcanza con estar logueado
    if (!rolesRequeridos || rolesRequeridos.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: UsuarioActual }>();
    if (!user || !rolesRequeridos.includes(user.rol)) {
      throw new ForbiddenException('No tenés permisos para realizar esta acción');
    }
    return true;
  }
}