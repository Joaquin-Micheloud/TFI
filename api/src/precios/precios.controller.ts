import { Body, Controller, Get, Param, ParseEnumPipe, Post, Put, Query } from '@nestjs/common';
import { Metal, Rol } from '../generated/prisma/client.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import type { UsuarioActual } from '../auth/types.js';
import { PrecioGramoService } from './precio-gramo.service.js';
import { ConfigMetalDto } from './dto/config-metal.dto.js';
import { PrecioManualDto } from './dto/precio-manual.dto.js';
import { GramoQueryDto } from './dto/gramo-query.dto.js';

@Controller('precios')
export class PreciosController {
  constructor(private readonly precioGramo: PrecioGramoService) {}

  @Get('gramo')
  gramo(@Query() q: GramoQueryDto, @CurrentUser() user: UsuarioActual) {
    return this.precioGramo.calcular(user.negocioId, q.metal, q.ley);
  }

  @Get('tabla')
  tabla(@CurrentUser() user: UsuarioActual) {
    return this.precioGramo.tabla(user.negocioId);
  }

  @Get('config')
  obtenerConfig(@CurrentUser() user: UsuarioActual) {
    return this.precioGramo.obtenerConfig(user.negocioId);
  }

  @Roles(Rol.ADMIN)
  @Put('config/:metal')
  guardarConfig(
    @Param('metal', new ParseEnumPipe(Metal)) metal: Metal,
    @Body() dto: ConfigMetalDto,
    @CurrentUser() user: UsuarioActual,
  ) {
    return this.precioGramo.guardarConfig(user.negocioId, metal, dto.modo, dto.ajustePct);
  }

  @Roles(Rol.ADMIN, Rol.GERENTE)
  @Get('manual')
  historialManual(@Query('metal') metal: Metal | undefined, @CurrentUser() user: UsuarioActual) {
    return this.precioGramo.historialManual(user.negocioId, metal);
  }

  @Roles(Rol.ADMIN)
  @Post('manual')
  cargarManual(@Body() dto: PrecioManualDto, @CurrentUser() user: UsuarioActual) {
    return this.precioGramo.cargarPrecioManual(
      user.negocioId,
      user.usuarioId,
      dto.metal,
      dto.ley,
      dto.precioArs,
    );
  }
}