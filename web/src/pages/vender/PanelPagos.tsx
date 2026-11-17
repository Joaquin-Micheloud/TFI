import { ActionIcon, Alert, Button, Card, Group, NumberInput, Select, Stack, Text, Title } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { formatoPesos } from '../../lib/formato';
import { MEDIOS, NOMBRE_MEDIO, type EstadoPagos, type MedioPago, type PagoCarrito } from './carrito';

interface Props {
  dolar: number;
  pagos: PagoCarrito[];
  estado: EstadoPagos;
  deshabilitado: boolean;
  onChange: (pagos: PagoCarrito[]) => void;
}

export function PanelPagos({ dolar, pagos, estado, deshabilitado, onChange }: Props) {
  // Cada medio nuevo se completa con lo que falta
  const agregar = (medio: MedioPago) => {
    const monto =
      medio === 'EFECTIVO_USD' && dolar > 0 ? Math.ceil((estado.falta / dolar) * 100) / 100 : estado.falta;
    onChange([...pagos, { clave: crypto.randomUUID(), medio, monto, cuotas: medio === 'CREDITO' ? 1 : undefined }]);
  };

  const actualizar = (clave: string, cambios: Partial<PagoCarrito>) =>
    onChange(pagos.map((p) => (p.clave === clave ? { ...p, ...cambios } : p)));

  const quitar = (clave: string) => onChange(pagos.filter((p) => p.clave !== clave));

  return (
    <Card withBorder>
      <Stack gap="sm">
        <Title order={5}>Pagos</Title>

        <Group gap={6}>
          {MEDIOS.map((medio) => (
            <Button key={medio} size="xs" variant="light" disabled={deshabilitado} onClick={() => agregar(medio)}>
              + {NOMBRE_MEDIO[medio]}
            </Button>
          ))}
        </Group>

        {pagos.map((p) => (
          <Group key={p.clave} wrap="nowrap" gap="xs">
            <Text size="sm" w={100}>
              {NOMBRE_MEDIO[p.medio]}
            </Text>
            <NumberInput
              size="xs"
              style={{ flex: 1 }}
              prefix={p.medio === 'EFECTIVO_USD' ? 'USD ' : '$ '}
              decimalScale={2}
              thousandSeparator="."
              decimalSeparator=","
              min={0}
              value={p.monto}
              onChange={(v) => actualizar(p.clave, { monto: Number(v) || 0 })}
            />
            {p.medio === 'CREDITO' && (
              <Select
                size="xs"
                w={110}
                data={[
                  { value: '1', label: '1 cuota' },
                  { value: '3', label: '3 cuotas' },
                  { value: '6', label: '6 cuotas' },
                  { value: '12', label: '12 cuotas' },
                ]}
                value={String(p.cuotas ?? 1)}
                onChange={(v) => actualizar(p.clave, { cuotas: Number(v) || 1 })}
                allowDeselect={false}
              />
            )}
            <ActionIcon variant="subtle" color="red" onClick={() => quitar(p.clave)} aria-label="Quitar pago">
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        ))}

        {pagos.some((p) => p.medio === 'EFECTIVO_USD') && (
          <Text size="xs" c="dimmed">
            Los dólares se toman a {formatoPesos(dolar)}
          </Text>
        )}

        <Group justify="space-between">
          <Text size="sm">Pagado</Text>
          <Text size="sm">{formatoPesos(estado.pagado)}</Text>
        </Group>
        {estado.falta > 0 && (
          <Group justify="space-between">
            <Text size="sm" c="red">
              Falta
            </Text>
            <Text size="sm" c="red" fw={600}>
              {formatoPesos(estado.falta)}
            </Text>
          </Group>
        )}
        {estado.vuelto > 0 && (
          <Group justify="space-between">
            <Text c="green">Vuelto</Text>
            <Text c="green" fw={700}>
              {formatoPesos(estado.vuelto)}
            </Text>
          </Group>
        )}
        {estado.vueltoSinEfectivo && (
          <Alert color="orange">Solo se puede dar vuelto si hay un pago en efectivo.</Alert>
        )}
      </Stack>
    </Card>
  );
}