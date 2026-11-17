import { Fragment, useState } from 'react';
import { Alert, Badge, Card, Group, Stack, Table, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { SelectorTienda } from '../../components/SelectorTienda';
import { api } from '../../lib/api';
import { formatoPesos } from '../../lib/formato';
import { numerarLotes, type FilaResumen, type Lote } from '../../lib/stock';

export function ResumenTab() {
  const [tiendaId, setTiendaId] = useState<string | null>(null);
  const filtro = tiendaId ? `?tiendaId=${tiendaId}` : '';

  const resumen = useQuery({
    queryKey: ['stock', 'resumen', tiendaId],
    queryFn: () => api<FilaResumen[]>(`/stock/resumen${filtro}`),
  });

  // Los lotes con unidades, para mostrar el desglose debajo de cada producto
  const lotes = useQuery({
    queryKey: ['stock', 'lotes', `resumen-${tiendaId}`],
    queryFn: () => api<{ items: Lote[] }>(`/stock/lotes${filtro}`),
  });

  const numeros = numerarLotes(lotes.data?.items ?? []);
  const lotesDe = (productoId: string, tienda: string) =>
    (lotes.data?.items ?? []).filter((l) => l.producto.id === productoId && l.tienda.id === tienda);

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
        <Table>
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
              <Fragment key={`${f.productoId}-${f.tiendaId}`}>
                <Table.Tr bg="gray.0">
                  <Table.Td>
                    <Text size="sm" fw={600}>
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
                      <Text fw={700}>{f.cantidad}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td ta="right">{f.stockMinimo ?? '—'}</Table.Td>
                </Table.Tr>

                {/* Desglose por lote */}
                {f.modoStock === 'LOTE' &&
                  lotesDe(f.productoId, f.tiendaId).map((l) => (
                    <Table.Tr key={l.id}>
                      <Table.Td pl="xl" colSpan={2}>
                        <Group gap={6}>
                          <Badge size="xs" variant="outline">
                            Lote {numeros.get(l.id)}
                          </Badge>
                          <Text size="xs" c="dimmed">
                            {[
                              `ingresó ${new Date(l.fechaIngreso).toLocaleDateString('es-AR')}`,
                              l.pesoUnitario ? `${Number(l.pesoUnitario).toLocaleString('es-AR')} g` : null,
                              l.precio.precioArs ? formatoPesos(l.precio.precioArs) : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </Text>
                        </Group>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="sm">{l.cantidadDisponible}</Text>
                      </Table.Td>
                      <Table.Td />
                    </Table.Tr>
                  ))}
              </Fragment>
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