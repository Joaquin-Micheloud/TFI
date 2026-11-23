import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  Pagination,
  Select,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { IconAdjustmentsDollar, IconPlus, IconSearch } from '@tabler/icons-react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../lib/api';
import { formatoPesos } from '../../lib/formato';
import { COLOR_TIPO, NOMBRE_TIPO, describirMetales, type Categoria, type ListaProductos, type Producto } from '../../lib/catalogo';
import { AjusteFantasiaModal } from './AjusteFantasiaModal';
import { CategoriasPanel } from './CategoriasPanel';
import { FormularioProducto } from './FormularioProducto';

const POR_PAGINA = 20;

export function ProductosPage() {
  const { sesion } = useAuth();
  const puedeEditar = sesion?.rol === 'ADMIN' || sesion?.rol === 'GERENTE';

  return (
    <Stack>
      <Title order={2}>Productos</Title>
      {sesion?.rol === 'ADMIN' ? (
        <Tabs defaultValue="catalogo" keepMounted={false}>
          <Tabs.List>
            <Tabs.Tab value="catalogo">Catálogo</Tabs.Tab>
            <Tabs.Tab value="categorias">Categorías y márgenes</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="catalogo" pt="md">
            <Catalogo puedeEditar />
          </Tabs.Panel>
          <Tabs.Panel value="categorias" pt="md">
            <CategoriasPanel />
          </Tabs.Panel>
        </Tabs>
      ) : (
        <Catalogo puedeEditar={puedeEditar} />
      )}
    </Stack>
  );
}

function Catalogo({ puedeEditar }: { puedeEditar: boolean }) {
  const [buscar, setBuscar] = useState('');
  const [buscarEstable] = useDebouncedValue(buscar.trim(), 300);
  const [tipo, setTipo] = useState<string | null>(null);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [inactivos, setInactivos] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [seleccionado, setSeleccionado] = useState<Producto | 'nuevo' | null>(null);
  const [ajusteAbierto, setAjusteAbierto] = useState(false);

  const parametros = new URLSearchParams({ pagina: String(pagina), porPagina: String(POR_PAGINA) });
  if (buscarEstable) parametros.set('buscar', buscarEstable);
  if (tipo) parametros.set('tipo', tipo);
  if (categoriaId) parametros.set('categoriaId', categoriaId);
  if (inactivos) parametros.set('incluirInactivos', 'true');

  const productos = useQuery({
    queryKey: ['productos', parametros.toString()],
    queryFn: () => api<ListaProductos>(`/productos?${parametros}`),
    placeholderData: keepPreviousData,
  });
  const categorias = useQuery({ queryKey: ['categorias'], queryFn: () => api<Categoria[]>('/categorias') });

  const paginas = Math.max(1, Math.ceil((productos.data?.total ?? 0) / POR_PAGINA));

  return (
    <Stack>
      {/* Filtros */}
      <Group align="flex-end">
        <TextInput
          style={{ flex: 1, minWidth: 220 }}
          placeholder="Buscar por nombre, código o código de barras"
          leftSection={<IconSearch size={16} />}
          value={buscar}
          onChange={(e) => {
            setBuscar(e.currentTarget.value);
            setPagina(1);
          }}
        />
        <Select
          w={180}
          placeholder="Todos los tipos"
          clearable
          data={Object.entries(NOMBRE_TIPO).map(([value, label]) => ({ value, label }))}
          value={tipo}
          onChange={(v) => {
            setTipo(v);
            setPagina(1);
          }}
        />
        <Select
          w={180}
          placeholder="Todas las categorías"
          clearable
          data={(categorias.data ?? []).map((c) => ({ value: c.id, label: c.nombre }))}
          value={categoriaId}
          onChange={(v) => {
            setCategoriaId(v);
            setPagina(1);
          }}
        />
        <Switch
          label="Ver inactivos"
          checked={inactivos}
          onChange={(e) => {
            setInactivos(e.currentTarget.checked);
            setPagina(1);
          }}
          mb={8}
        />
        {puedeEditar && (
          <Group gap="xs">
            <Button variant="default" leftSection={<IconAdjustmentsDollar size={16} />} onClick={() => setAjusteAbierto(true)}>
              Ajustar fantasía
            </Button>
            <Button leftSection={<IconPlus size={16} />} onClick={() => setSeleccionado('nuevo')}>
              Nuevo producto
            </Button>
          </Group>
        )}
      </Group>

      {/* Listado */}
      <Card withBorder p={0}>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Código</Table.Th>
              <Table.Th>Producto</Table.Th>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Metal</Table.Th>
              <Table.Th ta="right">Precio hoy</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {productos.data?.items.map((p) => (
              <Table.Tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setSeleccionado(p)}>
                <Table.Td>
                  <Text size="sm" ff="monospace">
                    {p.codigo}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group gap={6}>
                    <Text size="sm" fw={500}>
                      {p.nombre}
                    </Text>
                    {!p.activo && (
                      <Badge size="xs" color="gray">
                        Inactivo
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">
                    {p.categoria?.nombre ?? 'Sin categoría'} · {p.modoStock === 'UNICO' ? 'Pieza única' : 'Por lote'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge variant="light" color={COLOR_TIPO[p.tipo]}>
                    {NOMBRE_TIPO[p.tipo]}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {describirMetales(p.componentes)}
                </Table.Td>
                <Table.Td ta="right">
                  <PrecioCelda producto={p} />
                </Table.Td>
              </Table.Tr>
            ))}
            {productos.data?.items.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text size="sm" c="dimmed" ta="center" py="md">
                    No hay productos con esos filtros.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {productos.data?.total ?? 0} productos
        </Text>
        <Pagination total={paginas} value={pagina} onChange={setPagina} />
      </Group>

      {/* Alta / edición */}
      <Drawer
        opened={seleccionado !== null}
        onClose={() => setSeleccionado(null)}
        position="right"
        size="lg"
        title={seleccionado === 'nuevo' ? 'Nuevo producto' : puedeEditar ? 'Editar producto' : 'Producto'}
      >
        {seleccionado !== null && (
          <FormularioProducto
            key={seleccionado === 'nuevo' ? 'nuevo' : seleccionado.id}
            producto={seleccionado === 'nuevo' ? null : seleccionado}
            categorias={categorias.data ?? []}
            puedeEditar={puedeEditar}
            onListo={() => setSeleccionado(null)}
          />
        )}
      </Drawer>

      <AjusteFantasiaModal
        opened={ajusteAbierto}
        onClose={() => setAjusteAbierto(false)}
        categorias={categorias.data ?? []}
      />
    </Stack>
  );
}

// Precio para la lista: único (fantasía, elaboración) o rango del stock (reventa)
function PrecioCelda({ producto: p }: { producto: Producto }) {
  if (p.precio.precioArs) return <>{formatoPesos(p.precio.precioArs)}</>;

  const rango = p.rangoStock;
  if (rango?.desde && rango.hasta) {
    return (
      <div>
        <Text size="sm">
          {rango.desde === rango.hasta
            ? formatoPesos(rango.desde)
            : `${formatoPesos(rango.desde)} a ${formatoPesos(rango.hasta)}`}
        </Text>
        <Text size="xs" c="dimmed">
          {rango.unidades} en stock
        </Text>
      </div>
    );
  }

  return (
    <Tooltip
      label={p.tipo === 'REVENTA' ? 'El precio depende de cada pieza o lote: ingresá stock para verlo' : p.precio.motivo}
      multiline
      w={260}
      withArrow
    >
      <Text size="xs" c="dimmed">
        {p.tipo === 'REVENTA' ? 'Sin stock' : 'Sin precio'}
      </Text>
    </Tooltip>
  );
}