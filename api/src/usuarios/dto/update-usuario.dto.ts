import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Rol } from '../../generated/prisma/client.js';

// El email y la contraseña no se editan desde acá: son datos de la cuenta, no del puesto
export class UpdateUsuarioDto {
  @IsOptional()
  @IsEnum(Rol, { message: 'El rol debe ser ADMIN, GERENTE o VENDEDOR' })
  rol?: Rol;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  topeDescuento?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  // Si se envía, reemplaza por completo las tiendas asignadas
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  tiendaIds?: string[];
}