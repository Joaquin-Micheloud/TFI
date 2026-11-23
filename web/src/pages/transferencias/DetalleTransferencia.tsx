import { Alert, Badge, Button, Card, Group, Loader, Stack, Table, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconArrowRight, IconCheck, IconX } from '@tabler/icons-react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../lib/api';
import { formatoFechaHora } from '../../lib/formato';
import {
  COLOR_ESTADO_TRANSFERENCIA,
  NOMBRE_ESTADO_TRANSFERENCIA,
  nombreUsuario,
  type Transferencia,
} from '../../lib/transferencias';

export function DetalleTransferencia({ transferenciaId }: { transferenciaId: string }) {
  const { sesion } = useAuth();
  const queryClient = useQueryClient();
  const puedeCancelar = sesion?.rol === 'ADMIN' || sesion?.rol === 'GERENTE';

  const transferencia = useQuery({
    queryKey: ['transferencias', 'detalle', transferenciaId],
    queryFn: () => api<Transferencia>(`/transferencias/${transferenciaId}`),
  });

  const accion = useMutation({
    mutationFn: (tipo: 'recibir' | 'cancelar') =>
      api<Transferencia>(`/transferencias/${transferenciaId}/${tipo}`, { method: 'POST' }),
    onSuccess: (_t, tipo) => {
      notifications.show({
        color: 'green',
        message: tipo === 'recibir' ? 'Recepción confirmada: el stock ya está en destino' : 'Transferencia cancelada',
      });
      void queryClient.invalidateQueries({ queryKey: ['transferencias'] });
      void queryClient.invalidateQueries({ queryKey: ['stock'] });
    },
  });

  if (transferencia.isLoading) return <Loader />;
  if (transferencia.isError) return <Alert color="red">{transferencia.error.message}</Alert>;
  const t = transferencia.data!;

  return (
    <Stack>
      <Group justify="space-between" align="flex-start">
        <div>
          <Group gap={6}>
            <Title order={4}>{t.origen.nombre}</Title>
            <IconArrowRight size={18} />
            <Title order={4}>{t.destino.nombre}</Title>
          </Group>
          <Text size="sm" c="dimmed">
            Enviada el {formatoFechaHora(t.enviadaEn)} por {nombreUsuario(t.enviadaPor)}
          </Text>
          {t.recibidaEn && t.recibidaPor && (
            <Text size="sm" c="dimmed">
              Recibida el {formatoFechaHora(t.recibidaEn)} por {nombreUsuario(t.recibidaPor)}
            </Text>
          )}
          {t.canceladaEn && t.canceladaPor && (
            <Text size="sm" c="dimmed">
              Cancelada el {formatoFechaHora(t.canceladaEn)} por {nombreUsuario(t.canceladaPor)}
            </Text>
          )}
        </div>
        <Badge color={COLOR_ESTADO_TRANSFERENCIA[t.estado]}>{NOMBRE_ESTADO_TRANSFERENCIA[t.estado]}</Badge>
      </Group>

      {t.nota && <Alert color="gray">{t.nota}</Alert>}

      {t.estado === 'ENVIADA' && (
        <Group grow>
          <Button
            color="green"
            leftSection={<IconCheck size={16} />}
            loading={accion.isPending && accion.variables === 'recibir'}
            onClick={() => accion.mutate('recibir')}
          >
            Confirmar recepción
          </Button>
          {puedeCancelar && (
            <Button
              variant="light"
              color="red"
              leftSection={<IconX size={16} />}
              loading={accion.isPending && accion.variables === 'cancelar'}
              onClick={() => accion.mutate('cancelar')}
            >
              Cancelar
            </Button>
          )}
        </Group>
      )}
      {accion.isError && (
        <Alert color="red" style={{ whiteSpace: 'pre-line' }}>
          {accion.error.message}
        </Alert>
      )}

      <Card withBorder p={0}>
        <Table fz="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Producto</Table.Th>
              <Table.Th>Pieza o lote</Table.Th>
              <Table.Th ta="right">Cantidad</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {t.items.map((i) => (
              <Table.Tr key={i.id}>
                <Table.Td>
                  {i.producto.codigo} · {i.producto.nombre}
                </Table.Td>
                <Table.Td>
                  {i.pieza ? (
                    <Text size="sm" ff="monospace">
                      {i.pieza.codigo} ({Number(i.pieza.pesoGramos).toLocaleString('es-AR')} g)
                    </Text>
                  ) : (
                    <Text size="sm">
                      Lote del {i.loteOrigen ? new Date(i.loteOrigen.fechaIngreso).toLocaleDateString('es-AR') : '—'}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td ta="right">{i.cantidad}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>

      {t.estado === 'ENVIADA' && (
        <Text size="xs" c="dimmed">
          Mientras está en tránsito, la mercadería no se puede vender en ninguna de las dos tiendas. Al confirmar la
          recepción queda disponible en {t.destino.nombre}.
        </Text>
      )}
    </Stack>
  );
}
