import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UsuarioActual } from './types.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UsuarioActual => {
    const request = ctx.switchToHttp().getRequest<{ user: UsuarioActual }>();
    return request.user;
  },
);