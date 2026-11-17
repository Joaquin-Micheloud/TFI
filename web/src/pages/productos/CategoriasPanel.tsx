import { useState } from 'react';
import { ActionIcon, Alert, Button, Card, Group, Modal, NumberInput, Stack, Table, Text, TextInput } from '@mantine/core';
import { isNotEmpty, useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { api } from '../../lib/api';
import type { Categoria } from '../../lib/catalogo';

export function CategoriasPanel() {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<Categoria | 'nueva' | null>(null);

  const categorias = useQuery({ queryKey: ['categorias'], queryFn: () => api<Categoria[]>('/categorias') });

  // Un cambio de margen cambia los precios: se refresca todo lo que los muestra
  const invalidar = () => {
    void queryClient.invalidateQueries({ queryKey: ['categorias'] });
    void queryClient.invalidateQueries({ queryKey: ['productos'] });
    void queryClient.invalidateQueries({ queryKey: ['vender'] });
  };

  const eliminar = useMutation({
    mutationFn: (id: string) => api(`/categorias/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      notifications.show({ message: 'Categoría eliminada' });
      invalidar();
    },
    onError: (e) => notifications.show({ color: 'red', message: e.message }),
  });

  const confirmarEliminar = (c: Categoria) => {
    const aviso =
      c._count.productos > 0 ? `\n\nSus ${c._count.productos} productos van a quedar sin categoría.` : '';
    if (window.confirm(`¿Eliminar la categoría "${c.nombre}"?${aviso}`)) eliminar.mutate(c.id);
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Text c="dimmed" size="sm">
          El margen de la categoría se usa en todos sus productos que no tienen margen propio.
        </Text>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setEditando('nueva')}>
          Nueva categoría
        </Button>
      </Group>

      <Card withBorder p={0}>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Categoría</Table.Th>
              <Table.Th ta="right">Margen por defecto</Table.Th>
              <Table.Th ta="right">Productos</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {categorias.data?.map((c) => (
              <Table.Tr key={c.id}>
                <Table.Td>{c.nombre}</Table.Td>
                <Table.Td ta="right">{Number(c.margenDefectoPct ?? 0)} %</Table.Td>
                <Table.Td ta="right">{c._count.productos}</Table.Td>
                <Table.Td w={90}>
                  <Group gap={4} justify="flex-end">
                    <ActionIcon variant="subtle" onClick={() => setEditando(c)} aria-label="Editar">
                      <IconPencil size={16} />
                    </ActionIcon>
                    <ActionIcon variant="subtle" color="red" onClick={() => confirmarEliminar(c)} aria-label="Eliminar">
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {categorias.data?.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text size="sm" c="dimmed" ta="center" py="md">
                    Todavía no hay categorías.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      <Modal
        opened={editando !== null}
        onClose={() => setEditando(null)}
        title={editando === 'nueva' ? 'Nueva categoría' : 'Editar categoría'}
        centered
      >
        {editando !== null && (
          <FormularioCategoria
            key={editando === 'nueva' ? 'nueva' : editando.id}
            categoria={editando === 'nueva' ? null : editando}
            onListo={() => {
              invalidar();
              setEditando(null);
            }}
          />
        )}
      </Modal>
    </Stack>
  );
}

function FormularioCategoria({ categoria, onListo }: { categoria: Categoria | null; onListo: () => void }) {
  const form = useForm({
    initialValues: {
      nombre: categoria?.nombre ?? '',
      margenDefectoPct: categoria?.margenDefectoPct != null ? Number(categoria.margenDefectoPct) : 0,
    },
    validate: { nombre: isNotEmpty('El nombre es obligatorio') },
  });

  const guardar = useMutation({
    mutationFn: (v: typeof form.values) =>
      categoria
        ? api(`/categorias/${categoria.id}`, { method: 'PATCH', body: v })
        : api('/categorias', { method: 'POST', body: v }),
    onSuccess: onListo,
  });

  return (
    <form onSubmit={form.onSubmit((v) => guardar.mutate({ ...v, margenDefectoPct: Number(v.margenDefectoPct) || 0 }))}>
      <Stack>
        <TextInput label="Nombre" data-autofocus {...form.getInputProps('nombre')} />
        <NumberInput
          label="Margen por defecto"
          description="Porcentaje que se suma al costo: 40 % significa costo × 1,40"
          suffix=" %"
          min={0}
          max={1000}
          decimalScale={2}
          {...form.getInputProps('margenDefectoPct')}
        />
        {guardar.isError && <Alert color="red">{guardar.error.message}</Alert>}
        <Button type="submit" loading={guardar.isPending}>
          Guardar
        </Button>
      </Stack>
    </form>
  );
}