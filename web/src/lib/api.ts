const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const CLAVE_TOKEN = 'quilatear.token';

export const EVENTO_SESION_EXPIRADA = 'quilatear:sesion-expirada';

export const tokenStorage = {
  get: () => localStorage.getItem(CLAVE_TOKEN),
  set: (token: string) => localStorage.setItem(CLAVE_TOKEN, token),
  clear: () => localStorage.removeItem(CLAVE_TOKEN),
};

// Error con el código HTTP y el mensaje que mandó el backend
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, mensaje: string) {
    super(mensaje);
    this.status = status;
  }
}

interface Opciones {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
}

// Todas las llamadas a la API pasan por acá: agrega el token y traduce los errores
export async function api<T>(ruta: string, opciones: Opciones = {}): Promise<T> {
  const token = tokenStorage.get();
  const headers: Record<string, string> = {};
  if (opciones.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const respuesta = await fetch(`${API_URL}${ruta}`, {
    method: opciones.method ?? 'GET',
    headers,
    body: opciones.body !== undefined ? JSON.stringify(opciones.body) : undefined,
  });

  // Token vencido o desactivado: avisamos para cerrar la sesión
  if (respuesta.status === 401 && token) {
    window.dispatchEvent(new Event(EVENTO_SESION_EXPIRADA));
  }

  if (!respuesta.ok) {
    let mensaje = `Error ${respuesta.status}`;
    try {
      const data = await respuesta.json();
      // Los errores de validación de Nest vienen como lista
      mensaje = Array.isArray(data.message) ? data.message.join('\n') : (data.message ?? mensaje);
    } catch {
      // la respuesta no tenía cuerpo JSON
    }
    throw new ApiError(respuesta.status, mensaje);
  }

  if (respuesta.status === 204) return undefined as T;
  return respuesta.json() as Promise<T>;
}

// Descarga un archivo protegido (por ejemplo el PDF del ticket)
export async function apiArchivo(ruta: string): Promise<Blob> {
  const token = tokenStorage.get();
  const respuesta = await fetch(`${API_URL}${ruta}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!respuesta.ok) throw new ApiError(respuesta.status, `No se pudo descargar (error ${respuesta.status})`);
  return respuesta.blob();
}