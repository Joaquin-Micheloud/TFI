import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { MedioPago } from '../generated/prisma/client.js';
import type { VentaCompleta } from './ventas.service.js';

const ANCHO = 226; // 80 mm, el ancho de las impresoras térmicas de mostrador
const MARGEN = 10;
const UTIL = ANCHO - MARGEN * 2;

const formatoPesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const pesos = (valor: { toString(): string }) => formatoPesos.format(Number(valor.toString()));

const NOMBRE_MEDIO: Record<MedioPago, string> = {
  EFECTIVO_ARS: 'Efectivo',
  EFECTIVO_USD: 'Efectivo USD',
  TRANSFERENCIA: 'Transferencia',
  DEBITO: 'Débito',
  CREDITO: 'Crédito',
};

// 0001-00000123
export function numeroTicket(puntoVenta: number, numero: number) {
  return `${String(puntoVenta).padStart(4, '0')}-${String(numero).padStart(8, '0')}`;
}

@Injectable()
export class TicketService {
  generar(venta: VentaCompleta, negocio: { nombre: string; cuit: string | null }): Promise<Buffer> {
    const alto = 330 + venta.items.length * 36 + venta.pagos.length * 14;
    const doc = new PDFDocument({ size: [ANCHO, alto], margin: MARGEN });

    const partes: Buffer[] = [];
    doc.on('data', (parte: Buffer) => partes.push(parte));
    const listo = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(partes))));

    const centrado = (texto: string, tamano = 8, negrita = false) => {
      doc
        .font(negrita ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(tamano)
        .text(texto, MARGEN, doc.y, { width: UTIL, align: 'center' });
    };

    // Texto a la izquierda y monto a la derecha, en la misma línea
    const fila = (izquierda: string, derecha: string, negrita = false) => {
      doc.font(negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(negrita ? 10 : 8);
      const y = doc.y;
      doc.text(izquierda, MARGEN, y, { width: UTIL * 0.62 });
      const yIzquierda = doc.y;
      doc.text(derecha, MARGEN, y, { width: UTIL, align: 'right' });
      doc.y = Math.max(yIzquierda, doc.y);
    };

    const separador = () => {
      doc.moveDown(0.3);
      doc.moveTo(MARGEN, doc.y).lineTo(ANCHO - MARGEN, doc.y).dash(2, { space: 2 }).stroke().undash();
      doc.moveDown(0.4);
    };

    // Encabezado
    centrado(negocio.nombre, 11, true);
    if (negocio.cuit) centrado(`CUIT ${negocio.cuit}`);
    centrado(venta.tienda.nombre);
    const direccion = [venta.tienda.direccion, venta.tienda.localidad].filter(Boolean).join(', ');
    if (direccion) centrado(direccion);
    separador();

    centrado(`TICKET N° ${numeroTicket(venta.puntoVenta, venta.numero)}`, 9, true);
    centrado(venta.fecha.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }));
    centrado(`Atendió: ${venta.usuario.nombre ?? venta.usuario.email}`);
    if (venta.cliente) centrado(`Cliente: ${venta.cliente.nombre}`);
    if (venta.estado === 'ANULADA') centrado('*** VENTA ANULADA ***', 10, true);
    separador();

    // Ítems
    for (const item of venta.items) {
      doc.font('Helvetica-Bold').fontSize(8).text(`${item.codigo}  ${item.descripcion}`, MARGEN, doc.y, { width: UTIL });
      const descuento = item.descuentoPct.greaterThan(0) ? ` (-${item.descuentoPct.toString()}%)` : '';
      fila(`${item.cantidad} x ${pesos(item.precioListaUnitario)}${descuento}`, pesos(item.subtotal));
      doc.moveDown(0.2);
    }
    separador();

    // Totales
    fila('Subtotal', pesos(venta.subtotal));
    if (venta.descuentoTotal.greaterThan(0)) fila('Descuentos', `-${pesos(venta.descuentoTotal)}`);
    fila('TOTAL', pesos(venta.total), true);
    separador();

    // Pagos
    for (const pago of venta.pagos) {
      let detalle = NOMBRE_MEDIO[pago.medio];
      if (pago.moneda === 'USD') detalle += ` ${pago.monto.toFixed(2)}`;
      if (pago.cuotas && pago.cuotas > 1) detalle += ` (${pago.cuotas} cuotas)`;
      fila(detalle, pesos(pago.montoArs));
    }
    if (venta.vuelto.greaterThan(0)) fila('Vuelto', pesos(venta.vuelto));
    separador();

    centrado(`Dólar ${venta.tipoDolar.toLowerCase()} usado: ${pesos(venta.dolarUsado)}`, 7);
    doc.moveDown(0.5);
    centrado('Comprobante no válido como factura', 8, true);
    centrado('¡Gracias por su compra!');

    doc.end();
    return listo;
  }
}