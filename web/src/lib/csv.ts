type Celda = string | number | null | undefined;

// Descarga una tabla como CSV que Excel abre bien en español (separador ";" y BOM UTF-8)
export function descargarCsv(nombreArchivo: string, encabezados: string[], filas: Celda[][]) {
  const escapar = (valor: Celda) => {
    if (valor == null) return '';
    const texto = typeof valor === 'number' ? String(valor).replace('.', ',') : valor;
    return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  const contenido = [encabezados, ...filas].map((fila) => fila.map(escapar).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + contenido], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo.endsWith('.csv') ? nombreArchivo : `${nombreArchivo}.csv`;
  enlace.click();
  URL.revokeObjectURL(url);
}

// Los Decimal llegan como texto: a número para el CSV
export const num = (valor: string | number | null | undefined) => (valor == null ? null : Number(valor));
