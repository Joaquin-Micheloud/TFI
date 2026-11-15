import { Type } from 'class-transformer';
import { IsEnum, IsNumber, Max, Min } from 'class-validator';
import { Metal } from '../../generated/prisma/client.js';

// /precios/gramo?metal=ORO&ley=0.750
export class GramoQueryDto {
  @IsEnum(Metal)
  metal!: Metal;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(1)
  ley!: number;
}