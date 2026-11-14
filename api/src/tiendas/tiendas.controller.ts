import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Rol } from '../generated/prisma/client.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import type { UsuarioActual } from '../auth/types.js';
import { TiendasService } from './tiendas.service.js';
import { CreateTiendaDto } from './dto/create-tienda.dto.js';
import { UpdateTiendaDto } from './dto/update-tienda.dto.js';

@Controller('tiendas')
export class TiendasController {
  constructor(private readonly tiendasService: TiendasService) {}

  @Get()
  findAll(@CurrentUser() user: UsuarioActual) {
    return this.tiendasService.findAll(user);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: UsuarioActual) {
    return this.tiendasService.findOne(id, user);
  }

  @Roles(Rol.ADMIN)
  @Post()
  create(@Body() dto: CreateTiendaDto, @CurrentUser() user: UsuarioActual) {
    return this.tiendasService.create(dto, user);
  }

  @Roles(Rol.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTiendaDto,
    @CurrentUser() user: UsuarioActual,
  ) {
    return this.tiendasService.update(id, dto, user);
  }

  @Roles(Rol.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: UsuarioActual) {
    return this.tiendasService.remove(id, user);
  }
}