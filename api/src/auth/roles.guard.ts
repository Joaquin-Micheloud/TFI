import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Rol } from '../generated/prisma/client.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { ROLES_KEY } from './roles.decorator.js';
import type { UsuarioActual } from './types.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const objetivos = [context.getHandler(), context.getClass()];

    // Las rutas públicas no tienen usuario: no se controlan roles
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, objetivos)) return true;

    const rolesRequeridos = this.reflector.getAllAndOverride<Rol[] | undefined>(ROLES_KEY, objetivos);
    if (!rolesRequeridos || rolesRequeridos.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: UsuarioActual }>();
    if (!user || !rolesRequeridos.includes(user.rol)) {
      throw new ForbiddenException('No tenés permisos para realizar esta acción');
    }
    return true;
  }
}