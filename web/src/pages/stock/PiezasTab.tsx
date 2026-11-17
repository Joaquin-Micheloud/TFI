import { useState } from 'react';
import { Badge, Button, Card, Group, Select, Stack, Table, Text, Tooltip } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { SelectorProducto } from '../../components/SelectorProducto';
import { SelectorTienda } from '../../components/SelectorTienda';
import { api } from '../../lib/api';
import type { Producto } from '../../lib/catalogo';
import { formatoPesos, formatoUsd } from '../../lib/formato';
import { COLOR_ESTADO, NOMBRE_ESTADO, type EstadoPieza, type Pieza } from '../../lib/stock';
import { BajaPiezaModal } from './AccionesStock';

export function PiezasTab({ puedeEditar }: { puedeEditar: boolean }) {
  const [tiendaId, setTiendaId] = useState<string | null>(null);
  const [producto, setProducto] = useState<Producto | null>(null);
  const [estado, setEstado] = useState<EstadoPieza>('DISPONIBLE');
  const [bajaDe, setBajaDe] = useState<Pieza | null>(null);

  const parametros = new URLSearchParams({ estado });
  if (tiendaId) parametros.set('tiendaId', tiendaId);
  if (producto) parametros.set('productoId', producto.id);

  const piezas = useQuery({
    queryKey: ['stock', 'piezas', parametros.toString()],
    queryFn: () => api<{ items: Pieza[] }>(`/stock/piezas?${parametros}`),
  });

  return (
    <Stack>
      <Group align="flex-end">
        <SelectorTienda value={tiendaId} onChange={setTiendaId} permitirTodas />
        <SelectorProducto value={producto} onChange={setProducto} placeholder="Todos los productos" w={280} />
        <Select
          w={170}
          data={Object.entries(NOMBRE_ESTADO).map(([value, label]) => ({ value, label }))}
          value={estado}
          onChange={(v) => v && setEstado(v as EstadoPieza)}
          allowDeselect={false}
        />
      </Group>

      <Card withBorder p={0}>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Código</Table.Th>
              <Table.Th>Producto</Table.Th>
              <Table.Th>Tienda</Table.Th>
              <Table.Th ta="right">Peso</Table.Th>
              {puedeEditar && <Table.Th ta="right">Hechura</Table.Th>}
              <Table.Th ta="right">Precio hoy</Table.Th>
              <Table.Th>Estado</Table.Th>
              {puedeEditar && <Table.Th />}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {piezas.data?.items.map((p) => (
              <Table.Tr key={p.id}>
                <Table.Td>
                  <Text size="sm" ff="monospace">
                    {p.codigo}
                  </Text>
                </Table.Td>
                <Table.Td>{p.producto.nombre}</Table.Td>
                <Table.Td>{p.tienda.nombre}</Table.Td>
                <Table.Td ta="right">{Number(p.pesoGramos).toLocaleString('es-AR')} g</Table.Td>
                {puedeEditar && (
                  <Table.Td ta="right">
                    {p.hechuraUsd != null ? (
                      <Text size="sm" c={Number(p.hechuraUsd) < 0 ? 'red' : undefined}>
                        {formatoUsd(p.hechuraUsd)}
                      </Text>
                    ) : (
                      '—'
                    )}
                  </Table.Td>
                )}
                <Table.Td ta="right">
                  {p.precio.precioArs ? (
                    formatoPesos(p.precio.precioArs)
                  ) : (
                    <Tooltip label={p.precio.motivo} multiline w={240}>
                      <Text size="xs" c="dimmed">
                        Sin precio
                      </Text>
                    </Tooltip>
                  )}
                </Table.Td>
                <Table.Td>
                  <Badge variant="light" color={COLOR_ESTADO[p.estado]}>
                    {NOMBRE_ESTADO[p.estado]}
                  </Badge>
                </Table.Td>
                {puedeEditar && (
                  <Table.Td>
                    {p.estado === 'DISPONIBLE' && (
                      <Button size="xs" variant="subtle" color="red" onClick={() => setBajaDe(p)}>
                        Dar de baja
                      </Button>
                    )}
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
            {piezas.data?.items.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={8}>
                  <Text size="sm" c="dimmed" ta="center" py="md">
                    No hay piezas con esos filtros.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      {bajaDe && <BajaPiezaModal pieza={bajaDe} onClose={() => setBajaDe(null)} />}
    </Stack>
  );
}