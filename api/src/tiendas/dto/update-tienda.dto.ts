import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateTiendaDto } from './create-tienda.dto.js';

export class UpdateTiendaDto extends PartialType(CreateTiendaDto) {
  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}