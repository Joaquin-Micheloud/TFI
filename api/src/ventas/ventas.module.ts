import { Module } from '@nestjs/common';
import { PreciosModule } from '../precios/precios.module.js';
import { StockModule } from '../stock/stock.module.js';
import { VentasController } from './ventas.controller.js';
import { VentasService } from './ventas.service.js';
import { TicketService } from './ticket.service.js';

@Module({
  imports: [PreciosModule, StockModule],
  controllers: [VentasController],
  providers: [VentasService, TicketService],
})
export class VentasModule {}