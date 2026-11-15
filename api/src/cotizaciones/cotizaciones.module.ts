import { Module } from '@nestjs/common';
import { CotizacionesController } from './cotizaciones.controller.js';
import { CotizacionesService } from './cotizaciones.service.js';
import { CotizacionesJob } from './cotizaciones.job.js';
import { DolarApiProveedor } from './proveedores/dolarapi.proveedor.js';
import { XausProveedor } from './proveedores/xaus.proveedor.js';
import { PROVEEDOR_DOLAR, PROVEEDOR_METALES } from './proveedores/proveedor.js';

@Module({
  controllers: [CotizacionesController],
  providers: [
    CotizacionesService,
    CotizacionesJob,
    DolarApiProveedor,
    XausProveedor,
    // Acá se elige qué adaptador usar. Para cambiar de API, se cambia solo esta línea.
    { provide: PROVEEDOR_DOLAR, useExisting: DolarApiProveedor },
    { provide: PROVEEDOR_METALES, useExisting: XausProveedor },
  ],
  exports: [CotizacionesService],
})
export class CotizacionesModule {}