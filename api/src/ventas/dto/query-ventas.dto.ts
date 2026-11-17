import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

export class QueryVentasDto {
  @IsOptional()
  @IsUUID('all')
  tiendaId?: string;

  // Fechas en formato AAAA-MM-DD
  @IsOptional()
  @IsDateString()
  desde?: string;

  @IsOptional()
  @IsDateString()
  hasta?: string;

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

// /ventas/buscar?tiendaId=...&q=anillo
export class BuscarParaVenderDto {
  @IsUUID('all')
  tiendaId!: string;
  
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  q!: string;
}