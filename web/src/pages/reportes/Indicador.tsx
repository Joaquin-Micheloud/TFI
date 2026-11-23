import { Card, Text } from '@mantine/core';

// Tarjeta con un número destacado
export function Indicador({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <Card withBorder p="sm">
      <Text size="xs" c="dimmed">
        {titulo}
      </Text>
      <Text fw={700} size="lg">
        {valor}
      </Text>
      {detalle && (
        <Text size="xs" c="dimmed">
          {detalle}
        </Text>
      )}
    </Card>
  );
}
