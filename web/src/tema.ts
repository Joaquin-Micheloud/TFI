import { createTheme, type MantineColorsTuple } from '@mantine/core';

// Escala de dorados: del más claro al más oscuro
const oro: MantineColorsTuple = [
  '#fff9e1',
  '#fff1cc',
  '#ffe19b',
  '#ffd064',
  '#ffc238',
  '#ffb91b',
  '#ffb509',
  '#e39f00',
  '#ca8d00',
  '#af7800',
];

export const tema = createTheme({
  primaryColor: 'oro',
  colors: { oro },
  autoContrast: true, // texto oscuro sobre botones dorados, para que se lea bien
  defaultRadius: 'md',
});