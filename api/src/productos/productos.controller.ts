import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Rol } from '../generated/prisma/client.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import type { UsuarioActual } from '../auth/types.js';
import { ProductosService } from './productos.service.js';
import { CreateProductoDto } from './dto/create-producto.dto.js';
import { UpdateProductoDto } from './dto/update-producto.dto.js';
import { QueryProductosDto } from './dto/query-productos.dto.js';
import { AjustePrecioCompraDto } from './dto/ajuste-precio-compra.dto.js';

@Controller('productos')
@Roles(Rol.ADMIN, Rol.GERENTE) // alta y edición: admin y gerente
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  @Get()
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.VENDEDOR)
  findAll(@Query() query: QueryProductosDto, @CurrentUser() user: UsuarioActual) {
    return this.productosService.findAll(query, user);
  }

  @Get(':id')
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.VENDEDOR)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: UsuarioActual) {
    return this.productosService.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateProductoDto, @CurrentUser() user: UsuarioActual) {
    return this.productosService.create(dto, user);
  }

  @Post('ajuste-precio-compra')
  @HttpCode(200)
  ajustarPrecioCompra(@Body() dto: AjustePrecioCompraDto, @CurrentUser() user: UsuarioActual) {
    return this.productosService.ajustarPrecioCompra(dto, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductoDto,
    @CurrentUser() user: UsuarioActual,
  ) {
    return this.productosService.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: UsuarioActual) {
    return this.productosService.remove(id, user);
  }
}