import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import type { JwtPayload, UsuarioActual } from './types.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  // Se ejecuta en cada request con token válido
  async validate(payload: JwtPayload): Promise<UsuarioActual> {
    const membresia = await this.prisma.membresia.findUnique({
      where: {
        usuarioId_negocioId: { usuarioId: payload.sub, negocioId: payload.negocioId },
      },
      select: { id: true, rol: true, activo: true },
    });

    if (!membresia || !membresia.activo) {
      throw new UnauthorizedException('Tu acceso a este negocio está desactivado');
    }

    return {
      usuarioId: payload.sub,
      membresiaId: membresia.id,
      email: payload.email,
      negocioId: payload.negocioId,
      rol: membresia.rol,
    };
  }
}