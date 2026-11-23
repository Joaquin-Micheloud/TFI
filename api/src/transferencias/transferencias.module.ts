import { Module } from '@nestjs/common';
import { StockModule } from '../stock/stock.module.js';
import { TransferenciasController } from './transferencias.controller.js';
import { TransferenciasService } from './transferencias.service.js';

@Module({
  imports: [StockModule],
  controllers: [TransferenciasController],
  providers: [TransferenciasService],
})
export class TransferenciasModule {}
