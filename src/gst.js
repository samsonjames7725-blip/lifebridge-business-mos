import { getPool } from "./db.js";

const r2 = n => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
const n = v => Number(v || 0);

export function classifySupply(customer) {
  const gstin = String(customer?.gstin || "").trim();
  return gstin ? "B2B" : "B2C";
}

export function isInterState(sellerState, buyerState) {
  return String(sellerState || "").trim().toLowerCase() !== String(buyerState || "").trim().toLowerCase();
}

export function calculateTax(taxable, gstRate, cessRate, interstate, rcm=false) {
  const tax = r2(n(taxable) * n(gstRate) / 100);
  const cess = r2(n(taxable) * n(cessRate) / 100);
  const cgst = interstate ? 0 : r2(tax / 2);
  const sgst = interstate ? 0 : r2(tax - cgst);
  const igst = interstate ? tax : 0;
  return {
    cgst_rate: interstate ? 0 : n(gstRate)/2,
    sgst_rate: interstate ? 0 : n(gstRate)/2,
    igst_rate: interstate ? n(gstRate) : 0,
    cgst_amount: cgst,
    sgst_amount: sgst,
    igst_amount: igst,
    cess_amount: cess,
    rcm_amount: rcm ? tax + cess : 0,
    total_tax: r2(tax + cess)
  };
}

export async function resolveRule(conn, hsn, onDate) {
  const [rows] = await conn.query(
    `SELECT * FROM gst_rules
     WHERE (hsn_sac=? OR hsn_sac IS NULL)
       AND effective_from<=?
       AND (effective_to IS NULL OR effective_to>=?)
       AND status='Active'
     ORDER BY (hsn_sac IS NULL), effective_from DESC, id DESC
     LIMIT 1`,
    [hsn || "", onDate, onDate]
  );
  return rows[0] || null;
}
