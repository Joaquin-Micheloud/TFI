import { useNavigate, useSearchParams } from 'react-router';
import {
  Alert,
  Button,
  Center,
  Loader,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { hasLength, useForm } from '@mantine/form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import { formatoFechaHora } from '../lib/formato';
import { NOMBRE_ROL, type RespuestaLogin, type Rol } from '../lib/tipos';

interface DatosInvitacion {
  email: string;
  rol: Rol;
  negocio: string;
  invitadoPor: string;
  venceEn: string;
  tieneCuenta: boolean;
}

// Página a la que lleva el link del email: /invitacion?token=...
export function InvitacionPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { iniciarSesion } = useAuth();
  const navigate = useNavigate();

  const invitacion = useQuery({
    queryKey: ['invitacion', token],
    queryFn: () => api<DatosInvitacion>(`/invitaciones/token/${token}`),
    enabled: token.length === 64,
    retry: false,
  });

  const tieneCuenta = invitacion.data?.tieneCuenta ?? false;

  const form = useForm({
    initialValues: { nombre: '', password: '', confirmar: '' },
    validate: {
      nombre: (v) => (!tieneCuenta && !v.trim() ? 'Ingresá tu nombre' : null),
      password: hasLength({ min: 8 }, 'Mínimo 8 caracteres'),
      confirmar: (v, valores) => (!tieneCuenta && v !== valores.password ? 'Las contraseñas no coinciden' : null),
    },
  });

  const aceptar = useMutation({
    mutationFn: (v: typeof form.values) =>
      api<RespuestaLogin>('/invitaciones/aceptar', {
        method: 'POST',
        body: { token, password: v.password, nombre: tieneCuenta ? undefined : v.nombre },
      }),
    onSuccess: (respuesta) => {
      iniciarSesion(respuesta);
      navigate('/', { replace: true });
    },
  });

  return (
    <Center mih="100vh" p="md" bg="gray.0">
      <Paper withBorder shadow="sm" p="xl" w={420}>
        {token.length !== 64 || invitacion.isError ? (
          <Alert color="red" title="Invitación no válida">
            El link no es válido, ya se usó o venció. Pedile a quien te invitó que te la reenvíe.
          </Alert>
        ) : invitacion.isLoading || !invitacion.data ? (
          <Center>
            <Loader />
          </Center>
        ) : (
          <form onSubmit={form.onSubmit((valores) => aceptar.mutate(valores))}>
            <Stack>
              <div>
                <Title order={3}>Te invitaron a {invitacion.data.negocio}</Title>
                <Text c="dimmed" size="sm">
                  {invitacion.data.invitadoPor} te invitó como{' '}
                  <b>{NOMBRE_ROL[invitacion.data.rol].toLowerCase()}</b>. La invitación vence el{' '}
                  {formatoFechaHora(invitacion.data.venceEn)}.
                </Text>
              </div>

              {aceptar.error && <Alert color="red">{aceptar.error.message}</Alert>}

              <TextInput label="Email" value={invitacion.data.email} disabled />

              {tieneCuenta ? (
                <>
                  <Text size="sm">Ya tenés una cuenta en QuilateAr. Confirmá con tu contraseña.</Text>
                  <PasswordInput label="Tu contraseña" {...form.getInputProps('password')} />
                </>
              ) : (
                <>
                  <TextInput label="Tu nombre" {...form.getInputProps('nombre')} />
                  <PasswordInput label="Elegí una contraseña" {...form.getInputProps('password')} />
                  <PasswordInput label="Repetí la contraseña" {...form.getInputProps('confirmar')} />
                </>
              )}

              <Button type="submit" loading={aceptar.isPending} fullWidth>
                Aceptar invitación
              </Button>
            </Stack>
          </form>
        )}
      </Paper>
    </Center>
  );
}