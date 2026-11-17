import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { LEYES, type Metal } from '../../lib/catalogo';
import { formatoFechaHora, formatoPesos, nombreLey } from '../../lib/formato';

type Modo = 'AUTOMATICO' | 'AJUSTE' | 'MANUAL';

interface ConfigMetal {
  metal: Metal;
  modo: Modo;
  ajustePct: string;
  actualizadoEn: string | null;
}

interface FilaTabla {
  metal: Metal;
  ley: string;
  precioArs?: string;
  error?: string;
}

interface PrecioManual {
  id: string;
  ley: string;
  precioArs: string;
  vigenteDesde: string;
  usuario: { nombre: string | null; email: string };
}

const DESCRIPCION_MODO: Record<Modo, string> = {
  AUTOMATICO: 'Precio internacional de la API, convertido con el dólar del negocio, sin cambios.',
  AJUSTE:
    'Precio internacional más un porcentaje propio. Es el modo recomendado: el gramo en la plaza local suele diferir del internacional.',
  MANUAL: 'Cargás vos el precio del gramo de cada ley. Para este metal no se usa la API.',
};

const NOMBRE_METAL: Record<Metal, string> = { ORO: 'Oro', PLATA: 'Plata' };

// Un cambio de precio del gramo cambia todos los precios del sistema
function useInvalidarPrecios() {
  const queryClient = useQueryClient();
  return () => {
    for (const clave of ['precios', 'productos', 'stock', 'vender']) {
      void queryClient.invalidateQueries({ queryKey: [clave] });
    }
  };
}

export function PreciosPage() {
  const config = useQuery({ queryKey: ['precios', 'config'], queryFn: () => api<ConfigMetal[]>('/precios/config') });
  const tabla = useQuery({ queryKey: ['precios', 'tabla'], queryFn: () => api<FilaTabla[]>('/precios/tabla') });

  return (
    <Stack>
      <div>
        <Title order={2}>Precios del gramo</Title>
        <Text c="dimmed" size="sm">
          Todos los precios del sistema salen del precio del gramo de cada metal y ley. Fórmula: (USD por onza ÷
          31,1035) × ley × dólar × (1 + ajuste).
        </Text>
      </div>

      {config.isLoading && <Loader />}
      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        {config.data?.map((c) => (
          <TarjetaMetal
            // La clave cambia al guardar: el formulario vuelve a tomar los valores guardados
            key={`${c.metal}-${c.actualizadoEn}`}
            config={c}
            tabla={tabla.data?.filter((f) => f.metal === c.metal) ?? []}
          />
        ))}
      </SimpleGrid>
    </Stack>
  );
}

function TarjetaMetal({ config, tabla }: { config: ConfigMetal; tabla: FilaTabla[] }) {
  const invalidar = useInvalidarPrecios();
  const [modo, setModo] = useState<Modo>(config.modo);
  const [ajuste, setAjuste] = useState<number | string>(Number(config.ajustePct));

  const guardar = useMutation({
    mutationFn: () =>
      api(`/precios/config/${config.metal}`, {
        method: 'PUT',
        body: { modo, ajustePct: modo === 'AJUSTE' ? Number(ajuste) || 0 : undefined },
      }),
    onSuccess: () => {
      notifications.show({ color: 'green', message: `Configuración de ${NOMBRE_METAL[config.metal].toLowerCase()} guardada` });
      invalidar();
    },
  });

  const huboCambios =
    modo !== config.modo || (modo === 'AJUSTE' && Number(ajuste) !== Number(config.ajustePct));

  return (
    <Card withBorder>
      <Stack>
        <Group justify="space-between">
          <Title order={3}>{NOMBRE_METAL[config.metal]}</Title>
          {config.actualizadoEn && (
            <Text size="xs" c="dimmed">
              Configurado el {formatoFechaHora(config.actualizadoEn)}
            </Text>
          )}
        </Group>

        <SegmentedControl
          fullWidth
          data={[
            { value: 'AUTOMATICO', label: 'Automático' },
            { value: 'AJUSTE', label: 'Con ajuste' },
            { value: 'MANUAL', label: 'Manual' },
          ]}
          value={modo}
          onChange={(v) => setModo(v as Modo)}
        />
        <Text size="xs" c="dimmed">
          {DESCRIPCION_MODO[modo]}
        </Text>

        {modo === 'AJUSTE' && (
          <NumberInput
            label="Ajuste sobre el precio internacional"
            description="Positivo sube el precio, negativo lo baja"
            suffix=" %"
            min={-50}
            max={200}
            decimalScale={2}
            value={ajuste}
            onChange={setAjuste}
          />
        )}

        {guardar.isError && <Alert color="red">{guardar.error.message}</Alert>}
        <Button disabled={!huboCambios} loading={guardar.isPending} onClick={() => guardar.mutate()}>
          Guardar
        </Button>

        <Divider label="Precio del gramo hoy" labelPosition="left" />
        <Table>
          <Table.Tbody>
            {tabla.map((f) => (
              <Table.Tr key={f.ley}>
                <Table.Td>{nombreLey(config.metal, f.ley)}</Table.Td>
                <Table.Td ta="right">
                  {f.error ? (
                    <Text size="xs" c="red">
                      {config.modo === 'MANUAL' ? 'Sin precio cargado' : f.error}
                    </Text>
                  ) : (
                    <Text fw={600}>{formatoPesos(f.precioArs)}</Text>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        {config.modo === 'MANUAL' && <PreciosManuales metal={config.metal} />}
      </Stack>
    </Card>
  );
}

function PreciosManuales({ metal }: { metal: Metal }) {
  const invalidar = useInvalidarPrecios();
  const [ley, setLey] = useState<string | null>(null);
  const [precio, setPrecio] = useState<number | string>('');

  const historial = useQuery({
    queryKey: ['precios', 'manual', metal],
    queryFn: () => api<PrecioManual[]>(`/precios/manual?metal=${metal}`),
  });

  const cargar = useMutation({
    mutationFn: () =>
      api('/precios/manual', { method: 'POST', body: { metal, ley: Number(ley), precioArs: Number(precio) } }),
    onSuccess: () => {
      notifications.show({ color: 'green', message: 'Precio cargado' });
      setPrecio('');
      invalidar();
    },
  });

  // El historial viene del más nuevo al más viejo: el primero de cada ley es el vigente
  const vigentes = new Set<string>();
  const filas = (historial.data ?? []).slice(0, 15).map((h) => {
    const clave = String(Number(h.ley));
    const vigente = !vigentes.has(clave);
    vigentes.add(clave);
    return { ...h, vigente };
  });

  return (
    <Stack gap="xs">
      <Divider label="Precios manuales" labelPosition="left" />
      <Group align="flex-end" wrap="nowrap">
        <Select label="Ley" data={LEYES[metal]} value={ley} onChange={setLey} w={150} />
        <NumberInput
          label="Precio por gramo"
          prefix="$ "
          min={0}
          decimalScale={2}
          thousandSeparator="."
          decimalSeparator=","
          value={precio}
          onChange={setPrecio}
          style={{ flex: 1 }}
        />
        <Button disabled={!ley || !(Number(precio) > 0)} loading={cargar.isPending} onClick={() => cargar.mutate()}>
          Cargar
        </Button>
      </Group>
      {cargar.isError && <Alert color="red">{cargar.error.message}</Alert>}
      <Text size="xs" c="dimmed">
        Cada carga queda registrada y no se puede borrar. Para cada ley se usa la carga más reciente.
      </Text>

      {filas.length > 0 && (
        <Table fz="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Fecha</Table.Th>
              <Table.Th>Ley</Table.Th>
              <Table.Th ta="right">Precio</Table.Th>
              <Table.Th>Cargó</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filas.map((h) => (
              <Table.Tr key={h.id}>
                <Table.Td>{formatoFechaHora(h.vigenteDesde)}</Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    {nombreLey(metal, h.ley)}
                    {h.vigente && (
                      <Badge size="xs" color="green">
                        Vigente
                      </Badge>
                    )}
                  </Group>
                </Table.Td>
                <Table.Td ta="right">{formatoPesos(h.precioArs)}</Table.Td>
                <Table.Td>{h.usuario.nombre ?? h.usuario.email}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}