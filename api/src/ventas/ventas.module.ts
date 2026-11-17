import { Module } from '@nestjs/common';
import { PreciosModule } from '../precios/precios.module.js';
import { ProductosModule } from '../productos/productos.module.js';
import { StockModule } from '../stock/stock.module.js';
import { VentasController } from './ventas.controller.js';
import { VentasService } from './ventas.service.js';
import { TicketService } from './ticket.service.js';
import { DevolucionesService } from './devoluciones.service.js';

@Module({
  imports: [PreciosModule, ProductosModule, StockModule],
  controllers: [VentasController],
  providers: [VentasService, TicketService, DevolucionesService],
})
export class VentasModule {}