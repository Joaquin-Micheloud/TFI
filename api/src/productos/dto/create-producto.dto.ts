import {
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
} from 'class-validator';
import {
  ElaboracionPor,
  Metal,
  ModoStock,
  Moneda,
  TipoProducto,
} from '../../generated/prisma/client.js';

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

  @IsOptional()
  @IsEnum(Metal)
  metal?: Metal;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(1)
  ley?: number;

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