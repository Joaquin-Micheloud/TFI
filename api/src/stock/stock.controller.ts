import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Rol } from '../generated/prisma/client.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import type { UsuarioActual } from '../auth/types.js';
import { StockService } from './stock.service.js';
import { IngresoPiezasDto } from './dto/ingreso-piezas.dto.js';
import { IngresoLoteDto } from './dto/ingreso-lote.dto.js';
import { BajaLoteDto, BajaPiezaDto } from './dto/baja.dto.js';
import { AjusteLoteDto } from './dto/ajuste-lote.dto.js';
import { QueryMovimientosDto, QueryStockDto } from './dto/query-stock.dto.js';

@Controller('stock')
@Roles(Rol.ADMIN, Rol.GERENTE) // operar el stock: admin y gerente (en sus tiendas)
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get('resumen')
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.VENDEDOR)
  resumen(@Query() query: QueryStockDto, @CurrentUser() user: UsuarioActual) {
    return this.stockService.resumen(query, user);
  }

  @Get('piezas')
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.VENDEDOR)
  listarPiezas(@Query() query: QueryStockDto, @CurrentUser() user: UsuarioActual) {
    return this.stockService.listarPiezas(query, user);
  }

  @Get('lotes')
  @Roles(Rol.ADMIN, Rol.GERENTE, Rol.VENDEDOR)
  listarLotes(@Query() query: QueryStockDto, @CurrentUser() user: UsuarioActual) {
    return this.stockService.listarLotes(query, user);
  }

  @Get('movimientos')
  movimientos(@Query() query: QueryMovimientosDto, @CurrentUser() user: UsuarioActual) {
    return this.stockService.movimientos(query, user);
  }

  @Post('piezas')
  ingresarPiezas(@Body() dto: IngresoPiezasDto, @CurrentUser() user: UsuarioActual) {
    return this.stockService.ingresarPiezas(dto, user);
  }

  @Post('lotes')
  ingresarLote(@Body() dto: IngresoLoteDto, @CurrentUser() user: UsuarioActual) {
    return this.stockService.ingresarLote(dto, user);
  }

  @Post('piezas/:id/baja')
  @HttpCode(200)
  bajaPieza(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BajaPiezaDto,
    @CurrentUser() user: UsuarioActual,
  ) {
    return this.stockService.bajaPieza(id, dto, user);
  }

  @Post('lotes/:id/baja')
  @HttpCode(200)
  bajaLote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BajaLoteDto,
    @CurrentUser() user: UsuarioActual,
  ) {
    return this.stockService.bajaLote(id, dto, user);
  }

  @Post('lotes/:id/ajuste')
  @HttpCode(200)
  ajustarLote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AjusteLoteDto,
    @CurrentUser() user: UsuarioActual,
  ) {
    return this.stockService.ajustarLote(id, dto, user);
  }
}