import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Rol } from '../generated/prisma/client.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import type { UsuarioActual } from '../auth/types.js';
import { UsuariosService } from './usuarios.service.js';
import { CreateUsuarioDto } from './dto/create-usuario.dto.js';
import { UpdateUsuarioDto } from './dto/update-usuario.dto.js';

@Controller('usuarios')
@Roles(Rol.ADMIN) // por defecto, solo ADMIN
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  @Roles(Rol.ADMIN, Rol.GERENTE) // el gerente puede ver al equipo
  findAll(@CurrentUser() user: UsuarioActual) {
    return this.usuariosService.findAll(user);
  }

  @Get(':id')
  @Roles(Rol.ADMIN, Rol.GERENTE)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: UsuarioActual) {
    return this.usuariosService.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateUsuarioDto, @CurrentUser() user: UsuarioActual) {
    return this.usuariosService.create(dto, user);
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