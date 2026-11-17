import { Stack, Text, Title } from '@mantine/core';

export function ProximamentePage({ titulo }: { titulo: string }) {
  return (
    <Stack>
      <Title order={2}>{titulo}</Title>
      <Text c="dimmed">Esta pantalla la armamos en los próximos pasos.</Text>
    </Stack>
  );
}