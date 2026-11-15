import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { EstadoPieza, TipoMovimiento } from '../../generated/prisma/client.js';

export class QueryStockDto {
  @IsOptional()
  @IsUUID('all')
  productoId?: string;

  @IsOptional()
  @IsUUID('all')
  tiendaId?: string;

  // Piezas: por defecto solo DISPONIBLE
  @IsOptional()
  @IsEnum(EstadoPieza)
  estado?: EstadoPieza;

  // Lotes: por defecto solo los que tienen unidades
  @IsOptional()
  @IsIn(['true', 'false'])
  incluirAgotados?: string;
}

export class QueryMovimientosDto {
  @IsOptional()
  @IsUUID('all')
  productoId?: string;

  @IsOptional()
  @IsUUID('all')
  tiendaId?: string;

  @IsOptional()
  @IsEnum(TipoMovimiento)
  tipo?: TipoMovimiento;

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
  porPagina: number = 50;
}