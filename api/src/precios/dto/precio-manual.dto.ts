import { IsEnum, IsNumber, Max, Min } from 'class-validator';
import { Metal } from '../../generated/prisma/client.js';

export class PrecioManualDto {
  @IsEnum(Metal)
  metal!: Metal;

  // Pureza: 1 = 24k, 0.750 = 18k, 0.925 = plata 925
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'La ley admite hasta 3 decimales (ej. 0.750)' })
  @Min(0.001)
  @Max(1)
  ley!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  precioArs!: number;
}