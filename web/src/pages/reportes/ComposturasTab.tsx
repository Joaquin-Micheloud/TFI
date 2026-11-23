import { useState } from 'react';
import { Alert, Badge, Card, Group, Loader, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { SelectorTienda } from '../../components/SelectorTienda';
import { api } from '../../lib/api';
import {
  COLOR_ESTADO_COMPOSTURA,
  ESTADOS_COMPOSTURA,
  NOMBRE_ESTADO_COMPOSTURA,
  fechaSinHora,
  type AlertasComposturas,
  type ComposturaResumen,
} from '../../lib/composturas';
import { formatoPesos } from '../../lib/formato';

function Lista({ titulo, composturas, vacia }: { titulo: string; composturas: ComposturaResumen[]; vacia: string }) {
  return (
    <Card withBorder p={0}>
      <Title order={6} p="xs">
        {titulo}
      </Title>
      <Table fz="sm">
        <Table.Tbody>
          {composturas.map((c) => (
            <Table.Tr key={c.id}>
              <Table.Td ff="monospace">#{c.numeroFormateado}</Table.Td>
              <Table.Td>
                {c.cliente.nombre}
                {c.cliente.telefono && (
                  <Text span size="xs" c="dimmed">
                    {' '}
                    · {c.cliente.telefono}
                  </Text>
                )}
              </Table.Td>
              <Table.Td>{c.tienda.nombre}</Table.Td>
              <Table.Td>{fechaSinHora(c.fechaEstimada)}</Table.Td>
              <Table.Td ta="right">{formatoPesos(c.presupuesto)}</Table.Td>
            </Table.Tr>
          ))}
          {composturas.length === 0 && (
            <Table.Tr>
              <Table.Td>
                <Text size="sm" c="dimmed" ta="center">
                  {vacia}
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Card>
  );
}

export function ComposturasTab() {
  const [tiendaId, setTiendaId] = useState<string | null>(null);

  const alertas = useQuery({
    queryKey: ['composturas', 'alertas', tiendaId],
    queryFn: () => api<AlertasComposturas>(`/composturas/alertas${tiendaId ? `?tiendaId=${tiendaId}` : ''}`),
  });
  const a = alertas.data;

  return (
    <Stack>
      <SelectorTienda label="Tienda" value={tiendaId} onChange={setTiendaId} permitirTodas />

      {alertas.isLoading && <Loader />}
      {alertas.isError && <Alert color="red">{alertas.error.message}</Alert>}

      {a && (
        <>
          <SimpleGrid cols={{ base: 2, md: 6 }}>
            {ESTADOS_COMPOSTURA.map((e) => (
              <Card key={e} withBorder p="sm">
                <Group justify="space-between">
                  <Badge size="xs" variant="light" color={COLOR_ESTADO_COMPOSTURA[e]}>
                    {NOMBRE_ESTADO_COMPOSTURA[e]}
                  </Badge>
                </Group>
                <Text fw={700} size="lg">
                  {a.porEstado[e]}
                </Text>
              </Card>
            ))}
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <Lista
              titulo="Vencidas (pasó la fecha estimada y no están listas)"
              composturas={a.vencidas}
              vacia="No hay composturas vencidas."
            />
            <Lista
              titulo={`Listas hace más de ${a.diasSinRetirar} días sin retirar`}
              composturas={a.sinRetirar}
              vacia="No hay piezas esperando retiro."
            />
          </SimpleGrid>
        </>
      )}
    </Stack>
  );
}
