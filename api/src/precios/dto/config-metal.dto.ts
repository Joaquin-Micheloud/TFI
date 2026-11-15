import { IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { ModoPrecioMetal } from '../../generated/prisma/client.js';

export class ConfigMetalDto {
  @IsEnum(ModoPrecioMetal, { message: 'El modo debe ser AUTOMATICO, AJUSTE o MANUAL' })
  modo!: ModoPrecioMetal;

  // Porcentaje: 10 = +10 %, -5 = -5 %. Solo se usa en modo AJUSTE.
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-50)
  @Max(200)
  ajustePct?: number;
}