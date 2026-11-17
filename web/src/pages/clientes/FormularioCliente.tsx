import { Alert, Button, Group, Stack, TextInput, Textarea } from '@mantine/core';
import { isNotEmpty, useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Cliente } from '../../lib/clientes';

interface Props {
  cliente: Cliente | null; // null = alta
  onGuardado: (cliente: Cliente) => void;
}

export function FormularioCliente({ cliente, onGuardado }: Props) {
  const queryClient = useQueryClient();

  const form = useForm({
    initialValues: {
      nombre: cliente?.nombre ?? '',
      telefono: cliente?.telefono ?? '',
      email: cliente?.email ?? '',
      dni: cliente?.dni ?? '',
      notas: cliente?.notas ?? '',
    },
    validate: {
      nombre: isNotEmpty('El nombre es obligatorio'),
      email: (v) => (v.trim() && !/^\S+@\S+\.\S+$/.test(v.trim()) ? 'El email no es válido' : null),
    },
  });

  const guardar = useMutation({
    mutationFn: (v: typeof form.values) => {
      // Campo vacío = sin dato
      const body = {
        nombre: v.nombre,
        telefono: v.telefono.trim() || null,
        email: v.email.trim() || null,
        dni: v.dni.trim() || null,
        notas: v.notas.trim() || null,
      };
      return cliente
        ? api<Cliente>(`/clientes/${cliente.id}`, { method: 'PATCH', body })
        : api<Cliente>('/clientes', { method: 'POST', body });
    },
    onSuccess: (guardado) => {
      notifications.show({ color: 'green', message: cliente ? 'Cliente actualizado' : 'Cliente creado' });
      void queryClient.invalidateQueries({ queryKey: ['clientes'] });
      void queryClient.invalidateQueries({ queryKey: ['ventas'] });
      onGuardado(guardado);
    },
  });

  return (
    <form onSubmit={form.onSubmit((v) => guardar.mutate(v))}>
      <Stack>
        <TextInput label="Nombre y apellido" data-autofocus {...form.getInputProps('nombre')} />
        <Group grow>
          <TextInput label="Teléfono" placeholder="Opcional" {...form.getInputProps('telefono')} />
          <TextInput label="DNI" placeholder="Opcional" {...form.getInputProps('dni')} />
        </Group>
        <TextInput label="Email" placeholder="Opcional" {...form.getInputProps('email')} />
        <Textarea
          label="Notas"
          placeholder="Ej.: talle de anillo 14, prefiere oro blanco"
          autosize
          minRows={2}
          {...form.getInputProps('notas')}
        />
        {guardar.isError && <Alert color="red">{guardar.error.message}</Alert>}
        <Button type="submit" loading={guardar.isPending}>
          {cliente ? 'Guardar cambios' : 'Crear cliente'}
        </Button>
      </Stack>
    </form>
  );
}