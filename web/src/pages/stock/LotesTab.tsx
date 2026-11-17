import { useState } from 'react';
import { Badge, Button, Card, Group, Stack, Switch, Table, Text, Tooltip } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { SelectorProducto } from '../../components/SelectorProducto';
import { SelectorTienda } from '../../components/SelectorTienda';
import { api } from '../../lib/api';
import type { Producto } from '../../lib/catalogo';
import { formatoFechaHora, formatoPesos, formatoUsd } from '../../lib/formato';
import { numerarLotes, type Lote } from '../../lib/stock';
import { AccionLoteModal } from './AccionesStock';


export function LotesTab({ puedeEditar }: { puedeEditar: boolean }) {
  const [tiendaId, setTiendaId] = useState<string | null>(null);
  const [producto, setProducto] = useState<Producto | null>(null);
  const [agotados, setAgotados] = useState(false);
  const [accion, setAccion] = useState<{ lote: Lote; tipo: 'baja' | 'ajuste' } | null>(null);

  const parametros = new URLSearchParams();
  if (tiendaId) parametros.set('tiendaId', tiendaId);
  if (producto) parametros.set('productoId', producto.id);
  if (agotados) parametros.set('incluirAgotados', 'true');

  const lotes = useQuery({
    queryKey: ['stock', 'lotes', parametros.toString()],
    queryFn: () => api<{ items: Lote[] }>(`/stock/lotes?${parametros}`),
  });

  const numeros = numerarLotes(lotes.data?.items ?? []);

  return (
    <Stack>
      <Group align="flex-end">
        <SelectorTienda value={tiendaId} onChange={setTiendaId} permitirTodas />
        <SelectorProducto value={producto} onChange={setProducto} placeholder="Todos los productos" w={280} />
        <Switch label="Ver agotados" checked={agotados} onChange={(e) => setAgotados(e.currentTarget.checked)} mb={8} />
      </Group>

      <Text size="xs" c="dimmed">
        Ordenados del más antiguo al más nuevo: al vender se descuenta en este orden (FIFO).
      </Text>

      <Card withBorder p={0}>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Producto</Table.Th>
              <Table.Th>Tienda</Table.Th>
              <Table.Th>Ingreso</Table.Th>
              <Table.Th ta="right">Disponibles</Table.Th>
              <Table.Th ta="right">Peso u.</Table.Th>
              {puedeEditar && <Table.Th ta="right">Hechura u.</Table.Th>}
              <Table.Th ta="right">Precio u. hoy</Table.Th>
              {puedeEditar && <Table.Th />}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {lotes.data?.items.map((l) => (
              <Table.Tr key={l.id}>
                <Table.Td>
                  <Group gap={6} wrap="nowrap">
                    <Text size="sm" fw={500}>
                      {l.producto.codigo} · {l.producto.nombre}
                    </Text>
                    {numeros.has(l.id) ? (
                      <Badge size="xs" variant="outline">
                        Lote {numeros.get(l.id)}
                      </Badge>
                    ) : (
                      <Badge size="xs" color="gray">
                        Agotado
                      </Badge>
                    )}
                  </Group>
                </Table.Td>
                <Table.Td>{l.tienda.nombre}</Table.Td>
                <Table.Td>{formatoFechaHora(l.fechaIngreso)}</Table.Td>
                <Table.Td ta="right">
                  <Text size="sm" fw={600} span>
                    {l.cantidadDisponible}
                  </Text>
                  <Text size="xs" c="dimmed" span>
                    {' '}
                    / {l.cantidadInicial}
                  </Text>
                </Table.Td>
                <Table.Td ta="right">
                  {l.pesoUnitario ? `${Number(l.pesoUnitario).toLocaleString('es-AR')} g` : '—'}
                </Table.Td>
                {puedeEditar && (
                  <Table.Td ta="right">
                    {l.hechuraUsdUnitaria != null ? (
                      <Text size="sm" c={Number(l.hechuraUsdUnitaria) < 0 ? 'red' : undefined}>
                        {formatoUsd(l.hechuraUsdUnitaria)}
                      </Text>
                    ) : (
                      '—'
                    )}
                  </Table.Td>
                )}
                <Table.Td ta="right">
                  {l.precio.precioArs ? (
                    formatoPesos(l.precio.precioArs)
                  ) : (
                    <Tooltip label={l.precio.motivo} multiline w={240}>
                      <Text size="xs" c="dimmed">
                        Sin precio
                      </Text>
                    </Tooltip>
                  )}
                </Table.Td>
                {puedeEditar && (
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      <Button size="xs" variant="subtle" onClick={() => setAccion({ lote: l, tipo: 'ajuste' })}>
                        Ajustar
                      </Button>
                      <Button
                        size="xs"
                        variant="subtle"
                        color="red"
                        disabled={l.cantidadDisponible === 0}
                        onClick={() => setAccion({ lote: l, tipo: 'baja' })}
                      >
                        Baja
                      </Button>
                    </Group>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
            {lotes.data?.items.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={8}>
                  <Text size="sm" c="dimmed" ta="center" py="md">
                    No hay lotes con esos filtros.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      {accion && <AccionLoteModal lote={accion.lote} accion={accion.tipo} onClose={() => setAccion(null)} />}
    </Stack>
  );
}