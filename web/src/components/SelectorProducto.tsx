import { useState } from 'react';
import { Select } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { ListaProductos, Producto } from '../lib/catalogo';

interface Props {
  value: Producto | null;
  onChange: (producto: Producto | null) => void;
  label?: string;
  placeholder?: string;
  w?: number | string;
}

// Select con búsqueda en el servidor: escribís y consulta /productos
export function SelectorProducto({ value, onChange, label, placeholder = 'Buscá por código o nombre', w }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const [busquedaEstable] = useDebouncedValue(busqueda, 300);

  const resultados = useQuery({
    queryKey: ['productos', 'selector', busquedaEstable],
    queryFn: () => api<ListaProductos>(`/productos?porPagina=20&buscar=${encodeURIComponent(busquedaEstable)}`),
    placeholderData: keepPreviousData,
  });

  const encontrados = resultados.data?.items ?? [];
  // El elegido se mantiene en la lista aunque ya no coincida con la búsqueda
  const lista = value && !encontrados.some((p) => p.id === value.id) ? [value, ...encontrados] : encontrados;

  return (
    <Select
      label={label}
      w={w}
      placeholder={placeholder}
      searchable
      clearable
      data={lista.map((p) => ({ value: p.id, label: `${p.codigo} · ${p.nombre}` }))}
      value={value?.id ?? null}
      onChange={(id) => onChange(lista.find((p) => p.id === id) ?? null)}
      searchValue={busqueda}
      onSearchChange={setBusqueda}
      filter={({ options }) => options} // el filtro lo hace el servidor
      nothingFoundMessage="Sin resultados"
    />
  );
}