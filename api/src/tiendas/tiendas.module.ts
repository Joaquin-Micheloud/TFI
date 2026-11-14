import { Module } from '@nestjs/common';
import { TiendasController } from './tiendas.controller.js';
import { TiendasService } from './tiendas.service.js';

@Module({
  controllers: [TiendasController],
  providers: [TiendasService],
})
export class TiendasModule {}