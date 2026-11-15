import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Rol } from '../../generated/prisma/client.js';

export class CreateUsuarioDto {
  @IsEmail({}, { message: 'El email no es válido' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  nombre!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña temporal debe tener al menos 8 caracteres' })
  @MaxLength(72)
  password!: string;

  @IsEnum(Rol, { message: 'El rol debe ser ADMIN, GERENTE o VENDEDOR' })
  rol!: Rol;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El tope de descuento debe ser un número' })
  @Min(0)
  @Max(100)
  topeDescuento?: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true, message: 'Cada tienda debe ser un id válido' })
  tiendaIds?: string[];
}