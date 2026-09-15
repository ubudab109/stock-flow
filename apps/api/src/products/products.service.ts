import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Paginated } from '@eterna/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { CreateProductDto } from './dto/create-product.dto.js';
import type { QueryProductsDto } from './dto/query-products.dto.js';
import type { UpdateProductDto } from './dto/update-product.dto.js';

export interface ProductRecord {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unitPrice: number;
  quantityOnHand: number;
  createdAt: Date;
  updatedAt: Date;
}

// Explicit allow-list so internal columns (userId) never leak into API
// responses, and so adding a column to the model doesn't silently expose it.
const PRODUCT_SELECT = {
  id: true,
  sku: true,
  name: true,
  description: true,
  unitPrice: true,
  quantityOnHand: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.ProductSelect;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateProductDto): Promise<ProductRecord> {
    await this.assertSkuAvailable(userId, dto.sku);
    return this.prisma.product.create({ data: { userId, ...dto }, select: PRODUCT_SELECT });
  }

  async findAll(userId: string, query: QueryProductsDto): Promise<Paginated<ProductRecord>> {
    const { page, pageSize, search } = query;

    // Plain `contains` (not `mode: "insensitive"`) so the same query works
    // unmodified on both Postgres (dev/prod) and SQLite (tests) — `mode` is
    // Postgres-only and throws at runtime against the SQLite client. This
    // makes search case-sensitive on Postgres; see README trade-offs.
    const where: Prisma.ProductWhereInput = {
      userId,
      ...(search ? { OR: [{ name: { contains: search } }, { sku: { contains: search } }] } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        select: PRODUCT_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async findOne(userId: string, id: string): Promise<ProductRecord> {
    const product = await this.prisma.product.findFirst({ where: { id, userId }, select: PRODUCT_SELECT });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async update(userId: string, id: string, dto: UpdateProductDto): Promise<ProductRecord> {
    await this.findOne(userId, id);
    if (dto.sku) {
      await this.assertSkuAvailable(userId, dto.sku, id);
    }
    return this.prisma.product.update({ where: { id }, data: dto, select: PRODUCT_SELECT });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOne(userId, id);

    const referencingItems = await this.prisma.invoiceItem.count({ where: { productId: id } });
    if (referencingItems > 0) {
      throw new ConflictException(
        `Cannot delete this product: it is referenced by ${referencingItems} invoice line item(s). ` +
          'Remove it from those invoices first.',
      );
    }

    await this.prisma.product.delete({ where: { id } });
  }

  private async assertSkuAvailable(userId: string, sku: string, excludingId?: string): Promise<void> {
    const existing = await this.prisma.product.findFirst({
      where: { userId, sku, ...(excludingId ? { id: { not: excludingId } } : {}) },
    });
    if (existing) {
      throw new ConflictException(`SKU "${sku}" is already in use`);
    }
  }
}
