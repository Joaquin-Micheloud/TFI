import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Group,
  NumberInput,
  ScrollArea,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconSearch } from '@tabler/icons-react';
import { SelectorTienda } from '../../components/SelectorTienda';
import { api } from '../../lib/api';
import { numerarLotes, type Lote, type Pieza } from '../../lib/stock';

const coincide = (texto: string, ...campos: string[]) =>
  !texto || campos.some((c) => c.toLowerCase().includes(texto.toLowerCase()));

export function NuevaTransferencia({ onListo }: { onListo: () => void }) {
  const queryClient = useQueryClient();
  const [origenId, setOrigenId] = useState<string | null>(null);
  const [destinoId, setDestinoId] = useState<string | null>(null);
  const [nota, setNota] = useState('');
  const [filtro, setFiltro] = useState('');
  const [piezas, setPiezas] = useState<Set<string>>(new Set());
  const [lotes, setLotes] = useState<Map<string, number>>(new Map());

  const stockPiezas = useQuery({
    queryKey: ['stock', 'piezas', 'transferir', origenId],
    queryFn: () => api<{ items: Pieza[] }>(`/stock/piezas?estado=DISPONIBLE&tiendaId=${origenId}`),
    enabled: origenId !== null,
  });
  const stockLotes = useQuery({
    queryKey: ['stock', 'lotes', 'transferir', origenId],
    queryFn: () => api<{ items: Lote[] }>(`/stock/lotes?tiendaId=${origenId}`),
    enabled: origenId !== null,
  });

  const numeros = numerarLotes(stockLotes.data?.items ?? []);
  const piezasVisibles = (stockPiezas.data?.items ?? []).filter((p) =>
    coincide(filtro, p.codigo, p.producto.codigo, p.producto.nombre),
  );
  const lotesVisibles = (stockLotes.data?.items ?? []).filter((l) =>
    coincide(filtro, l.producto.codigo, l.producto.nombre),
  );

  const cambiarOrigen = (id: string | null) => {
    setOrigenId(id);
    setPiezas(new Set());
    setLotes(new Map());
  };

  const alternarPieza = (id: string) =>
    setPiezas((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });

  const cambiarLote = (id: string, cantidad: number) =>
    setLotes((actual) => {
      const nuevo = new Map(actual);
      if (cantidad > 0) nuevo.set(id, cantidad);
      else nuevo.delete(id);
      return nuevo;
    });

  const totalUnidades = piezas.size + [...lotes.values()].reduce((s, c) => s + c, 0);

  const enviar = useMutation({
    mutationFn: () =>
      api('/transferencias', {
        method: 'POST',
        body: {
          origenId,
          destinoId,
          nota: nota.trim() || undefined,
          items: [
            ...[...piezas].map((piezaId) => ({ piezaId })),
            ...[...lotes].map(([loteId, cantidad]) => ({ loteId, cantidad })),
          ],
        },
      }),
    onSuccess: () => {
      notifications.show({ color: 'green', message: 'Transferencia enviada: la mercadería quedó en tránsito' });
      void queryClient.invalidateQueries({ queryKey: ['transferencias'] });
      void queryClient.invalidateQueries({ queryKey: ['stock'] });
      onListo();
    },
  });

  const puedeEnviar = origenId && destinoId && origenId !== destinoId && totalUnidades > 0;

  return (
    <Stack>
      <Group grow align="flex-start">
        <SelectorTienda label="Desde" value={origenId} onChange={cambiarOrigen} />
        <SelectorTienda label="Hacia" value={destinoId} onChange={setDestinoId} />
      </Group>
      {origenId && destinoId && origenId === destinoId && (
        <Alert color="orange">El origen y el destino tienen que ser tiendas distintas.</Alert>
      )}

      {origenId && (
        <>
          <TextInput
            placeholder="Filtrar por código o nombre"
            leftSection={<IconSearch size={16} />}
            value={filtro}
            onChange={(e) => setFiltro(e.currentTarget.value)}
          />

          <Card withBorder p={0}>
            <Title order={6} p="xs">
              Piezas únicas disponibles
            </Title>
            <ScrollArea.Autosize mah={260}>
              <Table fz="sm">
                <Table.Tbody>
                  {piezasVisibles.map((p) => (
                    <Table.Tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => alternarPieza(p.id)}>
                      <Table.Td w={40}>
                        <Checkbox
                          checked={piezas.has(p.id)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => alternarPieza(p.id)}
                        />
                      </Table.Td>
                      <Table.Td ff="monospace">{p.codigo}</Table.Td>
                      <Table.Td>{p.producto.nombre}</Table.Td>
                      <Table.Td ta="right">{Number(p.pesoGramos).toLocaleString('es-AR')} g</Table.Td>
                    </Table.Tr>
                  ))}
                  {piezasVisibles.length === 0 && (
                    <Table.Tr>
                      <Table.Td>
                        <Text size="sm" c="dimmed" ta="center">
                          No hay piezas disponibles en esta tienda.
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </ScrollArea.Autosize>
          </Card>

          <Card withBorder p={0}>
            <Title order={6} p="xs">
              Lotes con stock
            </Title>
            <ScrollArea.Autosize mah={260}>
              <Table fz="sm">
                <Table.Tbody>
                  {lotesVisibles.map((l) => (
                    <Table.Tr key={l.id}>
                      <Table.Td>
                        <Text size="sm">
                          {l.producto.codigo} · {l.producto.nombre}
                        </Text>
                        <Text size="xs" c="dimmed">
                          Lote {numeros.get(l.id) ?? '—'} · {l.cantidadDisponible} disponibles
                        </Text>
                      </Table.Td>
                      <Table.Td w={130}>
                        <NumberInput
                          size="xs"
                          min={0}
                          max={l.cantidadDisponible}
                          allowDecimal={false}
                          placeholder="Cantidad"
                          value={lotes.get(l.id) ?? ''}
                          onChange={(v) => cambiarLote(l.id, Math.min(Number(v) || 0, l.cantidadDisponible))}
                        />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  {lotesVisibles.length === 0 && (
                    <Table.Tr>
                      <Table.Td>
                        <Text size="sm" c="dimmed" ta="center">
                          No hay lotes con stock en esta tienda.
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </ScrollArea.Autosize>
          </Card>
        </>
      )}

      <Textarea label="Nota (opcional)" autosize minRows={2} value={nota} onChange={(e) => setNota(e.currentTarget.value)} />

      {enviar.isError && (
        <Alert color="red" style={{ whiteSpace: 'pre-line' }}>
          {enviar.error.message}
        </Alert>
      )}

      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {totalUnidades} unidades seleccionadas
        </Text>
        <Button disabled={!puedeEnviar} loading={enviar.isPending} onClick={() => enviar.mutate()}>
          Enviar transferencia
        </Button>
      </Group>
    </Stack>
  );
}
