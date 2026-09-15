import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 'WIDGET-001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  sku!: string;

  @ApiProperty({ example: 'Widget' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: 'A high quality widget' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ description: 'Minor currency units (e.g. cents), >= 0', example: 1999 })
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  unitPrice!: number;

  @ApiProperty({ description: 'Units in stock, >= 0', example: 100 })
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  quantityOnHand!: number;
}
