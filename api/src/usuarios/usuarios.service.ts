import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma, Rol } from '../generated/prisma/client.js';
import { sinIndefinidos } from '../common/objetos.js';
import type { UsuarioActual } from '../auth/types.js';
import { UpdateUsuarioDto } from './dto/update-usuario.dto.js';

const incluir = {
  usuario: { select: { id: true, email: true, nombre: true } },
  tiendas: { include: { tienda: { select: { id: true, nombre: true } } } },
} satisfies Prisma.MembresiaInclude;

export type MembresiaConDatos = Prisma.MembresiaGetPayload<{ include: typeof incluir }>;

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: UsuarioActual) {
    const membresias = await this.prisma.membresia.findMany({
      where: await this.filtroVisibilidad(user),
      include: incluir,
      orderBy: { creadoEn: 'asc' },
    });
    return membresias.map((m) => this.formatear(m));
  }

  async findOne(id: string, user: UsuarioActual) {
    return this.formatear(await this.buscarMembresia(id, user));
  }

  async update(id: string, dto: UpdateUsuarioDto, user: UsuarioActual) {
    const membresia = await this.buscarMembresia(id, user);

    // El gerente solo activa o desactiva vendedores de sus tiendas
    if (user.rol === Rol.GERENTE) {
      if (membresia.rol !== Rol.VENDEDOR) {
        throw new ForbiddenException('Un gerente solo puede gestionar vendedores');
      }
      const campos = Object.keys(sinIndefinidos(dto));
      if (campos.some((c) => c !== 'activo')) {
        throw new ForbiddenException('Un gerente solo puede activar o desactivar vendedores');
      }
    }

    // Un ADMIN no puede quitarse el rol ni desactivarse a sí mismo
    if (id === user.membresiaId && ((dto.rol && dto.rol !== Rol.ADMIN) || dto.activo === false)) {
      throw new BadRequestException('No podés quitarte el rol de ADMIN ni desactivarte');
    }

    await this.validarTiendas(dto.tiendaIds, user);

    const actualizada = await this.prisma.membresia.update({
      where: { id },
      data: {
        rol: dto.rol,
        topeDescuento: dto.topeDescuento,
        activo: dto.activo,
        tiendas: dto.tiendaIds
          ? { deleteMany: {}, create: dto.tiendaIds.map((tiendaId) => ({ tiendaId })) }
          : undefined,
      },
      include: incluir,
    });
    return this.formatear(actualizada);
  }

  // ---------- Internos ----------

  // ADMIN ve a todos. GERENTE se ve a sí mismo y a los vendedores de sus tiendas.
  private async filtroVisibilidad(user: UsuarioActual): Promise<Prisma.MembresiaWhereInput> {
    const filtro: Prisma.MembresiaWhereInput = { negocioId: user.negocioId };
    if (user.rol === Rol.GERENTE) {
      const misTiendas = await this.tiendasDe(user.membresiaId);
      filtro.OR = [
        { id: user.membresiaId },
        { rol: Rol.VENDEDOR, tiendas: { some: { tiendaId: { in: misTiendas } } } },
      ];
    }
    return filtro;
  }

  private async buscarMembresia(id: string, user: UsuarioActual) {
    const membresia = await this.prisma.membresia.findFirst({
      where: { id, ...(await this.filtroVisibilidad(user)) },
      include: incluir,
    });
    if (!membresia) throw new NotFoundException('Usuario no encontrado en tu negocio');
    return membresia;
  }

  private async tiendasDe(membresiaId: string) {
    const asignadas = await this.prisma.usuarioTienda.findMany({
      where: { membresiaId },
      select: { tiendaId: true },
    });
    return asignadas.map((a) => a.tiendaId);
  }

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
      id: m.id,
      usuario: m.usuario,
      rol: m.rol,
      topeDescuento: m.topeDescuento,
      activo: m.activo,
      creadoEn: m.creadoEn,
      tiendas: m.tiendas.map((t) => t.tienda),
    };
  }
}