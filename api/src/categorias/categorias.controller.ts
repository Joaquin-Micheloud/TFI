import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Rol } from '../generated/prisma/client.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import type { UsuarioActual } from '../auth/types.js';
import { CategoriasService } from './categorias.service.js';
import { CreateCategoriaDto } from './dto/create-categoria.dto.js';
import { UpdateCategoriaDto } from './dto/update-categoria.dto.js';

@Controller('categorias')
@Roles(Rol.ADMIN) // categorías y márgenes: solo el administrador
export class CategoriasController {
  constructor(private readonly categoriasService: CategoriasService) {}

  @Get()
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.VENDEDOR)
  findAll(@CurrentUser() user: UsuarioActual) {
    return this.categoriasService.findAll(user);
  }

  @Post()
  create(@Body() dto: CreateCategoriaDto, @CurrentUser() user: UsuarioActual) {
    return this.categoriasService.create(dto, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoriaDto,
    @CurrentUser() user: UsuarioActual,
  ) {
    return this.categoriasService.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: UsuarioActual) {
    return this.categoriasService.remove(id, user);
  }
}