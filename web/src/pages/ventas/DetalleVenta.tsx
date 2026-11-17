import { Alert, Badge, Button, Card, Group, Loader, Stack, Table, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { IconPrinter } from '@tabler/icons-react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../lib/api';
import { formatoFechaHora, formatoPesos, formatoUsd, nombreLey } from '../../lib/formato';
import { abrirTicket } from '../../lib/ticket';
import { NOMBRE_MEDIO, type MedioPago } from '../vender/carrito';

interface ItemVenta {
  id: string;
  codigo: string;
  descripcion: string;
  cantidad: number;
  precioListaUnitario: string;
  descuentoPct: string;
  subtotal: string;
  costoUnitario?: string;
  margenPct?: string;
  metal: 'ORO' | 'PLATA' | null;
  ley: string | null;
  pesoGramos: string | null;
  gramoUsado: string | null;
}

interface VentaDetalle {
  id: string;
  numeroFormateado: string;
  fecha: string;
  estado: 'CONFIRMADA' | 'ANULADA';
  subtotal: string;
  descuentoPct: string;
  descuentoTotal: string;
  total: string;
  vuelto: string;
  tipoDolar: string;
  dolarUsado: string;
  tienda: { nombre: string };
  usuario: { nombre: string | null; email: string };
  items: ItemVenta[];
  pagos: { id: string; medio: MedioPago; moneda: 'ARS' | 'USD'; monto: string; montoArs: string; cuotas: number | null }[];
}

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

  const venta = useQuery({
    queryKey: ['ventas', 'detalle', ventaId],
    queryFn: () => api<VentaDetalle>(`/ventas/${ventaId}`),
  });

  if (venta.isLoading) return <Loader />;
  if (venta.isError) return <Alert color="red">{venta.error.message}</Alert>;
  const v = venta.data!;

  return (
    <Stack>
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={4}>Ticket {v.numeroFormateado}</Title>
          <Text size="sm" c="dimmed">
            {formatoFechaHora(v.fecha)} · {v.tienda.nombre} · {v.usuario.nombre ?? v.usuario.email}
          </Text>
        </div>
        <Badge color={v.estado === 'ANULADA' ? 'red' : 'green'}>{v.estado === 'ANULADA' ? 'Anulada' : 'Confirmada'}</Badge>
      </Group>

      <Button variant="light" leftSection={<IconPrinter size={16} />} onClick={() => abrirTicket(v.id)}>
        Reimprimir ticket
      </Button>

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
                  <Text size="sm" fw={500}>
                    {i.codigo} · {i.descripcion}
                  </Text>
                  {/* Snapshot: los datos con los que se calculó el precio */}
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

      <Text size="xs" c="dimmed">
        Dólar {v.tipoDolar.toLowerCase()} usado: {formatoPesos(v.dolarUsado)}. Los precios quedaron congelados al
        momento de la venta y no cambian aunque cambien las cotizaciones.
      </Text>
    </Stack>
  );
}