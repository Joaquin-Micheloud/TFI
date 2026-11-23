import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Rol } from '../generated/prisma/client.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import type { UsuarioActual } from '../auth/types.js';
import { TransferenciasService } from './transferencias.service.js';
import { CrearTransferenciaDto, QueryTransferenciasDto } from './dto/transferencia.dto.js';

// Todos ven las transferencias de sus tiendas y pueden recibir en las suyas.
// Enviar y cancelar: administrador y gerente.
@Controller('transferencias')
export class TransferenciasController {
  constructor(private readonly transferencias: TransferenciasService) {}

  @Get()
  listar(@Query() query: QueryTransferenciasDto, @CurrentUser() user: UsuarioActual) {
    return this.transferencias.listar(query, user);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: UsuarioActual) {
    return this.transferencias.findOne(id, user);
  }

  @Roles(Rol.ADMIN, Rol.GERENTE)
  @Post()
  crear(@Body() dto: CrearTransferenciaDto, @CurrentUser() user: UsuarioActual) {
    return this.transferencias.crear(dto, user);
  }

  @Post(':id/recibir')
  @HttpCode(200)
  recibir(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: UsuarioActual) {
    return this.transferencias.recibir(id, user);
  }

  @Roles(Rol.ADMIN, Rol.GERENTE)
  @Post(':id/cancelar')
  @HttpCode(200)
  cancelar(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: UsuarioActual) {
    return this.transferencias.cancelar(id, user);
  }
}
