import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'bcryptjs';
import { config } from 'dotenv';
import { PrismaClient } from '../src/generated/prisma/client.js';

// Same shared root .env as the app itself and prisma.config.ts.
config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env') });

// Matches PasswordService's cost factor so seeded accounts hash the same way
// a real registration would.
const SALT_ROUNDS = 12;
const DEMO_PASSWORD = 'Passw0rd!';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

interface SeedProduct {
  sku: string;
  name: string;
  description: string;
  unitPrice: number; // whole Rupiah — IDR has no minor unit
  quantityOnHand: number;
}

// A small distribution business selling Indonesian grocery/retail goods —
// matches the take-home's "small distribution business" scenario.
const DEMO_PRODUCTS: SeedProduct[] = [
  { sku: 'KOPI-KAPAL-001', name: 'Kopi Kapal Api Special Mix', description: 'Kopi sachet 20 gr', unitPrice: 1500, quantityOnHand: 500 },
  { sku: 'INDOMIE-GRG-001', name: 'Indomie Goreng (1 dus)', description: 'Mi instan goreng, isi 40 bungkus', unitPrice: 120000, quantityOnHand: 150 },
  { sku: 'TEHBOTOL-450', name: 'Teh Botol Sosro 450ml', description: 'Teh melati siap minum', unitPrice: 5000, quantityOnHand: 400 },
  { sku: 'KERUPUK-UDG-001', name: 'Kerupuk Udang Sidoarjo', description: 'Kerupuk udang mentah 500 gr', unitPrice: 25000, quantityOnHand: 200 },
  { sku: 'BATIK-PKL-001', name: 'Batik Tulis Pekalongan', description: 'Kain batik tulis motif klasik, 2 meter', unitPrice: 350000, quantityOnHand: 25 },
  { sku: 'TAS-ROTAN-BALI', name: 'Tas Rotan Bali', description: 'Tas anyaman rotan asli Bali', unitPrice: 175000, quantityOnHand: 60 },
  { sku: 'KRIPIK-SGK-BLD', name: 'Keripik Singkong Balado', description: 'Keripik singkong pedas manis 250 gr', unitPrice: 18000, quantityOnHand: 300 },
  { sku: 'SAMBAL-ABC-001', name: 'Sambal ABC Extra Pedas', description: 'Sambal botol 335 ml', unitPrice: 12000, quantityOnHand: 250 },
  { sku: 'KOPI-LUWAK-250', name: 'Kopi Luwak Gayo 250g', description: 'Kopi luwak asli Gayo, bubuk 250 gr', unitPrice: 450000, quantityOnHand: 20 },
  { sku: 'GULA-AREN-500', name: 'Gula Aren Cair 500ml', description: 'Gula aren cair asli, botol 500 ml', unitPrice: 22000, quantityOnHand: 120 },
];

async function upsertUser(email: string): Promise<{ id: string; email: string }> {
  const passwordHash = await hash(DEMO_PASSWORD, SALT_ROUNDS);
  return prisma.user.upsert({
    where: { email },
    create: { email, passwordHash },
    update: {},
  });
}

async function upsertProducts(userId: string, products: SeedProduct[]): Promise<void> {
  for (const product of products) {
    await prisma.product.upsert({
      where: { userId_sku: { userId, sku: product.sku } },
      create: { ...product, userId },
      update: { ...product },
    });
  }
}

async function main(): Promise<void> {
  const demoUser = await upsertUser('demo@stockflow.test');
  await upsertProducts(demoUser.id, DEMO_PRODUCTS);

  // A second account with a small, distinct catalog — demonstrates that each
  // user only ever sees their own workspace (A7).
  const staffUser = await upsertUser('staff@stockflow.test');
  await upsertProducts(staffUser.id, [
    { sku: 'AQUA-600', name: 'Air Mineral Aqua 600ml', description: 'Air mineral dalam kemasan botol', unitPrice: 4000, quantityOnHand: 500 },
    { sku: 'BERAS-IR64-5KG', name: 'Beras IR64 5kg', description: 'Beras putih kualitas medium', unitPrice: 65000, quantityOnHand: 100 },
    { sku: 'MINYAK-GORENG-2L', name: 'Minyak Goreng 2 Liter', description: 'Minyak goreng kemasan botol', unitPrice: 34000, quantityOnHand: 80 },
  ]);

  console.log('\nSeed complete. Demo accounts (password for both: %s):', DEMO_PASSWORD);
  console.log(`  ${demoUser.email} — ${DEMO_PRODUCTS.length} products`);
  console.log(`  ${staffUser.email} — 3 products (separate workspace, for testing per-user isolation)`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
