import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EstadoVenta, Prisma } from '../generated/prisma/client.js';
import { esErrorUnico } from '../common/prisma-errors.js';
import type { UsuarioActual } from '../auth/types.js';
import { CreateClienteDto, QueryClientesDto, UpdateClienteDto } from './dto/cliente.dto.js';

// undefined = no se toca (PATCH); vacío = se borra (null)
const limpiar = (v: string | null | undefined) => (v === undefined ? undefined : v?.trim() || null);

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(query: QueryClientesDto, user: UsuarioActual) {
    const where: Prisma.ClienteWhereInput = { negocioId: user.negocioId };
    const texto = query.buscar?.trim();
    if (texto) {
      const digitos = texto.replace(/\D/g, '');
      where.OR = [
        { nombre: { contains: texto, mode: 'insensitive' } },
        { email: { contains: texto, mode: 'insensitive' } },
        { telefono: { contains: texto } },
        ...(digitos ? [{ dni: { contains: digitos } }] : []),
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.cliente.findMany({
        where,
        include: { _count: { select: { ventas: true } } },
        orderBy: { nombre: 'asc' },
        skip: (query.pagina - 1) * query.porPagina,
        take: query.porPagina,
      }),
      this.prisma.cliente.count({ where }),
    ]);
    return { items, total, pagina: query.pagina, porPagina: query.porPagina };
  }

  // Ficha con el resumen de compras
  async findOne(id: string, user: UsuarioActual) {
    const cliente = await this.buscar(id, user);

    const [compras, devoluciones, ultima] = await Promise.all([
      this.prisma.venta.aggregate({
        where: { clienteId: id, estado: EstadoVenta.CONFIRMADA },
        _count: true,
        _sum: { total: true },
      }),
      this.prisma.devolucion.aggregate({
        where: { venta: { clienteId: id } },
        _sum: { montoArs: true },
      }),
      this.prisma.venta.findFirst({
        where: { clienteId: id, estado: EstadoVenta.CONFIRMADA },
        orderBy: { fecha: 'desc' },
        select: { fecha: true },
      }),
    ]);

    const cero = new Prisma.Decimal(0);
    return {
      ...cliente,
      resumen: {
        compras: compras._count,
        totalComprado: (compras._sum.total ?? cero).minus(devoluciones._sum.montoArs ?? cero),
        ultimaCompra: ultima?.fecha ?? null,
      },
    };
  }

  async create(dto: CreateClienteDto, user: UsuarioActual) {
    try {
      return await this.prisma.cliente.create({
        data: { ...this.normalizar(dto), nombre: dto.nombre.trim(), negocioId: user.negocioId },
      });
    } catch (e) {
      if (esErrorUnico(e)) throw new ConflictException('Ya existe un cliente con ese DNI');
      throw e;
    }
  }

  async update(id: string, dto: UpdateClienteDto, user: UsuarioActual) {
    await this.buscar(id, user);
    try {
      return await this.prisma.cliente.update({ where: { id }, data: this.normalizar(dto) });
    } catch (e) {
      if (esErrorUnico(e)) throw new ConflictException('Ya existe un cliente con ese DNI');
      throw e;
    }
  }

  private async buscar(id: string, user: UsuarioActual) {
    const cliente = await this.prisma.cliente.findFirst({ where: { id, negocioId: user.negocioId } });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');
    return cliente;
  }

  private normalizar(dto: UpdateClienteDto) {
    const dni = limpiar(dto.dni);
    return {
      nombre: dto.nombre?.trim(),
      telefono: limpiar(dto.telefono),
      email: limpiar(dto.email)?.toLowerCase() ?? limpiar(dto.email),
      dni: dni ? dni.replace(/\D/g, '') : dni, // "30.123.456" → "30123456"
      notas: limpiar(dto.notas),
    };
  }
}