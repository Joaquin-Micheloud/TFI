import { Badge, Button, Card, Group, Table, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatoFechaHora } from '../../lib/formato';
import { NOMBRE_ROL } from '../../lib/tipos';
import { COLOR_ESTADO_INVITACION, COLOR_ROL, NOMBRE_ESTADO_INVITACION, type Invitacion } from './equipo';

export function InvitacionesTab() {
  const queryClient = useQueryClient();
  const invitaciones = useQuery({ queryKey: ['equipo', 'invitaciones'], queryFn: () => api<Invitacion[]>('/invitaciones') });
  const tiendas = useQuery({
    queryKey: ['tiendas'],
    queryFn: () => api<{ id: string; nombre: string }[]>('/tiendas'),
  });

  const nombreTienda = (id: string) => tiendas.data?.find((t) => t.id === id)?.nombre ?? '—';
  const invalidar = () => void queryClient.invalidateQueries({ queryKey: ['equipo'] });

  const reenviar = useMutation({
    mutationFn: (id: string) => api<{ emailEnviado: boolean }>(`/invitaciones/${id}/reenviar`, { method: 'POST' }),
    onSuccess: (r) => {
      notifications.show({
        color: r.emailEnviado ? 'green' : 'orange',
        message: r.emailEnviado ? 'Invitación reenviada: el link anterior dejó de servir' : 'No se pudo enviar el email',
      });
      invalidar();
    },
    onError: (e) => notifications.show({ color: 'red', message: e.message }),
  });

  const cancelar = useMutation({
    mutationFn: (id: string) => api(`/invitaciones/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      notifications.show({ message: 'Invitación cancelada' });
      invalidar();
    },
    onError: (e) => notifications.show({ color: 'red', message: e.message }),
  });

  return (
    <Card withBorder p={0}>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Email</Table.Th>
            <Table.Th>Rol</Table.Th>
            <Table.Th>Tiendas</Table.Th>
            <Table.Th>Invitó</Table.Th>
            <Table.Th>Estado</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {invitaciones.data?.map((i) => {
            const abierta = i.estado === 'PENDIENTE' || i.estado === 'VENCIDA';
            return (
              <Table.Tr key={i.id}>
                <Table.Td>
                  <Text size="sm">{i.email}</Text>
                  <Text size="xs" c="dimmed">
                    Enviada el {formatoFechaHora(i.creadoEn)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge variant="light" color={COLOR_ROL[i.rol]}>
                    {NOMBRE_ROL[i.rol]}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{i.rol === 'ADMIN' ? 'Todas' : i.tiendaIds.map(nombreTienda).join(', ')}</Text>
                </Table.Td>
                <Table.Td>{i.invitadoPor.nombre ?? i.invitadoPor.email}</Table.Td>
                <Table.Td>
                  <Badge variant="light" color={COLOR_ESTADO_INVITACION[i.estado]}>
                    {NOMBRE_ESTADO_INVITACION[i.estado]}
                  </Badge>
                  {i.estado === 'PENDIENTE' && (
                    <Text size="xs" c="dimmed">
                      Vence el {formatoFechaHora(i.venceEn)}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  {abierta && (
                    <Group gap={4} wrap="nowrap" justify="flex-end">
                      <Button
                        size="xs"
                        variant="subtle"
                        loading={reenviar.isPending && reenviar.variables === i.id}
                        onClick={() => reenviar.mutate(i.id)}
                      >
                        Reenviar
                      </Button>
                      <Button
                        size="xs"
                        variant="subtle"
                        color="red"
                        onClick={() => window.confirm(`¿Cancelar la invitación a ${i.email}?`) && cancelar.mutate(i.id)}
                      >
                        Cancelar
                      </Button>
                    </Group>
                  )}
                </Table.Td>
              </Table.Tr>
            );
          })}
          {invitaciones.data?.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text size="sm" c="dimmed" ta="center" py="md">
                  Todavía no hay invitaciones.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Card>
  );
}