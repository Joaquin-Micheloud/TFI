import {
  IconBuildingStore,
  IconCashRegister,
  IconCoin,
  IconDiamond,
  IconHome,
  IconPackage,
  IconReceipt,
  IconSettings,
  IconUsers,
  type Icon,
} from '@tabler/icons-react';
import type { Rol } from '../lib/tipos';

export interface ItemMenu {
  etiqueta: string;
  ruta: string;
  icono: Icon;
  roles?: Rol[]; // sin roles = lo ven todos
}

// Sigue la tabla de permisos de la sección 4 del documento
export const MENU: ItemMenu[] = [
  { etiqueta: 'Inicio', ruta: '/', icono: IconHome },
  { etiqueta: 'Vender', ruta: '/vender', icono: IconCashRegister },
  { etiqueta: 'Ventas', ruta: '/ventas', icono: IconReceipt },
  { etiqueta: 'Productos', ruta: '/productos', icono: IconDiamond },
  { etiqueta: 'Stock', ruta: '/stock', icono: IconPackage },
  { etiqueta: 'Precios', ruta: '/precios', icono: IconCoin, roles: ['ADMIN'] },
  { etiqueta: 'Equipo', ruta: '/equipo', icono: IconUsers, roles: ['ADMIN', 'GERENTE'] },
  { etiqueta: 'Tiendas', ruta: '/tiendas', icono: IconBuildingStore, roles: ['ADMIN'] },
  { etiqueta: 'Negocio', ruta: '/negocio', icono: IconSettings, roles: ['ADMIN'] },
];