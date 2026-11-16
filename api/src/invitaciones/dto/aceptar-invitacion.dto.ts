import { IsNotEmpty, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class AceptarInvitacionDto {
  @IsString()
  @Length(64, 64, { message: 'El token no es válido' })
  token!: string;

  // Si el email ya tiene cuenta, es su contraseña actual. Si no, la contraseña nueva.
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72)
  password!: string;

  // Obligatorio solo si el email todavía no tiene cuenta
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre?: string;
}