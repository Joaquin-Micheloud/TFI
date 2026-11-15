import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma, ProveedorAuth, Rol } from '../generated/prisma/client.js';
import type { UsuarioActual } from '../auth/types.js';
import { CreateUsuarioDto } from './dto/create-usuario.dto.js';
import { UpdateUsuarioDto } from './dto/update-usuario.dto.js';

// Qué datos traemos de cada membresía
const incluir = {
  usuario: { select: { id: true, email: true, nombre: true } },
  tiendas: { include: { tienda: { select: { id: true, nombre: true } } } },
} satisfies Prisma.MembresiaInclude;

type MembresiaConDatos = Prisma.MembresiaGetPayload<{ include: typeof incluir }>;

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: UsuarioActual) {
    const membresias = await this.prisma.membresia.findMany({
      where: { negocioId: user.negocioId },
      include: incluir,
      orderBy: { creadoEn: 'asc' },
    });
    return membresias.map((m) => this.formatear(m));
  }

  async findOne(id: string, user: UsuarioActual) {
    return this.formatear(await this.buscarMembresia(id, user));
  }

  async create(dto: CreateUsuarioDto, user: UsuarioActual) {
    const email = dto.email.trim().toLowerCase();

    const existe = await this.prisma.usuario.findUnique({ where: { email } });
    if (existe) {
      throw new ConflictException('Ese email ya tiene una cuenta en QuilateAr');
    }

    await this.validarTiendas(dto.tiendaIds, user);
    const passwordHash = await hash(dto.password, 10);

    const usuario = await this.prisma.usuario.create({
      data: {
        email,
        nombre: dto.nombre.trim(),
        proveedorAuth: ProveedorAuth.EMAIL,
        passwordHash,
        membresias: {
          create: {
            negocioId: user.negocioId,
            rol: dto.rol,
            topeDescuento: dto.topeDescuento ?? 0,
            tiendas: {
              create: (dto.tiendaIds ?? []).map((tiendaId) => ({ tiendaId })),
            },
          },
        },
      },
      include: { membresias: { include: incluir } },
    });

    return this.formatear(usuario.membresias[0]);
  }

  async update(id: string, dto: UpdateUsuarioDto, user: UsuarioActual) {
    await this.buscarMembresia(id, user);

    // Un ADMIN no puede quitarse el rol ni desactivarse a sí mismo.
    // Así evitamos que el negocio quede sin nadie que lo administre.
    if (id === user.membresiaId) {
      if ((dto.rol && dto.rol !== Rol.ADMIN) || dto.activo === false) {
        throw new BadRequestException('No podés quitarte el rol de ADMIN ni desactivarte');
      }
    }

    await this.validarTiendas(dto.tiendaIds, user);

    const membresia = await this.prisma.membresia.update({
      where: { id },
      data: {
        rol: dto.rol,
        topeDescuento: dto.topeDescuento,
        activo: dto.activo,
        tiendas: dto.tiendaIds
          ? {
              deleteMany: {}, // borra las asignaciones actuales
              create: dto.tiendaIds.map((tiendaId) => ({ tiendaId })),
            }
          : undefined,
      },
      include: incluir,
    });

    return this.formatear(membresia);
  }

  private async buscarMembresia(id: string, user: UsuarioActual) {
    const membresia = await this.prisma.membresia.findFirst({
      where: { id, negocioId: user.negocioId },
      include: incluir,
    });
    if (!membresia) throw new NotFoundException('Usuario no encontrado en tu negocio');
    return membresia;
  }

  // Todas las tiendas tienen que existir, estar activas y ser del negocio
  private async validarTiendas(tiendaIds: string[] | undefined, user: UsuarioActual) {
    if (!tiendaIds || tiendaIds.length === 0) return;

    const cantidad = await this.prisma.tienda.count({
      where: { id: { in: tiendaIds }, negocioId: user.negocioId, activa: true },
    });
    if (cantidad !== tiendaIds.length) {
      throw new BadRequestException('Alguna de las tiendas no existe, está inactiva o no es de tu negocio');
    }
  }

  private formatear(m: MembresiaConDatos) {
    return {
      id: m.id, // id de la membresía: es el que se usa en GET/PATCH /usuarios/:id
      usuario: m.usuario,
      rol: m.rol,
      topeDescuento: m.topeDescuento,
      activo: m.activo,
      creadoEn: m.creadoEn,
      tiendas: m.tiendas.map((t) => t.tienda),
    };
  }
}