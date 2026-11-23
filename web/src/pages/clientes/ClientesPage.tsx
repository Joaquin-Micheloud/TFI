import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  Loader,
  Modal,
  Pagination,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import { api } from '../../lib/api';
import type { Cliente, FichaCliente } from '../../lib/clientes';
import {
  COLOR_ESTADO_COMPOSTURA,
  NOMBRE_ESTADO_COMPOSTURA,
  type ComposturaResumen,
} from '../../lib/composturas';
import { formatoFechaHora, formatoPesos } from '../../lib/formato';
import { FormularioCliente } from './FormularioCliente';

const POR_PAGINA = 20;

export function ClientesPage() {
  const [buscar, setBuscar] = useState('');
  const [buscarEstable] = useDebouncedValue(buscar.trim(), 300);
  const [pagina, setPagina] = useState(1);
  const [fichaId, setFichaId] = useState<string | null>(null);
  const [altaAbierta, setAltaAbierta] = useState(false);

  const parametros = new URLSearchParams({ pagina: String(pagina), porPagina: String(POR_PAGINA) });
  if (buscarEstable) parametros.set('buscar', buscarEstable);

  const clientes = useQuery({
    queryKey: ['clientes', parametros.toString()],
    queryFn: () => api<{ items: Cliente[]; total: number }>(`/clientes?${parametros}`),
    placeholderData: keepPreviousData,
  });

  const paginas = Math.max(1, Math.ceil((clientes.data?.total ?? 0) / POR_PAGINA));

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Clientes</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setAltaAbierta(true)}>
          Nuevo cliente
        </Button>
      </Group>

      <TextInput
        placeholder="Buscar por nombre, DNI, teléfono o email"
        leftSection={<IconSearch size={16} />}
        value={buscar}
        onChange={(e) => {
          setBuscar(e.currentTarget.value);
          setPagina(1);
        }}
      />

      <Card withBorder p={0}>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nombre</Table.Th>
              <Table.Th>Teléfono</Table.Th>
              <Table.Th>DNI</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th ta="right">Compras</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {clientes.data?.items.map((c) => (
              <Table.Tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setFichaId(c.id)}>
                <Table.Td fw={500}>{c.nombre}</Table.Td>
                <Table.Td>{c.telefono ?? '—'}</Table.Td>
                <Table.Td>{c.dni ?? '—'}</Table.Td>
                <Table.Td>{c.email ?? '—'}</Table.Td>
                <Table.Td ta="right">{c._count?.ventas ?? 0}</Table.Td>
              </Table.Tr>
            ))}
            {clientes.data?.items.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text size="sm" c="dimmed" ta="center" py="md">
                    No hay clientes con esa búsqueda.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {clientes.data?.total ?? 0} clientes
        </Text>
        <Pagination total={paginas} value={pagina} onChange={setPagina} />
      </Group>

      <Modal opened={altaAbierta} onClose={() => setAltaAbierta(false)} title="Nuevo cliente" centered>
        {altaAbierta && <FormularioCliente cliente={null} onGuardado={() => setAltaAbierta(false)} />}
      </Modal>

      <Drawer opened={fichaId !== null} onClose={() => setFichaId(null)} position="right" size="lg" title="Ficha del cliente">
        {fichaId && <Ficha clienteId={fichaId} />}
      </Drawer>
    </Stack>
  );
}

interface CompraResumen {
  id: string;
  numeroFormateado: string;
  fecha: string;
  total: string;
  estado: 'CONFIRMADA' | 'ANULADA';
  tienda: { nombre: string };
}

function Ficha({ clienteId }: { clienteId: string }) {
  const ficha = useQuery({
    queryKey: ['clientes', 'ficha', clienteId],
    queryFn: () => api<FichaCliente>(`/clientes/${clienteId}`),
  });
  const compras = useQuery({
    queryKey: ['ventas', `clienteId=${clienteId}`],
    queryFn: () => api<{ items: CompraResumen[] }>(`/ventas?clienteId=${clienteId}&porPagina=50`),
  });
  const composturas = useQuery({
    queryKey: ['composturas', `clienteId=${clienteId}`],
    queryFn: () => api<{ items: ComposturaResumen[] }>(`/composturas?clienteId=${clienteId}&porPagina=50`),
  });

  if (ficha.isLoading || !ficha.data) return <Loader />;
  const c = ficha.data;

  return (
    <Stack>
      <SimpleGrid cols={3}>
        <Card withBorder p="sm">
          <Text size="xs" c="dimmed">
            Compras
          </Text>
          <Text fw={700} size="lg">
            {c.resumen.compras}
          </Text>
        </Card>
        <Card withBorder p="sm">
          <Text size="xs" c="dimmed">
            Total comprado
          </Text>
          <Text fw={700} size="lg">
            {formatoPesos(c.resumen.totalComprado)}
          </Text>
        </Card>
        <Card withBorder p="sm">
          <Text size="xs" c="dimmed">
            Última compra
          </Text>
          <Text fw={700} size="sm">
            {c.resumen.ultimaCompra ? formatoFechaHora(c.resumen.ultimaCompra) : '—'}
          </Text>
        </Card>
      </SimpleGrid>

      {/* La clave cambia al guardar: el formulario toma los datos nuevos */}
      <FormularioCliente key={c.actualizadoEn} cliente={c} onGuardado={() => undefined} />

      <Text fw={600} size="sm">
        Historial de compras
      </Text>
      <Card withBorder p={0}>
        <Table fz="sm">
          <Table.Tbody>
            {compras.data?.items.map((v) => (
              <Table.Tr key={v.id}>
                <Table.Td ff="monospace">{v.numeroFormateado}</Table.Td>
                <Table.Td>{formatoFechaHora(v.fecha)}</Table.Td>
                <Table.Td>{v.tienda.nombre}</Table.Td>
                <Table.Td ta="right">{formatoPesos(v.total)}</Table.Td>
                <Table.Td>
                  {v.estado === 'ANULADA' && (
                    <Badge color="red" size="xs">
                      Anulada
                    </Badge>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
            {compras.data?.items.length === 0 && (
              <Table.Tr>
                <Table.Td>
                  <Text size="sm" c="dimmed" ta="center" py="sm">
                    Todavía no compró nada.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      <Text fw={600} size="sm">
        Composturas
      </Text>
      <Card withBorder p={0}>
        <Table fz="sm">
          <Table.Tbody>
            {composturas.data?.items.map((cp) => (
              <Table.Tr key={cp.id}>
                <Table.Td ff="monospace">#{cp.numeroFormateado}</Table.Td>
                <Table.Td>{formatoFechaHora(cp.creadoEn)}</Table.Td>
                <Table.Td>
                  <Text size="sm" lineClamp={1}>
                    {cp.descripcion}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge size="xs" variant="light" color={COLOR_ESTADO_COMPOSTURA[cp.estado]}>
                    {NOMBRE_ESTADO_COMPOSTURA[cp.estado]}
                  </Badge>
                </Table.Td>
              </Table.Tr>
            ))}
            {composturas.data?.items.length === 0 && (
              <Table.Tr>
                <Table.Td>
                  <Text size="sm" c="dimmed" ta="center" py="sm">
                    No dejó piezas para arreglar.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  );
}