import { useState } from 'react';
import { Button, Group, Stack, Tabs, Text, Title } from '@mantine/core';
import { IconUserPlus } from '@tabler/icons-react';
import { useAuth } from '../../auth/AuthContext';
import { InvitacionesTab } from './InvitacionesTab';
import { InvitarModal } from './InvitarModal';
import { UsuariosTab } from './UsuariosTab';

export function EquipoPage() {
  const { sesion } = useAuth();
  const esAdmin = sesion?.rol === 'ADMIN';
  const [invitarAbierto, setInvitarAbierto] = useState(false);

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Equipo</Title>
        <Button leftSection={<IconUserPlus size={16} />} onClick={() => setInvitarAbierto(true)}>
          Invitar
        </Button>
      </Group>

      {!esAdmin && (
        <Text size="sm" c="dimmed">
          Como gerente, ves y gestionás a los vendedores de tus tiendas, y solo podés invitar vendedores.
        </Text>
      )}

      <Tabs defaultValue="usuarios" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="usuarios">Usuarios</Tabs.Tab>
          <Tabs.Tab value="invitaciones">Invitaciones</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="usuarios" pt="md">
          <UsuariosTab esAdmin={esAdmin} />
        </Tabs.Panel>
        <Tabs.Panel value="invitaciones" pt="md">
          <InvitacionesTab />
        </Tabs.Panel>
      </Tabs>

      <InvitarModal opened={invitarAbierto} onClose={() => setInvitarAbierto(false)} esAdmin={esAdmin} />
    </Stack>
  );
}