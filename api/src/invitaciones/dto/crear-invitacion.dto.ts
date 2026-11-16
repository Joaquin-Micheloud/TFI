import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Rol } from '../../generated/prisma/client.js';

export class CrearInvitacionDto {
  @IsEmail({}, { message: 'El email no es válido' })
  email!: string;

  @IsEnum(Rol, { message: 'El rol debe ser ADMIN, GERENTE o VENDEDOR' })
  rol!: Rol;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  topeDescuento?: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  tiendaIds?: string[];
}