import { Alert, Card, Group, Loader, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import { formatoFechaHora, formatoPesos, formatoUsd, nombreLey } from '../lib/formato';

interface FilaPrecio {
  metal: 'ORO' | 'PLATA';
  ley: string;
  modo?: string;
  precioArs?: string;
  error?: string;
}

interface Cotizacion {
  id: string;
  tipo: string;
  valorVenta: string;
  unidad: string;
  creadoEn: string;
  desactualizada: boolean;
}

const NOMBRE_COTIZACION: Record<string, string> = {
  DOLAR_OFICIAL: 'Dólar oficial',
  DOLAR_BLUE: 'Dólar blue',
  DOLAR_MEP: 'Dólar MEP',
  DOLAR_CCL: 'Dólar CCL',
  DOLAR_TARJETA: 'Dólar tarjeta',
  DOLAR_MAYORISTA: 'Dólar mayorista',
  ORO: 'Oro (onza troy)',
  PLATA: 'Plata (onza troy)',
};

export function InicioPage() {
  const { sesion } = useAuth();

  const precios = useQuery({
    queryKey: ['precios', 'tabla'],
    queryFn: () => api<FilaPrecio[]>('/precios/tabla'),
  });

  const cotizaciones = useQuery({
    queryKey: ['cotizaciones'],
    queryFn: () => api<Cotizacion[]>('/cotizaciones'),
    refetchInterval: 5 * 60_000, // se actualiza sola cada 5 minutos
  });

  const hayDesactualizadas = cotizaciones.data?.some((c) => c.desactualizada);

  return (
    <Stack>
      <div>
        <Title order={2}>Hola, {sesion?.usuario.nombre}</Title>
        <Text c="dimmed">{sesion?.negocio.nombre}</Text>
      </div>

      {hayDesactualizadas && (
        <Alert color="orange" title="Cotizaciones desactualizadas">
          Hace más de 24 horas que no se pudo leer alguna cotización. Los precios se están calculando con el último
          valor guardado.
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Card withBorder>
          <Title order={4} mb="sm">
            Precio del gramo hoy
          </Title>
          {precios.isLoading && <Loader size="sm" />}
          {precios.error && <Alert color="red">{precios.error.message}</Alert>}
          {precios.data && (
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Metal</Table.Th>
                  <Table.Th>Ley</Table.Th>
                  <Table.Th ta="right">Precio por gramo</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {precios.data.map((fila) => (
                  <Table.Tr key={`${fila.metal}-${fila.ley}`}>
                    <Table.Td>{fila.metal === 'ORO' ? 'Oro' : 'Plata'}</Table.Td>
                    <Table.Td>{nombreLey(fila.metal, fila.ley)}</Table.Td>
                    <Table.Td ta="right">
                      {fila.error ? (
                        <Text size="xs" c="red">
                          Sin precio
                        </Text>
                      ) : (
                        formatoPesos(fila.precioArs)
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Card>

        <Card withBorder>
          <Group justify="space-between" mb="sm">
            <Title order={4}>Cotizaciones</Title>
            {cotizaciones.data?.[0] && (
              <Text size="xs" c="dimmed">
                Última lectura: {formatoFechaHora(cotizaciones.data[0].creadoEn)}
              </Text>
            )}
          </Group>
          {cotizaciones.isLoading && <Loader size="sm" />}
          {cotizaciones.error && <Alert color="red">{cotizaciones.error.message}</Alert>}
          {cotizaciones.data && (
            <Table striped>
              <Table.Tbody>
                {cotizaciones.data.map((c) => (
                  <Table.Tr key={c.id}>
                    <Table.Td>{NOMBRE_COTIZACION[c.tipo] ?? c.tipo}</Table.Td>
                    <Table.Td ta="right">
                      {c.unidad === 'USD/oz' ? formatoUsd(c.valorVenta) : formatoPesos(c.valorVenta)}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Card>
      </SimpleGrid>
    </Stack>
  );
}