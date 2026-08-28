import { z } from "zod";

export const lineItemSchema = z.object({
  productId: z.string().optional().nullable(),
  description: z.string().min(1),
  hsnSac: z.string().optional().nullable(),
  quantity: z.number().positive(),
  unit: z.string().optional().nullable(),
  rate: z.number().min(0),
  discountPercent: z.number().min(0).max(100).optional().default(0),
  discountAmount: z.number().min(0).optional().default(0),
  gstRate: z.number().min(0).max(100),
  cgstRate: z.number().min(0).optional(),
  sgstRate: z.number().min(0).optional(),
  igstRate: z.number().min(0).optional(),
  cessRate: z.number().min(0).optional().default(0),
  sortOrder: z.number().int().optional().default(0),
});

export const createInvoiceSchema = z.object({
  companyId: z.string().min(1),
  gstRegistrationId: z.string().min(1),
  branchId: z.string().optional().nullable(),
  customerId: z.string().min(1),
  salesOrderId: z.string().optional().nullable(),
  invoiceDate: z.string().or(z.date()),
  dueDate: z.string().or(z.date()).optional().nullable(),
  billingAddress: z.string().optional().nullable(),
  shippingAddress: z.string().optional().nullable(),
  placeOfSupplyCode: z.string().optional().nullable(),
  placeOfSupply: z.string().optional().nullable(),
  supplyType: z
    .enum(["B2B", "B2C", "EXPORT", "SEZ", "EXEMPT", "NIL_RATED", "ZERO_RATED", "OTHER"])
    .optional(),
  rcm: z.boolean().optional().default(false),
  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  items: z.array(lineItemSchema).min(1),
  postImmediately: z.boolean().optional().default(false),
});

export const createQuotationSchema = z.object({
  companyId: z.string().min(1),
  branchId: z.string().optional().nullable(),
  customerId: z.string().min(1),
  quotationDate: z.string().or(z.date()),
  validUntil: z.string().or(z.date()).optional().nullable(),
  billingAddress: z.string().optional().nullable(),
  shippingAddress: z.string().optional().nullable(),
  placeOfSupplyCode: z.string().optional().nullable(),
  placeOfSupply: z.string().optional().nullable(),
  supplyType: z
    .enum(["B2B", "B2C", "EXPORT", "SEZ", "EXEMPT", "NIL_RATED", "ZERO_RATED", "OTHER"])
    .optional(),
  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  items: z.array(lineItemSchema).min(1),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;
