import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { api, EVENTO_SESION_EXPIRADA, tokenStorage } from '../lib/api';
import type { RespuestaLogin, RespuestaMe, Sesion } from '../lib/tipos';

interface AuthContextValue {
  sesion: Sesion | null;
  cargando: boolean;
  actualizarSesion: (cambios: Partial<Sesion>) => void;
  iniciarSesion: (respuesta: RespuestaLogin) => void;
  cerrarSesion: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [sesion, setSesion] = useState<Sesion | null>(null);
  // Si hay un token guardado, primero hay que validarlo con /auth/me
  const [cargando, setCargando] = useState(() => tokenStorage.get() !== null);

  const cerrarSesion = useCallback(() => {
    tokenStorage.clear();
    setSesion(null);
    queryClient.clear(); // borra los datos en caché del usuario anterior
  }, [queryClient]);

  const iniciarSesion = useCallback((respuesta: RespuestaLogin) => {
    tokenStorage.set(respuesta.accessToken);
    setSesion({ usuario: respuesta.usuario, negocio: respuesta.negocio, rol: respuesta.rol });
  }, []);

  const actualizarSesion = useCallback((cambios: Partial<Sesion>) => {
    setSesion((actual) => (actual ? { ...actual, ...cambios } : actual));
  }, []);

  // Al abrir la app: si hay token, recuperamos la sesión
  useEffect(() => {
    if (!tokenStorage.get()) return;
    api<RespuestaMe>('/auth/me')
      .then((me) => setSesion({ usuario: me.usuario, negocio: me.negocio, rol: me.rol, tiendas: me.tiendas }))
      .catch(() => cerrarSesion())
      .finally(() => setCargando(false));
  }, [cerrarSesion]);

  // Si cualquier pedido devuelve 401, se cierra la sesión
  useEffect(() => {
    const alExpirar = () => {
      cerrarSesion();
      notifications.show({ color: 'orange', message: 'Tu sesión venció. Volvé a ingresar.' });
    };
    window.addEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
    return () => window.removeEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
  }, [cerrarSesion]);

  return (
    <AuthContext.Provider value={{ sesion, cargando, iniciarSesion, cerrarSesion, actualizarSesion }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth tiene que usarse dentro de <AuthProvider>');
  return contexto;
}