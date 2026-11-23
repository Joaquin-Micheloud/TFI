import { useState } from 'react';
import { Alert, Button, Card, Group, Loader, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { IconDownload } from '@tabler/icons-react';
import { SelectorTienda } from '../../components/SelectorTienda';
import { api } from '../../lib/api';
import { NOMBRE_TIPO, type Metal, type TipoProducto } from '../../lib/catalogo';
import { descargarCsv, num } from '../../lib/csv';
import { formatoFechaHora, formatoPesos, nombreLey } from '../../lib/formato';
import { Indicador } from './Indicador';

interface Valor {
  unidades: number;
  costo: string;
  precio: string;
  sinPrecio: number;
}

interface Valorizacion {
  cotizacion: { tipoDolar: string; dolar: string; fechaHora: string };
  total: Valor;
  porTienda: ({ tienda: string } & Valor)[];
  porTipo: ({ tipo: TipoProducto } & Valor)[];
  gramos: { metal: Metal; ley: string; gramos: string }[];
}

const g = (valor: string) => `${Number(valor).toLocaleString('es-AR', { maximumFractionDigits: 3 })} g`;

export function ValorizacionTab() {
  const [tiendaId, setTiendaId] = useState<string | null>(null);

  const reporte = useQuery({
    queryKey: ['reportes', 'valorizacion', tiendaId],
    queryFn: () => api<Valorizacion>(`/reportes/valorizacion${tiendaId ? `?tiendaId=${tiendaId}` : ''}`),
  });

  const r = reporte.data;
  const exportar = () => {
    if (!r) return;
    descargarCsv(
      'valorizacion-inventario',
      ['Tienda', 'Unidades', 'Valor a costo', 'Valor a precio de venta', 'Sin precio'],
      r.porTienda.map((f) => [f.tienda, f.unidades, num(f.costo), num(f.precio), f.sinPrecio]),
    );
  };

  return (
    <Stack>
      <Group justify="space-between" align="flex-end">
        <SelectorTienda label="Tienda" value={tiendaId} onChange={setTiendaId} permitirTodas />
        <Button variant="default" leftSection={<IconDownload size={16} />} disabled={!r} onClick={exportar}>
          Exportar CSV
        </Button>
      </Group>

      {reporte.isLoading && <Loader />}
      {reporte.isError && <Alert color="red">{reporte.error.message}</Alert>}

      {r && (
        <>
          <Text size="sm" c="dimmed">
            Stock disponible valorizado con el dólar {r.cotizacion.tipoDolar.toLowerCase()} a{' '}
            {formatoPesos(r.cotizacion.dolar)} ({formatoFechaHora(r.cotizacion.fechaHora)}) y el precio del gramo de hoy.
            No incluye mercadería en tránsito.
          </Text>

          <SimpleGrid cols={{ base: 2, md: 4 }}>
            <Indicador titulo="Valor a costo" valor={formatoPesos(r.total.costo)} />
            <Indicador titulo="Valor a precio de venta" valor={formatoPesos(r.total.precio)} />
            <Indicador
              titulo="Ganancia potencial"
              valor={formatoPesos(Number(r.total.precio) - Number(r.total.costo))}
            />
            <Indicador titulo="Unidades" valor={r.total.unidades.toLocaleString('es-AR')} />
          </SimpleGrid>

          {r.total.sinPrecio > 0 && (
            <Alert color="orange">
              {r.total.sinPrecio} unidades no se pudieron valorizar a precio de venta (por ejemplo, falta el margen del
              producto o su categoría).
            </Alert>
          )}

          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <Card withBorder p={0}>
              <Title order={6} p="xs">
                Por tienda
              </Title>
              <Table fz="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Tienda</Table.Th>
                    <Table.Th ta="right">Unidades</Table.Th>
                    <Table.Th ta="right">A costo</Table.Th>
                    <Table.Th ta="right">A precio de venta</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {r.porTienda.map((f) => (
                    <Table.Tr key={f.tienda}>
                      <Table.Td>{f.tienda}</Table.Td>
                      <Table.Td ta="right">{f.unidades}</Table.Td>
                      <Table.Td ta="right">{formatoPesos(f.costo)}</Table.Td>
                      <Table.Td ta="right">{formatoPesos(f.precio)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>

            <Card withBorder p={0}>
              <Title order={6} p="xs">
                Por tipo de producto
              </Title>
              <Table fz="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Tipo</Table.Th>
                    <Table.Th ta="right">Unidades</Table.Th>
                    <Table.Th ta="right">A costo</Table.Th>
                    <Table.Th ta="right">A precio de venta</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {r.porTipo.map((f) => (
                    <Table.Tr key={f.tipo}>
                      <Table.Td>{NOMBRE_TIPO[f.tipo]}</Table.Td>
                      <Table.Td ta="right">{f.unidades}</Table.Td>
                      <Table.Td ta="right">{formatoPesos(f.costo)}</Table.Td>
                      <Table.Td ta="right">{formatoPesos(f.precio)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          </SimpleGrid>

          <Card withBorder p={0} maw={480}>
            <Title order={6} p="xs">
              Metal en stock
            </Title>
            <Table fz="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Metal</Table.Th>
                  <Table.Th>Ley</Table.Th>
                  <Table.Th ta="right">Gramos</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {r.gramos.map((f) => (
                  <Table.Tr key={`${f.metal}-${f.ley}`}>
                    <Table.Td>{f.metal === 'ORO' ? 'Oro' : 'Plata'}</Table.Td>
                    <Table.Td>{nombreLey(f.metal, f.ley)}</Table.Td>
                    <Table.Td ta="right">{g(f.gramos)}</Table.Td>
                  </Table.Tr>
                ))}
                {r.gramos.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={3}>
                      <Text size="sm" c="dimmed" ta="center">
                        No hay piezas de metal en stock.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Card>
        </>
      )}
    </Stack>
  );
}
