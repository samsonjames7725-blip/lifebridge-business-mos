/**
 * Centralized GST Tax Engine
 * Every billing/purchase module MUST call this. Do not duplicate logic.
 */

import { Decimal } from "@prisma/client/runtime/library";

export type SupplyType =
  | "B2B" | "B2C" | "EXPORT" | "SEZ" | "EXEMPT" | "NIL_RATED" | "ZERO_RATED" | "OTHER";

export type TaxType = "CGST_SGST" | "IGST" | "NIL" | "EXEMPT";

export interface CalculateGSTInput {
  supplierStateCode: string;
  customerStateCode: string;
  placeOfSupplyCode?: string;
  hsnSac?: string;
  transactionDate: Date;
  taxableValue: number;
  gstRate: number;
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
  cessRate?: number;
  customerType?: string;
  supplyType?: SupplyType;
  rcm?: boolean;
  exemptionStatus?: boolean;
  ruleVersionId?: string;
}

export interface CalculateGSTResult {
  taxableValue: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  cessRate: number;
  cessAmount: number;
  totalTax: number;
  taxType: TaxType;
  placeOfSupplyCode: string;
  placeOfSupplyName?: string;
  isInterState: boolean;
  rcm: boolean;
  b2bB2CClassification: SupplyType;
  ruleVersionId?: string;
  grandTotal: number;
}

const STATE_NAMES: Record<string, string> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
  "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
  "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra", "29": "Karnataka",
  "30": "Goa", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
  "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
  "97": "Other Territory", "99": "Centre Jurisdiction",
};

function toNum(v: number | Decimal | string | undefined | null): number {
  if (v === undefined || v === null) return 0;
  if (typeof v === "number") return v;
  return Number(v);
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function calculateGST(input: CalculateGSTInput): CalculateGSTResult {
  const taxableValue = round2(toNum(input.taxableValue));
  const gstRate = toNum(input.gstRate);
  const cessRate = toNum(input.cessRate ?? 0);
  const rcm = Boolean(input.rcm);
  const isExempt = Boolean(input.exemptionStatus);

  const placeOfSupplyCode =
    input.placeOfSupplyCode?.trim() ||
    input.customerStateCode?.trim() ||
    input.supplierStateCode?.trim() || "";

  const supplierState = (input.supplierStateCode || "").trim();
  const isInterState =
    Boolean(supplierState) && Boolean(placeOfSupplyCode) && supplierState !== placeOfSupplyCode;

  let classification: SupplyType = "OTHER";
  if (input.supplyType) classification = input.supplyType;
  else if (input.customerType) {
    const ct = input.customerType.toUpperCase();
    if (["B2B", "B2C", "EXPORT", "SEZ", "EXEMPT", "NIL_RATED", "ZERO_RATED"].includes(ct))
      classification = ct as SupplyType;
    else if (ct === "GOVERNMENT" || ct === "INSTITUTION") classification = "B2B";
    else classification = "B2C";
  } else classification = "B2C";

  let cgstRate = 0, sgstRate = 0, igstRate = 0;
  let taxType: TaxType = "NIL";

  if (isExempt || classification === "EXEMPT" || classification === "NIL_RATED") taxType = "EXEMPT";
  else if (classification === "ZERO_RATED" || classification === "EXPORT") taxType = "NIL";
  else if (isInterState) {
    taxType = "IGST";
    igstRate = input.igstRate !== undefined ? toNum(input.igstRate) : gstRate;
  } else {
    taxType = "CGST_SGST";
    if (input.cgstRate !== undefined && input.sgstRate !== undefined) {
      cgstRate = toNum(input.cgstRate);
      sgstRate = toNum(input.sgstRate);
    } else {
      cgstRate = round2(gstRate / 2);
      sgstRate = round2(gstRate / 2);
    }
  }

  const cgstAmount = round2((taxableValue * cgstRate) / 100);
  const sgstAmount = round2((taxableValue * sgstRate) / 100);
  const igstAmount = round2((taxableValue * igstRate) / 100);
  const cessAmount = round2((taxableValue * cessRate) / 100);
  const totalTax = round2(cgstAmount + sgstAmount + igstAmount + cessAmount);
  const grandTotal = round2(taxableValue + totalTax);

  return {
    taxableValue, cgstRate, cgstAmount, sgstRate, sgstAmount, igstRate, igstAmount,
    cessRate, cessAmount, totalTax, taxType, placeOfSupplyCode,
    placeOfSupplyName: STATE_NAMES[placeOfSupplyCode] || undefined,
    isInterState, rcm, b2bB2CClassification: classification,
    ruleVersionId: input.ruleVersionId, grandTotal,
  };
}

export function calculateLineGST(params: {
  quantity: number; rate: number; discountPercent?: number; discountAmount?: number;
  gstRate: number; cgstRate?: number; sgstRate?: number; igstRate?: number; cessRate?: number;
  supplierStateCode: string; customerStateCode: string; placeOfSupplyCode?: string;
  customerType?: string; supplyType?: SupplyType; rcm?: boolean; ruleVersionId?: string;
}) {
  const qty = toNum(params.quantity);
  const rate = toNum(params.rate);
  let taxable = round2(qty * rate);
  if (params.discountAmount && params.discountAmount > 0)
    taxable = round2(taxable - toNum(params.discountAmount));
  else if (params.discountPercent && params.discountPercent > 0)
    taxable = round2(taxable * (1 - toNum(params.discountPercent) / 100));
  if (taxable < 0) taxable = 0;

  const gst = calculateGST({
    supplierStateCode: params.supplierStateCode,
    customerStateCode: params.customerStateCode,
    placeOfSupplyCode: params.placeOfSupplyCode,
    taxableValue: taxable,
    gstRate: params.gstRate,
    cgstRate: params.cgstRate,
    sgstRate: params.sgstRate,
    igstRate: params.igstRate,
    cessRate: params.cessRate,
    customerType: params.customerType,
    supplyType: params.supplyType,
    rcm: params.rcm,
    ruleVersionId: params.ruleVersionId,
  });

  return {
    ...gst, quantity: qty, rate,
    discountPercent: toNum(params.discountPercent),
    discountAmount: params.discountAmount !== undefined ? toNum(params.discountAmount) : round2(qty * rate - taxable),
    lineTotal: gst.grandTotal,
  };
}

export { STATE_NAMES };
