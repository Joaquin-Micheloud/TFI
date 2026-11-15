import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Rol } from '../generated/prisma/client.js';
import { esErrorUnico } from '../common/prisma-errors.js';
import type { UsuarioActual } from '../auth/types.js';
import { CreateCategoriaDto } from './dto/create-categoria.dto.js';
import { UpdateCategoriaDto } from './dto/update-categoria.dto.js';

@Injectable()
export class CategoriasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: UsuarioActual) {
    const categorias = await this.prisma.categoria.findMany({
      where: { negocioId: user.negocioId },
      include: { _count: { select: { productos: true } } },
      orderBy: { nombre: 'asc' },
    });
    // El vendedor no ve márgenes
    if (user.rol === Rol.VENDEDOR) {
      return categorias.map(({ margenDefectoPct, ...c }) => c);
    }
    return categorias;
  }

  async create(dto: CreateCategoriaDto, user: UsuarioActual) {
    try {
      return await this.prisma.categoria.create({
        data: {
          nombre: dto.nombre.trim(),
          margenDefectoPct: dto.margenDefectoPct ?? 0,
          negocioId: user.negocioId,
        },
      });
    } catch (e) {
      if (esErrorUnico(e)) throw new ConflictException('Ya existe una categoría con ese nombre');
      throw e;
    }
  }

  async update(id: string, dto: UpdateCategoriaDto, user: UsuarioActual) {
    await this.buscar(id, user);
    try {
      return await this.prisma.categoria.update({
        where: { id },
        data: { nombre: dto.nombre?.trim(), margenDefectoPct: dto.margenDefectoPct },
      });
    } catch (e) {
      if (esErrorUnico(e)) throw new ConflictException('Ya existe una categoría con ese nombre');
      throw e;
    }
  }

  // Borrado real: sus productos quedan sin categoría
  async remove(id: string, user: UsuarioActual) {
    await this.buscar(id, user);
    return this.prisma.categoria.delete({ where: { id } });
  }

  private async buscar(id: string, user: UsuarioActual) {
    const categoria = await this.prisma.categoria.findFirst({
      where: { id, negocioId: user.negocioId },
    });
    if (!categoria) throw new NotFoundException('Categoría no encontrada');
    return categoria;
  }
}