import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { Center, Loader } from '@mantine/core';
import { useAuth } from './AuthContext';
import type { Rol } from '../lib/tipos';

// Protege una ruta: exige sesión y, opcionalmente, ciertos roles
export function RequireAuth({ roles, children }: { roles?: Rol[]; children: ReactNode }) {
  const { sesion, cargando } = useAuth();
  const location = useLocation();

  if (cargando) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }
  if (!sesion) return <Navigate to="/login" replace state={{ desde: location.pathname }} />;
  if (roles && !roles.includes(sesion.rol)) return <Navigate to="/" replace />;
  return children;
}