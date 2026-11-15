import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateProductoDto } from './create-producto.dto.js';

// El tipo y el modo de stock no se cambian después del alta
export class UpdateProductoDto extends PartialType(
  OmitType(CreateProductoDto, ['tipo', 'modoStock'] as const),
) {
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}