import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { ComposturaCompleta } from './composturas.service.js';
import { numeroOrden } from './composturas.service.js';

const ANCHO = 226; // 80 mm, como el ticket de venta
const MARGEN = 10;
const UTIL = ANCHO - MARGEN * 2;

const formatoPesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const pesos = (valor: { toString(): string }) => formatoPesos.format(Number(valor.toString()));
const gramos = (valor: { toString(): string }) => `${Number(valor.toString()).toLocaleString('es-AR')} g`;

const QUILATES: Record<string, string> = { '1': '24k', '0.75': '18k', '0.585': '14k', '0.417': '10k' };
function metalYLey(metal: string, ley: { toString(): string }) {
  const valor = String(Number(ley.toString()));
  if (metal === 'ORO') return `Oro ${QUILATES[valor] ?? `ley ${valor}`}`;
  return `Plata ${valor === '0.925' ? '925' : `ley ${valor}`}`;
}

// La fecha estimada es una fecha sin hora: se muestra tal cual, sin pasar por la zona horaria
const fechaSinHora = (fecha: Date) => fecha.toISOString().slice(0, 10).split('-').reverse().join('/');

/** Comprobante de recepción: lo que el cliente presenta para retirar la pieza */
@Injectable()
export class ComprobanteService {
  generar(c: ComposturaCompleta, negocio: { nombre: string; cuit: string | null }): Promise<Buffer> {
    const doc = new PDFDocument({ size: [ANCHO, 420], margin: MARGEN });

    const partes: Buffer[] = [];
    doc.on('data', (parte: Buffer) => partes.push(parte));
    const listo = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(partes))));

    const centrado = (texto: string, tamano = 8, negrita = false) => {
      doc
        .font(negrita ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(tamano)
        .text(texto, MARGEN, doc.y, { width: UTIL, align: 'center' });
    };

    const fila = (izquierda: string, derecha: string, negrita = false) => {
      doc.font(negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
      const y = doc.y;
      doc.text(izquierda, MARGEN, y, { width: UTIL * 0.5 });
      const yIzquierda = doc.y;
      doc.text(derecha, MARGEN, y, { width: UTIL, align: 'right' });
      doc.y = Math.max(yIzquierda, doc.y);
    };

    const separador = () => {
      doc.moveDown(0.3);
      doc.moveTo(MARGEN, doc.y).lineTo(ANCHO - MARGEN, doc.y).dash(2, { space: 2 }).stroke().undash();
      doc.moveDown(0.4);
    };

    centrado(negocio.nombre, 11, true);
    if (negocio.cuit) centrado(`CUIT ${negocio.cuit}`);
    centrado(c.tienda.nombre);
    const direccion = [c.tienda.direccion, c.tienda.localidad].filter(Boolean).join(', ');
    if (direccion) centrado(direccion);
    separador();

    centrado('COMPROBANTE DE RECEPCIÓN', 9, true);
    centrado(`Orden N° ${numeroOrden(c.numero)}`, 12, true);
    centrado(c.creadoEn.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }));
    centrado(`Recibió: ${c.usuario.nombre ?? c.usuario.email}`);
    separador();

    fila('Cliente', c.cliente.nombre);
    if (c.cliente.telefono) fila('Teléfono', c.cliente.telefono);
    separador();

    doc.font('Helvetica-Bold').fontSize(8).text('Trabajo', MARGEN, doc.y, { width: UTIL });
    doc.font('Helvetica').fontSize(8).text(c.descripcion, MARGEN, doc.y, { width: UTIL });
    doc.moveDown(0.3);
    if (c.metal && c.ley) fila('Metal', metalYLey(c.metal, c.ley));
    fila('Peso de entrada', gramos(c.pesoEntrada));
    if (c.pesoAportado.greaterThan(0)) fila('Material aportado', gramos(c.pesoAportado));
    if (c.fechaEstimada) fila('Entrega estimada', fechaSinHora(c.fechaEstimada));
    separador();

    if (c.presupuesto) fila('Presupuesto', pesos(c.presupuesto));
    fila('Seña', pesos(c.sena), true);
    if (c.presupuesto) fila('Saldo estimado', pesos(c.presupuesto.minus(c.sena)));
    separador();

    centrado('Presente este comprobante para retirar la pieza.', 8, true);
    centrado('El presupuesto se confirma al terminar el trabajo.', 7);
    doc.moveDown(0.5);
    centrado('Comprobante no válido como factura', 8, true);

    doc.end();
    return listo;
  }
}
