import { useState } from 'react';
import { ActionIcon, Alert, Badge, Button, Group, NumberInput, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { SelectorProducto } from '../../components/SelectorProducto';
import { SelectorTienda } from '../../components/SelectorTienda';
import { api } from '../../lib/api';
import { COLOR_TIPO, NOMBRE_TIPO, type Producto } from '../../lib/catalogo';

interface FilaPieza {
  clave: string;
  peso: number | string;
  precio: number | string;
  codigo: string;
}

const filaVacia = (): FilaPieza => ({ clave: crypto.randomUUID(), peso: '', precio: '', codigo: '' });
const numero = (v: number | string) => (v === '' ? undefined : Number(v));

interface RespuestaIngreso {
  advertencias: string[];
  piezas?: { codigo: string }[];
  lote?: { cantidadInicial: number };
}

export function FormularioIngreso({ onListo }: { onListo: () => void }) {
  const queryClient = useQueryClient();
  const [tiendaId, setTiendaId] = useState<string | null>(null);
  const [producto, setProducto] = useState<Producto | null>(null);
  const [piezas, setPiezas] = useState<FilaPieza[]>([filaVacia()]);
  const [cantidad, setCantidad] = useState<number | string>('');
  const [pesoTotal, setPesoTotal] = useState<number | string>('');
  const [precioTotal, setPrecioTotal] = useState<number | string>('');

  const esReventa = producto?.tipo === 'REVENTA';
  const esFantasia = producto?.tipo === 'FANTASIA';
  const porPieza = producto?.modoStock === 'UNICO';

  // Validación antes de enviar (el backend vuelve a validar todo)
  const piezasCompletas = piezas.every((p) => Number(p.peso) > 0 && (!esReventa || Number(p.precio) > 0));
  const loteCompleto =
    Number(cantidad) >= 1 && (esFantasia || Number(pesoTotal) > 0) && (!esReventa || Number(precioTotal) > 0);
  const puedeEnviar = !!tiendaId && !!producto && (porPieza ? piezasCompletas : loteCompleto);

  const ingresar = useMutation({
    mutationFn: () =>
      porPieza
        ? api<RespuestaIngreso>('/stock/piezas', {
            method: 'POST',
            body: {
              productoId: producto!.id,
              tiendaId,
              piezas: piezas.map((p) => ({
                pesoGramos: Number(p.peso),
                precioCompra: esReventa ? numero(p.precio) : undefined,
                codigo: p.codigo.trim() || undefined,
              })),
            },
          })
        : api<RespuestaIngreso>('/stock/lotes', {
            method: 'POST',
            body: {
              productoId: producto!.id,
              tiendaId,
              cantidad: Number(cantidad),
              pesoTotalGramos: esFantasia ? undefined : numero(pesoTotal),
              precioCompraTotal: numero(precioTotal),
            },
          }),
    onSuccess: (r) => {
      // Ej.: una pieza comprada por debajo del valor del metal (hechura negativa)
      for (const aviso of r.advertencias) {
        notifications.show({ color: 'orange', title: 'Atención', message: aviso, autoClose: 12000 });
      }
      notifications.show({
        color: 'green',
        message: r.piezas
          ? `Ingresaste ${r.piezas.length} piezas: ${r.piezas.map((p) => p.codigo).join(', ')}`
          : `Ingresaste un lote de ${r.lote?.cantidadInicial} unidades`,
      });
      void queryClient.invalidateQueries({ queryKey: ['stock'] });
      void queryClient.invalidateQueries({ queryKey: ['vender'] });
      onListo();
    },
  });

  const actualizarFila = (clave: string, cambios: Partial<FilaPieza>) =>
    setPiezas((prev) => prev.map((p) => (p.clave === clave ? { ...p, ...cambios } : p)));

  const pesoPromedio =
    Number(cantidad) > 0 && Number(pesoTotal) > 0 ? (Number(pesoTotal) / Number(cantidad)).toFixed(3) : null;

  return (
    <Stack>
      <SelectorTienda label="Tienda" value={tiendaId} onChange={setTiendaId} w={undefined} />
      <SelectorProducto label="Producto" value={producto} onChange={setProducto} />

      {producto && (
        <Group gap="xs">
          <Badge variant="light" color={COLOR_TIPO[producto.tipo]}>
            {NOMBRE_TIPO[producto.tipo]}
          </Badge>
          <Badge variant="outline">{porPieza ? 'Pieza única' : 'Por lote'}</Badge>
        </Group>
      )}

      {producto && esReventa && (
        <Text size="xs" c="dimmed">
          La hechura de cada pieza se calcula con el precio del gramo y el dólar de este momento.
        </Text>
      )}

      {/* ----- Pieza única: una fila por pieza ----- */}
      {producto && porPieza && (
        <Stack gap="xs">
          {piezas.map((p, i) => (
            <Group key={p.clave} align="flex-end" wrap="nowrap" gap="xs">
              <NumberInput
                label={i === 0 ? 'Peso (g)' : undefined}
                min={0}
                decimalScale={3}
                decimalSeparator=","
                value={p.peso}
                onChange={(v) => actualizarFila(p.clave, { peso: v })}
                style={{ flex: 1 }}
              />
              {esReventa && (
                <NumberInput
                  label={i === 0 ? 'Precio de compra ($)' : undefined}
                  min={0}
                  decimalScale={2}
                  thousandSeparator="."
                  decimalSeparator=","
                  value={p.precio}
                  onChange={(v) => actualizarFila(p.clave, { precio: v })}
                  style={{ flex: 1.3 }}
                />
              )}
              <TextInput
                label={i === 0 ? 'Código' : undefined}
                placeholder="Automático"
                value={p.codigo}
                onChange={(e) => actualizarFila(p.clave, { codigo: e.currentTarget.value })}
                style={{ flex: 1 }}
              />
              <ActionIcon
                variant="subtle"
                color="red"
                mb={4}
                disabled={piezas.length === 1}
                onClick={() => setPiezas((prev) => prev.filter((x) => x.clave !== p.clave))}
                aria-label="Quitar pieza"
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          ))}
          <Button
            variant="subtle"
            leftSection={<IconPlus size={16} />}
            onClick={() => setPiezas((prev) => [...prev, filaVacia()])}
            style={{ alignSelf: 'flex-start' }}
          >
            Otra pieza
          </Button>
        </Stack>
      )}

      {/* ----- Lote ----- */}
      {producto && !porPieza && (
        <Stack gap="xs">
          <NumberInput label="Cantidad de unidades" min={1} allowDecimal={false} value={cantidad} onChange={setCantidad} />
          {!esFantasia && (
            <NumberInput
              label="Peso total del lote (g)"
              description={pesoPromedio ? `Peso promedio por unidad: ${pesoPromedio.replace('.', ',')} g` : undefined}
              min={0}
              decimalScale={3}
              decimalSeparator=","
              value={pesoTotal}
              onChange={setPesoTotal}
            />
          )}
          <NumberInput
            label={esFantasia ? `Precio de compra total (${producto.monedaCompra === 'USD' ? 'USD' : '$'}, opcional)` : 'Precio de compra total ($)'}
            min={0}
            decimalScale={2}
            thousandSeparator="."
            decimalSeparator=","
            value={precioTotal}
            onChange={setPrecioTotal}
          />
        </Stack>
      )}

      {ingresar.isError && (
        <Alert color="red" style={{ whiteSpace: 'pre-line' }}>
          {ingresar.error.message}
        </Alert>
      )}

      <Button disabled={!puedeEnviar} loading={ingresar.isPending} onClick={() => ingresar.mutate()}>
        Ingresar
      </Button>
    </Stack>
  );
}