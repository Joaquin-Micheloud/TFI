import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  ElaboracionPor,
  Metal,
  ModoStock,
  Moneda,
  TipoProducto,
} from '../../generated/prisma/client.js';

// Un metal de la pieza con su porcentaje del peso total
export class ComponenteMetalDto {
  @IsEnum(Metal)
  metal!: Metal;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(1)
  ley!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  porcentaje!: number;
}

export class CreateProductoDto {
  @IsString()
  @IsNotEmpty({ message: 'El código es obligatorio' })
  @MaxLength(50)
  codigo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  codigoBarras?: string | null;

  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(150)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descripcion?: string;

  @IsEnum(TipoProducto, { message: 'El tipo debe ser REVENTA, FANTASIA o ELABORACION' })
  tipo!: TipoProducto;

  @IsOptional()
  @IsUUID('all')
  categoriaId?: string | null;

  // Por defecto UNICO. Para FANTASIA siempre es LOTE.
  @IsOptional()
  @IsEnum(ModoStock)
  modoStock?: ModoStock;

  // Forma simple (un solo metal): equivale a un componente al 100 %
  @IsOptional()
  @IsEnum(Metal)
  metal?: Metal;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(1)
  ley?: number;

  // Pieza combinada: varios metales cuyos porcentajes suman 100 %
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ComponenteMetalDto)
  componentes?: ComponenteMetalDto[];

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  pesoGramos?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000)
  margenPct?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  precioCompra?: number;

  @IsOptional()
  @IsEnum(Moneda)
  monedaCompra?: Moneda;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  elaboracionUsd?: number;

  @IsOptional()
  @IsEnum(ElaboracionPor)
  elaboracionPor?: ElaboracionPor;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  insumosArs?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockMinimo?: number | null;

  @IsOptional()
  @IsUrl()
  fotoUrl?: string | null;
}