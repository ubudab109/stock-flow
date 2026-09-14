export interface HealthStatus {
  status: "ok" | "error";
  timestamp: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  /** Minor currency units (e.g. cents) — never a float. */
  unitPrice: number;
  quantityOnHand: number;
  createdAt: string;
  updatedAt: string;
}

export type InvoiceStatus = "DRAFT" | "ISSUED" | "PAID" | "CANCELLED";

export interface InvoiceItem {
  id: string;
  productId: string;
  /** Snapshotted at the time the line was added; independent of the live product. */
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  issueDate: string;
  dueDate: string | null;
  status: InvoiceStatus;
  notes: string | null;
  subtotal: number;
  taxAmount: number;
  total: number;
  items: InvoiceItem[];
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string;
  details?: Array<{ field: string; message: string }>;
  path: string;
  timestamp: string;
}
