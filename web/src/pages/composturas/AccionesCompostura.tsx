import { useState } from 'react';
import { Alert, Button, Group, Modal, NumberInput, Stack, Text, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Compostura } from '../../lib/composturas';
import { formatoPesos } from '../../lib/formato';
import { calcularPagos, type PagoCarrito } from '../vender/carrito';
import { PanelPagos } from '../vender/PanelPagos';
import { usePrecioCompostura } from './precio';

interface PropsModal {
  compostura: Compostura;
  abierto: boolean;
  onCerrar: () => void;
}

const aNumero = (v: string | null) => (v == null ? '' : Number(v));

function useInvalidar() {
  const queryClient = useQueryClient();
  return () => {
    for (const clave of ['composturas', 'ventas', 'clientes']) {
      void queryClient.invalidateQueries({ queryKey: [clave] });
    }
  };
}

// Desglose del precio en vivo (mano de obra + metal agregado × margen)
function Desglose({ precio }: { precio: ReturnType<typeof usePrecioCompostura> }) {
  if (precio.isError) {
    return (
      <Text size="xs" c="red">
        {precio.error.message}
      </Text>
    );
  }
  if (!precio.data) return null;
  const p = precio.data;
  return (
    <Stack gap={2}>
      <Group justify="space-between">
        <Text size="xs" c="dimmed">
          Mano de obra
        </Text>
        <Text size="xs">{formatoPesos(p.manoObra)}</Text>
      </Group>
      {Number(p.material) > 0 && (
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            Metal agregado ({Number(p.pesoAgregado).toLocaleString('es-AR')} g a {formatoPesos(p.gramo)}/g, +
            {Number(p.margenPct)} %)
          </Text>
          <Text size="xs">{formatoPesos(Number(p.material) * (1 + Number(p.margenPct) / 100))}</Text>
        </Group>
      )}
      <Group justify="space-between">
        <Text fw={600}>Precio</Text>
        <Text fw={700}>{formatoPesos(p.precio)}</Text>
      </Group>
    </Stack>
  );
}

// ---------- Presupuesto ----------

export function PresupuestoModal({ compostura, abierto, onCerrar }: PropsModal) {
  return (
    <Modal opened={abierto} onClose={onCerrar} title={`Presupuesto · orden #${compostura.numeroFormateado}`} centered>
      {abierto && <FormularioPresupuesto compostura={compostura} onCerrar={onCerrar} />}
    </Modal>
  );
}

function FormularioPresupuesto({ compostura, onCerrar }: { compostura: Compostura; onCerrar: () => void }) {
  const invalidar = useInvalidar();
  const [manoObra, setManoObra] = useState<number | string>(aNumero(compostura.manoObra));
  const [pesoAgregado, setPesoAgregado] = useState<number | string>(aNumero(compostura.pesoAgregado));
  const [margenPct, setMargenPct] = useState<number | string>(aNumero(compostura.margenPct));

  const precio = usePrecioCompostura({ metal: compostura.metal, ley: compostura.ley, manoObra, pesoAgregado, margenPct });

  const guardar = useMutation({
    mutationFn: () =>
      api(`/composturas/${compostura.id}/presupuesto`, {
        method: 'POST',
        body: {
          manoObra: Number(manoObra),
          pesoAgregado: pesoAgregado === '' ? undefined : Number(pesoAgregado),
          margenPct: margenPct === '' ? undefined : Number(margenPct),
        },
      }),
    onSuccess: () => {
      notifications.show({ color: 'green', message: 'Presupuesto guardado. Esperando la respuesta del cliente.' });
      invalidar();
      onCerrar();
    },
  });

  return (
    <Stack>
      <NumberInput
        label="Mano de obra ($)"
        min={0}
        decimalScale={2}
        thousandSeparator="."
        decimalSeparator=","
        value={manoObra}
        onChange={setManoObra}
      />
      <Group grow>
        <NumberInput
          label="Metal a agregar (g)"
          description={compostura.metal ? undefined : 'La orden no tiene metal cargado'}
          disabled={!compostura.metal}
          min={0}
          decimalScale={3}
          decimalSeparator=","
          value={pesoAgregado}
          onChange={setPesoAgregado}
        />
        <NumberInput label="Margen sobre el metal" suffix=" %" min={0} decimalScale={2} value={margenPct} onChange={setMargenPct} />
      </Group>
      <Desglose precio={precio} />
      {guardar.isError && <Alert color="red">{guardar.error.message}</Alert>}
      <Button disabled={manoObra === ''} loading={guardar.isPending} onClick={() => guardar.mutate()}>
        Guardar presupuesto
      </Button>
    </Stack>
  );
}

// ---------- Cancelación ----------

export function CancelarModal({ compostura, abierto, onCerrar }: PropsModal) {
  const invalidar = useInvalidar();
  const [motivo, setMotivo] = useState('');

  const cancelar = useMutation({
    mutationFn: () =>
      api(`/composturas/${compostura.id}/estado`, { method: 'POST', body: { estado: 'CANCELADA', nota: motivo } }),
    onSuccess: () => {
      notifications.show({ message: `Orden #${compostura.numeroFormateado} cancelada` });
      invalidar();
      onCerrar();
    },
  });

  return (
    <Modal opened={abierto} onClose={onCerrar} title={`Cancelar orden #${compostura.numeroFormateado}`} centered>
      <Stack>
        <Text size="sm">
          La pieza se devuelve al cliente sin trabajar.
          {Number(compostura.sena) > 0 && ` Acordate de devolverle la seña de ${formatoPesos(compostura.sena)}.`}
        </Text>
        <Textarea
          label="Motivo"
          placeholder="Ej.: el cliente no aceptó el presupuesto"
          autosize
          minRows={2}
          value={motivo}
          onChange={(e) => setMotivo(e.currentTarget.value)}
        />
        {cancelar.isError && <Alert color="red">{cancelar.error.message}</Alert>}
        <Button color="red" disabled={!motivo.trim()} loading={cancelar.isPending} onClick={() => cancelar.mutate()}>
          Cancelar compostura
        </Button>
      </Stack>
    </Modal>
  );
}

// ---------- Entrega ----------

export function EntregarModal({ compostura, abierto, onCerrar }: PropsModal) {
  return (
    <Modal
      opened={abierto}
      onClose={onCerrar}
      title={`Entregar orden #${compostura.numeroFormateado}`}
      size="lg"
      centered
    >
      {abierto && <FormularioEntrega compostura={compostura} onCerrar={onCerrar} />}
    </Modal>
  );
}

function FormularioEntrega({ compostura, onCerrar }: { compostura: Compostura; onCerrar: () => void }) {
  const invalidar = useInvalidar();
  const [pesoSalida, setPesoSalida] = useState<number | string>('');
  const [manoObra, setManoObra] = useState<number | string>(aNumero(compostura.manoObra));
  const [pesoAgregado, setPesoAgregado] = useState<number | string>(aNumero(compostura.pesoAgregado));
  const [margenPct, setMargenPct] = useState<number | string>(aNumero(compostura.margenPct));
  const [pagos, setPagos] = useState<PagoCarrito[]>([]);

  const precio = usePrecioCompostura({ metal: compostura.metal, ley: compostura.ley, manoObra, pesoAgregado, margenPct });
  const total = precio.data ? Number(precio.data.precio) : 0;
  const sena = Number(compostura.sena);
  const saldo = Math.max(Math.round((total - sena) * 100) / 100, 0);
  const dolar = precio.data ? Number(precio.data.dolar) : 0;
  const estado = calcularPagos(pagos, saldo, dolar);

  const entregar = useMutation({
    mutationFn: () =>
      api<Compostura>(`/composturas/${compostura.id}/entregar`, {
        method: 'POST',
        body: {
          pesoSalida: Number(pesoSalida),
          manoObra: Number(manoObra),
          pesoAgregado: pesoAgregado === '' ? undefined : Number(pesoAgregado),
          margenPct: margenPct === '' ? undefined : Number(margenPct),
          pagos: pagos
            .filter((p) => p.monto > 0)
            .map((p) => ({ medio: p.medio, monto: p.monto, cuotas: p.cuotas })),
        },
      }),
    onSuccess: (c) => {
      notifications.show({
        color: 'green',
        message: `Orden #${c.numeroFormateado} entregada y cobrada. El ticket está en el detalle.`,
      });
      invalidar();
      onCerrar();
    },
  });

  const listo =
    pesoSalida !== '' &&
    manoObra !== '' &&
    precio.data !== undefined &&
    total >= sena &&
    estado.falta === 0 &&
    !estado.vueltoSinEfectivo;

  return (
    <Stack>
      <Group grow align="flex-start">
        <NumberInput
          label="Peso de salida (g)"
          description={`Entró con ${Number(compostura.pesoEntrada).toLocaleString('es-AR')} g`}
          min={0}
          decimalScale={3}
          decimalSeparator=","
          value={pesoSalida}
          onChange={setPesoSalida}
        />
        <NumberInput
          label="Mano de obra ($)"
          min={0}
          decimalScale={2}
          thousandSeparator="."
          decimalSeparator=","
          value={manoObra}
          onChange={setManoObra}
        />
      </Group>
      <Group grow align="flex-start">
        <NumberInput
          label="Metal agregado (g)"
          disabled={!compostura.metal}
          min={0}
          decimalScale={3}
          decimalSeparator=","
          value={pesoAgregado}
          onChange={setPesoAgregado}
        />
        <NumberInput label="Margen sobre el metal" suffix=" %" min={0} decimalScale={2} value={margenPct} onChange={setMargenPct} />
      </Group>

      <Desglose precio={precio} />
      {sena > 0 && (
        <>
          <Group justify="space-between">
            <Text size="sm">Seña cobrada</Text>
            <Text size="sm">-{formatoPesos(sena)}</Text>
          </Group>
          <Group justify="space-between">
            <Text fw={600}>Saldo a cobrar</Text>
            <Text fw={700}>{formatoPesos(saldo)}</Text>
          </Group>
        </>
      )}
      {precio.data && total < sena && <Alert color="orange">La seña supera el precio final.</Alert>}

      {saldo > 0 && (
        <PanelPagos dolar={dolar} pagos={pagos} estado={estado} deshabilitado={!precio.data} onChange={setPagos} />
      )}

      {entregar.isError && (
        <Alert color="red" style={{ whiteSpace: 'pre-line' }}>
          {entregar.error.message}
        </Alert>
      )}
      <Button color="green" disabled={!listo} loading={entregar.isPending} onClick={() => entregar.mutate()}>
        Confirmar entrega
      </Button>
    </Stack>
  );
}
