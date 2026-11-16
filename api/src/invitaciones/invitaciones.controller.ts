import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Rol } from '../generated/prisma/client.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Public } from '../auth/public.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import type { UsuarioActual } from '../auth/types.js';
import { InvitacionesService } from './invitaciones.service.js';
import { CrearInvitacionDto } from './dto/crear-invitacion.dto.js';
import { AceptarInvitacionDto } from './dto/aceptar-invitacion.dto.js';

@Controller('invitaciones')
@Roles(Rol.ADMIN, Rol.GERENTE)
export class InvitacionesController {
  constructor(private readonly invitacionesService: InvitacionesService) {}

  @Get()
  listar(@CurrentUser() user: UsuarioActual) {
    return this.invitacionesService.listar(user);
  }

  @Post()
  crear(@Body() dto: CrearInvitacionDto, @CurrentUser() user: UsuarioActual) {
    return this.invitacionesService.crear(dto, user);
  }

  @Post(':id/reenviar')
  @HttpCode(200)
  reenviar(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: UsuarioActual) {
    return this.invitacionesService.reenviar(id, user);
  }

  @Delete(':id')
  cancelar(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: UsuarioActual) {
    return this.invitacionesService.cancelar(id, user);
  }

  // ---- Públicos: los usa el invitado, que todavía no tiene sesión ----

  @Public()
  @Get('token/:token')
  consultar(@Param('token') token: string) {
    return this.invitacionesService.consultar(token);
  }

  @Public()
  @Post('aceptar')
  @HttpCode(200)
  aceptar(@Body() dto: AceptarInvitacionDto) {
    return this.invitacionesService.aceptar(dto);
  }
}