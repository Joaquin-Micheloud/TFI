import { notifications } from '@mantine/notifications';
import { apiArchivo } from './api';

// Abre un PDF protegido (ticket, comprobante) en una pestaña nueva
export async function abrirPdf(ruta: string) {
  // La pestaña se abre antes de esperar la descarga: si se abre después,
  // el navegador la bloquea como ventana emergente
  const pestana = window.open('', '_blank');
  try {
    const pdf = await apiArchivo(ruta);
    const url = URL.createObjectURL(pdf);
    if (pestana) pestana.location.href = url;
    else window.open(url, '_blank');
  } catch (e) {
    pestana?.close();
    notifications.show({ color: 'red', message: (e as Error).message });
  }
}

export const abrirTicket = (ventaId: string) => abrirPdf(`/ventas/${ventaId}/ticket`);

export const abrirComprobante = (composturaId: string) => abrirPdf(`/composturas/${composturaId}/comprobante`);
