import { IsInt, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class IngresoLoteDto {
  @IsUUID('all')
  productoId!: string;

  @IsUUID('all')
  tiendaId!: string;

  @IsInt()
  @Min(1)
  @Max(100000)
  cantidad!: number;

  // Obligatorio en productos de metal (reventa y elaboración)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  pesoTotalGramos?: number;

  // Obligatorio en reventa (ARS). En fantasía es opcional y va en la moneda del producto.
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  precioCompraTotal?: number;
}