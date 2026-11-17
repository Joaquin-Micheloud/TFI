import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Grid,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { useDebouncedValue, useLocalStorage } from '@mantine/hooks';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconPrinter, IconTrash } from '@tabler/icons-react';
import { api } from '../../lib/api';
import { formatoFechaHora, formatoPesos } from '../../lib/formato';
import { abrirTicket } from '../../lib/ticket';
import { Buscador } from './Buscador';
import { PanelPagos } from './PanelPagos';
import {
  calcularPagos,
  type Cotizacion,
  type ItemCarrito,
  type PagoCarrito,
  type PiezaEncontrada,
  type LoteEncontrado,
  type VentaConfirmada,
} from './carrito';

interface Tienda {
  id: string;
  nombre: string;
  activa: boolean;
}

export function VenderPage() {
  const queryClient = useQueryClient();
  const [tiendaId, setTiendaId] = useLocalStorage<string>({ key: 'quilatear.tienda', defaultValue: '' });
  const [items, setItems] = useState<ItemCarrito[]>([]);
  const [descuentoGlobal, setDescuentoGlobal] = useState(0);
  const [pagos, setPagos] = useState<PagoCarrito[]>([]);
  const [confirmada, setConfirmada] = useState<VentaConfirmada | null>(null);

  // ----- Tiendas -----
  const tiendas = useQuery({ queryKey: ['tiendas'], queryFn: () => api<Tienda[]>('/tiendas') });
  const tiendasActivas = useMemo(() => (tiendas.data ?? []).filter((t) => t.activa), [tiendas.data]);

  // Si la tienda recordada ya no es válida, se elige la primera
  useEffect(() => {
    if (tiendasActivas.length > 0 && !tiendasActivas.some((t) => t.id === tiendaId)) {
      setTiendaId(tiendasActivas[0].id);
    }
  }, [tiendasActivas, tiendaId, setTiendaId]);

  const limpiar = () => {
    setItems([]);
    setPagos([]);
    setDescuentoGlobal(0);
  };

  // ----- Cotización en vivo -----
  const pedido = useMemo(
    () => ({
      tiendaId,
      descuentoPct: descuentoGlobal || undefined,
      items: items.map((i) =>
        i.piezaId
          ? { piezaId: i.piezaId, descuentoPct: i.descuentoPct || undefined }
          : { productoId: i.productoId, loteId: i.loteId, cantidad: i.cantidad, descuentoPct: i.descuentoPct || undefined },
      ),
    }),
    [tiendaId, descuentoGlobal, items],
  );
  const [pedidoEstable] = useDebouncedValue(pedido, 300);

  const cotizacion = useQuery({
    queryKey: ['vender', 'cotizar', pedidoEstable],
    queryFn: () => api<Cotizacion>('/ventas/cotizar', { method: 'POST', body: pedidoEstable }),
    enabled: !!pedidoEstable.tiendaId && pedidoEstable.items.length > 0,
    placeholderData: keepPreviousData, // mantiene los números anteriores mientras recalcula
    retry: false,
  });

  const cot = items.length > 0 ? cotizacion.data : undefined;
  const total = cot ? Number(cot.total) : 0;
  const dolar = cot ? Number(cot.dolar) : 0;
  const estadoPagos = calcularPagos(pagos, total, dolar);
  const recalculando = pedido !== pedidoEstable || cotizacion.isFetching;

  const puedeConfirmar =
    items.length > 0 &&
    !!cot &&
    !cotizacion.isError &&
    !recalculando &&
    pagos.length > 0 &&
    estadoPagos.falta === 0 &&
    !estadoPagos.vueltoSinEfectivo;

  // ----- Confirmar -----
  const confirmar = useMutation({
    mutationFn: () =>
      api<VentaConfirmada>('/ventas', {
        method: 'POST',
        body: {
          ...pedido,
          pagos: pagos.map((p) => ({
            medio: p.medio,
            monto: p.monto,
            cuotas: p.medio === 'CREDITO' ? p.cuotas : undefined,
          })),
        },
      }),
    onSuccess: (venta) => {
      setConfirmada(venta);
      limpiar();
      void queryClient.invalidateQueries({ queryKey: ['vender'] }); // refresca el stock del buscador
    },
  });

  // ----- Carrito -----
  const agregarPieza = (p: PiezaEncontrada) => {
    if (items.some((i) => i.piezaId === p.piezaId)) return;
    setItems((prev) => [
      ...prev,
      {
        clave: crypto.randomUUID(),
        piezaId: p.piezaId,
        cantidad: 1,
        descuentoPct: 0,
        etiqueta: `${p.codigo} · ${p.producto.nombre}`,
        detalle: `Pieza única · ${Number(p.pesoGramos)} g`,
      },
    ]);
  };

  // Cada lote es un ítem distinto: se vende de ese lote y a su precio
  const agregarLote = (l: LoteEncontrado) => {
    setItems((prev) => {
      const existente = prev.find((i) => i.loteId === l.loteId);
      if (existente) {
        return prev.map((i) =>
          i === existente ? { ...i, cantidad: Math.min(i.cantidad + 1, l.disponible) } : i,
        );
      }
      const peso = l.pesoUnitario ? ` · ${Number(l.pesoUnitario).toLocaleString('es-AR')} g` : '';
      return [
        ...prev,
        {
          clave: crypto.randomUUID(),
          productoId: l.producto.id,
          loteId: l.loteId,
          cantidad: 1,
          descuentoPct: 0,
          etiqueta: `${l.producto.codigo} · ${l.producto.nombre} · Lote ${l.numeroLote}`,
          detalle: `Ingresó ${new Date(l.fechaIngreso).toLocaleDateString('es-AR')}${peso} · ${l.disponible} disponibles`,
          maximo: l.disponible,
        },
      ];
    });
  };

  const actualizarItem = (clave: string, cambios: Partial<ItemCarrito>) =>
    setItems((prev) => prev.map((i) => (i.clave === clave ? { ...i, ...cambios } : i)));

  const quitarItem = (clave: string) => setItems((prev) => prev.filter((i) => i.clave !== clave));

  const cambiarTienda = (id: string) => {
    setTiendaId(id);
    limpiar(); // el stock es por tienda: el carrito no se puede mantener
  };

  // Las líneas cotizadas de cada ítem (puede haber varias si sale de varios lotes)
  const lineasDe = (indice: number) => cot?.lineas.filter((l) => l.numeroItem === indice + 1) ?? [];

  if (tiendas.isSuccess && tiendasActivas.length === 0) {
    return <Alert color="orange">No tenés tiendas asignadas para vender.</Alert>;
  }

  return (
    <>
      <Grid>
        {/* ----- Izquierda: buscador y carrito ----- */}
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Stack>
            <Group justify="space-between" align="flex-end">
              <Title order={2}>Vender</Title>
              <Select
                label="Tienda"
                w={240}
                data={tiendasActivas.map((t) => ({ value: t.id, label: t.nombre }))}
                value={tiendaId || null}
                onChange={(v) => v && cambiarTienda(v)}
                allowDeselect={false}
              />
            </Group>

            <Buscador
              tiendaId={tiendaId}
              piezasEnCarrito={items.flatMap((i) => (i.piezaId ? [i.piezaId] : []))}
              onAgregarPieza={agregarPieza}
              onAgregarLote={agregarLote}
            />

            <Card withBorder p={0}>
              <Table verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Ítem</Table.Th>
                    <Table.Th>Cant.</Table.Th>
                    <Table.Th ta="right">Precio</Table.Th>
                    <Table.Th>Desc.</Table.Th>
                    <Table.Th ta="right">Subtotal</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {items.length === 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={6}>
                        <Text size="sm" c="dimmed" ta="center" py="md">
                          El carrito está vacío. Buscá un producto para empezar.
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                  {items.map((item, i) => {
                    const lineas = lineasDe(i);
                    const subtotal = lineas.reduce((s, l) => s + Number(l.subtotal), 0);
                    const precios = [...new Set(lineas.map((l) => l.precioListaUnitario))];
                    return (
                      <Table.Tr key={item.clave}>
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {item.etiqueta}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {item.detalle}
                            {lineas.length > 1 ? ` · sale de ${lineas.length} lotes` : ''}
                          </Text>
                        </Table.Td>
                        <Table.Td w={90}>
                          {item.piezaId ? (
                            1
                          ) : (
                            <NumberInput
                              size="xs"
                              min={1}
                              max={item.maximo}
                              allowDecimal={false}
                              value={item.cantidad}
                              onChange={(v) => actualizarItem(item.clave, { cantidad: Math.max(1, Number(v) || 1) })}
                            />
                          )}
                        </Table.Td>
                        <Table.Td ta="right">
                          {precios.length === 1 ? formatoPesos(precios[0]) : precios.length > 1 ? 'Varios' : '—'}
                        </Table.Td>
                        <Table.Td w={90}>
                          <NumberInput
                            size="xs"
                            min={0}
                            max={100}
                            suffix=" %"
                            value={item.descuentoPct}
                            onChange={(v) => actualizarItem(item.clave, { descuentoPct: Number(v) || 0 })}
                          />
                        </Table.Td>
                        <Table.Td ta="right">{lineas.length > 0 ? formatoPesos(subtotal) : '—'}</Table.Td>
                        <Table.Td w={40}>
                          <ActionIcon variant="subtle" color="red" onClick={() => quitarItem(item.clave)} aria-label="Quitar">
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Card>

            {cotizacion.isError && items.length > 0 && <Alert color="red">{cotizacion.error.message}</Alert>}
          </Stack>
        </Grid.Col>

        {/* ----- Derecha: totales, pagos y confirmación ----- */}
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Stack>
            <Card withBorder>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text>Subtotal</Text>
                  <Text>{formatoPesos(cot?.subtotal ?? 0)}</Text>
                </Group>
                <NumberInput
                  label="Descuento sobre el total"
                  size="xs"
                  min={0}
                  max={100}
                  suffix=" %"
                  value={descuentoGlobal}
                  onChange={(v) => setDescuentoGlobal(Number(v) || 0)}
                />
                <Group justify="space-between">
                  <Text>Descuentos</Text>
                  <Text c="red">-{formatoPesos(cot?.descuentoTotal ?? 0)}</Text>
                </Group>
                <Group justify="space-between">
                  <Title order={3}>Total</Title>
                  <Title order={3}>{formatoPesos(cot?.total ?? 0)}</Title>
                </Group>
                {cot && (
                  <Text size="xs" c="dimmed">
                    Dólar {cot.tipoDolar.toLowerCase()} {formatoPesos(cot.dolar)} · cotización del{' '}
                    {formatoFechaHora(cot.cotizacionFecha)}
                  </Text>
                )}
              </Stack>
            </Card>

            <PanelPagos dolar={dolar} pagos={pagos} estado={estadoPagos} deshabilitado={!cot} onChange={setPagos} />

            <Button size="lg" disabled={!puedeConfirmar} loading={confirmar.isPending} onClick={() => confirmar.mutate()}>
              Confirmar venta
            </Button>
            {confirmar.isError && <Alert color="red">{confirmar.error.message}</Alert>}
          </Stack>
        </Grid.Col>
      </Grid>

      {/* ----- Venta registrada ----- */}
      <Modal opened={!!confirmada} onClose={() => setConfirmada(null)} title="Venta registrada" centered>
        {confirmada && (
          <Stack>
            <Text>
              Ticket N° <b>{confirmada.numeroFormateado}</b>
            </Text>
            <Group justify="space-between">
              <Text>Total</Text>
              <Text fw={700}>{formatoPesos(confirmada.total)}</Text>
            </Group>
            {Number(confirmada.vuelto) > 0 && (
              <Alert color="green" title="Vuelto">
                {formatoPesos(confirmada.vuelto)}
              </Alert>
            )}
            <Group grow>
              <Button leftSection={<IconPrinter size={18} />} onClick={() => abrirTicket(confirmada.id)}>
                Imprimir ticket
              </Button>
              <Button variant="default" onClick={() => setConfirmada(null)}>
                Nueva venta
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  );
}