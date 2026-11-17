import { useState } from 'react';
import { Badge, Button, Card, Drawer, Group, Pagination, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import { SelectorTienda } from '../../components/SelectorTienda';
import { api } from '../../lib/api';
import { formatoFechaHora, formatoPesos } from '../../lib/formato';
import { DetalleVenta } from './DetalleVenta';

interface VentaResumen {
  id: string;
  numeroFormateado: string;
  fecha: string;
  total: string;
  estado: 'CONFIRMADA' | 'ANULADA';
  tienda: { nombre: string };
  usuario: { nombre: string | null };
  _count: { items: number };
}

const POR_PAGINA = 20;
const hoy = () => new Date().toLocaleDateString('en-CA'); // AAAA-MM-DD en hora local

export function VentasPage() {
  const { sesion } = useAuth();
  const [tiendaId, setTiendaId] = useState<string | null>(null);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [pagina, setPagina] = useState(1);
  const [ventaId, setVentaId] = useState<string | null>(null);

  const parametros = new URLSearchParams({ pagina: String(pagina), porPagina: String(POR_PAGINA) });
  if (tiendaId) parametros.set('tiendaId', tiendaId);
  if (desde) parametros.set('desde', desde);
  if (hasta) parametros.set('hasta', hasta);

  const ventas = useQuery({
    queryKey: ['ventas', parametros.toString()],
    queryFn: () => api<{ items: VentaResumen[]; total: number }>(`/ventas?${parametros}`),
    placeholderData: keepPreviousData,
  });

  const paginas = Math.max(1, Math.ceil((ventas.data?.total ?? 0) / POR_PAGINA));
  const cambiarFechas = (d: string, h: string) => {
    setDesde(d);
    setHasta(h);
    setPagina(1);
  };

  return (
    <Stack>
      <Title order={2}>Ventas</Title>

      <Group align="flex-end">
        <SelectorTienda
          label="Tienda"
          value={tiendaId}
          onChange={(v) => {
            setTiendaId(v);
            setPagina(1);
          }}
          permitirTodas
        />
        <TextInput type="date" label="Desde" value={desde} onChange={(e) => cambiarFechas(e.currentTarget.value, hasta)} />
        <TextInput type="date" label="Hasta" value={hasta} onChange={(e) => cambiarFechas(desde, e.currentTarget.value)} />
        <Button variant="default" onClick={() => cambiarFechas(hoy(), hoy())}>
          Hoy
        </Button>
        {(desde || hasta) && (
          <Button variant="subtle" onClick={() => cambiarFechas('', '')}>
            Quitar fechas
          </Button>
        )}
      </Group>

      {sesion?.rol === 'VENDEDOR' && (
        <Text size="sm" c="dimmed">
          Se muestran solo tus ventas.
        </Text>
      )}

      <Card withBorder p={0}>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Ticket</Table.Th>
              <Table.Th>Fecha</Table.Th>
              <Table.Th>Tienda</Table.Th>
              <Table.Th>Vendedor</Table.Th>
              <Table.Th ta="right">Ítems</Table.Th>
              <Table.Th ta="right">Total</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {ventas.data?.items.map((v) => (
              <Table.Tr key={v.id} style={{ cursor: 'pointer' }} onClick={() => setVentaId(v.id)}>
                <Table.Td>
                  <Text size="sm" ff="monospace">
                    {v.numeroFormateado}
                  </Text>
                </Table.Td>
                <Table.Td>{formatoFechaHora(v.fecha)}</Table.Td>
                <Table.Td>{v.tienda.nombre}</Table.Td>
                <Table.Td>{v.usuario.nombre ?? '—'}</Table.Td>
                <Table.Td ta="right">{v._count.items}</Table.Td>
                <Table.Td ta="right" fw={600}>
                  {formatoPesos(v.total)}
                </Table.Td>
                <Table.Td>
                  {v.estado === 'ANULADA' && (
                    <Badge color="red" size="xs">
                      Anulada
                    </Badge>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
            {ventas.data?.items.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={7}>
                  <Text size="sm" c="dimmed" ta="center" py="md">
                    No hay ventas con esos filtros.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {ventas.data?.total ?? 0} ventas
        </Text>
        <Pagination total={paginas} value={pagina} onChange={setPagina} />
      </Group>

      <Drawer opened={ventaId !== null} onClose={() => setVentaId(null)} position="right" size="lg" title="Detalle de la venta">
        {ventaId && <DetalleVenta ventaId={ventaId} />}
      </Drawer>
    </Stack>
  );
}