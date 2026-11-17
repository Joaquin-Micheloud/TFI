import { useState } from 'react';
import { Alert, Badge, Card, Group, Stack, Table, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { SelectorTienda } from '../../components/SelectorTienda';
import { api } from '../../lib/api';
import type { FilaResumen } from '../../lib/stock';

export function ResumenTab() {
  const [tiendaId, setTiendaId] = useState<string | null>(null);

  const resumen = useQuery({
    queryKey: ['stock', 'resumen', tiendaId],
    queryFn: () => api<FilaResumen[]>(`/stock/resumen${tiendaId ? `?tiendaId=${tiendaId}` : ''}`),
  });

  const alertas = resumen.data?.filter((f) => f.bajoMinimo).length ?? 0;

  return (
    <Stack>
      <SelectorTienda value={tiendaId} onChange={setTiendaId} permitirTodas />

      {alertas > 0 && (
        <Alert color="orange" title="Stock bajo">
          Hay {alertas} {alertas === 1 ? 'producto' : 'productos'} por debajo del stock mínimo.
        </Alert>
      )}

      <Card withBorder p={0}>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Producto</Table.Th>
              <Table.Th>Tienda</Table.Th>
              <Table.Th ta="right">Disponible</Table.Th>
              <Table.Th ta="right">Mínimo</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {resumen.data?.map((f) => (
              <Table.Tr key={`${f.productoId}-${f.tiendaId}`}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {f.codigo} · {f.nombre}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {f.modoStock === 'UNICO' ? 'Piezas únicas' : 'Por lote'}
                  </Text>
                </Table.Td>
                <Table.Td>{f.tienda}</Table.Td>
                <Table.Td ta="right">
                  <Group gap={6} justify="flex-end">
                    {f.bajoMinimo && (
                      <Badge color="red" size="xs">
                        Bajo mínimo
                      </Badge>
                    )}
                    <Text fw={600}>{f.cantidad}</Text>
                  </Group>
                </Table.Td>
                <Table.Td ta="right">{f.stockMinimo ?? '—'}</Table.Td>
              </Table.Tr>
            ))}
            {resumen.data?.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text size="sm" c="dimmed" ta="center" py="md">
                    No hay stock cargado.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  );
}