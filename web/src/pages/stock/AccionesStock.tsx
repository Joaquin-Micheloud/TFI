import { useState } from 'react';
import { Alert, Button, Modal, NumberInput, Select, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { NOMBRE_MOTIVO, type Lote, type MotivoBaja, type Pieza } from '../../lib/stock';

const opcionesMotivo = Object.entries(NOMBRE_MOTIVO).map(([value, label]) => ({ value, label }));

function useInvalidarStock() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['stock'] });
    void queryClient.invalidateQueries({ queryKey: ['vender'] });
  };
}

export function BajaPiezaModal({ pieza, onClose }: { pieza: Pieza; onClose: () => void }) {
  const invalidar = useInvalidarStock();
  const [motivo, setMotivo] = useState<MotivoBaja | null>(null);
  const [detalle, setDetalle] = useState('');

  const baja = useMutation({
    mutationFn: () =>
      api(`/stock/piezas/${pieza.id}/baja`, { method: 'POST', body: { motivo, detalle: detalle.trim() || undefined } }),
    onSuccess: () => {
      notifications.show({ message: `Pieza ${pieza.codigo} dada de baja` });
      invalidar();
      onClose();
    },
  });

  return (
    <Modal opened onClose={onClose} title={`Dar de baja la pieza ${pieza.codigo}`} centered>
      <Stack>
        <Text size="sm" c="dimmed">
          La pieza deja de estar disponible. El movimiento queda registrado y no se puede borrar.
        </Text>
        <Select label="Motivo" data={opcionesMotivo} value={motivo} onChange={(v) => setMotivo(v as MotivoBaja | null)} />
        <TextInput label="Detalle" placeholder="Opcional" value={detalle} onChange={(e) => setDetalle(e.currentTarget.value)} />
        {baja.isError && <Alert color="red">{baja.error.message}</Alert>}
        <Button color="red" disabled={!motivo} loading={baja.isPending} onClick={() => baja.mutate()}>
          Dar de baja
        </Button>
      </Stack>
    </Modal>
  );
}

// accion "baja": saca unidades del lote. accion "ajuste": corrige según un conteo físico.
export function AccionLoteModal({ lote, accion, onClose }: { lote: Lote; accion: 'baja' | 'ajuste'; onClose: () => void }) {
  const invalidar = useInvalidarStock();
  const [cantidad, setCantidad] = useState<number | string>(accion === 'ajuste' ? lote.cantidadDisponible : '');
  const [motivo, setMotivo] = useState<MotivoBaja | null>(null);
  const [detalle, setDetalle] = useState('');

  const ejecutar = useMutation({
    mutationFn: () =>
      accion === 'baja'
        ? api(`/stock/lotes/${lote.id}/baja`, {
            method: 'POST',
            body: { cantidad: Number(cantidad), motivo, detalle: detalle.trim() || undefined },
          })
        : api(`/stock/lotes/${lote.id}/ajuste`, {
            method: 'POST',
            body: { cantidadContada: Number(cantidad), detalle: detalle.trim() },
          }),
    onSuccess: () => {
      notifications.show({ message: accion === 'baja' ? 'Baja registrada' : 'Ajuste registrado' });
      invalidar();
      onClose();
    },
  });

  const valido =
    accion === 'baja'
      ? Number(cantidad) >= 1 && Number(cantidad) <= lote.cantidadDisponible && !!motivo
      : cantidad !== '' && Number(cantidad) !== lote.cantidadDisponible && detalle.trim().length > 0;

  return (
    <Modal
      opened
      onClose={onClose}
      title={`${accion === 'baja' ? 'Baja de unidades' : 'Ajuste por conteo'} · ${lote.producto.codigo}`}
      centered
    >
      <Stack>
        <Text size="sm">
          Disponibles según el sistema: <b>{lote.cantidadDisponible}</b>
        </Text>
        <NumberInput
          label={accion === 'baja' ? 'Unidades a dar de baja' : 'Cantidad contada'}
          min={accion === 'baja' ? 1 : 0}
          max={accion === 'baja' ? lote.cantidadDisponible : undefined}
          allowDecimal={false}
          value={cantidad}
          onChange={setCantidad}
        />
        {accion === 'baja' && (
          <Select label="Motivo" data={opcionesMotivo} value={motivo} onChange={(v) => setMotivo(v as MotivoBaja | null)} />
        )}
        <TextInput
          label="Detalle"
          placeholder={accion === 'ajuste' ? 'Obligatorio: por qué no coincide' : 'Opcional'}
          value={detalle}
          onChange={(e) => setDetalle(e.currentTarget.value)}
        />
        {ejecutar.isError && <Alert color="red">{ejecutar.error.message}</Alert>}
        <Button color={accion === 'baja' ? 'red' : undefined} disabled={!valido} loading={ejecutar.isPending} onClick={() => ejecutar.mutate()}>
          Confirmar
        </Button>
      </Stack>
    </Modal>
  );
}