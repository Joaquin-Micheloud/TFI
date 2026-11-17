import { useState } from 'react';
import { Alert, Button, Modal, NumberInput, Select, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Categoria } from '../../lib/catalogo';

interface Props {
  opened: boolean;
  onClose: () => void;
  categorias: Categoria[];
}

export function AjusteFantasiaModal({ opened, onClose, categorias }: Props) {
  const queryClient = useQueryClient();
  const [porcentaje, setPorcentaje] = useState<number | string>('');
  const [categoriaId, setCategoriaId] = useState<string | null>(null);

  const ajustar = useMutation({
    mutationFn: () =>
      api<{ productosActualizados: number }>('/productos/ajuste-precio-compra', {
        method: 'POST',
        body: { porcentaje: Number(porcentaje), categoriaId: categoriaId ?? undefined },
      }),
    onSuccess: (r) => {
      notifications.show({ color: 'green', message: `${r.productosActualizados} productos actualizados` });
      void queryClient.invalidateQueries({ queryKey: ['productos'] });
      void queryClient.invalidateQueries({ queryKey: ['vender'] });
      setPorcentaje('');
      onClose();
    },
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Ajustar precios de compra de fantasía" centered>
      <Stack>
        <Text size="sm" c="dimmed">
          Cambia el precio de compra de todos los productos de fantasía cargados en pesos. Los que están en dólares
          no se tocan, porque se actualizan solos con el dólar.
        </Text>
        <NumberInput
          label="Porcentaje"
          description="10 sube un 10 %, -5 baja un 5 %"
          suffix=" %"
          min={-90}
          max={500}
          decimalScale={2}
          value={porcentaje}
          onChange={setPorcentaje}
        />
        <Select
          label="Categoría"
          placeholder="Todas"
          clearable
          data={categorias.map((c) => ({ value: c.id, label: c.nombre }))}
          value={categoriaId}
          onChange={setCategoriaId}
        />
        {ajustar.isError && <Alert color="red">{ajustar.error.message}</Alert>}
        <Button disabled={porcentaje === '' || Number(porcentaje) === 0} loading={ajustar.isPending} onClick={() => ajustar.mutate()}>
          Aplicar ajuste
        </Button>
      </Stack>
    </Modal>
  );
}