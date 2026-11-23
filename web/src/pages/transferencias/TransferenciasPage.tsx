import { useState } from 'react';
import { Badge, Button, Card, Drawer, Group, Select, Stack, Table, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { IconArrowRight, IconPlus } from '@tabler/icons-react';
import { useAuth } from '../../auth/AuthContext';
import { SelectorTienda } from '../../components/SelectorTienda';
import { api } from '../../lib/api';
import { formatoFechaHora } from '../../lib/formato';
import {
  COLOR_ESTADO_TRANSFERENCIA,
  NOMBRE_ESTADO_TRANSFERENCIA,
  nombreUsuario,
  unidades,
  type EstadoTransferencia,
  type Transferencia,
} from '../../lib/transferencias';
import { DetalleTransferencia } from './DetalleTransferencia';
import { NuevaTransferencia } from './NuevaTransferencia';

export function TransferenciasPage() {
  const { sesion } = useAuth();
  const puedeEnviar = sesion?.rol === 'ADMIN' || sesion?.rol === 'GERENTE';
  const [tiendaId, setTiendaId] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoTransferencia | null>(null);
  const [nuevaAbierta, setNuevaAbierta] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);

  const parametros = new URLSearchParams();
  if (tiendaId) parametros.set('tiendaId', tiendaId);
  if (estado) parametros.set('estado', estado);

  const transferencias = useQuery({
    queryKey: ['transferencias', parametros.toString()],
    queryFn: () => api<Transferencia[]>(`/transferencias?${parametros}`),
  });

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Transferencias</Title>
        {puedeEnviar && (
          <Button leftSection={<IconPlus size={16} />} onClick={() => setNuevaAbierta(true)}>
            Nueva transferencia
          </Button>
        )}
      </Group>

      <Group align="flex-end">
        <SelectorTienda label="Tienda (origen o destino)" value={tiendaId} onChange={setTiendaId} permitirTodas />
        <Select
          label="Estado"
          w={180}
          placeholder="Todos"
          clearable
          data={Object.entries(NOMBRE_ESTADO_TRANSFERENCIA).map(([value, label]) => ({ value, label }))}
          value={estado}
          onChange={(v) => setEstado(v as EstadoTransferencia | null)}
        />
      </Group>

      <Card withBorder p={0}>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Enviada</Table.Th>
              <Table.Th>Recorrido</Table.Th>
              <Table.Th>Envió</Table.Th>
              <Table.Th ta="right">Unidades</Table.Th>
              <Table.Th>Estado</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {transferencias.data?.map((t) => (
              <Table.Tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setDetalleId(t.id)}>
                <Table.Td>{formatoFechaHora(t.enviadaEn)}</Table.Td>
                <Table.Td>
                  <Group gap={6} wrap="nowrap">
                    <Text size="sm">{t.origen.nombre}</Text>
                    <IconArrowRight size={14} />
                    <Text size="sm">{t.destino.nombre}</Text>
                  </Group>
                </Table.Td>
                <Table.Td>{nombreUsuario(t.enviadaPor)}</Table.Td>
                <Table.Td ta="right">{unidades(t)}</Table.Td>
                <Table.Td>
                  <Badge color={COLOR_ESTADO_TRANSFERENCIA[t.estado]} variant="light">
                    {NOMBRE_ESTADO_TRANSFERENCIA[t.estado]}
                  </Badge>
                </Table.Td>
              </Table.Tr>
            ))}
            {transferencias.data?.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text size="sm" c="dimmed" ta="center" py="md">
                    No hay transferencias con esos filtros.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      <Drawer
        opened={nuevaAbierta}
        onClose={() => setNuevaAbierta(false)}
        position="right"
        size="xl"
        title="Nueva transferencia"
      >
        {nuevaAbierta && <NuevaTransferencia onListo={() => setNuevaAbierta(false)} />}
      </Drawer>

      <Drawer
        opened={detalleId !== null}
        onClose={() => setDetalleId(null)}
        position="right"
        size="lg"
        title="Detalle de la transferencia"
      >
        {detalleId && <DetalleTransferencia transferenciaId={detalleId} />}
      </Drawer>
    </Stack>
  );
}
