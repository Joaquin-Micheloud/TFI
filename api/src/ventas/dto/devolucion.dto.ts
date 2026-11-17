import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { DestinoDevolucion, MedioPago } from '../../generated/prisma/client.js';

export class AnularVentaDto {
  @IsString()
  @IsNotEmpty({ message: 'El motivo es obligatorio' })
  @MaxLength(300)
  motivo!: string;
}

export class ItemDevolucionDto {
  @IsUUID('all')
  ventaItemId!: string;

  @IsInt()
  @Min(1)
  cantidad!: number;

  @IsEnum(DestinoDevolucion, { message: 'El destino debe ser STOCK o BAJA' })
  destino!: DestinoDevolucion;
}

export class DevolucionDto {
  @IsString()
  @IsNotEmpty({ message: 'El motivo es obligatorio' })
  @MaxLength(300)
  motivo!: string;

  @IsEnum(MedioPago)
  medioReintegro!: MedioPago;

  @IsArray()
  @ArrayMinSize(1, { message: 'Elegí al menos un ítem para devolver' })
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ItemDevolucionDto)
  items!: ItemDevolucionDto[];
}