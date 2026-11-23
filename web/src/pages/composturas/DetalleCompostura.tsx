import { useState } from 'react';
import { Alert, Badge, Button, Card, Group, Loader, Stack, Table, Text, Timeline, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  IconCash,
  IconCheck,
  IconFileText,
  IconHammer,
  IconPencil,
  IconPrinter,
  IconX,
} from '@tabler/icons-react';
import { api } from '../../lib/api';
import {
  COLOR_ESTADO_COMPOSTURA,
  NOMBRE_ESTADO_COMPOSTURA,
  fechaSinHora,
  gramos,
  nombreUsuario,
  type Compostura,
  type EstadoCompostura,
} from '../../lib/composturas';
import { formatoFechaHora, formatoPesos, nombreLey } from '../../lib/formato';
import { abrirComprobante, abrirTicket } from '../../lib/ticket';
import { NOMBRE_MEDIO } from '../vender/carrito';
import { CancelarModal, EntregarModal, PresupuestoModal } from './AccionesCompostura';

const Dato = ({ etiqueta, valor }: { etiqueta: string; valor: string }) => (
  <Table.Tr>
    <Table.Td c="dimmed" w="45%">
      {etiqueta}
    </Table.Td>
    <Table.Td>{valor}</Table.Td>
  </Table.Tr>
);

export function DetalleCompostura({ composturaId }: { composturaId: string }) {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<'presupuesto' | 'cancelar' | 'entregar' | null>(null);

  const compostura = useQuery({
    queryKey: ['composturas', 'detalle', composturaId],
    queryFn: () => api<Compostura>(`/composturas/${composturaId}`),
  });

  const avanzar = useMutation({
    mutationFn: (estado: EstadoCompostura) =>
      api<Compostura>(`/composturas/${composturaId}/estado`, { method: 'POST', body: { estado } }),
    onSuccess: (c) => {
      notifications.show({ color: 'green', message: `Orden #${c.numeroFormateado}: ${NOMBRE_ESTADO_COMPOSTURA[c.estado]}` });
      void queryClient.invalidateQueries({ queryKey: ['composturas'] });
    },
  });

  if (compostura.isLoading) return <Loader />;
  if (compostura.isError) return <Alert color="red">{compostura.error.message}</Alert>;
  const c = compostura.data!;
  const cerrar = () => setModal(null);

  return (
    <Stack>
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={4}>Orden #{c.numeroFormateado}</Title>
          <Text size="sm" c="dimmed">
            {formatoFechaHora(c.creadoEn)} · {c.tienda.nombre} · recibió {nombreUsuario(c.usuario)}
          </Text>
          <Text size="sm">
            Cliente: <b>{c.cliente.nombre}</b>
            {c.cliente.telefono ? ` · ${c.cliente.telefono}` : ''}
            {c.cliente.dni ? ` · DNI ${c.cliente.dni}` : ''}
          </Text>
        </div>
        <Stack gap={4} align="flex-end">
          <Badge color={COLOR_ESTADO_COMPOSTURA[c.estado]}>{NOMBRE_ESTADO_COMPOSTURA[c.estado]}</Badge>
          {c.vencida && <Badge color="red">Vencida</Badge>}
          {c.sinRetirar && <Badge color="orange">Sin retirar</Badge>}
        </Stack>
      </Group>

      {c.estado === 'CANCELADA' && c.motivoCancelacion && (
        <Alert color="red" title="Cancelada">
          {c.motivoCancelacion}
          {Number(c.sena) > 0 && ` · Devolvé la seña de ${formatoPesos(c.sena)}.`}
        </Alert>
      )}

      {/* ----- Acciones según el estado ----- */}
      <Group grow>
        <Button variant="light" leftSection={<IconPrinter size={16} />} onClick={() => void abrirComprobante(c.id)}>
          Comprobante
        </Button>
        {c.venta && (
          <Button variant="light" leftSection={<IconFileText size={16} />} onClick={() => void abrirTicket(c.venta!.id)}>
            Ticket de cobro
          </Button>
        )}
      </Group>

      {c.estado === 'RECIBIDA' && (
        <Group grow>
          <Button leftSection={<IconPencil size={16} />} onClick={() => setModal('presupuesto')}>
            Presupuestar
          </Button>
          <Button variant="light" color="red" leftSection={<IconX size={16} />} onClick={() => setModal('cancelar')}>
            Cancelar
          </Button>
        </Group>
      )}
      {c.estado === 'PRESUPUESTADA' && (
        <Stack gap="xs">
          <Group grow>
            <Button
              leftSection={<IconHammer size={16} />}
              loading={avanzar.isPending}
              onClick={() => avanzar.mutate('EN_TALLER')}
            >
              Aceptó: pasar al taller
            </Button>
            <Button variant="light" color="red" leftSection={<IconX size={16} />} onClick={() => setModal('cancelar')}>
              Rechazó / cancelar
            </Button>
          </Group>
          <Button variant="subtle" size="xs" onClick={() => setModal('presupuesto')}>
            Corregir presupuesto
          </Button>
        </Stack>
      )}
      {c.estado === 'EN_TALLER' && (
        <Button color="green" leftSection={<IconCheck size={16} />} loading={avanzar.isPending} onClick={() => avanzar.mutate('LISTA')}>
          Marcar como lista para retirar
        </Button>
      )}
      {c.estado === 'LISTA' && (
        <Button color="green" leftSection={<IconCash size={16} />} onClick={() => setModal('entregar')}>
          Entregar y cobrar
        </Button>
      )}
      {avanzar.isError && <Alert color="red">{avanzar.error.message}</Alert>}

      {/* ----- Datos ----- */}
      <Card withBorder p={0}>
        <Table fz="sm">
          <Table.Tbody>
            <Dato etiqueta="Trabajo" valor={c.descripcion} />
            {c.metal && c.ley && (
              <Dato etiqueta="Metal" valor={`${c.metal === 'ORO' ? 'Oro' : 'Plata'} ${nombreLey(c.metal, c.ley)}`} />
            )}
            <Dato etiqueta="Peso de entrada" valor={gramos(c.pesoEntrada)} />
            {Number(c.pesoAportado) > 0 && <Dato etiqueta="Material del cliente" valor={gramos(c.pesoAportado)} />}
            {c.pesoAgregado && Number(c.pesoAgregado) > 0 && (
              <Dato etiqueta="Metal agregado" valor={gramos(c.pesoAgregado)} />
            )}
            {c.pesoSalida && <Dato etiqueta="Peso de salida" valor={gramos(c.pesoSalida)} />}
            <Dato etiqueta="Entrega estimada" valor={fechaSinHora(c.fechaEstimada)} />
            {c.manoObra && <Dato etiqueta="Mano de obra" valor={formatoPesos(c.manoObra)} />}
            {c.presupuesto && <Dato etiqueta="Presupuesto" valor={formatoPesos(c.presupuesto)} />}
            <Dato
              etiqueta="Seña"
              valor={
                Number(c.sena) > 0
                  ? `${formatoPesos(c.sena)}${c.medioSena ? ` (${NOMBRE_MEDIO[c.medioSena]})` : ''}`
                  : 'Sin seña'
              }
            />
            {c.precioFinal && <Dato etiqueta="Precio final" valor={formatoPesos(c.precioFinal)} />}
            {c.observaciones && <Dato etiqueta="Observaciones" valor={c.observaciones} />}
          </Table.Tbody>
        </Table>
      </Card>

      <div>
        <Title order={6} mb="xs">
          Historial
        </Title>
        <Timeline bulletSize={14} lineWidth={2} active={c.historial.length - 1}>
          {c.historial.map((h) => (
            <Timeline.Item key={h.id} title={NOMBRE_ESTADO_COMPOSTURA[h.estado]}>
              <Text size="xs" c="dimmed">
                {formatoFechaHora(h.fecha)} · {nombreUsuario(h.usuario)}
              </Text>
              {h.nota && <Text size="xs">{h.nota}</Text>}
            </Timeline.Item>
          ))}
        </Timeline>
      </div>

      <PresupuestoModal compostura={c} abierto={modal === 'presupuesto'} onCerrar={cerrar} />
      <CancelarModal compostura={c} abierto={modal === 'cancelar'} onCerrar={cerrar} />
      <EntregarModal compostura={c} abierto={modal === 'entregar'} onCerrar={cerrar} />
    </Stack>
  );
}
