import { notifications } from '@mantine/notifications';
import { apiArchivo } from './api';

// Abre el PDF del ticket en una pestaña nueva
export async function abrirTicket(ventaId: string) {
  // La pestaña se abre antes de esperar la descarga: si se abre después,
  // el navegador la bloquea como ventana emergente
  const pestana = window.open('', '_blank');
  try {
    const pdf = await apiArchivo(`/ventas/${ventaId}/ticket`);
    const url = URL.createObjectURL(pdf);
    if (pestana) pestana.location.href = url;
    else window.open(url, '_blank');
  } catch (e) {
    pestana?.close();
    notifications.show({ color: 'red', message: (e as Error).message });
  }
}