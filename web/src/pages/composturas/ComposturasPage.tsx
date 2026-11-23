import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  Pagination,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { IconAlertTriangle, IconPlus, IconSearch } from '@tabler/icons-react';
import { SelectorTienda } from '../../components/SelectorTienda';
import { api } from '../../lib/api';
import {
  COLOR_ESTADO_COMPOSTURA,
  ESTADOS_COMPOSTURA,
  NOMBRE_ESTADO_COMPOSTURA,
  fechaSinHora,
  type AlertasComposturas,
  type ComposturaResumen,
  type EstadoCompostura,
} from '../../lib/composturas';
import { formatoPesos } from '../../lib/formato';
import { DetalleCompostura } from './DetalleCompostura';
import { NuevaCompostura } from './NuevaCompostura';

const POR_PAGINA = 20;

export function ComposturasPage() {
  const [tiendaId, setTiendaId] = useState<string | null>(null);
  const [vista, setVista] = useState<'abiertas' | 'todas'>('abiertas');
  const [estado, setEstado] = useState<EstadoCompostura | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [busquedaEstable] = useDebouncedValue(busqueda, 300);
  const [pagina, setPagina] = useState(1);
  const [nuevaAbierta, setNuevaAbierta] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);

  const parametros = new URLSearchParams({ pagina: String(pagina), porPagina: String(POR_PAGINA) });
  if (tiendaId) parametros.set('tiendaId', tiendaId);
  if (estado) parametros.set('estado', estado);
  else if (vista === 'abiertas') parametros.set('abiertas', 'true');
  if (busquedaEstable.trim()) parametros.set('buscar', busquedaEstable.trim());

  const composturas = useQuery({
    queryKey: ['composturas', parametros.toString()],
    queryFn: () => api<{ items: ComposturaResumen[]; total: number }>(`/composturas?${parametros}`),
    placeholderData: keepPreviousData,
  });

  const alertas = useQuery({
    queryKey: ['composturas', 'alertas', tiendaId],
    queryFn: () => api<AlertasComposturas>(`/composturas/alertas${tiendaId ? `?tiendaId=${tiendaId}` : ''}`),
  });

  const paginas = Math.max(1, Math.ceil((composturas.data?.total ?? 0) / POR_PAGINA));
  const reiniciar = () => setPagina(1);

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Composturas</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setNuevaAbierta(true)}>
          Recibir pieza
        </Button>
      </Group>

      {alertas.data && (alertas.data.vencidas.length > 0 || alertas.data.sinRetirar.length > 0) && (
        <Alert color="orange" icon={<IconAlertTriangle size={18} />} title="Para atender">
          <Stack gap={4}>
            {alertas.data.vencidas.length > 0 && (
              <Text size="sm">
                {alertas.data.vencidas.length} vencidas (pasó la fecha estimada y no están listas):{' '}
                {alertas.data.vencidas.map((c) => `#${c.numeroFormateado}`).join(', ')}
              </Text>
            )}
            {alertas.data.sinRetirar.length > 0 && (
              <Text size="sm">
                {alertas.data.sinRetirar.length} listas hace más de {alertas.data.diasSinRetirar} días sin retirar:{' '}
                {alertas.data.sinRetirar.map((c) => `#${c.numeroFormateado}`).join(', ')}
              </Text>
            )}
          </Stack>
        </Alert>
      )}

      <Group align="flex-end">
        <SelectorTienda
          label="Tienda"
          value={tiendaId}
          onChange={(v) => {
            setTiendaId(v);
            reiniciar();
          }}
          permitirTodas
        />
        <SegmentedControl
          data={[
            { value: 'abiertas', label: 'Abiertas' },
            { value: 'todas', label: 'Todas' },
          ]}
          value={vista}
          onChange={(v) => {
            setVista(v as 'abiertas' | 'todas');
            setEstado(null);
            reiniciar();
          }}
        />
        <Select
          label="Estado"
          w={190}
          placeholder="Cualquiera"
          clearable
          data={ESTADOS_COMPOSTURA.map((e) => ({
            value: e,
            label: `${NOMBRE_ESTADO_COMPOSTURA[e]}${alertas.data ? ` (${alertas.data.porEstado[e]})` : ''}`,
          }))}
          value={estado}
          onChange={(v) => {
            setEstado(v as EstadoCompostura | null);
            reiniciar();
          }}
        />
        <TextInput
          placeholder="N° de orden, cliente o trabajo"
          leftSection={<IconSearch size={16} />}
          w={260}
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.currentTarget.value);
            reiniciar();
          }}
        />
      </Group>

      <Card withBorder p={0}>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Orden</Table.Th>
              <Table.Th>Cliente</Table.Th>
              <Table.Th>Trabajo</Table.Th>
              <Table.Th>Tienda</Table.Th>
              <Table.Th>Entrega estimada</Table.Th>
              <Table.Th ta="right">Presupuesto</Table.Th>
              <Table.Th>Estado</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {composturas.data?.items.map((c) => (
              <Table.Tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setDetalleId(c.id)}>
                <Table.Td>
                  <Text size="sm" ff="monospace">
                    #{c.numeroFormateado}
                  </Text>
                </Table.Td>
                <Table.Td>{c.cliente.nombre}</Table.Td>
                <Table.Td>
                  <Text size="sm" lineClamp={1} maw={280}>
                    {c.descripcion}
                  </Text>
                </Table.Td>
                <Table.Td>{c.tienda.nombre}</Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    {fechaSinHora(c.fechaEstimada)}
                    {c.vencida && (
                      <Badge size="xs" color="red">
                        Vencida
                      </Badge>
                    )}
                    {c.sinRetirar && (
                      <Badge size="xs" color="orange">
                        Sin retirar
                      </Badge>
                    )}
                  </Group>
                </Table.Td>
                <Table.Td ta="right">{formatoPesos(c.precioFinal ?? c.presupuesto)}</Table.Td>
                <Table.Td>
                  <Badge color={COLOR_ESTADO_COMPOSTURA[c.estado]} variant="light">
                    {NOMBRE_ESTADO_COMPOSTURA[c.estado]}
                  </Badge>
                </Table.Td>
              </Table.Tr>
            ))}
            {composturas.data?.items.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={7}>
                  <Text size="sm" c="dimmed" ta="center" py="md">
                    No hay composturas con esos filtros.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {composturas.data?.total ?? 0} composturas
        </Text>
        <Pagination total={paginas} value={pagina} onChange={setPagina} />
      </Group>

      <Drawer opened={nuevaAbierta} onClose={() => setNuevaAbierta(false)} position="right" size="lg" title="Recibir pieza">
        {nuevaAbierta && (
          <NuevaCompostura
            onCreada={(id) => {
              setNuevaAbierta(false);
              setDetalleId(id);
            }}
          />
        )}
      </Drawer>

      <Drawer
        opened={detalleId !== null}
        onClose={() => setDetalleId(null)}
        position="right"
        size="lg"
        title="Compostura"
      >
        {detalleId && <DetalleCompostura composturaId={detalleId} />}
      </Drawer>
    </Stack>
  );
}
