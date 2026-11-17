import { Badge, Card, Loader, Stack, Table, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Producto } from '../../lib/catalogo';
import { formatoPesos } from '../../lib/formato';
import { numerarLotes, type Lote, type Pieza } from '../../lib/stock';

const gramos = (g: string | null) => (g ? `${Number(g).toLocaleString('es-AR')} g` : '—');

// Cada lote o pieza disponible del producto, con su tienda y su precio de hoy
export function StockDelProducto({ producto }: { producto: Producto }) {
  const porLote = producto.modoStock === 'LOTE';

  const lotes = useQuery({
    queryKey: ['stock', 'lotes', `productoId=${producto.id}`],
    queryFn: () => api<{ items: Lote[] }>(`/stock/lotes?productoId=${producto.id}`),
    enabled: porLote,
  });

  const piezas = useQuery({
    queryKey: ['stock', 'piezas', `estado=DISPONIBLE&productoId=${producto.id}`],
    queryFn: () => api<{ items: Pieza[] }>(`/stock/piezas?estado=DISPONIBLE&productoId=${producto.id}`),
    enabled: !porLote,
  });

  const cargando = porLote ? lotes.isLoading : piezas.isLoading;
  const numeros = numerarLotes(lotes.data?.items ?? []);
  const vacio = porLote ? lotes.data?.items.length === 0 : piezas.data?.items.length === 0;

  return (
    <Card withBorder>
      <Stack gap="xs">
        <Text fw={600} size="sm">
          Stock disponible
        </Text>
        {cargando && <Loader size="sm" />}
        {vacio && (
          <Text size="sm" c="dimmed">
            No hay stock de este producto.
          </Text>
        )}

        {porLote && !!lotes.data?.items.length && (
          <Table fz="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Tienda</Table.Th>
                <Table.Th>Lote</Table.Th>
                <Table.Th>Ingreso</Table.Th>
                <Table.Th ta="right">Peso u.</Table.Th>
                <Table.Th ta="right">Disp.</Table.Th>
                <Table.Th ta="right">Precio u.</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {lotes.data.items.map((l) => (
                <Table.Tr key={l.id}>
                  <Table.Td>{l.tienda.nombre}</Table.Td>
                  <Table.Td>
                    <Badge size="xs" variant="outline">
                      Lote {numeros.get(l.id)}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{new Date(l.fechaIngreso).toLocaleDateString('es-AR')}</Table.Td>
                  <Table.Td ta="right">{gramos(l.pesoUnitario)}</Table.Td>
                  <Table.Td ta="right">{l.cantidadDisponible}</Table.Td>
                  <Table.Td ta="right">{formatoPesos(l.precio.precioArs)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}

        {!porLote && !!piezas.data?.items.length && (
          <Table fz="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Tienda</Table.Th>
                <Table.Th>Código</Table.Th>
                <Table.Th ta="right">Peso</Table.Th>
                <Table.Th ta="right">Precio</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {piezas.data.items.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td>{p.tienda.nombre}</Table.Td>
                  <Table.Td ff="monospace">{p.codigo}</Table.Td>
                  <Table.Td ta="right">{gramos(p.pesoGramos)}</Table.Td>
                  <Table.Td ta="right">{formatoPesos(p.precio.precioArs)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Stack>
    </Card>
  );
}