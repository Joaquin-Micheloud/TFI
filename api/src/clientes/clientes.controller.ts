import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { UsuarioActual } from '../auth/types.js';
import { ClientesService } from './clientes.service.js';
import { CreateClienteDto, QueryClientesDto, UpdateClienteDto } from './dto/cliente.dto.js';

// Todos los roles: el vendedor carga clientes en el mostrador
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Get()
  listar(@Query() query: QueryClientesDto, @CurrentUser() user: UsuarioActual) {
    return this.clientesService.listar(query, user);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: UsuarioActual) {
    return this.clientesService.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateClienteDto, @CurrentUser() user: UsuarioActual) {
    return this.clientesService.create(dto, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClienteDto,
    @CurrentUser() user: UsuarioActual,
  ) {
    return this.clientesService.update(id, dto, user);
  }
}