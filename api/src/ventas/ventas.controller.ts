import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { UsuarioActual } from '../auth/types.js';
import { VentasService } from './ventas.service.js';
import { CotizarVentaDto, CrearVentaDto } from './dto/crear-venta.dto.js';
import { BuscarParaVenderDto, QueryVentasDto } from './dto/query-ventas.dto.js';
import { Rol } from '../generated/prisma/client.js';
import { Roles } from '../auth/roles.decorator.js';
import { DevolucionesService } from './devoluciones.service.js';
import { AnularVentaDto, DevolucionDto } from './dto/devolucion.dto.js';

// Todos los roles venden. Cada uno ve lo que le corresponde (ver filtroVisibilidad).
@Controller('ventas')
export class VentasController {
  constructor(
    private readonly ventasService: VentasService,
    private readonly devolucionesService: DevolucionesService,
  ) {}

  @Post('cotizar')
  @HttpCode(200)
  cotizar(@Body() dto: CotizarVentaDto, @CurrentUser() user: UsuarioActual) {
    return this.ventasService.cotizar(dto, user);
  }

  @Post()
  crear(@Body() dto: CrearVentaDto, @CurrentUser() user: UsuarioActual) {
    return this.ventasService.crear(dto, user);
  }

  @Get()
  listar(@Query() query: QueryVentasDto, @CurrentUser() user: UsuarioActual) {
    return this.ventasService.listar(query, user);
  }

  @Get('buscar')
  buscar(@Query() dto: BuscarParaVenderDto, @CurrentUser() user: UsuarioActual) {
    return this.ventasService.buscarParaVender(dto, user);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: UsuarioActual) {
    return this.ventasService.findOne(id, user);
  }

  @Get(':id/ticket')
  async ticket(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: UsuarioActual) {
    const { buffer, nombreArchivo } = await this.ventasService.ticket(id, user);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `inline; filename="${nombreArchivo}"`,
    });
  }

  @Roles(Rol.ADMIN, Rol.GERENTE)
  @Post(':id/anular')
  @HttpCode(200)
  async anular(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnularVentaDto,
    @CurrentUser() user: UsuarioActual,
  ) {
    await this.devolucionesService.anular(id, dto, user);
    return this.ventasService.findOne(id, user);
  }

  @Roles(Rol.ADMIN, Rol.GERENTE)
  @Post(':id/devoluciones')
  async devolver(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DevolucionDto,
    @CurrentUser() user: UsuarioActual,
  ) {
    await this.devolucionesService.devolver(id, dto, user);
    return this.ventasService.findOne(id, user);
  }
}