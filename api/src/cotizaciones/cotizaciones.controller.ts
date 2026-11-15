import { Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { Rol } from '../generated/prisma/client.js';
import { Roles } from '../auth/roles.decorator.js';
import { CotizacionesService } from './cotizaciones.service.js';
import { HistorialDto } from './dto/historial.dto.js';

@Controller('cotizaciones')
export class CotizacionesController {
  constructor(private readonly cotizacionesService: CotizacionesService) {}

  // Última cotización de cada tipo (cualquier rol)
  @Get()
  ultimas() {
    return this.cotizacionesService.ultimas();
  }

  // Para el gráfico de evolución: /cotizaciones/historial?tipo=ORO&dias=30
  @Get('historial')
  historial(@Query() query: HistorialDto) {
    return this.cotizacionesService.historial(query.tipo, query.dias);
  }

  // Fuerza una lectura inmediata, sin esperar al job
  @Roles(Rol.ADMIN)
  @Post('actualizar')
  @HttpCode(200)
  async actualizar() {
    const [dolar, metales] = await Promise.allSettled([
      this.cotizacionesService.actualizarDolar(),
      this.cotizacionesService.actualizarMetales(),
    ]);
    const resumen = (r: PromiseSettledResult<number>) =>
      r.status === 'fulfilled' ? { ok: true, valores: r.value } : { ok: false, error: String(r.reason) };
    return { dolar: resumen(dolar), metales: resumen(metales) };
  }
}