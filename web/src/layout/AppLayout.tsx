import { Link, Outlet, useLocation } from 'react-router';
import {
  AppShell,
  Avatar,
  Badge,
  Burger,
  Group,
  Menu,
  NavLink,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconLogout } from '@tabler/icons-react';
import { useAuth } from '../auth/AuthContext';
import { NOMBRE_ROL } from '../lib/tipos';
import { MENU } from './menu';

export function AppLayout() {
  const { sesion, cerrarSesion } = useAuth();
  const [menuAbierto, { toggle, close }] = useDisclosure();
  const location = useLocation();

  if (!sesion) return null; // RequireAuth ya garantiza la sesión

  const items = MENU.filter((item) => !item.roles || item.roles.includes(sesion.rol));
  const nombre = sesion.usuario.nombre ?? sesion.usuario.email;
  const iniciales = nombre.slice(0, 2).toUpperCase();

  const estaActivo = (ruta: string) =>
    ruta === '/' ? location.pathname === '/' : location.pathname.startsWith(ruta);

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 230, breakpoint: 'sm', collapsed: { mobile: !menuAbierto } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger opened={menuAbierto} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Title order={3} c="oro.8">
              QuilateAr
            </Title>
            <Text c="dimmed" size="sm" visibleFrom="xs">
              {sesion.negocio.nombre}
            </Text>
          </Group>

          <Menu position="bottom-end" withArrow>
            <Menu.Target>
              <UnstyledButton>
                <Group gap="xs">
                  <Avatar color="oro" radius="xl" size="md">
                    {iniciales}
                  </Avatar>
                  <div>
                    <Text size="sm" fw={500} visibleFrom="sm">
                      {nombre}
                    </Text>
                    <Badge size="xs" variant="light" visibleFrom="sm">
                      {NOMBRE_ROL[sesion.rol]}
                    </Badge>
                  </div>
                </Group>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>{sesion.usuario.email}</Menu.Label>
              <Menu.Item color="red" leftSection={<IconLogout size={16} />} onClick={cerrarSesion}>
                Cerrar sesión
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        {items.map((item) => (
          <NavLink
            key={item.ruta}
            component={Link}
            to={item.ruta}
            label={item.etiqueta}
            leftSection={<item.icono size={18} stroke={1.6} />}
            active={estaActivo(item.ruta)}
            onClick={close}
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}