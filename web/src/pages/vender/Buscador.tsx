import { useState } from 'react';
import { Badge, Button, Group, Loader, Paper, ScrollArea, Stack, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { IconSearch } from '@tabler/icons-react';
import { api } from '../../lib/api';
import { formatoPesos } from '../../lib/formato';
import type { LoteEncontrado, PiezaEncontrada, ResultadoBusqueda } from './carrito';

interface Props {
  tiendaId: string;
  piezasEnCarrito: string[];
  onAgregarPieza: (pieza: PiezaEncontrada) => void;
  onAgregarLote: (lote: LoteEncontrado) => void;
}

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR');
const gramos = (g: string | null) => (g ? `${Number(g).toLocaleString('es-AR')} g` : null);

export function Buscador({ tiendaId, piezasEnCarrito, onAgregarPieza, onAgregarLote }: Props) {
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState('');
  const [busqueda] = useDebouncedValue(texto.trim(), 300);

  const consulta = (q: string) => ({
    queryKey: ['vender', 'buscar', tiendaId, q],
    queryFn: () =>
      api<ResultadoBusqueda>(`/ventas/buscar?tiendaId=${tiendaId}&q=${encodeURIComponent(q)}`),
  });

  const resultados = useQuery({ ...consulta(busqueda), enabled: !!tiendaId && busqueda.length >= 2 });

  // Enter (o lector de código de barras):
  // - código de pieza exacto → esa pieza
  // - código de producto por lote → el lote más antiguo (FIFO)
  // - un único resultado → ese
  const alPresionarEnter = async () => {
    const q = texto.trim();
    if (!q || !tiendaId) return;
    try {
      const r = await queryClient.fetchQuery(consulta(q));
      const codigo = q.toUpperCase();

      const pieza = r.piezas.find((p) => p.codigo.toUpperCase() === codigo);
      const lote = r.lotes.find((l) => l.producto.codigo.toUpperCase() === codigo); // ya vienen ordenados: el primero es el más antiguo
      const unico = r.piezas.length + r.lotes.length === 1;

      if (pieza || (unico && r.piezas[0])) onAgregarPieza(pieza ?? r.piezas[0]);
      else if (lote || (unico && r.lotes[0])) onAgregarLote(lote ?? r.lotes[0]);
      else return;
      setTexto('');
    } catch (e) {
      notifications.show({ color: 'red', message: (e as Error).message });
    }
  };

  const hayResultados = resultados.data && (resultados.data.piezas.length > 0 || resultados.data.lotes.length > 0);

  return (
    <Stack gap="xs">
      <TextInput
        placeholder="Código, nombre o código de barras… (Enter para agregar)"
        leftSection={<IconSearch size={16} />}
        rightSection={resultados.isFetching ? <Loader size="xs" /> : null}
        value={texto}
        onChange={(e) => setTexto(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void alPresionarEnter();
          }
        }}
        autoFocus
      />

      {busqueda.length >= 2 && resultados.data && (
        <ScrollArea.Autosize mah={320}>
          <Stack gap={6}>
            {!hayResultados && (
              <Text size="sm" c="dimmed">
                Sin resultados con stock en esta tienda.
              </Text>
            )}

            {/* Piezas únicas */}
            {resultados.data.piezas.map((p) => {
              const enCarrito = piezasEnCarrito.includes(p.piezaId);
              return (
                <Paper key={p.piezaId} withBorder p="xs">
                  <Group justify="space-between" wrap="nowrap">
                    <div>
                      <Text size="sm" fw={500}>
                        {p.codigo} · {p.producto.nombre}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Pieza única · {gramos(p.pesoGramos)}
                      </Text>
                    </div>
                    <Group gap="sm" wrap="nowrap">
                      <Text size="sm" fw={600}>
                        {formatoPesos(p.precioArs)}
                      </Text>
                      <Button size="xs" variant="light" disabled={enCarrito} onClick={() => onAgregarPieza(p)}>
                        {enCarrito ? 'En el carrito' : 'Agregar'}
                      </Button>
                    </Group>
                  </Group>
                </Paper>
              );
            })}

            {/* Lotes: uno por fila */}
            {resultados.data.lotes.map((l) => (
              <Paper key={l.loteId} withBorder p="xs">
                <Group justify="space-between" wrap="nowrap">
                  <div>
                    <Group gap={6}>
                      <Text size="sm" fw={500}>
                        {l.producto.codigo} · {l.producto.nombre}
                      </Text>
                      <Badge size="xs" variant="outline">
                        Lote {l.numeroLote}
                      </Badge>
                    </Group>
                    <Text size="xs" c="dimmed">
                      {['Ingresó ' + fecha(l.fechaIngreso), gramos(l.pesoUnitario), `${l.disponible} disponibles`]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </div>
                  <Group gap="sm" wrap="nowrap">
                    <Text size="sm" fw={600}>
                      {formatoPesos(l.precioArs)}
                    </Text>
                    <Button size="xs" variant="light" onClick={() => onAgregarLote(l)}>
                      Agregar
                    </Button>
                  </Group>
                </Group>
              </Paper>
            ))}
          </Stack>
        </ScrollArea.Autosize>
      )}
    </Stack>
  );
}