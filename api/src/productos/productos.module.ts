import { Module } from '@nestjs/common';
import { PreciosModule } from '../precios/precios.module.js';
import { ProductosController } from './productos.controller.js';
import { ProductosService } from './productos.service.js';

@Module({
  imports: [PreciosModule],
  controllers: [ProductosController],
  providers: [ProductosService],
  exports: [ProductosService],
})
export class ProductosModule {}