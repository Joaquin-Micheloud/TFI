import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MedioPago } from '../../generated/prisma/client.js';

// Un ítem es una pieza única (piezaId) o un producto por lote (productoId + cantidad)
export class ItemVentaDto {
  @IsOptional()
  @IsUUID('all')
  piezaId?: string;

  @IsOptional()
  @IsUUID('all')
  productoId?: string;

  // Opcional: elegir un lote puntual en vez de FIFO
  @IsOptional()
  @IsUUID('all')
  loteId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  cantidad?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  descuentoPct?: number;
}

export class PagoDto {
  @IsEnum(MedioPago, {
    message: 'El medio debe ser EFECTIVO_ARS, EFECTIVO_USD, TRANSFERENCIA, DEBITO o CREDITO',
  })
  medio!: MedioPago;

  // En pesos, salvo EFECTIVO_USD que va en dólares
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(36)
  cuotas?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referencia?: string;
}

export class CotizarVentaDto {
  @IsUUID('all')
  tiendaId!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'La venta tiene que tener al menos un ítem' })
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ItemVentaDto)
  items!: ItemVentaDto[];

  // Descuento sobre el total, después de los descuentos por ítem
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  descuentoPct?: number;
}

export class CrearVentaDto extends CotizarVentaDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Registrá al menos un pago' })
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PagoDto)
  pagos!: PagoDto[];
}