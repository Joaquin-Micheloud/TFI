import { useState } from 'react';
import { Button, Drawer, Group, Stack, Tabs, Title } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useAuth } from '../../auth/AuthContext';
import { FormularioIngreso } from './FormularioIngreso';
import { LotesTab } from './LotesTab';
import { MovimientosTab } from './MovimientosTab';
import { PiezasTab } from './PiezasTab';
import { ResumenTab } from './ResumenTab';

export function StockPage() {
  const { sesion } = useAuth();
  const puedeEditar = sesion?.rol === 'ADMIN' || sesion?.rol === 'GERENTE';
  const [ingresoAbierto, setIngresoAbierto] = useState(false);

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Stock</Title>
        {puedeEditar && (
          <Button leftSection={<IconPlus size={16} />} onClick={() => setIngresoAbierto(true)}>
            Ingresar mercadería
          </Button>
        )}
      </Group>

      <Tabs defaultValue="resumen" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="resumen">Resumen</Tabs.Tab>
          <Tabs.Tab value="piezas">Piezas únicas</Tabs.Tab>
          <Tabs.Tab value="lotes">Lotes</Tabs.Tab>
          {puedeEditar && <Tabs.Tab value="movimientos">Movimientos</Tabs.Tab>}
        </Tabs.List>

        <Tabs.Panel value="resumen" pt="md">
          <ResumenTab />
        </Tabs.Panel>
        <Tabs.Panel value="piezas" pt="md">
          <PiezasTab puedeEditar={puedeEditar} />
        </Tabs.Panel>
        <Tabs.Panel value="lotes" pt="md">
          <LotesTab puedeEditar={puedeEditar} />
        </Tabs.Panel>
        {puedeEditar && (
          <Tabs.Panel value="movimientos" pt="md">
            <MovimientosTab />
          </Tabs.Panel>
        )}
      </Tabs>

      <Drawer
        opened={ingresoAbierto}
        onClose={() => setIngresoAbierto(false)}
        position="right"
        size="lg"
        title="Ingresar mercadería"
      >
        {ingresoAbierto && <FormularioIngreso onListo={() => setIngresoAbierto(false)} />}
      </Drawer>
    </Stack>
  );
}