import { Navigate, Route, Routes } from 'react-router';
import { RequireAuth } from './auth/RequireAuth';
import { AppLayout } from './layout/AppLayout';
import { InicioPage } from './pages/InicioPage';
import { InvitacionPage } from './pages/InvitacionPage';
import { LoginPage } from './pages/LoginPage';
import { RegistroPage } from './pages/RegistroPage';
import { EquipoPage } from './pages/equipo/EquipoPage';
import { NegocioPage } from './pages/negocio/NegocioPage';
import { PreciosPage } from './pages/precios/PreciosPage';
import { ProductosPage } from './pages/productos/ProductosPage';
import { StockPage } from './pages/stock/StockPage';
import { TiendasPage } from './pages/tiendas/TiendasPage';
import { VenderPage } from './pages/vender/VenderPage';
import { VentasPage } from './pages/ventas/VentasPage';

export default function App() {
  return (
    <Routes>
      {/* ---------- Públicas ---------- */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<RegistroPage />} />
      <Route path="/invitacion" element={<InvitacionPage />} />

      {/* ---------- Con sesión: todas adentro del layout ---------- */}
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<InicioPage />} />
        <Route path="vender" element={<VenderPage />} />
        <Route path="ventas" element={<VentasPage />} />
        <Route path="productos" element={<ProductosPage />} />
        <Route path="stock" element={<StockPage />} />
        <Route
          path="precios"
          element={
            <RequireAuth roles={['ADMIN']}>
              <PreciosPage />
            </RequireAuth>
          }
        />
        <Route
          path="equipo"
          element={
            <RequireAuth roles={['ADMIN', 'GERENTE']}>
              <EquipoPage />
            </RequireAuth>
          }
        />
        <Route
          path="tiendas"
          element={
            <RequireAuth roles={['ADMIN']}>
              <TiendasPage />
            </RequireAuth>
          }
        />
        <Route
          path="negocio"
          element={
            <RequireAuth roles={['ADMIN']}>
              <NegocioPage />
            </RequireAuth>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}