import { Navigate, Route, Routes } from 'react-router';
import { RequireAuth } from './auth/RequireAuth';
import { AppLayout } from './layout/AppLayout';
import { InicioPage } from './pages/InicioPage';
import { InvitacionPage } from './pages/InvitacionPage';
import { LoginPage } from './pages/LoginPage';
import { ProximamentePage } from './pages/ProximamentePage';
import { RegistroPage } from './pages/RegistroPage';
import { VenderPage } from './pages/vender/VenderPage';

export default function App() {
  return (
    <Routes>
      {/* Públicas */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<RegistroPage />} />
      <Route path="/invitacion" element={<InvitacionPage />} />

      {/* Con sesión: todas comparten el layout con menú */}
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<InicioPage />} />
        <Route path="vender" element={<VenderPage />} />
        <Route path="ventas" element={<ProximamentePage titulo="Ventas" />} />
        <Route path="productos" element={<ProximamentePage titulo="Productos" />} />
        <Route path="stock" element={<ProximamentePage titulo="Stock" />} />
        <Route
          path="precios"
          element={
            <RequireAuth roles={['ADMIN']}>
              <ProximamentePage titulo="Precios del gramo" />
            </RequireAuth>
          }
        />
        <Route
          path="equipo"
          element={
            <RequireAuth roles={['ADMIN', 'GERENTE']}>
              <ProximamentePage titulo="Equipo" />
            </RequireAuth>
          }
        />
        <Route
          path="tiendas"
          element={
            <RequireAuth roles={['ADMIN']}>
              <ProximamentePage titulo="Tiendas" />
            </RequireAuth>
          }
        />
        <Route
          path="negocio"
          element={
            <RequireAuth roles={['ADMIN']}>
              <ProximamentePage titulo="Datos del negocio" />
            </RequireAuth>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}