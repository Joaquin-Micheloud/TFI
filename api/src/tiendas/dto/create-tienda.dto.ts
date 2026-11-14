import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTiendaDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la tienda es obligatorio' })
  @MaxLength(100)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  direccion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  localidad?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  provincia?: string;
}