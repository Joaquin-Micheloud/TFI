import {
  Alert,
  Button,
  Card,
  Fieldset,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { isNotEmpty, useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatoPesos } from '../../lib/formato';
import {
  LEYES,
  NOMBRE_COMPONENTE,
  type Categoria,
  type Metal,
  type ModoStock,
  type Producto,
  type TipoProducto,
} from '../../lib/catalogo';

interface ValoresProducto {
  codigo: string;
  codigoBarras: string;
  nombre: string;
  descripcion: string;
  tipo: TipoProducto;
  modoStock: ModoStock;
  categoriaId: string | null;
  metal: Metal;
  ley: string | null;
  pesoGramos: number | string;
  margenPct: number | string;
  precioCompra: number | string;
  monedaCompra: 'ARS' | 'USD';
  elaboracionUsd: number | string;
  elaboracionPor: 'PIEZA' | 'GRAMO';
  insumosArs: number | string;
  stockMinimo: number | string;
}

// Los Decimal llegan como texto; en el formulario un campo vacío es ''
const aNumero = (v: string | null | undefined) => (v == null ? '' : Number(v));
const aNumeroONull = (v: number | string) => (v === '' ? null : Number(v));

function valoresIniciales(p: Producto | null): ValoresProducto {
  return {
    codigo: p?.codigo ?? '',
    codigoBarras: p?.codigoBarras ?? '',
    nombre: p?.nombre ?? '',
    descripcion: p?.descripcion ?? '',
    tipo: p?.tipo ?? 'REVENTA',
    modoStock: p?.modoStock ?? 'UNICO',
    categoriaId: p?.categoria?.id ?? null,
    metal: p?.metal ?? 'ORO',
    ley: p?.ley != null ? String(Number(p.ley)) : null,
    pesoGramos: aNumero(p?.pesoGramos),
    margenPct: aNumero(p?.margenPct),
    precioCompra: aNumero(p?.precioCompra),
    monedaCompra: p?.monedaCompra ?? 'ARS',
    elaboracionUsd: aNumero(p?.elaboracionUsd),
    elaboracionPor: p?.elaboracionPor ?? 'PIEZA',
    insumosArs: aNumero(p?.insumosArs),
    stockMinimo: p?.stockMinimo ?? '',
  };
}

// Arma el body con los campos que corresponden al tipo
function armarBody(v: ValoresProducto, esNuevo: boolean) {
  const body: Record<string, unknown> = {
    codigo: v.codigo,
    nombre: v.nombre,
    descripcion: v.descripcion.trim() || null,
    codigoBarras: v.codigoBarras.trim() || null,
    categoriaId: v.categoriaId || null,
    margenPct: aNumeroONull(v.margenPct), // null = usa el de la categoría
    stockMinimo: aNumeroONull(v.stockMinimo),
  };
  // El tipo y el modo de stock solo se envían al crear
  if (esNuevo) {
    body.tipo = v.tipo;
    if (v.tipo !== 'FANTASIA') body.modoStock = v.modoStock;
  }
  if (v.tipo === 'FANTASIA') {
    body.precioCompra = aNumeroONull(v.precioCompra);
    body.monedaCompra = v.monedaCompra;
  } else {
    body.metal = v.metal;
    body.ley = v.ley ? Number(v.ley) : null;
    body.pesoGramos = aNumeroONull(v.pesoGramos);
  }
  if (v.tipo === 'ELABORACION') {
    body.elaboracionUsd = aNumeroONull(v.elaboracionUsd);
    body.elaboracionPor = v.elaboracionPor;
    body.insumosArs = aNumeroONull(v.insumosArs) ?? 0;
  }
  return body;
}

interface Props {
  producto: Producto | null; // null = alta
  categorias: Categoria[];
  puedeEditar: boolean;
  onListo: () => void;
}

export function FormularioProducto({ producto, categorias, puedeEditar, onListo }: Props) {
  const queryClient = useQueryClient();
  const esNuevo = producto === null;

  const form = useForm<ValoresProducto>({
    initialValues: valoresIniciales(producto),
    validate: {
      codigo: isNotEmpty('El código es obligatorio'),
      nombre: isNotEmpty('El nombre es obligatorio'),
      ley: (v, val) => (val.tipo !== 'FANTASIA' && !v ? 'Elegí la ley' : null),
      pesoGramos: (v, val) => (val.tipo === 'ELABORACION' && v === '' ? 'El peso es obligatorio' : null),
      precioCompra: (v, val) => (val.tipo === 'FANTASIA' && v === '' ? 'El precio de compra es obligatorio' : null),
      elaboracionUsd: (v, val) =>
        val.tipo === 'ELABORACION' && v === '' ? 'El costo de elaboración es obligatorio' : null,
    },
  });

  const invalidar = () => {
    void queryClient.invalidateQueries({ queryKey: ['productos'] });
    void queryClient.invalidateQueries({ queryKey: ['categorias'] });
    void queryClient.invalidateQueries({ queryKey: ['vender'] });
  };

  const guardar = useMutation({
    mutationFn: (v: ValoresProducto) =>
      esNuevo
        ? api<Producto>('/productos', { method: 'POST', body: armarBody(v, true) })
        : api<Producto>(`/productos/${producto.id}`, { method: 'PATCH', body: armarBody(v, false) }),
    onSuccess: () => {
      notifications.show({ color: 'green', message: esNuevo ? 'Producto creado' : 'Cambios guardados' });
      invalidar();
      onListo();
    },
  });

  const cambiarActivo = useMutation({
    mutationFn: () =>
      producto!.activo
        ? api(`/productos/${producto!.id}`, { method: 'DELETE' })
        : api(`/productos/${producto!.id}`, { method: 'PATCH', body: { activo: true } }),
    onSuccess: () => {
      notifications.show({ message: producto!.activo ? 'Producto dado de baja' : 'Producto reactivado' });
      invalidar();
      onListo();
    },
  });

  const { tipo, metal } = form.values;
  const modoStock: ModoStock = tipo === 'FANTASIA' ? 'LOTE' : form.values.modoStock;
  const categoria = categorias.find((c) => c.id === form.values.categoriaId);

  return (
    <form onSubmit={form.onSubmit((valores) => guardar.mutate(valores))}>
      <Fieldset variant="unstyled" disabled={!puedeEditar}>
        <Stack>
          {producto && <PrecioActual producto={producto} />}

          <div>
            <Text size="sm" fw={500} mb={4}>
              Tipo de producto
            </Text>
            <SegmentedControl
              fullWidth
              disabled={!esNuevo}
              data={[
                { value: 'REVENTA', label: 'Reventa' },
                { value: 'FANTASIA', label: 'Fantasía' },
                { value: 'ELABORACION', label: 'Elaboración propia' },
              ]}
              value={tipo}
              onChange={(v) => form.setFieldValue('tipo', v as TipoProducto)}
            />
          </div>

          {tipo !== 'FANTASIA' && (
            <div>
              <Text size="sm" fw={500} mb={4}>
                Manejo del stock
              </Text>
              <SegmentedControl
                fullWidth
                disabled={!esNuevo}
                data={[
                  { value: 'UNICO', label: 'Pieza única' },
                  { value: 'LOTE', label: 'Por lote' },
                ]}
                value={form.values.modoStock}
                onChange={(v) => form.setFieldValue('modoStock', v as ModoStock)}
              />
            </div>
          )}
          {!esNuevo && (
            <Text size="xs" c="dimmed">
              El tipo y el manejo del stock no se pueden cambiar después del alta.
            </Text>
          )}

          <Group grow>
            <TextInput label="Código" {...form.getInputProps('codigo')} />
            <TextInput label="Código de barras" placeholder="Opcional" {...form.getInputProps('codigoBarras')} />
          </Group>
          <TextInput label="Nombre" {...form.getInputProps('nombre')} />
          <Textarea label="Descripción" autosize minRows={2} {...form.getInputProps('descripcion')} />

          <Group grow>
            <Select
              label="Categoría"
              placeholder="Sin categoría"
              clearable
              data={categorias.map((c) => ({ value: c.id, label: c.nombre }))}
              {...form.getInputProps('categoriaId')}
            />
            <NumberInput
              label="Margen propio"
              placeholder={
                categoria?.margenDefectoPct != null
                  ? `Usa el de la categoría (${Number(categoria.margenDefectoPct)} %)`
                  : 'Usa el de la categoría'
              }
              suffix=" %"
              min={0}
              max={1000}
              decimalScale={2}
              {...form.getInputProps('margenPct')}
            />
          </Group>

          {tipo !== 'FANTASIA' && (
            <Group grow align="flex-start">
              <Select
                label="Metal"
                data={[
                  { value: 'ORO', label: 'Oro' },
                  { value: 'PLATA', label: 'Plata' },
                ]}
                value={metal}
                onChange={(v) => {
                  form.setFieldValue('metal', (v ?? 'ORO') as Metal);
                  form.setFieldValue('ley', null); // cada metal tiene sus leyes
                }}
                allowDeselect={false}
              />
              <Select label="Ley" data={LEYES[metal]} {...form.getInputProps('ley')} />
              <NumberInput
                label={tipo === 'REVENTA' ? 'Peso de referencia (g)' : 'Peso (g)'}
                description={tipo === 'REVENTA' ? 'Cada pieza guarda su peso real' : undefined}
                min={0}
                decimalScale={3}
                decimalSeparator=","
                {...form.getInputProps('pesoGramos')}
              />
            </Group>
          )}

          {tipo === 'FANTASIA' && (
            <Group grow>
              <NumberInput
                label="Precio de compra"
                min={0}
                decimalScale={2}
                thousandSeparator="."
                decimalSeparator=","
                {...form.getInputProps('precioCompra')}
              />
              <Select
                label="Moneda"
                data={[
                  { value: 'ARS', label: 'Pesos' },
                  { value: 'USD', label: 'Dólares' },
                ]}
                allowDeselect={false}
                {...form.getInputProps('monedaCompra')}
              />
            </Group>
          )}

          {tipo === 'ELABORACION' && (
            <Group grow align="flex-start">
              <NumberInput
                label="Elaboración (USD)"
                min={0}
                decimalScale={2}
                decimalSeparator=","
                {...form.getInputProps('elaboracionUsd')}
              />
              <Select
                label="Se calcula por"
                data={[
                  { value: 'PIEZA', label: 'Pieza' },
                  { value: 'GRAMO', label: 'Gramo' },
                ]}
                allowDeselect={false}
                {...form.getInputProps('elaboracionPor')}
              />
              <NumberInput
                label="Insumos ($)"
                description="Piedras u otros materiales"
                min={0}
                decimalScale={2}
                thousandSeparator="."
                decimalSeparator=","
                {...form.getInputProps('insumosArs')}
              />
            </Group>
          )}

          {modoStock === 'LOTE' && (
            <NumberInput
              label="Stock mínimo por tienda"
              description="Se avisa cuando una tienda queda por debajo"
              min={0}
              allowDecimal={false}
              {...form.getInputProps('stockMinimo')}
            />
          )}

          {guardar.isError && (
            <Alert color="red" style={{ whiteSpace: 'pre-line' }}>
              {guardar.error.message}
            </Alert>
          )}

          {puedeEditar && (
            <Group justify="space-between">
              {producto ? (
                <Button
                  variant="subtle"
                  color={producto.activo ? 'red' : 'green'}
                  loading={cambiarActivo.isPending}
                  onClick={() => cambiarActivo.mutate()}
                >
                  {producto.activo ? 'Dar de baja' : 'Reactivar'}
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" loading={guardar.isPending}>
                {esNuevo ? 'Crear producto' : 'Guardar cambios'}
              </Button>
            </Group>
          )}
        </Stack>
      </Fieldset>
    </form>
  );
}

// Precio de hoy con su desglose (el vendedor solo recibe el precio)
function PrecioActual({ producto }: { producto: Producto }) {
  const p = producto.precio;
  return (
    <Card withBorder bg="gray.0">
      <Stack gap={4}>
        <Group justify="space-between">
          <Text size="sm">Precio de venta hoy</Text>
          <Text fw={700}>{p.precioArs ? formatoPesos(p.precioArs) : '—'}</Text>
        </Group>
        {p.motivo && (
          <Text size="xs" c="dimmed">
            {p.motivo}
          </Text>
        )}
        {p.detalle &&
          Object.entries(p.detalle).map(([parte, valor]) => (
            <Group key={parte} justify="space-between" pl="sm">
              <Text size="xs" c="dimmed">
                {NOMBRE_COMPONENTE[parte] ?? parte}
              </Text>
              <Text size="xs">{formatoPesos(valor)}</Text>
            </Group>
          ))}
        {p.costoArs != null && (
          <Group justify="space-between">
            <Text size="xs" fw={500}>
              Costo
            </Text>
            <Text size="xs" fw={500}>
              {formatoPesos(p.costoArs)}
            </Text>
          </Group>
        )}
        {p.margenPct != null && (
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              Margen
            </Text>
            <Text size="xs">{Number(p.margenPct)} %</Text>
          </Group>
        )}
      </Stack>
    </Card>
  );
}