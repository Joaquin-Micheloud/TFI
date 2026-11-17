export interface Cliente {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  dni: string | null;
  notas: string | null;
  actualizadoEn: string;
  _count?: { ventas: number };
}

export interface FichaCliente extends Cliente {
  resumen: { compras: number; totalComprado: string; ultimaCompra: string | null };
}

// "Juana Pérez · DNI 30123456"
export const etiquetaCliente = (c: Cliente) =>
  [c.nombre, c.dni ? `DNI ${c.dni}` : null, c.telefono].filter(Boolean).join(' · ');