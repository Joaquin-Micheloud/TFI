import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { TipoCotizacion } from '../../generated/prisma/client.js';

export class HistorialDto {
  @IsEnum(TipoCotizacion)
  tipo!: TipoCotizacion;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  dias: number = 7;
}