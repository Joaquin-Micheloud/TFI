import { Alert, Button, Card, Loader, Select, Stack, Text, TextInput, Title } from '@mantine/core';
import { isNotEmpty, useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../lib/api';
import { formatoPesos } from '../../lib/formato';

interface Negocio {
  id: string;
  nombre: string;
  cuit: string | null;
  tipoDolar: string;
  reglaRedondeo: number;
}

interface Cotizacion {
  tipo: string;
  valorVenta: string;
}

const TIPOS_DOLAR = [
  { value: 'OFICIAL', label: 'Oficial' },
  { value: 'BLUE', label: 'Blue' },
  { value: 'MEP', label: 'MEP (bolsa)' },
  { value: 'CCL', label: 'Contado con liquidación' },
  { value: 'TARJETA', label: 'Tarjeta' },
  { value: 'MAYORISTA', label: 'Mayorista' },
];

const REDONDEOS = [
  { value: '1', label: 'Sin redondeo (al peso)' },
  { value: '10', label: 'Al múltiplo de $10' },
  { value: '50', label: 'Al múltiplo de $50' },
  { value: '100', label: 'Al múltiplo de $100' },
  { value: '500', label: 'Al múltiplo de $500' },
  { value: '1000', label: 'Al múltiplo de $1.000' },
];

export function NegocioPage() {
  const negocio = useQuery({ queryKey: ['negocio'], queryFn: () => api<Negocio>('/negocio') });
  const cotizaciones = useQuery({ queryKey: ['cotizaciones'], queryFn: () => api<Cotizacion[]>('/cotizaciones') });

  return (
    <Stack maw={560}>
      <Title order={2}>Datos del negocio</Title>
      {negocio.isLoading && <Loader />}
      {negocio.data && (
        <FormularioNegocio key={negocio.data.id} negocio={negocio.data} cotizaciones={cotizaciones.data ?? []} />
      )}
    </Stack>
  );
}

function FormularioNegocio({ negocio, cotizaciones }: { negocio: Negocio; cotizaciones: Cotizacion[] }) {
  const queryClient = useQueryClient();
  const { actualizarSesion } = useAuth();

  const form = useForm({
    initialValues: {
      nombre: negocio.nombre,
      cuit: negocio.cuit ?? '',
      tipoDolar: negocio.tipoDolar,
      reglaRedondeo: String(negocio.reglaRedondeo),
    },
    validate: {
      nombre: isNotEmpty('El nombre es obligatorio'),
      cuit: (v) => (v && !/^\d{2}-?\d{8}-?\d$/.test(v) ? 'Formato: 20-12345678-9' : null),
    },
  });

  // Cada opción de dólar muestra su valor de hoy
  const opcionesDolar = TIPOS_DOLAR.map((t) => {
    const cotizacion = cotizaciones.find((c) => c.tipo === `DOLAR_${t.value}`);
    return { value: t.value, label: cotizacion ? `${t.label} — ${formatoPesos(cotizacion.valorVenta)}` : t.label };
  });

  const guardar = useMutation({
    mutationFn: (v: typeof form.values) =>
      api<Negocio>('/negocio', {
        method: 'PATCH',
        body: {
          nombre: v.nombre,
          cuit: v.cuit.trim() || undefined,
          tipoDolar: v.tipoDolar,
          reglaRedondeo: Number(v.reglaRedondeo),
        },
      }),
    onSuccess: (n) => {
      notifications.show({ color: 'green', message: 'Datos guardados' });
      actualizarSesion({ negocio: { id: n.id, nombre: n.nombre } }); // el encabezado muestra el nombre nuevo
      // El dólar y el redondeo cambian todos los precios
      for (const clave of ['negocio', 'productos', 'stock', 'vender', 'precios']) {
        void queryClient.invalidateQueries({ queryKey: [clave] });
      }
    },
  });

  return (
    <form onSubmit={form.onSubmit((v) => guardar.mutate(v))}>
      <Card withBorder>
        <Stack>
          <TextInput label="Nombre comercial" {...form.getInputProps('nombre')} />
          <TextInput label="CUIT" placeholder="20-12345678-9" {...form.getInputProps('cuit')} />
          <Select
            label="Dólar con el que opera el negocio"
            description="Se usa para convertir los precios en USD y el precio internacional del oro y la plata"
            data={opcionesDolar}
            allowDeselect={false}
            {...form.getInputProps('tipoDolar')}
          />
          <Select
            label="Redondeo de los precios de venta"
            description="Ej.: con redondeo a $100, un precio de $147.643 queda en $147.600"
            data={REDONDEOS}
            allowDeselect={false}
            {...form.getInputProps('reglaRedondeo')}
          />
          {guardar.isError && <Alert color="red">{guardar.error.message}</Alert>}
          <Text size="xs" c="dimmed">
            Cambiar el dólar o el redondeo recalcula todos los precios. Las ventas ya hechas no cambian.
          </Text>
          <Button type="submit" loading={guardar.isPending}>
            Guardar
          </Button>
        </Stack>
      </Card>
    </form>
  );
}