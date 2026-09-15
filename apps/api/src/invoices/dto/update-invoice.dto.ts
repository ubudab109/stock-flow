import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { CreateInvoiceDto, CreateInvoiceItemDto } from './create-invoice.dto.js';

export class UpdateInvoiceDto extends PartialType(CreateInvoiceDto) {
  @ApiPropertyOptional({
    type: [CreateInvoiceItemDto],
    description: 'When provided, replaces the invoice’s line items entirely.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  override items?: CreateInvoiceItemDto[];
}
