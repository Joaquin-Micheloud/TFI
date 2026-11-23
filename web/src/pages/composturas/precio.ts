import { useDebouncedValue } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Metal } from '../../lib/catalogo';
import type { PrecioCompostura } from '../../lib/composturas';

export interface DatosPrecio {
  metal: Metal | null;
  ley: string | number | null;
  manoObra: number | string;
  pesoAgregado: number | string;
  margenPct: number | string;
}

const numeroONada = (v: number | string | null) => (v === '' || v == null ? undefined : Number(v));

// Precio en vivo con el gramo de hoy: mano de obra + metal agregado × (1 + margen)
export function usePrecioCompostura(datos: DatosPrecio, habilitado = true) {
  const [estables] = useDebouncedValue(datos, 400);
  const cuerpo = {
    metal: estables.metal ?? undefined,
    ley: numeroONada(estables.ley),
    manoObra: numeroONada(estables.manoObra) ?? 0,
    pesoAgregado: numeroONada(estables.pesoAgregado),
    margenPct: numeroONada(estables.margenPct),
  };

  return useQuery({
    queryKey: ['composturas', 'cotizar', cuerpo],
    queryFn: () => api<PrecioCompostura>('/composturas/cotizar', { method: 'POST', body: cuerpo }),
    enabled: habilitado && estables.manoObra !== '',
    retry: false,
  });
}
