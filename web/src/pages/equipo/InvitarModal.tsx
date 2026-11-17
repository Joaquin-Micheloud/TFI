import { Alert, Button, Modal, MultiSelect, NumberInput, Select, Stack, Text, TextInput } from '@mantine/core';
import { isEmail, useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { NOMBRE_ROL, type Rol } from '../../lib/tipos';

interface Props {
  opened: boolean;
  onClose: () => void;
  esAdmin: boolean;
}

export function InvitarModal({ opened, onClose, esAdmin }: Props) {
  const queryClient = useQueryClient();
  // Para un gerente, /tiendas ya devuelve solo sus tiendas
  const tiendas = useQuery({
    queryKey: ['tiendas'],
    queryFn: () => api<{ id: string; nombre: string; activa: boolean }[]>('/tiendas'),
  });

  const form = useForm({
    initialValues: { email: '', rol: 'VENDEDOR' as Rol, topeDescuento: 10 as number | string, tiendaIds: [] as string[] },
    validate: {
      email: isEmail('Ingresá un email válido'),
      tiendaIds: (v, valores) => (valores.rol !== 'ADMIN' && v.length === 0 ? 'Elegí al menos una tienda' : null),
    },
  });

  const invitar = useMutation({
    mutationFn: (v: typeof form.values) =>
      api<{ emailEnviado: boolean; email: string }>('/invitaciones', {
        method: 'POST',
        body: {
          email: v.email,
          rol: v.rol,
          topeDescuento: v.rol === 'VENDEDOR' ? Number(v.topeDescuento) || 0 : 0,
          tiendaIds: v.rol === 'ADMIN' ? [] : v.tiendaIds,
        },
      }),
    onSuccess: (r) => {
      if (r.emailEnviado) {
        notifications.show({ color: 'green', message: `Invitación enviada a ${r.email}` });
      } else {
        notifications.show({
          color: 'orange',
          message: 'La invitación se creó, pero no se pudo enviar el email. Reenviala desde la lista.',
        });
      }
      void queryClient.invalidateQueries({ queryKey: ['equipo'] });
      form.reset();
      onClose();
    },
  });

  const rolesPermitidos: Rol[] = esAdmin ? ['ADMIN', 'GERENTE', 'VENDEDOR'] : ['VENDEDOR'];
  const rol = form.values.rol;

  return (
    <Modal opened={opened} onClose={onClose} title="Invitar al equipo" centered>
      <form onSubmit={form.onSubmit((v) => invitar.mutate(v))}>
        <Stack>
          <Text size="sm" c="dimmed">
            La persona recibe un email con un link que vence en 72 horas y se puede usar una sola vez.
          </Text>
          <TextInput label="Email" data-autofocus {...form.getInputProps('email')} />
          <Select
            label="Rol"
            data={rolesPermitidos.map((r) => ({ value: r, label: NOMBRE_ROL[r] }))}
            disabled={!esAdmin}
            allowDeselect={false}
            {...form.getInputProps('rol')}
          />
          {rol === 'ADMIN' ? (
            <Text size="xs" c="dimmed">
              Un administrador opera en todas las tiendas y puede hacer todo en el negocio.
            </Text>
          ) : (
            <MultiSelect
              label="Tiendas donde va a trabajar"
              data={(tiendas.data ?? []).filter((t) => t.activa).map((t) => ({ value: t.id, label: t.nombre }))}
              {...form.getInputProps('tiendaIds')}
            />
          )}
          {rol === 'VENDEDOR' && (
            <NumberInput
              label="Tope de descuento"
              description="Máximo descuento que puede aplicar en una venta"
              suffix=" %"
              min={0}
              max={100}
              decimalScale={2}
              {...form.getInputProps('topeDescuento')}
            />
          )}
          {invitar.isError && <Alert color="red">{invitar.error.message}</Alert>}
          <Button type="submit" loading={invitar.isPending}>
            Enviar invitación
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}