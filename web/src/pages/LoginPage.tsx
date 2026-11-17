import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { Alert, Anchor, Button, Center, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { isEmail, isNotEmpty, useForm } from '@mantine/form';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import type { RespuestaLogin } from '../lib/tipos';

export function LoginPage() {
  const { sesion, iniciarSesion } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const destino = (location.state as { desde?: string } | null)?.desde ?? '/';

  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: isEmail('Ingresá un email válido'),
      password: isNotEmpty('Ingresá tu contraseña'),
    },
  });

  const login = useMutation({
    mutationFn: (valores: typeof form.values) =>
      api<RespuestaLogin>('/auth/login', { method: 'POST', body: valores }),
    onSuccess: (respuesta) => {
      iniciarSesion(respuesta);
      navigate(destino, { replace: true });
    },
  });

  if (sesion) return <Navigate to="/" replace />;

  return (
    <Center mih="100vh" p="md" bg="gray.0">
      <Paper withBorder shadow="sm" p="xl" w={380}>
        <form onSubmit={form.onSubmit((valores) => login.mutate(valores))}>
          <Stack>
            <div>
              <Title order={2} c="oro.8">
                QuilateAr
              </Title>
              <Text c="dimmed" size="sm">
                Ingresá a tu cuenta
              </Text>
            </div>

            {login.error && <Alert color="red">{login.error.message}</Alert>}

            <TextInput label="Email" autoComplete="email" {...form.getInputProps('email')} />
            <PasswordInput label="Contraseña" autoComplete="current-password" {...form.getInputProps('password')} />
            <Button type="submit" loading={login.isPending} fullWidth>
              Ingresar
            </Button>

            <Text size="sm" ta="center">
              ¿Tenés una joyería y todavía no usás QuilateAr?{' '}
              <Anchor component={Link} to="/registro">
                Registrate
              </Anchor>
            </Text>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}