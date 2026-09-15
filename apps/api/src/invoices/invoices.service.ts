import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Paginated } from '@eterna/shared';
import type { AppConfig } from '../config/configuration.js';
import type { Prisma } from '../generated/prisma/client.js';
import { InvoiceStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateInvoiceDto, CreateInvoiceItemDto } from './dto/create-invoice.dto.js';
import type { QueryInvoicesDto } from './dto/query-invoices.dto.js';
import type { UpdateInvoiceDto } from './dto/update-invoice.dto.js';
import { canTransition, computeTotals, formatInvoiceNumber } from './invoice.utils.js';

export interface InvoiceItemRecord {
  id: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  customerName: string;
  issueDate: Date;
  dueDate: Date | null;
  status: InvoiceStatus;
  notes: string | null;
  subtotal: number;
  taxAmount: number;
  total: number;
  items: InvoiceItemRecord[];
  createdAt: Date;
  updatedAt: Date;
}

// Explicit allow-list so userId never leaks into API responses (same
// rationale as products.service.ts).
const INVOICE_SELECT = {
  id: true,
  invoiceNumber: true,
  customerName: true,
  issueDate: true,
  dueDate: true,
  status: true,
  notes: true,
  subtotal: true,
  taxAmount: true,
  total: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: { id: true, productId: true, productName: true, unitPrice: true, quantity: true, lineTotal: true },
  },
} as const satisfies Prisma.InvoiceSelect;

interface ResolvedItem {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

type Tx = Prisma.TransactionClient;

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async create(userId: string, dto: CreateInvoiceDto): Promise<InvoiceRecord> {
    return this.prisma.$transaction(async (tx) => {
      const items = await this.resolveAndValidateItems(tx, userId, dto.items);
      const totals = computeTotals(items, this.config.get('taxRateBps', { infer: true }));
      const invoiceNumber = await this.nextInvoiceNumber(tx, userId);

      return tx.invoice.create({
        data: {
          userId,
          invoiceNumber,
          customerName: dto.customerName,
          issueDate: dto.issueDate ? new Date(dto.issueDate) : new Date(),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          notes: dto.notes,
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          total: totals.total,
          items: { create: items },
        },
        select: INVOICE_SELECT,
      });
    });
  }

  async findAll(userId: string, query: QueryInvoicesDto): Promise<Paginated<InvoiceRecord>> {
    const { page, pageSize, status, search } = query;

    // Plain `contains` (not `mode: "insensitive"`) — see products.service.ts
    // for why: `mode` is Postgres-only and throws at runtime against the
    // SQLite test client.
    const where: Prisma.InvoiceWhereInput = {
      userId,
      ...(status ? { status } : {}),
      ...(search
        ? { OR: [{ customerName: { contains: search } }, { invoiceNumber: { contains: search } }] }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        select: INVOICE_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { data, meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
  }

  async findOne(userId: string, id: string): Promise<InvoiceRecord> {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, userId }, select: INVOICE_SELECT });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  async update(userId: string, id: string, dto: UpdateInvoiceDto): Promise<InvoiceRecord> {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({ where: { id, userId } });
      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }
      if (invoice.status !== InvoiceStatus.DRAFT) {
        throw new ConflictException('Only DRAFT invoices can be edited');
      }

      const data: Prisma.InvoiceUpdateInput = {};
      if (dto.customerName !== undefined) data.customerName = dto.customerName;
      if (dto.issueDate !== undefined) data.issueDate = new Date(dto.issueDate);
      if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
      if (dto.notes !== undefined) data.notes = dto.notes;

      if (dto.items) {
        const items = await this.resolveAndValidateItems(tx, userId, dto.items);
        const totals = computeTotals(items, this.config.get('taxRateBps', { infer: true }));
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
        data.subtotal = totals.subtotal;
        data.taxAmount = totals.taxAmount;
        data.total = totals.total;
        data.items = { create: items };
      }

      return tx.invoice.update({ where: { id }, data, select: INVOICE_SELECT });
    });
  }

  async issue(userId: string, id: string): Promise<InvoiceRecord> {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({ where: { id, userId }, include: { items: true } });
      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }
      if (!canTransition(invoice.status, InvoiceStatus.ISSUED)) {
        throw new ConflictException(`Cannot issue an invoice with status ${invoice.status}`);
      }

      // Decrement stock atomically per product, sequentially (not in
      // parallel) so a product referenced by two lines sees each decrement
      // before the next one checks it — a single `updateMany` conditioned
      // on quantityOnHand >= requested is what makes each step race-safe.
      for (const [productId, quantity] of sumQuantitiesByProduct(invoice.items)) {
        const result = await tx.product.updateMany({
          where: { id: productId, quantityOnHand: { gte: quantity } },
          data: { quantityOnHand: { decrement: quantity } },
        });
        if (result.count === 0) {
          const item = invoice.items.find((line) => line.productId === productId);
          throw new ConflictException(
            `Cannot issue invoice: insufficient stock for "${item?.productName}" (need ${quantity})`,
          );
        }
      }

      return tx.invoice.update({ where: { id }, data: { status: InvoiceStatus.ISSUED }, select: INVOICE_SELECT });
    });
  }

  async pay(userId: string, id: string): Promise<InvoiceRecord> {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, userId } });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    if (!canTransition(invoice.status, InvoiceStatus.PAID)) {
      throw new ConflictException(`Cannot mark an invoice with status ${invoice.status} as paid`);
    }
    return this.prisma.invoice.update({ where: { id }, data: { status: InvoiceStatus.PAID }, select: INVOICE_SELECT });
  }

  async cancel(userId: string, id: string): Promise<InvoiceRecord> {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({ where: { id, userId }, include: { items: true } });
      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }
      if (!canTransition(invoice.status, InvoiceStatus.CANCELLED)) {
        throw new ConflictException(`Cannot cancel an invoice with status ${invoice.status}`);
      }

      // Cancelling a DRAFT restores nothing (stock was never decremented);
      // cancelling an ISSUED invoice restores exactly what issuing consumed.
      if (invoice.status === InvoiceStatus.ISSUED) {
        for (const [productId, quantity] of sumQuantitiesByProduct(invoice.items)) {
          await tx.product.update({ where: { id: productId }, data: { quantityOnHand: { increment: quantity } } });
        }
      }

      return tx.invoice.update({ where: { id }, data: { status: InvoiceStatus.CANCELLED }, select: INVOICE_SELECT });
    });
  }

  private async resolveAndValidateItems(
    tx: Tx,
    userId: string,
    itemDtos: CreateInvoiceItemDto[],
  ): Promise<ResolvedItem[]> {
    const productIds = [...new Set(itemDtos.map((item) => item.productId))];
    const products = await tx.product.findMany({ where: { id: { in: productIds }, userId } });
    const productMap = new Map(products.map((product) => [product.id, product]));

    for (const productId of productIds) {
      if (!productMap.has(productId)) {
        throw new NotFoundException(`Product ${productId} not found`);
      }
    }

    // Validate cumulative demand per product — two lines for the same
    // product must not each pass an individual check while together
    // exceeding stock.
    const requestedByProduct = new Map<string, number>();
    for (const item of itemDtos) {
      requestedByProduct.set(item.productId, (requestedByProduct.get(item.productId) ?? 0) + item.quantity);
    }
    for (const [productId, requested] of requestedByProduct) {
      const product = productMap.get(productId);
      if (product && requested > product.quantityOnHand) {
        throw new ConflictException(
          `Requested quantity (${requested}) for "${product.name}" exceeds available stock (${product.quantityOnHand})`,
        );
      }
    }

    return itemDtos.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found`);
      }
      return {
        productId: product.id,
        productName: product.name,
        unitPrice: product.unitPrice,
        quantity: item.quantity,
        lineTotal: product.unitPrice * item.quantity,
      };
    });
  }

  private async nextInvoiceNumber(tx: Tx, userId: string): Promise<string> {
    const year = new Date().getUTCFullYear();
    const counter = await tx.invoiceCounter.upsert({
      where: { userId_year: { userId, year } },
      create: { userId, year, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });
    return formatInvoiceNumber(year, counter.lastNumber);
  }
}

function sumQuantitiesByProduct(items: Array<{ productId: string; quantity: number }>): Map<string, number> {
  const byProduct = new Map<string, number>();
  for (const item of items) {
    byProduct.set(item.productId, (byProduct.get(item.productId) ?? 0) + item.quantity);
  }
  return byProduct;
}
