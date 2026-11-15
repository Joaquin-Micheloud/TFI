import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { TipoCotizacion } from '../generated/prisma/client.js';
import {
  PROVEEDOR_DOLAR,
  PROVEEDOR_METALES,
  type ProveedorCotizaciones,
} from './proveedores/proveedor.js';

const HORAS_ALERTA = 24;

@Injectable()
export class CotizacionesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PROVEEDOR_DOLAR) private readonly proveedorDolar: ProveedorCotizaciones,
    @Inject(PROVEEDOR_METALES) private readonly proveedorMetales: ProveedorCotizaciones,
  ) {}

  actualizarDolar() {
    return this.leerYGuardar(this.proveedorDolar);
  }

  actualizarMetales() {
    return this.leerYGuardar(this.proveedorMetales);
  }

  // Devuelve cuántos valores se guardaron. Si la API falla, lanza el error y no guarda nada.
  private async leerYGuardar(proveedor: ProveedorCotizaciones) {
    const lecturas = await proveedor.obtener();
    if (lecturas.length === 0) throw new Error(`${proveedor.nombre} no devolvió valores`);
    await this.prisma.cotizacion.createMany({ data: lecturas });
    return lecturas.length;
  }

  // Última cotización válida de un tipo (o null si nunca se leyó)
  ultima(tipo: TipoCotizacion) {
    return this.prisma.cotizacion.findFirst({
      where: { tipo },
      orderBy: { creadoEn: 'desc' },
    });
  }

  // La última de cada tipo, con la alerta de antigüedad
  async ultimas() {
    const tipos = Object.values(TipoCotizacion);
    const lista = await Promise.all(tipos.map((t) => this.ultima(t)));
    const ahora = Date.now();

    return lista
      .filter((c) => c !== null)
      .map((c) => ({
        ...c,
        desactualizada: (ahora - c.creadoEn.getTime()) / 3_600_000 > HORAS_ALERTA,
      }));
  }

  historial(tipo: TipoCotizacion, dias: number) {
    const desde = new Date(Date.now() - dias * 24 * 3_600_000);
    return this.prisma.cotizacion.findMany({
      where: { tipo, creadoEn: { gte: desde } },
      select: { valorCompra: true, valorVenta: true, fechaHora: true, creadoEn: true },
      orderBy: { creadoEn: 'asc' },
    });
  }
}