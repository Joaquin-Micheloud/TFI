import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { MotivoBaja } from '../../generated/prisma/client.js';

export class BajaPiezaDto {
  @IsEnum(MotivoBaja, { message: 'El motivo debe ser ROTURA, PERDIDA, FUNDICION u OTRO' })
  motivo!: MotivoBaja;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  detalle?: string;
}

export class BajaLoteDto extends BajaPiezaDto {
  @IsInt()
  @Min(1)
  cantidad!: number;
}