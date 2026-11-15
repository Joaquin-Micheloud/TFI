import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CotizacionesService } from './cotizaciones.service.js';

@Injectable()
export class CotizacionesJob implements OnApplicationBootstrap {
  private readonly logger = new Logger('Cotizaciones');

  constructor(
    private readonly cotizaciones: CotizacionesService,
    private readonly config: ConfigService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  onApplicationBootstrap() {
    this.programar('dolar', 'COTIZACIONES_DOLAR_MINUTOS', () => this.cotizaciones.actualizarDolar());
    this.programar('metales', 'COTIZACIONES_METALES_MINUTOS', () =>
      this.cotizaciones.actualizarMetales(),
    );
  }

  // Ejecuta la tarea al arrancar y después cada N minutos (configurable en .env)
  private programar(nombre: string, variable: string, tarea: () => Promise<number>) {
    const minutos = Number(this.config.get(variable) ?? 30);

    const ejecutar = async () => {
      try {
        const cantidad = await tarea();
        this.logger.log(`${nombre}: ${cantidad} valores guardados`);
      } catch (e) {
        this.logger.warn(
          `${nombre}: no se pudo actualizar (${(e as Error).message}). Se sigue usando la última cotización válida.`,
        );
      }
    };

    void ejecutar();
    this.scheduler.addInterval(
      `cotizaciones-${nombre}`,
      setInterval(() => void ejecutar(), minutos * 60_000),
    );
  }
}