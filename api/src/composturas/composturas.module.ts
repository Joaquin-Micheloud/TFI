import { Module } from '@nestjs/common';
import { PreciosModule } from '../precios/precios.module.js';
import { StockModule } from '../stock/stock.module.js';
import { VentasModule } from '../ventas/ventas.module.js';
import { ComposturasController } from './composturas.controller.js';
import { ComposturasService } from './composturas.service.js';
import { ComprobanteService } from './comprobante.service.js';

@Module({
  imports: [PreciosModule, StockModule, VentasModule],
  controllers: [ComposturasController],
  providers: [ComposturasService, ComprobanteService],
  exports: [ComposturasService], // la usan los reportes
})
export class ComposturasModule {}
