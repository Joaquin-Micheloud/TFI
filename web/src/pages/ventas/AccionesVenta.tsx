import { useState } from 'react';
import { Alert, Button, Group, Modal, NumberInput, Select, Stack, Table, Text, TextInput, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatoPesos } from '../../lib/formato';
import { MEDIOS, NOMBRE_MEDIO, type MedioPago } from '../vender/carrito';
import type { ItemVenta, VentaDetalle } from './tipos';

// Anular o devolver cambia ventas, stock y precios de catálogo (rangos)
function useInvalidarVenta() {
  const queryClient = useQueryClient();
  return () => {
    for (const clave of ['ventas', 'stock', 'vender', 'productos']) {
      void queryClient.invalidateQueries({ queryKey: [clave] });
    }
  };
}

export function AnularVentaModal({ venta, onClose }: { venta: VentaDetalle; onClose: () => void }) {
  const invalidar = useInvalidarVenta();
  const [motivo, setMotivo] = useState('');

  const anular = useMutation({
    mutationFn: () => api(`/ventas/${venta.id}/anular`, { method: 'POST', body: { motivo } }),
    onSuccess: () => {
      notifications.show({ message: `Venta ${venta.numeroFormateado} anulada. El stock volvió a estar disponible.` });
      invalidar();
      onClose();
    },
  });

  return (
    <Modal opened onClose={onClose} title={`Anular venta ${venta.numeroFormateado}`} centered>
      <Stack>
        <Text size="sm">
          Toda la mercadería vuelve al stock y la venta queda marcada como <b>anulada</b>. No se borra: queda
          registrado quién la anuló, cuándo y por qué.
        </Text>
        <Textarea
          label="Motivo"
          placeholder="Ej.: error de carga, el cliente se arrepintió en el momento"
          autosize
          minRows={2}
          value={motivo}
          onChange={(e) => setMotivo(e.currentTarget.value)}
        />
        {anular.isError && <Alert color="red">{anular.error.message}</Alert>}
        <Button color="red" disabled={!motivo.trim()} loading={anular.isPending} onClick={() => anular.mutate()}>
          Anular venta
        </Button>
      </Stack>
    </Modal>
  );
}

export function DevolucionModal({ venta, onClose }: { venta: VentaDetalle; onClose: () => void }) {
  const invalidar = useInvalidarVenta();
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [destinos, setDestinos] = useState<Record<string, 'STOCK' | 'BAJA'>>({});
  const [motivo, setMotivo] = useState('');
  const [medio, setMedio] = useState<MedioPago>('EFECTIVO_ARS');

  const devolvibles = venta.items.filter((i) => i.cantidad - i.cantidadDevuelta > 0);
  const factorGlobal = 1 - Number(venta.descuentoPct) / 100;

  // Lo que efectivamente se cobró por esas unidades (mismo cálculo que el backend)
  const montoDe = (item: ItemVenta, cantidad: number) =>
    Math.round((Number(item.subtotal) / item.cantidad) * cantidad * factorGlobal * 100) / 100;

  const seleccionados = devolvibles.filter((i) => (cantidades[i.id] ?? 0) > 0);
  const total = seleccionados.reduce((s, i) => s + montoDe(i, cantidades[i.id]), 0);

  const devolver = useMutation({
    mutationFn: () =>
      api(`/ventas/${venta.id}/devoluciones`, {
        method: 'POST',
        body: {
          motivo,
          medioReintegro: medio,
          items: seleccionados.map((i) => ({
            ventaItemId: i.id,
            cantidad: cantidades[i.id],
            destino: destinos[i.id] ?? 'STOCK',
          })),
        },
      }),
    onSuccess: () => {
      notifications.show({ color: 'green', message: `Devolución registrada: reintegrar ${formatoPesos(total)}` });
      invalidar();
      onClose();
    },
  });

  return (
    <Modal opened onClose={onClose} title={`Devolución · venta ${venta.numeroFormateado}`} size="xl" centered>
      <Stack>
        <Text size="sm" c="dimmed">
          Elegí qué unidades devuelve el cliente. Se reintegra lo que pagó (con sus descuentos), no el precio de hoy.
        </Text>

        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Ítem</Table.Th>
              <Table.Th ta="right">Vendidas</Table.Th>
              <Table.Th>A devolver</Table.Th>
              <Table.Th>Qué se hace</Table.Th>
              <Table.Th ta="right">Reintegro</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {devolvibles.map((i) => {
              const maximo = i.cantidad - i.cantidadDevuelta;
              const cantidad = cantidades[i.id] ?? 0;
              return (
                <Table.Tr key={i.id}>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {i.codigo} · {i.descripcion}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    {i.cantidad}
                    {i.cantidadDevuelta > 0 && (
                      <Text size="xs" c="dimmed">
                        ({i.cantidadDevuelta} ya devueltas)
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td w={100}>
                    <NumberInput
                      size="xs"
                      min={0}
                      max={maximo}
                      allowDecimal={false}
                      value={cantidad}
                      onChange={(v) => setCantidades((prev) => ({ ...prev, [i.id]: Math.min(Number(v) || 0, maximo) }))}
                    />
                  </Table.Td>
                  <Table.Td w={190}>
                    <Select
                      size="xs"
                      disabled={cantidad === 0}
                      data={[
                        { value: 'STOCK', label: 'Vuelve al stock' },
                        { value: 'BAJA', label: 'Dañado: dar de baja' },
                      ]}
                      value={destinos[i.id] ?? 'STOCK'}
                      onChange={(v) => setDestinos((prev) => ({ ...prev, [i.id]: (v ?? 'STOCK') as 'STOCK' | 'BAJA' }))}
                      allowDeselect={false}
                    />
                  </Table.Td>
                  <Table.Td ta="right">{cantidad > 0 ? formatoPesos(montoDe(i, cantidad)) : '—'}</Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>

        <Group grow align="flex-start">
          <TextInput
            label="Motivo"
            placeholder="Ej.: cambio de talle, falla de fábrica"
            value={motivo}
            onChange={(e) => setMotivo(e.currentTarget.value)}
          />
          <Select
            label="Cómo se reintegra"
            data={MEDIOS.map((m) => ({ value: m, label: NOMBRE_MEDIO[m] }))}
            value={medio}
            onChange={(v) => v && setMedio(v as MedioPago)}
            allowDeselect={false}
          />
        </Group>

        <Group justify="space-between">
          <Text fw={600}>Total a reintegrar</Text>
          <Text fw={700} size="lg">
            {formatoPesos(total)}
          </Text>
        </Group>

        {devolver.isError && <Alert color="red">{devolver.error.message}</Alert>}
        <Button
          disabled={seleccionados.length === 0 || !motivo.trim()}
          loading={devolver.isPending}
          onClick={() => devolver.mutate()}
        >
          Registrar devolución
        </Button>
      </Stack>
    </Modal>
  );
}