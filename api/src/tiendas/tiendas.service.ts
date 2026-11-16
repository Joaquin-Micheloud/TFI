import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma, Rol } from '../generated/prisma/client.js';
import type { UsuarioActual } from '../auth/types.js';
import { CreateTiendaDto } from './dto/create-tienda.dto.js';
import { UpdateTiendaDto } from './dto/update-tienda.dto.js';

@Injectable()
export class TiendasService {
  constructor(private readonly prisma: PrismaService) {}

  // Filtro base: siempre el negocio del usuario.
  // Un VENDEDOR además solo ve las tiendas que tiene asignadas.
  private filtroVisibilidad(user: UsuarioActual): Prisma.TiendaWhereInput {
    const filtro: Prisma.TiendaWhereInput = { negocioId: user.negocioId };
        // Gerente y vendedor: solo las tiendas que tienen asignadas
    if (user.rol !== Rol.ADMIN) {
      filtro.usuarios = { some: { membresiaId: user.membresiaId } };
    }
    return filtro;
  }

  findAll(user: UsuarioActual) {
    return this.prisma.tienda.findMany({
      where: this.filtroVisibilidad(user),
      orderBy: { nombre: 'asc' },
    });
  }

  async findOne(id: string, user: UsuarioActual) {
    const tienda = await this.prisma.tienda.findFirst({
      where: { id, ...this.filtroVisibilidad(user) },
    });
    // 404 tanto si no existe como si es de otro negocio: no revelamos datos ajenos
    if (!tienda) throw new NotFoundException('Tienda no encontrada');
    return tienda;
  }

  async create(dto: CreateTiendaDto, user: UsuarioActual) {
    // Punto de venta correlativo dentro del negocio: 1, 2, 3...
    const ultimo = await this.prisma.tienda.aggregate({
      where: { negocioId: user.negocioId },
      _max: { puntoVenta: true },
    });
    try {
      return await this.prisma.tienda.create({
        data: {
          ...dto,
          nombre: dto.nombre.trim(),
          negocioId: user.negocioId,
          puntoVenta: (ultimo._max.puntoVenta ?? 0) + 1,
        },
      });
    } catch (e) {
      this.manejarNombreDuplicado(e);
    }
  }

  async update(id: string, dto: UpdateTiendaDto, user: UsuarioActual) {
    await this.findOne(id, user); // valida que sea de su negocio
    try {
      return await this.prisma.tienda.update({
        where: { id },
        data: { ...dto, nombre: dto.nombre?.trim() },
      });
    } catch (e) {
      this.manejarNombreDuplicado(e);
    }
  }

  // Baja lógica: no borramos la fila porque más adelante va a tener stock y ventas asociadas
  async remove(id: string, user: UsuarioActual) {
    await this.findOne(id, user);
    return this.prisma.tienda.update({ where: { id }, data: { activa: false } });
  }

  private manejarNombreDuplicado(e: unknown): never {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ConflictException('Ya existe una tienda con ese nombre en tu negocio');
    }
    throw e;
  }
}