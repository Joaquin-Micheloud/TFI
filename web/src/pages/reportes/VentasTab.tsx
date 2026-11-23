import { useState } from 'react';
import { Alert, Button, Card, Group, Loader, SimpleGrid, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { IconDownload } from '@tabler/icons-react';
import { SelectorTienda } from '../../components/SelectorTienda';
import { api } from '../../lib/api';
import { descargarCsv, num } from '../../lib/csv';
import { formatoPesos } from '../../lib/formato';
import { Indicador } from './Indicador';

interface Fila {
  cantidad: number;
  total: string;
  ticketPromedio: string;
  costo: string;
  margenBruto: string;
}

interface ReporteVentas {
  desde: string;
  hasta: string;
  total: Fila & { devuelto: string; neto: string };
  porDia: ({ dia: string } & Fila)[];
  porTienda: ({ tienda: string } & Fila)[];
  porVendedor: ({ vendedor: string } & Fila)[];
}

const fechaLocal = (fecha: Date) => fecha.toLocaleDateString('en-CA'); // AAAA-MM-DD
const diaCorto = (dia: string) => dia.split('-').reverse().join('/');
const margenPct = (f: Fila) => (Number(f.total) > 0 ? `${((Number(f.margenBruto) / Number(f.total)) * 100).toFixed(1)} %` : '—');

function TablaAgrupada({ titulo, columna, filas }: { titulo: string; columna: string; filas: { etiqueta: string; fila: Fila }[] }) {
  return (
    <Card withBorder p={0}>
      <Title order={6} p="xs">
        {titulo}
      </Title>
      <Table fz="sm" striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{columna}</Table.Th>
            <Table.Th ta="right">Tickets</Table.Th>
            <Table.Th ta="right">Total</Table.Th>
            <Table.Th ta="right">Promedio</Table.Th>
            <Table.Th ta="right">Margen bruto</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {filas.map(({ etiqueta, fila }) => (
            <Table.Tr key={etiqueta}>
              <Table.Td>{etiqueta}</Table.Td>
              <Table.Td ta="right">{fila.cantidad}</Table.Td>
              <Table.Td ta="right">{formatoPesos(fila.total)}</Table.Td>
              <Table.Td ta="right">{formatoPesos(fila.ticketPromedio)}</Table.Td>
              <Table.Td ta="right">
                {formatoPesos(fila.margenBruto)}{' '}
                <Text span size="xs" c="dimmed">
                  ({margenPct(fila)})
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
          {filas.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={5}>
                <Text size="sm" c="dimmed" ta="center">
                  Sin ventas en el período.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Card>
  );
}

export function VentasTab() {
  const [tiendaId, setTiendaId] = useState<string | null>(null);
  const [desde, setDesde] = useState(() => fechaLocal(new Date(Date.now() - 29 * 86_400_000)));
  const [hasta, setHasta] = useState(() => fechaLocal(new Date()));

  const parametros = new URLSearchParams({ desde, hasta });
  if (tiendaId) parametros.set('tiendaId', tiendaId);

  const reporte = useQuery({
    queryKey: ['reportes', 'ventas', parametros.toString()],
    queryFn: () => api<ReporteVentas>(`/reportes/ventas?${parametros}`),
    enabled: Boolean(desde && hasta),
  });
  const r = reporte.data;

  const exportar = () => {
    if (!r) return;
    descargarCsv(
      `ventas-${r.desde}-a-${r.hasta}`,
      ['Día', 'Tickets', 'Total', 'Ticket promedio', 'Costo', 'Margen bruto'],
      r.porDia.map((f) => [f.dia, f.cantidad, num(f.total), num(f.ticketPromedio), num(f.costo), num(f.margenBruto)]),
    );
  };

  return (
    <Stack>
      <Group justify="space-between" align="flex-end">
        <Group align="flex-end">
          <SelectorTienda label="Tienda" value={tiendaId} onChange={setTiendaId} permitirTodas />
          <TextInput type="date" label="Desde" value={desde} onChange={(e) => setDesde(e.currentTarget.value)} />
          <TextInput type="date" label="Hasta" value={hasta} onChange={(e) => setHasta(e.currentTarget.value)} />
        </Group>
        <Button variant="default" leftSection={<IconDownload size={16} />} disabled={!r} onClick={exportar}>
          Exportar CSV
        </Button>
      </Group>

      {reporte.isLoading && <Loader />}
      {reporte.isError && <Alert color="red">{reporte.error.message}</Alert>}

      {r && (
        <>
          <SimpleGrid cols={{ base: 2, md: 5 }}>
            <Indicador titulo="Total vendido" valor={formatoPesos(r.total.total)} />
            <Indicador titulo="Tickets" valor={String(r.total.cantidad)} />
            <Indicador titulo="Ticket promedio" valor={formatoPesos(r.total.ticketPromedio)} />
            <Indicador titulo="Margen bruto" valor={formatoPesos(r.total.margenBruto)} detalle={margenPct(r.total)} />
            <Indicador
              titulo="Neto de devoluciones"
              valor={formatoPesos(r.total.neto)}
              detalle={Number(r.total.devuelto) > 0 ? `Devuelto: ${formatoPesos(r.total.devuelto)}` : undefined}
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <TablaAgrupada
              titulo="Por tienda"
              columna="Tienda"
              filas={r.porTienda.map((f) => ({ etiqueta: f.tienda, fila: f }))}
            />
            <TablaAgrupada
              titulo="Por vendedor"
              columna="Vendedor"
              filas={r.porVendedor.map((f) => ({ etiqueta: f.vendedor, fila: f }))}
            />
          </SimpleGrid>

          <TablaAgrupada titulo="Por día" columna="Día" filas={r.porDia.map((f) => ({ etiqueta: diaCorto(f.dia), fila: f }))} />
        </>
      )}
    </Stack>
  );
}
