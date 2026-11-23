import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { isNotEmpty, useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SelectorCliente } from '../../components/SelectorCliente';
import { SelectorTienda } from '../../components/SelectorTienda';
import { api } from '../../lib/api';
import { LEYES, type Metal } from '../../lib/catalogo';
import type { Cliente } from '../../lib/clientes';
import type { Compostura } from '../../lib/composturas';
import { formatoPesos } from '../../lib/formato';
import { MEDIOS, NOMBRE_MEDIO, type MedioPago } from '../vender/carrito';
import { usePrecioCompostura } from './precio';

interface Valores {
  tiendaId: string | null;
  descripcion: string;
  metal: Metal | null;
  ley: string | null;
  pesoEntrada: number | string;
  pesoAportado: number | string;
  fechaEstimada: string;
  observaciones: string;
  conPresupuesto: boolean;
  manoObra: number | string;
  pesoAgregado: number | string;
  margenPct: number | string;
  sena: number | string;
  medioSena: MedioPago;
}

const numeroONada = (v: number | string) => (v === '' ? undefined : Number(v));

export function NuevaCompostura({ onCreada }: { onCreada: (id: string) => void }) {
  const queryClient = useQueryClient();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [errorCliente, setErrorCliente] = useState(false);

  const form = useForm<Valores>({
    initialValues: {
      tiendaId: null,
      descripcion: '',
      metal: null,
      ley: null,
      pesoEntrada: '',
      pesoAportado: '',
      fechaEstimada: '',
      observaciones: '',
      conPresupuesto: false,
      manoObra: '',
      pesoAgregado: '',
      margenPct: '',
      sena: '',
      medioSena: 'EFECTIVO_ARS',
    },
    validate: {
      tiendaId: isNotEmpty('Elegí la tienda'),
      descripcion: isNotEmpty('Describí el trabajo'),
      pesoEntrada: (v) => (v === '' ? 'Pesá la pieza al recibirla' : null),
      ley: (v, val) => (val.metal && !v ? 'Elegí la ley' : null),
      manoObra: (v, val) => (val.conPresupuesto && v === '' ? 'Indicá la mano de obra' : null),
      pesoAgregado: (v, val) =>
        val.conPresupuesto && Number(v) > 0 && !val.metal ? 'Para agregar metal, indicá el metal y la ley' : null,
    },
  });

  const v = form.values;
  const precio = usePrecioCompostura(
    { metal: v.metal, ley: v.ley, manoObra: v.manoObra, pesoAgregado: v.pesoAgregado, margenPct: v.margenPct },
    v.conPresupuesto,
  );

  const crear = useMutation({
    mutationFn: (valores: Valores) =>
      api<Compostura>('/composturas', {
        method: 'POST',
        body: {
          tiendaId: valores.tiendaId,
          clienteId: cliente?.id,
          descripcion: valores.descripcion,
          metal: valores.metal ?? undefined,
          ley: valores.metal && valores.ley ? Number(valores.ley) : undefined,
          pesoEntrada: Number(valores.pesoEntrada),
          pesoAportado: numeroONada(valores.pesoAportado),
          fechaEstimada: valores.fechaEstimada || undefined,
          observaciones: valores.observaciones.trim() || undefined,
          ...(valores.conPresupuesto && {
            manoObra: Number(valores.manoObra),
            pesoAgregado: numeroONada(valores.pesoAgregado),
            margenPct: numeroONada(valores.margenPct),
          }),
          sena: numeroONada(valores.sena),
          medioSena: Number(valores.sena) > 0 ? valores.medioSena : undefined,
        },
      }),
    onSuccess: (compostura) => {
      notifications.show({
        color: 'green',
        message: `Orden #${compostura.numeroFormateado} registrada. Imprimí el comprobante para el cliente.`,
      });
      void queryClient.invalidateQueries({ queryKey: ['composturas'] });
      onCreada(compostura.id);
    },
  });

  const enviar = form.onSubmit((valores) => {
    if (!cliente) {
      setErrorCliente(true);
      return;
    }
    crear.mutate(valores);
  });

  return (
    <form onSubmit={enviar}>
      <Stack>
        <SelectorTienda label="Tienda" value={v.tiendaId} onChange={(id) => form.setFieldValue('tiendaId', id)} />
        {form.errors.tiendaId && (
          <Text size="xs" c="red">
            {form.errors.tiendaId}
          </Text>
        )}

        <div>
          <SelectorCliente
            label="Cliente"
            value={cliente}
            onChange={(c) => {
              setCliente(c);
              setErrorCliente(false);
            }}
          />
          {errorCliente && (
            <Text size="xs" c="red" mt={4}>
              El cliente es obligatorio en una compostura (nombre y teléfono para avisarle)
            </Text>
          )}
        </div>

        <Textarea
          label="Trabajo a realizar"
          placeholder="Ej.: soldar eslabón, cambiar broche, achicar anillo"
          autosize
          minRows={2}
          {...form.getInputProps('descripcion')}
        />

        <Group grow align="flex-start">
          <Select
            label="Metal"
            placeholder="Sin especificar"
            clearable
            data={[
              { value: 'ORO', label: 'Oro' },
              { value: 'PLATA', label: 'Plata' },
            ]}
            value={v.metal}
            onChange={(m) => {
              form.setFieldValue('metal', m as Metal | null);
              form.setFieldValue('ley', null);
            }}
          />
          <Select
            label="Ley"
            disabled={!v.metal}
            data={v.metal ? LEYES[v.metal] : []}
            {...form.getInputProps('ley')}
          />
        </Group>

        <Group grow align="flex-start">
          <NumberInput label="Peso de entrada (g)" min={0} decimalScale={3} decimalSeparator="," {...form.getInputProps('pesoEntrada')} />
          <NumberInput
            label="Material del cliente (g)"
            description="Si trae metal para el trabajo"
            min={0}
            decimalScale={3}
            decimalSeparator=","
            {...form.getInputProps('pesoAportado')}
          />
        </Group>

        <TextInput type="date" label="Entrega estimada" {...form.getInputProps('fechaEstimada')} />
        <Textarea label="Observaciones" autosize minRows={1} {...form.getInputProps('observaciones')} />

        <Switch
          label="Presupuestar ahora"
          checked={v.conPresupuesto}
          onChange={(e) => form.setFieldValue('conPresupuesto', e.currentTarget.checked)}
        />
        {v.conPresupuesto && (
          <Card withBorder>
            <Stack gap="xs">
              <Group grow align="flex-start">
                <NumberInput
                  label="Mano de obra ($)"
                  min={0}
                  decimalScale={2}
                  thousandSeparator="."
                  decimalSeparator=","
                  {...form.getInputProps('manoObra')}
                />
                <NumberInput
                  label="Metal a agregar (g)"
                  min={0}
                  decimalScale={3}
                  decimalSeparator=","
                  {...form.getInputProps('pesoAgregado')}
                />
                <NumberInput label="Margen sobre el metal" suffix=" %" min={0} decimalScale={2} {...form.getInputProps('margenPct')} />
              </Group>
              {precio.data && (
                <Group justify="space-between">
                  <Text size="sm">
                    Presupuesto
                    {Number(precio.data.material) > 0 && (
                      <Text span size="xs" c="dimmed">
                        {' '}
                        (metal {formatoPesos(precio.data.material)} a {formatoPesos(precio.data.gramo)}/g)
                      </Text>
                    )}
                  </Text>
                  <Text fw={700}>{formatoPesos(precio.data.precio)}</Text>
                </Group>
              )}
              {precio.isError && (
                <Text size="xs" c="red">
                  {precio.error.message}
                </Text>
              )}
            </Stack>
          </Card>
        )}

        <Group grow align="flex-start">
          <NumberInput
            label="Seña ($)"
            min={0}
            decimalScale={2}
            thousandSeparator="."
            decimalSeparator=","
            {...form.getInputProps('sena')}
          />
          <Select
            label="Cobrada con"
            disabled={!(Number(v.sena) > 0)}
            data={MEDIOS.filter((m) => m !== 'EFECTIVO_USD').map((m) => ({ value: m, label: NOMBRE_MEDIO[m] }))}
            value={v.medioSena}
            onChange={(m) => m && form.setFieldValue('medioSena', m as MedioPago)}
            allowDeselect={false}
          />
        </Group>

        {crear.isError && (
          <Alert color="red" style={{ whiteSpace: 'pre-line' }}>
            {crear.error.message}
          </Alert>
        )}

        <Button type="submit" loading={crear.isPending}>
          Registrar compostura
        </Button>
      </Stack>
    </form>
  );
}
