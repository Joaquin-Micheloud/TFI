import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class CreateClienteDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(120)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefono?: string | null;

  @IsOptional()
  @IsEmail({}, { message: 'El email no es válido' })
  email?: string | null;

  // Acepta "30123456" o "30.123.456"
  @IsOptional()
  @Matches(/^[\d.\s-]{7,12}$/, { message: 'El DNI tiene que tener entre 7 y 8 números' })
  dni?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string | null;
}

export class UpdateClienteDto extends PartialType(CreateClienteDto) {}

export class QueryClientesDto {
  @IsOptional()
  @IsString()
  buscar?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  porPagina: number = 20;
}