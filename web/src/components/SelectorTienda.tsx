import { Select } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

interface Tienda {
  id: string;
  nombre: string;
  activa: boolean;
}

interface Props {
  value: string | null;
  onChange: (tiendaId: string | null) => void;
  permitirTodas?: boolean; // agrega la opción "Todas las tiendas" (valor null)
  label?: string;
  w?: number;
}

// Solo muestra las tiendas que el usuario puede ver (el backend ya las filtra por rol)
export function SelectorTienda({ value, onChange, permitirTodas = false, label, w = 220 }: Props) {
  const tiendas = useQuery({ queryKey: ['tiendas'], queryFn: () => api<Tienda[]>('/tiendas') });
  const opciones = (tiendas.data ?? []).filter((t) => t.activa).map((t) => ({ value: t.id, label: t.nombre }));

  return (
    <Select
      label={label}
      w={w}
      placeholder={permitirTodas ? 'Todas las tiendas' : 'Elegí una tienda'}
      clearable={permitirTodas}
      data={opciones}
      value={value}
      onChange={onChange}
    />
  );
}