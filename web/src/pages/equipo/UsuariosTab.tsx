import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Switch,
  Table,
  Text,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../lib/api';
import { NOMBRE_ROL, type Rol } from '../../lib/tipos';
import { COLOR_ROL, type Miembro } from './equipo';

export function UsuariosTab({ esAdmin }: { esAdmin: boolean }) {
  const queryClient = useQueryClient();
  const { sesion } = useAuth();
  const [editando, setEditando] = useState<Miembro | null>(null);

  const miembros = useQuery({ queryKey: ['equipo', 'usuarios'], queryFn: () => api<Miembro[]>('/usuarios') });

  // El gerente solo activa o desactiva vendedores
  const alternarActivo = useMutation({
    mutationFn: (m: Miembro) => api(`/usuarios/${m.id}`, { method: 'PATCH', body: { activo: !m.activo } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['equipo'] }),
    onError: (e) => notifications.show({ color: 'red', message: e.message }),
  });

  return (
    <>
      <Card withBorder p={0}>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Persona</Table.Th>
              <Table.Th>Rol</Table.Th>
              <Table.Th>Tiendas</Table.Th>
              <Table.Th ta="right">Tope desc.</Table.Th>
              <Table.Th>Estado</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {miembros.data?.map((m) => {
              const esUnoMismo = m.usuario.id === sesion?.usuario.id;
              return (
                <Table.Tr key={m.id} opacity={m.activo ? 1 : 0.55}>
                  <Table.Td>
                    <Group gap={6}>
                      <Text size="sm" fw={500}>
                        {m.usuario.nombre ?? '—'}
                      </Text>
                      {esUnoMismo && (
                        <Badge size="xs" variant="outline">
                          Vos
                        </Badge>
                      )}
                    </Group>
                    <Text size="xs" c="dimmed">
                      {m.usuario.email}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={COLOR_ROL[m.rol]}>
                      {NOMBRE_ROL[m.rol]}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {m.rol === 'ADMIN' ? 'Todas' : m.tiendas.map((t) => t.nombre).join(', ') || 'Ninguna'}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">{m.rol === 'VENDEDOR' ? `${Number(m.topeDescuento)} %` : 'Sin tope'}</Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={m.activo ? 'green' : 'gray'}>
                      {m.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {esAdmin && (
                      <Button size="xs" variant="subtle" onClick={() => setEditando(m)}>
                        Editar
                      </Button>
                    )}
                    {!esAdmin && m.rol === 'VENDEDOR' && (
                      <Button
                        size="xs"
                        variant="subtle"
                        color={m.activo ? 'red' : 'green'}
                        loading={alternarActivo.isPending && alternarActivo.variables?.id === m.id}
                        onClick={() => alternarActivo.mutate(m)}
                      >
                        {m.activo ? 'Desactivar' : 'Activar'}
                      </Button>
                    )}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Card>

      <Modal opened={editando !== null} onClose={() => setEditando(null)} title="Editar integrante" centered>
        {editando && (
          <FormularioMiembro
            key={editando.id}
            miembro={editando}
            esUnoMismo={editando.usuario.id === sesion?.usuario.id}
            onListo={() => {
              void queryClient.invalidateQueries({ queryKey: ['equipo'] });
              setEditando(null);
            }}
          />
        )}
      </Modal>
    </>
  );
}

function FormularioMiembro({ miembro, esUnoMismo, onListo }: { miembro: Miembro; esUnoMismo: boolean; onListo: () => void }) {
  const tiendas = useQuery({
    queryKey: ['tiendas'],
    queryFn: () => api<{ id: string; nombre: string; activa: boolean }[]>('/tiendas'),
  });
  const activas = (tiendas.data ?? []).filter((t) => t.activa);

  const form = useForm({
    initialValues: {
      rol: miembro.rol,
      topeDescuento: Number(miembro.topeDescuento) as number | string,
      tiendaIds: miembro.tiendas.map((t) => t.id),
      activo: miembro.activo,
    },
  });

  const guardar = useMutation({
    mutationFn: (v: typeof form.values) =>
      api(`/usuarios/${miembro.id}`, {
        method: 'PATCH',
        body: {
          // Uno mismo no puede cambiarse el rol ni desactivarse (el backend también lo impide)
          rol: esUnoMismo ? undefined : v.rol,
          activo: esUnoMismo ? undefined : v.activo,
          topeDescuento: Number(v.topeDescuento) || 0,
          tiendaIds: v.tiendaIds.filter((id) => activas.some((t) => t.id === id)),
        },
      }),
    onSuccess: () => {
      notifications.show({ color: 'green', message: 'Cambios guardados' });
      onListo();
    },
  });

  return (
    <form onSubmit={form.onSubmit((v) => guardar.mutate(v))}>
      <Stack>
        <div>
          <Text fw={500}>{miembro.usuario.nombre}</Text>
          <Text size="sm" c="dimmed">
            {miembro.usuario.email}
          </Text>
        </div>
        <Select
          label="Rol"
          data={(['ADMIN', 'GERENTE', 'VENDEDOR'] as Rol[]).map((r) => ({ value: r, label: NOMBRE_ROL[r] }))}
          disabled={esUnoMismo}
          allowDeselect={false}
          {...form.getInputProps('rol')}
        />
        <MultiSelect
          label="Tiendas asignadas"
          description="Un administrador opera en todas; para gerentes y vendedores define dónde trabajan"
          data={activas.map((t) => ({ value: t.id, label: t.nombre }))}
          {...form.getInputProps('tiendaIds')}
        />
        <NumberInput
          label="Tope de descuento"
          description="Solo aplica a vendedores"
          suffix=" %"
          min={0}
          max={100}
          decimalScale={2}
          {...form.getInputProps('topeDescuento')}
        />
        <Switch label="Activo" disabled={esUnoMismo} {...form.getInputProps('activo', { type: 'checkbox' })} />
        {esUnoMismo && (
          <Text size="xs" c="dimmed">
            No podés cambiar tu propio rol ni desactivarte.
          </Text>
        )}
        {guardar.isError && <Alert color="red">{guardar.error.message}</Alert>}
        <Button type="submit" loading={guardar.isPending}>
          Guardar
        </Button>
      </Stack>
    </form>
  );
}