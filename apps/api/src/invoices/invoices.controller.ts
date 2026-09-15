import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { QueryInvoicesDto } from './dto/query-invoices.dto.js';
import { UpdateInvoiceDto } from './dto/update-invoice.dto.js';
import { InvoicesService } from './invoices.service.js';

@ApiTags('invoices')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInvoiceDto) {
    return this.invoicesService.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryInvoicesDto) {
    return this.invoicesService.findAll(user.id, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.invoicesService.findOne(user.id, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateInvoiceDto) {
    return this.invoicesService.update(user.id, id, dto);
  }

  @Post(':id/issue')
  @HttpCode(HttpStatus.OK)
  issue(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.invoicesService.issue(user.id, id);
  }

  @Post(':id/pay')
  @HttpCode(HttpStatus.OK)
  pay(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.invoicesService.pay(user.id, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.invoicesService.cancel(user.id, id);
  }
}
