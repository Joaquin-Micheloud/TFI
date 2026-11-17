import { useState } from 'react';
import { Badge, Card, Group, Pagination, Select, Stack, Table, Text } from '@mantine/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { SelectorTienda } from '../../components/SelectorTienda';
import { api } from '../../lib/api';
import { formatoFechaHora } from '../../lib/formato';
import { COLOR_MOVIMIENTO, NOMBRE_MOTIVO, NOMBRE_MOVIMIENTO, type Movimiento } from '../../lib/stock';

const POR_PAGINA = 50;

export function MovimientosTab() {
  const [tiendaId, setTiendaId] = useState<string | null>(null);
  const [tipo, setTipo] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);

  const parametros = new URLSearchParams({ pagina: String(pagina), porPagina: String(POR_PAGINA) });
  if (tiendaId) parametros.set('tiendaId', tiendaId);
  if (tipo) parametros.set('tipo', tipo);

  const movimientos = useQuery({
    queryKey: ['stock', 'movimientos', parametros.toString()],
    queryFn: () => api<{ items: Movimiento[]; total: number }>(`/stock/movimientos?${parametros}`),
    placeholderData: keepPreviousData,
  });

  const paginas = Math.max(1, Math.ceil((movimientos.data?.total ?? 0) / POR_PAGINA));

  return (
    <Stack>
      <Group align="flex-end">
        <SelectorTienda
          value={tiendaId}
          onChange={(v) => {
            setTiendaId(v);
            setPagina(1);
          }}
          permitirTodas
        />
        <Select
          w={220}
          placeholder="Todos los tipos"
          clearable
          data={Object.entries(NOMBRE_MOVIMIENTO).map(([value, label]) => ({ value, label }))}
          value={tipo}
          onChange={(v) => {
            setTipo(v);
            setPagina(1);
          }}
        />
      </Group>

      <Card withBorder p={0}>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Fecha</Table.Th>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Producto</Table.Th>
              <Table.Th>Tienda</Table.Th>
              <Table.Th ta="right">Cantidad</Table.Th>
              <Table.Th>Usuario</Table.Th>
              <Table.Th>Detalle</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {movimientos.data?.items.map((m) => (
              <Table.Tr key={m.id}>
                <Table.Td>{formatoFechaHora(m.fecha)}</Table.Td>
                <Table.Td>
                  <Badge variant="light" color={COLOR_MOVIMIENTO[m.tipo]}>
                    {NOMBRE_MOVIMIENTO[m.tipo]}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {m.producto.codigo} · {m.producto.nombre}
                  </Text>
                  {m.pieza && (
                    <Text size="xs" c="dimmed" ff="monospace">
                      {m.pieza.codigo}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>{m.tienda.nombre}</Table.Td>
                <Table.Td ta="right">
                  <Text fw={600} c={m.cantidad > 0 ? 'green' : 'red'}>
                    {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                  </Text>
                </Table.Td>
                <Table.Td>{m.usuario.nombre ?? m.usuario.email}</Table.Td>
                <Table.Td>
                  <Text size="xs">
                    {[m.motivoBaja ? NOMBRE_MOTIVO[m.motivoBaja] : null, m.detalle].filter(Boolean).join(' · ') || '—'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
            {movimientos.data?.items.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={7}>
                  <Text size="sm" c="dimmed" ta="center" py="md">
                    No hay movimientos con esos filtros.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {movimientos.data?.total ?? 0} movimientos
        </Text>
        <Pagination total={paginas} value={pagina} onChange={setPagina} />
      </Group>
    </Stack>
  );
}