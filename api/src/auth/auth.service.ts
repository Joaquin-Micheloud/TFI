import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProveedorAuth, Rol } from '../generated/prisma/client.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import type { JwtPayload } from './types.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();

    const existe = await this.prisma.usuario.findUnique({ where: { email } });
    if (existe) {
      throw new ConflictException('Ya existe una cuenta con ese email');
    }

    const passwordHash = await hash(dto.password, 10);

    // Usuario + membresía ADMIN + negocio en una sola operación atómica
    const usuario = await this.prisma.usuario.create({
      data: {
        email,
        nombre: dto.nombre.trim(),
        proveedorAuth: ProveedorAuth.EMAIL,
        passwordHash,
        membresias: {
          create: {
            rol: Rol.ADMIN,
            negocio: { create: { nombre: dto.nombreNegocio.trim() } },
          },
        },
      },
      include: { membresias: { include: { negocio: true } } },
    });

    return this.armarRespuesta(usuario, usuario.membresias[0]);
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();

    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
      include: {
        membresias: {
          where: { activo: true },
          include: { negocio: true },
          orderBy: { creadoEn: 'asc' },
        },
      },
    });

    // Mismo mensaje en todos los casos para no revelar qué emails existen
    if (!usuario || !usuario.passwordHash) {
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }

    const ok = await compare(dto.password, usuario.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }

    const membresia = usuario.membresias[0];
    if (!membresia) {
      throw new UnauthorizedException('Tu usuario no tiene acceso a ningún negocio');
    }

    return this.armarRespuesta(usuario, membresia);
  }

  async me(usuarioId: string, negocioId: string) {
    const membresia = await this.prisma.membresia.findUnique({
      where: { usuarioId_negocioId: { usuarioId, negocioId } },
      include: {
        usuario: { select: { id: true, email: true, nombre: true, verificado: true } },
        negocio: { select: { id: true, nombre: true, tipoDolar: true } },
        tiendas: { include: { tienda: { select: { id: true, nombre: true } } } },
      },
    });

    if (!membresia || !membresia.activo) {
      throw new NotFoundException('Membresía no encontrada');
    }

    return {
      usuario: membresia.usuario,
      negocio: membresia.negocio,
      rol: membresia.rol,
      tiendas: membresia.tiendas.map((t) => t.tienda),
    };
  }

  async armarRespuesta(
    usuario: { id: string; email: string; nombre: string | null },
    membresia: { rol: Rol; negocio: { id: string; nombre: string } },
  ) {
    const payload: JwtPayload = {
      sub: usuario.id,
      email: usuario.email,
      negocioId: membresia.negocio.id,
      rol: membresia.rol,
    };

    return {
      accessToken: await this.jwt.signAsync(payload),
      usuario: { id: usuario.id, email: usuario.email, nombre: usuario.nombre },
      negocio: { id: membresia.negocio.id, nombre: membresia.negocio.nombre },
      rol: membresia.rol,
    };
  }
}