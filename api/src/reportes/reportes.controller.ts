import { Controller, Get, Query } from '@nestjs/common';
import { Rol } from '../generated/prisma/client.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import type { UsuarioActual } from '../auth/types.js';
import { ReportesService } from './reportes.service.js';
import { QueryCajaDto, QueryPeriodoDto, QueryValorizacionDto } from './dto/reportes.dto.js';

// Administrador: todas las tiendas. Gerente: las suyas. Vendedor: solo su caja del día.
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportes: ReportesService) {}

  @Roles(Rol.ADMIN, Rol.GERENTE)
  @Get('valorizacion')
  valorizacion(@Query() query: QueryValorizacionDto, @CurrentUser() user: UsuarioActual) {
    return this.reportes.valorizacion(query, user);
  }

  @Roles(Rol.ADMIN, Rol.GERENTE)
  @Get('ventas')
  ventas(@Query() query: QueryPeriodoDto, @CurrentUser() user: UsuarioActual) {
    return this.reportes.ventas(query, user);
  }

  @Get('caja')
  caja(@Query() query: QueryCajaDto, @CurrentUser() user: UsuarioActual) {
    return this.reportes.caja(query, user);
  }
}
