import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { Rol } from '../generated/prisma/client.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import type { UsuarioActual } from '../auth/types.js';
import { UsuariosService } from './usuarios.service.js';
import { UpdateUsuarioDto } from './dto/update-usuario.dto.js';

// El alta de usuarios se hace por invitación: ver /invitaciones
@Controller('usuarios')
@Roles(Rol.ADMIN, Rol.GERENTE)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  findAll(@CurrentUser() user: UsuarioActual) {
    return this.usuariosService.findAll(user);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: UsuarioActual) {
    return this.usuariosService.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUsuarioDto,
    @CurrentUser() user: UsuarioActual,
  ) {
    return this.usuariosService.update(id, dto, user);
  }
}