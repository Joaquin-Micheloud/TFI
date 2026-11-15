import { IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { TipoDolar } from '../../generated/prisma/client.js';

export class UpdateNegocioDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre?: string;

  @IsOptional()
  @Matches(/^\d{2}-?\d{8}-?\d$/, { message: 'El CUIT debe tener el formato 20-12345678-9' })
  cuit?: string;

  @IsOptional()
  @IsEnum(TipoDolar)
  tipoDolar?: TipoDolar;

  // El precio final se redondea al múltiplo más cercano de este valor
  @IsOptional()
  @IsIn([1, 10, 50, 100, 500, 1000], { message: 'El redondeo debe ser 1, 10, 50, 100, 500 o 1000' })
  reglaRedondeo?: number;
}