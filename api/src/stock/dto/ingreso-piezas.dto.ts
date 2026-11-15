import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class PiezaIngresoDto {
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'El peso admite hasta 3 decimales' })
  @Min(0.001)
  pesoGramos!: number;

  // Obligatorio en reventa: lo que se le pagó al proveedor, en pesos
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  precioCompra?: number;

  // Si no se envía, se genera: CODIGO-PRODUCTO-0001
  @IsOptional()
  @IsString()
  @MaxLength(50)
  codigo?: string;
}

export class IngresoPiezasDto {
  @IsUUID('all')
  productoId!: string;

  @IsUUID('all')
  tiendaId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PiezaIngresoDto)
  piezas!: PiezaIngresoDto[];
}