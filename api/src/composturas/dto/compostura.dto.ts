import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { EstadoCompostura, MedioPago, Metal } from '../../generated/prisma/client.js';
import { PagoDto } from '../../ventas/dto/crear-venta.dto.js';

// Precio = mano de obra + peso agregado × gramo × (1 + margen) (sección 6 del documento)
export class CotizarComposturaDto {
  @IsOptional()
  @IsEnum(Metal)
  metal?: Metal;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(1)
  ley?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  manoObra!: number;

  // Metal que pone la joyería (0 si el cliente aporta el material)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  pesoAgregado?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000)
  margenPct?: number;
}

export class CrearComposturaDto {
  @IsUUID('all')
  tiendaId!: string;

  @IsUUID('all', { message: 'Elegí el cliente: es obligatorio en una compostura' })
  clienteId!: string;

  @IsString()
  @IsNotEmpty({ message: 'Describí el trabajo' })
  @MaxLength(500)
  descripcion!: string;

  @IsOptional()
  @IsEnum(Metal)
  metal?: Metal;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(1)
  ley?: number;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  pesoEntrada!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  pesoAportado?: number;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha estimada no es válida' })
  fechaEstimada?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observaciones?: string;

  // Presupuesto (opcional al recibir: si viene, la orden queda PRESUPUESTADA)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  manoObra?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  pesoAgregado?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000)
  margenPct?: number;

  // Seña opcional, en pesos
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  sena?: number;

  @IsOptional()
  @IsEnum(MedioPago)
  medioSena?: MedioPago;
}

export class PresupuestoDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  manoObra!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  pesoAgregado?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000)
  margenPct?: number;
}

// La entrega tiene su propio endpoint; desde acá se avanza o se cancela
export class CambiarEstadoDto {
  @IsIn([EstadoCompostura.EN_TALLER, EstadoCompostura.LISTA, EstadoCompostura.CANCELADA], {
    message: 'El estado tiene que ser EN_TALLER, LISTA o CANCELADA',
  })
  estado!: EstadoCompostura;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  nota?: string;
}

export class EntregarComposturaDto {
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  pesoSalida!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  manoObra!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  pesoAgregado?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000)
  margenPct?: number;

  // Pagos del saldo (precio final menos la seña). Puede ir vacío si no queda saldo.
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PagoDto)
  pagos!: PagoDto[];
}

export class QueryComposturasDto {
  @IsOptional()
  @IsEnum(EstadoCompostura)
  estado?: EstadoCompostura;

  @IsOptional()
  @IsUUID('all')
  tiendaId?: string;

  @IsOptional()
  @IsUUID('all')
  clienteId?: string;

  @IsOptional()
  @IsString()
  buscar?: string;

  // "true": solo las que no se entregaron ni se cancelaron
  @IsOptional()
  @IsIn(['true', 'false'])
  abiertas?: string;

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
