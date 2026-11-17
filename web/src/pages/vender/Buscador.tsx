import { useState } from 'react';
import { Badge, Button, Group, Loader, Paper, ScrollArea, Stack, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { IconSearch } from '@tabler/icons-react';
import { api } from '../../lib/api';
import type { PiezaEncontrada, ProductoEncontrado, ResultadoBusqueda } from './carrito';

interface Props {
  tiendaId: string;
  piezasEnCarrito: string[];
  onAgregarPieza: (pieza: PiezaEncontrada) => void;
  onAgregarProducto: (producto: ProductoEncontrado) => void;
}

export function Buscador({ tiendaId, piezasEnCarrito, onAgregarPieza, onAgregarProducto }: Props) {
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState('');
  const [busqueda] = useDebouncedValue(texto.trim(), 300); // espera a que se deje de escribir

  const consulta = (q: string) => ({
    queryKey: ['vender', 'buscar', tiendaId, q],
    queryFn: () =>
      api<ResultadoBusqueda>(`/ventas/buscar?tiendaId=${tiendaId}&q=${encodeURIComponent(q)}`),
  });

  const resultados = useQuery({ ...consulta(busqueda), enabled: !!tiendaId && busqueda.length >= 2 });

  // Enter: si el código coincide exacto (o hay un único resultado), se agrega directo.
  // Así funciona con un lector de código de barras.
  const alPresionarEnter = async () => {
    const q = texto.trim();
    if (!q || !tiendaId) return;
    try {
      const r = await queryClient.fetchQuery(consulta(q));
      const codigo = q.toUpperCase();

      const pieza =
        r.piezas.find((p) => p.codigo.toUpperCase() === codigo) ??
        (r.piezas.length === 1 && r.productos.length === 0 ? r.piezas[0] : undefined);
      if (pieza) {
        onAgregarPieza(pieza);
        setTexto('');
        return;
      }

      const producto =
        r.productos.find((p) => p.codigo.toUpperCase() === codigo) ??
        (r.productos.length === 1 && r.piezas.length === 0 ? r.productos[0] : undefined);
      if (producto && producto.disponible > 0) {
        onAgregarProducto(producto);
        setTexto('');
      }
    } catch (e) {
      notifications.show({ color: 'red', message: (e as Error).message });
    }
  };

  const hayResultados = resultados.data && (resultados.data.piezas.length > 0 || resultados.data.productos.length > 0);

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
        <ScrollArea.Autosize mah={280}>
          <Stack gap={6}>
            {!hayResultados && (
              <Text size="sm" c="dimmed">
                Sin resultados con stock en esta tienda.
              </Text>
            )}

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
                        Pieza única · {Number(p.pesoGramos)} g
                      </Text>
                    </div>
                    <Button size="xs" variant="light" disabled={enCarrito} onClick={() => onAgregarPieza(p)}>
                      {enCarrito ? 'En el carrito' : 'Agregar'}
                    </Button>
                  </Group>
                </Paper>
              );
            })}

            {resultados.data.productos.map((p) => (
              <Paper key={p.productoId} withBorder p="xs">
                <Group justify="space-between" wrap="nowrap">
                  <div>
                    <Text size="sm" fw={500}>
                      {p.codigo} · {p.nombre}
                    </Text>
                    <Badge size="xs" variant="light" color={p.disponible > 0 ? 'green' : 'gray'}>
                      {p.disponible} disponibles
                    </Badge>
                  </div>
                  <Button size="xs" variant="light" disabled={p.disponible === 0} onClick={() => onAgregarProducto(p)}>
                    Agregar
                  </Button>
                </Group>
              </Paper>
            ))}
          </Stack>
        </ScrollArea.Autosize>
      )}
    </Stack>
  );
}