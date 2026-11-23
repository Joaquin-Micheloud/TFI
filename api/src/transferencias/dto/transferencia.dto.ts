import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { EstadoTransferencia } from '../../generated/prisma/client.js';

// Una pieza única, o una cantidad de un lote
export class ItemTransferenciaDto {
  @IsOptional()
  @IsUUID('all')
  piezaId?: string;

  @IsOptional()
  @IsUUID('all')
  loteId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  cantidad?: number;
}

export class CrearTransferenciaDto {
  @IsUUID('all')
  origenId!: string;

  @IsUUID('all')
  destinoId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  nota?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Agregá al menos una pieza o lote' })
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ItemTransferenciaDto)
  items!: ItemTransferenciaDto[];
}

export class QueryTransferenciasDto {
  @IsOptional()
  @IsEnum(EstadoTransferencia)
  estado?: EstadoTransferencia;

  @IsOptional()
  @IsUUID('all')
  tiendaId?: string;
}
