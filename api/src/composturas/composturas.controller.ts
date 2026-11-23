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
import { PrismaService } from '../prisma/prisma.service.js';
import { ComposturasService, numeroOrden } from './composturas.service.js';
import { ComprobanteService } from './comprobante.service.js';
import {
  CambiarEstadoDto,
  CotizarComposturaDto,
  CrearComposturaDto,
  EntregarComposturaDto,
  PresupuestoDto,
  QueryComposturasDto,
} from './dto/compostura.dto.js';

// Todos los roles registran composturas y cambian su estado (sección 4 del documento),
// siempre en las tiendas que tienen asignadas.
@Controller('composturas')
export class ComposturasController {
  constructor(
    private readonly composturas: ComposturasService,
    private readonly comprobantes: ComprobanteService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  listar(@Query() query: QueryComposturasDto, @CurrentUser() user: UsuarioActual) {
    return this.composturas.listar(query, user);
  }

  @Get('alertas')
  alertas(@Query('tiendaId') tiendaId: string | undefined, @CurrentUser() user: UsuarioActual) {
    return this.composturas.alertas(user, tiendaId || undefined);
  }

  @Post('cotizar')
  @HttpCode(200)
  cotizar(@Body() dto: CotizarComposturaDto, @CurrentUser() user: UsuarioActual) {
    return this.composturas.cotizar(dto, user);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: UsuarioActual) {
    return this.composturas.findOne(id, user);
  }

  @Get(':id/comprobante')
  async comprobante(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: UsuarioActual) {
    const compostura = await this.composturas.findOne(id, user);
    const negocio = await this.prisma.negocio.findUniqueOrThrow({
      where: { id: user.negocioId },
      select: { nombre: true, cuit: true },
    });
    const buffer = await this.comprobantes.generar(compostura, negocio);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `inline; filename="compostura-${numeroOrden(compostura.numero)}.pdf"`,
    });
  }

  @Post()
  crear(@Body() dto: CrearComposturaDto, @CurrentUser() user: UsuarioActual) {
    return this.composturas.crear(dto, user);
  }

  @Post(':id/presupuesto')
  @HttpCode(200)
  presupuestar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PresupuestoDto,
    @CurrentUser() user: UsuarioActual,
  ) {
    return this.composturas.presupuestar(id, dto, user);
  }

  @Post(':id/estado')
  @HttpCode(200)
  cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoDto,
    @CurrentUser() user: UsuarioActual,
  ) {
    return this.composturas.cambiarEstado(id, dto, user);
  }

  @Post(':id/entregar')
  @HttpCode(200)
  entregar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EntregarComposturaDto,
    @CurrentUser() user: UsuarioActual,
  ) {
    return this.composturas.entregar(id, dto, user);
  }
}
