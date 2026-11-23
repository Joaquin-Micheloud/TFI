import { Stack, Tabs, Title } from '@mantine/core';
import { useAuth } from '../../auth/AuthContext';
import { CajaTab } from './CajaTab';
import { ComposturasTab } from './ComposturasTab';
import { ValorizacionTab } from './ValorizacionTab';
import { VentasTab } from './VentasTab';

export function ReportesPage() {
  const { sesion } = useAuth();
  const gestiona = sesion?.rol === 'ADMIN' || sesion?.rol === 'GERENTE';

  return (
    <Stack>
      <Title order={2}>Reportes</Title>

      <Tabs defaultValue={gestiona ? 'valorizacion' : 'caja'} keepMounted={false}>
        <Tabs.List>
          {gestiona && <Tabs.Tab value="valorizacion">Valorización del inventario</Tabs.Tab>}
          {gestiona && <Tabs.Tab value="ventas">Ventas</Tabs.Tab>}
          <Tabs.Tab value="caja">Caja del día</Tabs.Tab>
          {gestiona && <Tabs.Tab value="composturas">Composturas</Tabs.Tab>}
        </Tabs.List>

        {gestiona && (
          <Tabs.Panel value="valorizacion" pt="md">
            <ValorizacionTab />
          </Tabs.Panel>
        )}
        {gestiona && (
          <Tabs.Panel value="ventas" pt="md">
            <VentasTab />
          </Tabs.Panel>
        )}
        <Tabs.Panel value="caja" pt="md">
          <CajaTab />
        </Tabs.Panel>
        {gestiona && (
          <Tabs.Panel value="composturas" pt="md">
            <ComposturasTab />
          </Tabs.Panel>
        )}
      </Tabs>
    </Stack>
  );
}
