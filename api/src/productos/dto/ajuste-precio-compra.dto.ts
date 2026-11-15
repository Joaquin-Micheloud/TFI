import { IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class AjustePrecioCompraDto {
  // 10 = +10 %, -5 = -5 %
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-90)
  @Max(500)
  porcentaje!: number;

  // Si se envía, solo ajusta esa categoría
  @IsOptional()
  @IsUUID('all')
  categoriaId?: string;
}