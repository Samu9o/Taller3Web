import {
  IsBoolean,
  IsNumber,
  IsPositive,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePilotDto {
  @IsString()
  @MinLength(1)
  nombre: string;

  @IsString()
  @MinLength(1)
  escuderia: string;

  @IsNumber()
  @IsPositive()
  numero: number;

  @IsBoolean()
  activo: boolean;

  @IsNumber()
  @Min(0)
  campeonatos: number;
}
