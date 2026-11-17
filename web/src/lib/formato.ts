const pesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const dolares = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' });

// La API manda los Decimal como texto ("147643.44"): los convertimos solo para mostrar
export const formatoPesos = (valor: string | number | null | undefined) =>
  valor == null ? '—' : pesos.format(Number(valor));

export const formatoUsd = (valor: string | number | null | undefined) =>
  valor == null ? '—' : dolares.format(Number(valor));

export const formatoFechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });

// 0.75 → "18k", 0.925 → "925"
export function nombreLey(metal: 'ORO' | 'PLATA', ley: string | number) {
  const valor = Number(ley);
  if (metal === 'ORO') {
    const quilates: Record<string, string> = { '1': '24k', '0.75': '18k', '0.585': '14k', '0.417': '10k' };
    return quilates[String(valor)] ?? `ley ${valor}`;
  }
  const plata: Record<string, string> = { '1': '999', '0.925': '925', '0.95': '950' };
  return plata[String(valor)] ?? `ley ${valor}`;
}