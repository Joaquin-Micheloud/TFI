import { Module } from '@nestjs/common';
import { PreciosModule } from '../precios/precios.module.js';
import { ProductosModule } from '../productos/productos.module.js';
import { StockController } from './stock.controller.js';
import { StockService } from './stock.service.js';

@Module({
  imports: [PreciosModule, ProductosModule],
  controllers: [StockController],
  providers: [StockService],
  exports: [StockService], // lo van a usar las ventas
})
export class StockModule {}