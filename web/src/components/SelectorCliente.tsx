import { useState } from 'react';
import { ActionIcon, Group, Modal, Select, Tooltip } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { IconUserPlus } from '@tabler/icons-react';
import { api } from '../lib/api';
import { etiquetaCliente, type Cliente } from '../lib/clientes';
import { FormularioCliente } from '../pages/clientes/FormularioCliente';

interface Props {
  value: Cliente | null;
  onChange: (cliente: Cliente | null) => void;
  label?: string;
}

// Búsqueda de clientes con alta rápida, sin salir de la pantalla
export function SelectorCliente({ value, onChange, label = 'Cliente (opcional)' }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const [busquedaEstable] = useDebouncedValue(busqueda, 300);
  const [altaAbierta, setAltaAbierta] = useState(false);

  const resultados = useQuery({
    queryKey: ['clientes', 'selector', busquedaEstable],
    queryFn: () =>
      api<{ items: Cliente[] }>(`/clientes?porPagina=20&buscar=${encodeURIComponent(busquedaEstable)}`),
    placeholderData: keepPreviousData,
  });

  const encontrados = resultados.data?.items ?? [];
  const lista = value && !encontrados.some((c) => c.id === value.id) ? [value, ...encontrados] : encontrados;

  return (
    <>
      <Group align="flex-end" gap="xs" wrap="nowrap">
        <Select
          label={label}
          placeholder="Buscá por nombre, DNI o teléfono"
          style={{ flex: 1 }}
          searchable
          clearable
          data={lista.map((c) => ({ value: c.id, label: etiquetaCliente(c) }))}
          value={value?.id ?? null}
          onChange={(id) => onChange(lista.find((c) => c.id === id) ?? null)}
          searchValue={busqueda}
          onSearchChange={setBusqueda}
          filter={({ options }) => options} // el filtro lo hace el servidor
          nothingFoundMessage="Sin resultados"
        />
        <Tooltip label="Nuevo cliente">
          <ActionIcon size={36} variant="light" onClick={() => setAltaAbierta(true)} aria-label="Nuevo cliente">
            <IconUserPlus size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Modal opened={altaAbierta} onClose={() => setAltaAbierta(false)} title="Nuevo cliente" centered>
        {altaAbierta && (
          <FormularioCliente
            cliente={null}
            onGuardado={(nuevo) => {
              onChange(nuevo); // queda elegido
              setAltaAbierta(false);
            }}
          />
        )}
      </Modal>
    </>
  );
}