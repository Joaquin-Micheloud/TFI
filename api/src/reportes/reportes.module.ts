import { Module } from '@nestjs/common';
import { ProductosModule } from '../productos/productos.module.js';
import { StockModule } from '../stock/stock.module.js';
import { ReportesController } from './reportes.controller.js';
import { ReportesService } from './reportes.service.js';

@Module({
  imports: [StockModule, ProductosModule],
  controllers: [ReportesController],
  providers: [ReportesService],
})
export class ReportesModule {}
