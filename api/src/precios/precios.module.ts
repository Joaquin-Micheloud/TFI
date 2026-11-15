import { Module } from '@nestjs/common';
import { CotizacionesModule } from '../cotizaciones/cotizaciones.module.js';
import { PreciosController } from './precios.controller.js';
import { PrecioGramoService } from './precio-gramo.service.js';

@Module({
  imports: [CotizacionesModule],
  controllers: [PreciosController],
  providers: [PrecioGramoService],
  exports: [PrecioGramoService], // lo va a usar el catálogo en el Paso 7
})
export class PreciosModule {}