import { Link, Navigate, useNavigate } from 'react-router';
import { Alert, Anchor, Button, Center, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { hasLength, isEmail, isNotEmpty, useForm } from '@mantine/form';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import type { RespuestaLogin } from '../lib/tipos';

export function RegistroPage() {
  const { sesion, iniciarSesion } = useAuth();
  const navigate = useNavigate();

  const form = useForm({
    initialValues: { nombre: '', nombreNegocio: '', email: '', password: '', confirmar: '' },
    validate: {
      nombre: isNotEmpty('Ingresá tu nombre'),
      nombreNegocio: isNotEmpty('Ingresá el nombre de tu joyería'),
      email: isEmail('Ingresá un email válido'),
      password: hasLength({ min: 8 }, 'Mínimo 8 caracteres'),
      confirmar: (valor, valores) => (valor !== valores.password ? 'Las contraseñas no coinciden' : null),
    },
  });

  const registro = useMutation({
    mutationFn: (v: typeof form.values) =>
      api<RespuestaLogin>('/auth/register', {
        method: 'POST',
        body: { nombre: v.nombre, nombreNegocio: v.nombreNegocio, email: v.email, password: v.password },
      }),
    onSuccess: (respuesta) => {
      iniciarSesion(respuesta);
      navigate('/', { replace: true });
    },
  });

  if (sesion) return <Navigate to="/" replace />;

  return (
    <Center mih="100vh" p="md" bg="gray.0">
      <Paper withBorder shadow="sm" p="xl" w={420}>
        <form onSubmit={form.onSubmit((valores) => registro.mutate(valores))}>
          <Stack>
            <div>
              <Title order={2} c="oro.8">
                Registrá tu joyería
              </Title>
              <Text c="dimmed" size="sm">
                Vas a quedar como administrador del negocio
              </Text>
            </div>

            {registro.error && <Alert color="red">{registro.error.message}</Alert>}

            <TextInput label="Tu nombre" {...form.getInputProps('nombre')} />
            <TextInput label="Nombre de la joyería" {...form.getInputProps('nombreNegocio')} />
            <TextInput label="Email" autoComplete="email" {...form.getInputProps('email')} />
            <PasswordInput label="Contraseña" autoComplete="new-password" {...form.getInputProps('password')} />
            <PasswordInput label="Repetí la contraseña" autoComplete="new-password" {...form.getInputProps('confirmar')} />
            <Button type="submit" loading={registro.isPending} fullWidth>
              Crear cuenta
            </Button>

            <Text size="sm" ta="center">
              ¿Ya tenés cuenta?{' '}
              <Anchor component={Link} to="/login">
                Ingresá
              </Anchor>
            </Text>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}