import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class QueryValorizacionDto {
  @IsOptional()
  @IsUUID('all')
  tiendaId?: string;
}

// Fechas AAAA-MM-DD en hora argentina. Por defecto, los últimos 30 días.
export class QueryPeriodoDto {
  @IsOptional()
  @IsDateString()
  desde?: string;

  @IsOptional()
  @IsDateString()
  hasta?: string;

  @IsOptional()
  @IsUUID('all')
  tiendaId?: string;
}

// Por defecto, hoy
export class QueryCajaDto {
  @IsOptional()
  @IsDateString()
  fecha?: string;

  @IsOptional()
  @IsUUID('all')
  tiendaId?: string;
}
