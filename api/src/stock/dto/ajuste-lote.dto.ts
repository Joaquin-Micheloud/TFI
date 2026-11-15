import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class AjusteLoteDto {
  // Lo que se contó físicamente
  @IsInt()
  @Min(0)
  cantidadContada!: number;

  @IsString()
  @IsNotEmpty({ message: 'Explicá el motivo del ajuste' })
  @MaxLength(300)
  detalle!: string;
}