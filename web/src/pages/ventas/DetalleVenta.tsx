import { useState } from 'react';
import { Alert, Badge, Button, Card, Group, Loader, Stack, Table, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { IconArrowBackUp, IconBan, IconPrinter } from '@tabler/icons-react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../lib/api';
import { formatoFechaHora, formatoPesos, formatoUsd, nombreLey } from '../../lib/formato';
import { abrirTicket } from '../../lib/ticket';
import { NOMBRE_MEDIO } from '../vender/carrito';
import { AnularVentaModal, DevolucionModal } from './AccionesVenta';
import type { VentaDetalle } from './tipos';

const Fila = ({ izquierda, derecha, fuerte }: { izquierda: string; derecha: string; fuerte?: boolean }) => (
  <Group justify="space-between">
    <Text size="sm" fw={fuerte ? 700 : undefined}>
      {izquierda}
    </Text>
    <Text size="sm" fw={fuerte ? 700 : undefined}>
      {derecha}
    </Text>
  </Group>
);

export function DetalleVenta({ ventaId }: { ventaId: string }) {
  const { sesion } = useAuth();
  const veCostos = sesion?.rol !== 'VENDEDOR';
  const puedeGestionar = sesion?.rol === 'ADMIN' || sesion?.rol === 'GERENTE';
  const [accion, setAccion] = useState<'anular' | 'devolver' | null>(null);

  const venta = useQuery({
    queryKey: ['ventas', 'detalle', ventaId],
    queryFn: () => api<VentaDetalle>(`/ventas/${ventaId}`),
  });

  if (venta.isLoading) return <Loader />;
  if (venta.isError) return <Alert color="red">{venta.error.message}</Alert>;
  const v = venta.data!;

  const anulada = v.estado === 'ANULADA';
  const quedaPorDevolver = v.items.some((i) => i.cantidad > i.cantidadDevuelta);
  const nombre = (u: { nombre: string | null; email: string }) => u.nombre ?? u.email;

  return (
    <Stack>
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={4}>Ticket {v.numeroFormateado}</Title>
          <Text size="sm" c="dimmed">
            {formatoFechaHora(v.fecha)} · {v.tienda.nombre} · {nombre(v.usuario)}
          </Text>
        </div>
        <Group gap={6}>
          {v.devoluciones.length > 0 && (
            <Badge color="grape" variant="light">
              Con devolución
            </Badge>
          )}
          <Badge color={anulada ? 'red' : 'green'}>{anulada ? 'Anulada' : 'Confirmada'}</Badge>
        </Group>
      </Group>

      {anulada && (
        <Alert color="red" title="Venta anulada">
          {v.anuladaPor && `${nombre(v.anuladaPor)} la anuló`}
          {v.anuladaEn && ` el ${formatoFechaHora(v.anuladaEn)}`}. Motivo: {v.motivoAnulacion}
        </Alert>
      )}

      <Group grow>
        <Button variant="light" leftSection={<IconPrinter size={16} />} onClick={() => abrirTicket(v.id)}>
          Reimprimir ticket
        </Button>
        {puedeGestionar && !anulada && quedaPorDevolver && (
          <Button variant="light" color="grape" leftSection={<IconArrowBackUp size={16} />} onClick={() => setAccion('devolver')}>
            Devolución
          </Button>
        )}
        {puedeGestionar && !anulada && v.devoluciones.length === 0 && (
          <Button variant="light" color="red" leftSection={<IconBan size={16} />} onClick={() => setAccion('anular')}>
            Anular
          </Button>
        )}
      </Group>

      <Card withBorder p={0}>
        <Table fz="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Ítem</Table.Th>
              <Table.Th ta="right">Cant.</Table.Th>
              <Table.Th ta="right">Precio</Table.Th>
              <Table.Th ta="right">Subtotal</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {v.items.map((i) => (
              <Table.Tr key={i.id}>
                <Table.Td>
                  <Group gap={6}>
                    <Text size="sm" fw={500}>
                      {i.codigo} · {i.descripcion}
                    </Text>
                    {i.cantidadDevuelta > 0 && (
                      <Badge size="xs" color="grape" variant="light">
                        {i.cantidadDevuelta === i.cantidad ? 'Devuelto' : `${i.cantidadDevuelta} devueltas`}
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">
                    {[
                      i.pesoGramos ? `${Number(i.pesoGramos).toLocaleString('es-AR')} g` : null,
                      i.metal && i.ley ? `${i.metal === 'ORO' ? 'oro' : 'plata'} ${nombreLey(i.metal, i.ley)}` : null,
                      i.gramoUsado ? `gramo a ${formatoPesos(i.gramoUsado)}` : null,
                      Number(i.descuentoPct) > 0 ? `-${Number(i.descuentoPct)} %` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  {veCostos && i.costoUnitario && (
                    <Text size="xs" c="dimmed">
                      Costo {formatoPesos(i.costoUnitario)} · margen {Number(i.margenPct)} %
                    </Text>
                  )}
                </Table.Td>
                <Table.Td ta="right">{i.cantidad}</Table.Td>
                <Table.Td ta="right">{formatoPesos(i.precioListaUnitario)}</Table.Td>
                <Table.Td ta="right">{formatoPesos(i.subtotal)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>

      <Card withBorder>
        <Stack gap={4}>
          <Fila izquierda="Subtotal" derecha={formatoPesos(v.subtotal)} />
          {Number(v.descuentoTotal) > 0 && (
            <Fila
              izquierda={Number(v.descuentoPct) > 0 ? `Descuentos (incluye ${Number(v.descuentoPct)} % sobre el total)` : 'Descuentos'}
              derecha={`-${formatoPesos(v.descuentoTotal)}`}
            />
          )}
          <Fila izquierda="Total" derecha={formatoPesos(v.total)} fuerte />
          {Number(v.totalDevuelto) > 0 && (
            <>
              <Fila izquierda="Reintegrado por devoluciones" derecha={`-${formatoPesos(v.totalDevuelto)}`} />
              <Fila izquierda="Neto" derecha={formatoPesos(Number(v.total) - Number(v.totalDevuelto))} fuerte />
            </>
          )}
        </Stack>
      </Card>

      <Card withBorder>
        <Stack gap={4}>
          <Text size="sm" fw={600}>
            Pagos
          </Text>
          {v.pagos.map((p) => (
            <Fila
              key={p.id}
              izquierda={`${NOMBRE_MEDIO[p.medio]}${p.moneda === 'USD' ? ` ${formatoUsd(p.monto)}` : ''}${p.cuotas && p.cuotas > 1 ? ` (${p.cuotas} cuotas)` : ''}`}
              derecha={formatoPesos(p.montoArs)}
            />
          ))}
          {Number(v.vuelto) > 0 && <Fila izquierda="Vuelto" derecha={formatoPesos(v.vuelto)} />}
        </Stack>
      </Card>

      {v.devoluciones.length > 0 && (
        <Card withBorder>
          <Stack gap="xs">
            <Text size="sm" fw={600}>
              Devoluciones
            </Text>
            {v.devoluciones.map((d) => (
              <div key={d.id}>
                <Fila izquierda={`${formatoFechaHora(d.fecha)} · ${nombre(d.usuario)}`} derecha={`-${formatoPesos(d.montoArs)}`} />
                <Text size="xs" c="dimmed">
                  {d.motivo} · reintegro en {NOMBRE_MEDIO[d.medioReintegro].toLowerCase()} ·{' '}
                  {d.items
                    .map((di) => {
                      const item = v.items.find((i) => i.id === di.ventaItemId);
                      return `${di.cantidad} × ${item?.codigo}${di.destino === 'BAJA' ? ' (dado de baja)' : ''}`;
                    })
                    .join(', ')}
                </Text>
              </div>
            ))}
          </Stack>
        </Card>
      )}

      <Text size="xs" c="dimmed">
        Dólar {v.tipoDolar.toLowerCase()} usado: {formatoPesos(v.dolarUsado)}. Los precios quedaron congelados al
        momento de la venta y no cambian aunque cambien las cotizaciones.
      </Text>

      {accion === 'anular' && <AnularVentaModal venta={v} onClose={() => setAccion(null)} />}
      {accion === 'devolver' && <DevolucionModal venta={v} onClose={() => setAccion(null)} />}
    </Stack>
  );
}