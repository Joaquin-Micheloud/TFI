import { useState } from 'react';
import { Alert, Badge, Button, Card, Group, Modal, Select, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { isNotEmpty, useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconPlus } from '@tabler/icons-react';
import { api } from '../../lib/api';

interface Tienda {
  id: string;
  nombre: string;
  direccion: string | null;
  localidad: string | null;
  provincia: string | null;
  activa: boolean;
  puntoVenta: number;
}

const PROVINCIAS = [
  'Buenos Aires', 'Ciudad Autónoma de Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes',
  'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro',
  'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
];

export function TiendasPage() {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<Tienda | 'nueva' | null>(null);

  const tiendas = useQuery({ queryKey: ['tiendas'], queryFn: () => api<Tienda[]>('/tiendas') });

  const cambiarEstado = useMutation({
    mutationFn: (t: Tienda) =>
      t.activa
        ? api(`/tiendas/${t.id}`, { method: 'DELETE' })
        : api(`/tiendas/${t.id}`, { method: 'PATCH', body: { activa: true } }),
    onSuccess: () => {
      notifications.show({ message: 'Tienda actualizada' });
      void queryClient.invalidateQueries({ queryKey: ['tiendas'] });
    },
    onError: (e) => notifications.show({ color: 'red', message: e.message }),
  });

  const alternar = (t: Tienda) => {
    if (t.activa && !window.confirm(`¿Desactivar "${t.nombre}"? No se va a poder vender ni ingresar stock en ella.`)) return;
    cambiarEstado.mutate(t);
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Tiendas</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setEditando('nueva')}>
          Nueva tienda
        </Button>
      </Group>

      <Card withBorder p={0}>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Tienda</Table.Th>
              <Table.Th>Punto de venta</Table.Th>
              <Table.Th>Ubicación</Table.Th>
              <Table.Th>Estado</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {tiendas.data?.map((t) => (
              <Table.Tr key={t.id}>
                <Table.Td fw={500}>{t.nombre}</Table.Td>
                <Table.Td ff="monospace">{String(t.puntoVenta).padStart(4, '0')}</Table.Td>
                <Table.Td>
                  <Text size="sm">{t.direccion ?? '—'}</Text>
                  <Text size="xs" c="dimmed">
                    {[t.localidad, t.provincia].filter(Boolean).join(', ')}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge variant="light" color={t.activa ? 'green' : 'gray'}>
                    {t.activa ? 'Activa' : 'Inactiva'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap={4} justify="flex-end" wrap="nowrap">
                    <Button size="xs" variant="subtle" onClick={() => setEditando(t)}>
                      Editar
                    </Button>
                    <Button size="xs" variant="subtle" color={t.activa ? 'red' : 'green'} onClick={() => alternar(t)}>
                      {t.activa ? 'Desactivar' : 'Reactivar'}
                    </Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>

      <Text size="xs" c="dimmed">
        El punto de venta es el prefijo de los tickets de cada tienda (por ejemplo 0001-00000123) y no se puede cambiar.
      </Text>

      <Modal opened={editando !== null} onClose={() => setEditando(null)} title={editando === 'nueva' ? 'Nueva tienda' : 'Editar tienda'} centered>
        {editando !== null && (
          <FormularioTienda
            key={editando === 'nueva' ? 'nueva' : editando.id}
            tienda={editando === 'nueva' ? null : editando}
            onListo={() => {
              void queryClient.invalidateQueries({ queryKey: ['tiendas'] });
              setEditando(null);
            }}
          />
        )}
      </Modal>
    </Stack>
  );
}

function FormularioTienda({ tienda, onListo }: { tienda: Tienda | null; onListo: () => void }) {
  const form = useForm({
    initialValues: {
      nombre: tienda?.nombre ?? '',
      direccion: tienda?.direccion ?? '',
      localidad: tienda?.localidad ?? '',
      provincia: tienda?.provincia ?? null,
    },
    validate: { nombre: isNotEmpty('El nombre es obligatorio') },
  });

  const guardar = useMutation({
    mutationFn: (v: typeof form.values) => {
      const body = {
        nombre: v.nombre,
        direccion: v.direccion.trim() || null,
        localidad: v.localidad.trim() || null,
        provincia: v.provincia || null,
      };
      return tienda
        ? api(`/tiendas/${tienda.id}`, { method: 'PATCH', body })
        : api('/tiendas', { method: 'POST', body });
    },
    onSuccess: () => {
      notifications.show({ color: 'green', message: tienda ? 'Tienda actualizada' : 'Tienda creada' });
      onListo();
    },
  });

  return (
    <form onSubmit={form.onSubmit((v) => guardar.mutate(v))}>
      <Stack>
        <TextInput label="Nombre" data-autofocus {...form.getInputProps('nombre')} />
        <TextInput label="Dirección" {...form.getInputProps('direccion')} />
        <Group grow>
          <TextInput label="Localidad" {...form.getInputProps('localidad')} />
          <Select label="Provincia" data={PROVINCIAS} searchable clearable {...form.getInputProps('provincia')} />
        </Group>
        {guardar.isError && <Alert color="red">{guardar.error.message}</Alert>}
        <Button type="submit" loading={guardar.isPending}>
          Guardar
        </Button>
      </Stack>
    </form>
  );
}