import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Metal, TipoProducto } from '../../generated/prisma/client.js';

export class QueryProductosDto {
  @IsOptional()
  @IsString()
  buscar?: string;

  @IsOptional()
  @IsEnum(TipoProducto)
  tipo?: TipoProducto;

  @IsOptional()
  @IsUUID('all')
  categoriaId?: string;

  @IsOptional()
  @IsEnum(Metal)
  metal?: Metal;

  @IsOptional()
  @IsIn(['true', 'false'])
  incluirInactivos?: string;

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