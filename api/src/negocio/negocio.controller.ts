import { Body, Controller, Get, Patch } from '@nestjs/common';
import { Rol } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import type { UsuarioActual } from '../auth/types.js';
import { UpdateNegocioDto } from './dto/update-negocio.dto.js';

const campos = {
  id: true,
  nombre: true,
  cuit: true,
  tipoDolar: true,
  reglaRedondeo: true,
  plan: true,
} as const;

@Controller('negocio')
export class NegocioController {
  constructor(private readonly prisma: PrismaService) {}

  // El negocio siempre es el del token: no hay :id en la ruta
  @Get()
  obtener(@CurrentUser() user: UsuarioActual) {
    return this.prisma.negocio.findUniqueOrThrow({ where: { id: user.negocioId }, select: campos });
  }

  @Roles(Rol.ADMIN)
  @Patch()
  actualizar(@Body() dto: UpdateNegocioDto, @CurrentUser() user: UsuarioActual) {
    return this.prisma.negocio.update({
      where: { id: user.negocioId },
      data: { ...dto, nombre: dto.nombre?.trim() },
      select: campos,
    });
  }
}