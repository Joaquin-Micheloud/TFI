import { useState } from 'react';
import { Alert, Button, Card, Group, Loader, SimpleGrid, Stack, Table, Text, TextInput } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { IconDownload } from '@tabler/icons-react';
import { SelectorTienda } from '../../components/SelectorTienda';
import { api } from '../../lib/api';
import { descargarCsv, num } from '../../lib/csv';
import { formatoPesos, formatoUsd } from '../../lib/formato';
import { NOMBRE_MEDIO, type MedioPago } from '../vender/carrito';
import { Indicador } from './Indicador';

interface Caja {
  fecha: string;
  soloMias: boolean;
  tickets: number;
  vendido: string;
  reintegrado: string;
  neto: string;
  porMedio: {
    medio: MedioPago;
    cobrado: string;
    dolares: string;
    reintegrado: string;
    vuelto: string;
    neto: string;
  }[];
}

export function CajaTab() {
  const [tiendaId, setTiendaId] = useState<string | null>(null);
  const [fecha, setFecha] = useState(() => new Date().toLocaleDateString('en-CA'));

  const parametros = new URLSearchParams({ fecha });
  if (tiendaId) parametros.set('tiendaId', tiendaId);

  const caja = useQuery({
    queryKey: ['reportes', 'caja', parametros.toString()],
    queryFn: () => api<Caja>(`/reportes/caja?${parametros}`),
    enabled: Boolean(fecha),
  });
  const c = caja.data;

  const exportar = () => {
    if (!c) return;
    descargarCsv(
      `caja-${c.fecha}`,
      ['Medio', 'Cobrado', 'Vuelto', 'Reintegros', 'Neto', 'USD recibidos'],
      c.porMedio.map((m) => [NOMBRE_MEDIO[m.medio], num(m.cobrado), num(m.vuelto), num(m.reintegrado), num(m.neto), num(m.dolares)]),
    );
  };

  const efectivo = c?.porMedio.find((m) => m.medio === 'EFECTIVO_ARS');
  const dolares = c?.porMedio.find((m) => m.medio === 'EFECTIVO_USD');

  return (
    <Stack>
      <Group justify="space-between" align="flex-end">
        <Group align="flex-end">
          <TextInput type="date" label="Fecha" value={fecha} onChange={(e) => setFecha(e.currentTarget.value)} />
          <SelectorTienda label="Tienda" value={tiendaId} onChange={setTiendaId} permitirTodas />
        </Group>
        <Button variant="default" leftSection={<IconDownload size={16} />} disabled={!c} onClick={exportar}>
          Exportar CSV
        </Button>
      </Group>

      {caja.isLoading && <Loader />}
      {caja.isError && <Alert color="red">{caja.error.message}</Alert>}

      {c && (
        <>
          {c.soloMias && (
            <Text size="sm" c="dimmed">
              Se muestran solo tus ventas.
            </Text>
          )}

          <SimpleGrid cols={{ base: 2, md: 4 }}>
            <Indicador titulo="Tickets" valor={String(c.tickets)} />
            <Indicador titulo="Vendido" valor={formatoPesos(c.vendido)} />
            <Indicador titulo="Devoluciones" valor={formatoPesos(c.reintegrado)} />
            <Indicador titulo="Neto" valor={formatoPesos(c.neto)} />
          </SimpleGrid>

          <Card withBorder p={0}>
            <Table fz="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Medio de pago</Table.Th>
                  <Table.Th ta="right">Cobrado</Table.Th>
                  <Table.Th ta="right">Vuelto</Table.Th>
                  <Table.Th ta="right">Reintegros</Table.Th>
                  <Table.Th ta="right">Neto</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {c.porMedio.map((m) => (
                  <Table.Tr key={m.medio}>
                    <Table.Td>
                      {NOMBRE_MEDIO[m.medio]}
                      {m.medio === 'EFECTIVO_USD' && Number(m.dolares) > 0 && (
                        <Text span size="xs" c="dimmed">
                          {' '}
                          ({formatoUsd(m.dolares)})
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td ta="right">{formatoPesos(m.cobrado)}</Table.Td>
                    <Table.Td ta="right">{Number(m.vuelto) > 0 ? `-${formatoPesos(m.vuelto)}` : '—'}</Table.Td>
                    <Table.Td ta="right">{Number(m.reintegrado) > 0 ? `-${formatoPesos(m.reintegrado)}` : '—'}</Table.Td>
                    <Table.Td ta="right" fw={600}>
                      {formatoPesos(m.neto)}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>

          {efectivo && dolares && (
            <Text size="sm">
              Efectivo que tiene que haber en la caja: <b>{formatoPesos(efectivo.neto)}</b>
              {Number(dolares.dolares) > 0 && (
                <>
                  {' '}
                  y <b>{formatoUsd(dolares.dolares)}</b>
                </>
              )}
              .
            </Text>
          )}
        </>
      )}
    </Stack>
  );
}
