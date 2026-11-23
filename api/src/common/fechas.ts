// Argentina usa UTC-3 todo el año (sin horario de verano)
const DESFASE_MS = 3 * 3_600_000;
const DIA_MS = 86_400_000;

// "2026-11-23" → 2026-11-23 00:00 hora argentina
export const inicioDelDia = (fecha: string) => new Date(`${fecha.slice(0, 10)}T00:00:00-03:00`);

// Fecha (AAAA-MM-DD) de un instante, en hora argentina
export const diaArgentina = (instante: Date) => new Date(instante.getTime() - DESFASE_MS).toISOString().slice(0, 10);

export const hoyArgentina = () => diaArgentina(new Date());

// Rango [desde 00:00, hasta 24:00) en hora argentina, listo para un filtro de Prisma
export function rangoDeFechas(desde: string, hasta: string) {
  return { gte: inicioDelDia(desde), lt: new Date(inicioDelDia(hasta).getTime() + DIA_MS) };
}

// AAAA-MM-DD de hace N días (en hora argentina)
export const haceDias = (dias: number) => diaArgentina(new Date(Date.now() - dias * DIA_MS));
