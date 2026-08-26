import mysql from "mysql2/promise";

const cfg = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true
};

let pool;
let initPromise;

export function getPool() {
  if (!pool) {
    if (!cfg.host || !cfg.user || !cfg.database) {
      throw new Error("DB_HOST, DB_USER and DB_NAME are required");
    }
    pool = mysql.createPool(cfg);
  }
  return pool;
}

const ddl = [
`CREATE TABLE IF NOT EXISTS companies (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(255) NOT NULL,
 legal_name VARCHAR(255),
 pan VARCHAR(20),
 email VARCHAR(255),
 phone VARCHAR(50),
 address TEXT,
 city VARCHAR(120),
 state VARCHAR(120),
 pincode VARCHAR(20),
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)`,
`CREATE TABLE IF NOT EXISTS gst_registrations (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT NOT NULL,
 gstin VARCHAR(20) NOT NULL,
 legal_name VARCHAR(255),
 trade_name VARCHAR(255),
 state_code VARCHAR(10),
 state_name VARCHAR(120),
 registration_type VARCHAR(50) DEFAULT 'Regular',
 status VARCHAR(40) DEFAULT 'Active',
 effective_from DATE,
 effective_to DATE,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_gstin(gstin),
 INDEX(company_id)
)`,
`CREATE TABLE IF NOT EXISTS branches (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT NOT NULL,
 name VARCHAR(255) NOT NULL,
 code VARCHAR(80),
 address TEXT,
 city VARCHAR(120),
 state VARCHAR(120),
 pincode VARCHAR(20),
 phone VARCHAR(50),
 email VARCHAR(255),
 active TINYINT DEFAULT 1,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX(company_id)
)`,
`CREATE TABLE IF NOT EXISTS users (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT NOT NULL,
 name VARCHAR(255) NOT NULL,
 email VARCHAR(255),
 role VARCHAR(80) DEFAULT 'staff',
 active TINYINT DEFAULT 1,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX(company_id)
)`,
`CREATE TABLE IF NOT EXISTS customers (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT NOT NULL,
 name VARCHAR(255) NOT NULL,
 gstin VARCHAR(20),
 pan VARCHAR(20),
 state VARCHAR(120),
 city VARCHAR(120),
 phone VARCHAR(50),
 email VARCHAR(255),
 billing_address TEXT,
 shipping_address TEXT,
 credit_limit DECIMAL(18,2) DEFAULT 0,
 payment_terms_days INT DEFAULT 0,
 active TINYINT DEFAULT 1,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX(company_id)
)`,
`CREATE TABLE IF NOT EXISTS vendors (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT NOT NULL,
 name VARCHAR(255) NOT NULL,
 gstin VARCHAR(20),
 pan VARCHAR(20),
 state VARCHAR(120),
 city VARCHAR(120),
 phone VARCHAR(50),
 email VARCHAR(255),
 address TEXT,
 payment_terms_days INT DEFAULT 0,
 active TINYINT DEFAULT 1,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX(company_id)
)`,
`CREATE TABLE IF NOT EXISTS products (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT NOT NULL,
 name VARCHAR(255) NOT NULL,
 sku VARCHAR(100),
 barcode VARCHAR(100),
 hsn_sac VARCHAR(40) NOT NULL,
 description TEXT,
 unit VARCHAR(30) DEFAULT 'Nos',
 gst_rate DECIMAL(6,2) DEFAULT 18,
 cess_rate DECIMAL(6,2) DEFAULT 0,
 purchase_price DECIMAL(18,2) DEFAULT 0,
 sale_price DECIMAL(18,2) DEFAULT 0,
 opening_stock DECIMAL(18,3) DEFAULT 0,
 reorder_level DECIMAL(18,3) DEFAULT 0,
 active TINYINT DEFAULT 1,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX(company_id),
 INDEX(hsn_sac)
)`,
`CREATE TABLE IF NOT EXISTS gst_rules (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 rule_code VARCHAR(100) NOT NULL,
 hsn_sac VARCHAR(40),
 description TEXT,
 gst_rate DECIMAL(6,2) NOT NULL,
 cgst_rate DECIMAL(6,2) DEFAULT 0,
 sgst_rate DECIMAL(6,2) DEFAULT 0,
 igst_rate DECIMAL(6,2) DEFAULT 0,
 cess_rate DECIMAL(6,2) DEFAULT 0,
 rcm_applicable TINYINT DEFAULT 0,
 rcm_category VARCHAR(120),
 effective_from DATE NOT NULL,
 effective_to DATE,
 source_reference TEXT,
 source_date DATE,
 status VARCHAR(40) DEFAULT 'Active',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX(hsn_sac),
 INDEX(effective_from,effective_to)
)`,
`CREATE TABLE IF NOT EXISTS audit_log (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT NULL,
 user_id BIGINT NULL,
 entity_type VARCHAR(80) NOT NULL,
 entity_id BIGINT NULL,
 action VARCHAR(80) NOT NULL,
 before_json JSON NULL,
 after_json JSON NULL,
 details JSON NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX(company_id,created_at),
 INDEX(entity_type,entity_id)
)`,
`CREATE TABLE IF NOT EXISTS invoice_sequences (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT NOT NULL,
 fiscal_year VARCHAR(20) NOT NULL,
 prefix VARCHAR(30) DEFAULT 'INV',
 next_number INT NOT NULL DEFAULT 1,
 UNIQUE KEY uq_company_fy(company_id,fiscal_year)
)`,
`CREATE TABLE IF NOT EXISTS quotations (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT NOT NULL,
 customer_id BIGINT NULL,
 quote_no VARCHAR(80) NOT NULL,
 quote_date DATE NOT NULL,
 valid_until DATE NULL,
 subtotal DECIMAL(18,2) DEFAULT 0,
 taxable_total DECIMAL(18,2) DEFAULT 0,
 tax_total DECIMAL(18,2) DEFAULT 0,
 grand_total DECIMAL(18,2) DEFAULT 0,
 status VARCHAR(40) DEFAULT 'Draft',
 notes TEXT,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_quote(company_id,quote_no)
)`,
`CREATE TABLE IF NOT EXISTS invoices (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT NOT NULL,
 gst_registration_id BIGINT NULL,
 branch_id BIGINT NULL,
 customer_id BIGINT NULL,
 invoice_no VARCHAR(80) NOT NULL,
 invoice_date DATE NOT NULL,
 due_date DATE NULL,
 place_of_supply VARCHAR(120),
 seller_state VARCHAR(120),
 buyer_state VARCHAR(120),
 supply_type VARCHAR(30) DEFAULT 'B2C',
 is_interstate TINYINT DEFAULT 0,
 rcm_applicable TINYINT DEFAULT 0,
 rcm_category VARCHAR(120),
 rcm_tax DECIMAL(18,2) DEFAULT 0,
 subtotal DECIMAL(18,2) DEFAULT 0,
 discount_total DECIMAL(18,2) DEFAULT 0,
 taxable_total DECIMAL(18,2) DEFAULT 0,
 cgst_total DECIMAL(18,2) DEFAULT 0,
 sgst_total DECIMAL(18,2) DEFAULT 0,
 igst_total DECIMAL(18,2) DEFAULT 0,
 cess_total DECIMAL(18,2) DEFAULT 0,
 round_off DECIMAL(18,2) DEFAULT 0,
 grand_total DECIMAL(18,2) DEFAULT 0,
 paid_total DECIMAL(18,2) DEFAULT 0,
 balance_due DECIMAL(18,2) DEFAULT 0,
 status VARCHAR(40) DEFAULT 'Issued',
 einvoice_status VARCHAR(40) DEFAULT 'Not Requested',
 einvoice_irn VARCHAR(120),
 einvoice_ack_no VARCHAR(120),
 einvoice_ack_date DATETIME NULL,
 eway_status VARCHAR(40) DEFAULT 'Not Requested',
 eway_bill_no VARCHAR(120),
 eway_valid_until DATETIME NULL,
 notes TEXT,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_invoice(company_id,invoice_no),
 INDEX(company_id,invoice_date)
)`,
`CREATE TABLE IF NOT EXISTS invoice_items (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 invoice_id BIGINT NOT NULL,
 product_id BIGINT NULL,
 description VARCHAR(500),
 hsn_sac VARCHAR(40),
 unit VARCHAR(30),
 quantity DECIMAL(18,3) NOT NULL,
 rate DECIMAL(18,2) NOT NULL,
 discount_percent DECIMAL(8,3) DEFAULT 0,
 discount_amount DECIMAL(18,2) DEFAULT 0,
 taxable_value DECIMAL(18,2) DEFAULT 0,
 gst_rate DECIMAL(6,2) DEFAULT 0,
 cgst_rate DECIMAL(6,2) DEFAULT 0,
 cgst_amount DECIMAL(18,2) DEFAULT 0,
 sgst_rate DECIMAL(6,2) DEFAULT 0,
 sgst_amount DECIMAL(18,2) DEFAULT 0,
 igst_rate DECIMAL(6,2) DEFAULT 0,
 igst_amount DECIMAL(18,2) DEFAULT 0,
 cess_rate DECIMAL(6,2) DEFAULT 0,
 cess_amount DECIMAL(18,2) DEFAULT 0,
 rcm_amount DECIMAL(18,2) DEFAULT 0,
 line_total DECIMAL(18,2) DEFAULT 0,
 INDEX(invoice_id)
)`,
`CREATE TABLE IF NOT EXISTS payments (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 invoice_id BIGINT NOT NULL,
 payment_date DATE NOT NULL,
 amount DECIMAL(18,2) NOT NULL,
 mode VARCHAR(50) DEFAULT 'Bank',
 reference_no VARCHAR(120),
 notes TEXT,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX(invoice_id)
)`,
`CREATE TABLE IF NOT EXISTS purchase_bills (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT NOT NULL,
 gst_registration_id BIGINT NULL,
 branch_id BIGINT NULL,
 vendor_id BIGINT NOT NULL,
 bill_no VARCHAR(80) NOT NULL,
 bill_date DATE NOT NULL,
 place_of_supply VARCHAR(120),
 taxable_value DECIMAL(18,2) DEFAULT 0,
 cgst DECIMAL(18,2) DEFAULT 0,
 sgst DECIMAL(18,2) DEFAULT 0,
 igst DECIMAL(18,2) DEFAULT 0,
 cess DECIMAL(18,2) DEFAULT 0,
 rcm_applicable TINYINT DEFAULT 0,
 rcm_tax DECIMAL(18,2) DEFAULT 0,
 total DECIMAL(18,2) DEFAULT 0,
 status VARCHAR(40) DEFAULT 'Posted',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_purchase(company_id,bill_no)
)`,
`CREATE TABLE IF NOT EXISTS purchase_items (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 purchase_bill_id BIGINT NOT NULL,
 product_id BIGINT NOT NULL,
 hsn_sac VARCHAR(40),
 qty DECIMAL(18,3) NOT NULL,
 rate DECIMAL(18,2) NOT NULL,
 taxable_value DECIMAL(18,2) NOT NULL,
 gst_rate DECIMAL(6,2) DEFAULT 0,
 cgst DECIMAL(18,2) DEFAULT 0,
 sgst DECIMAL(18,2) DEFAULT 0,
 igst DECIMAL(18,2) DEFAULT 0,
 cess DECIMAL(18,2) DEFAULT 0
)`,
`CREATE TABLE IF NOT EXISTS inventory_stock (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT NOT NULL,
 branch_id BIGINT NULL,
 product_id BIGINT NOT NULL,
 qty DECIMAL(18,3) DEFAULT 0,
 avg_cost DECIMAL(18,2) DEFAULT 0,
 reorder_level DECIMAL(18,3) DEFAULT 0,
 UNIQUE KEY uq_stock(company_id,branch_id,product_id)
)`,
`CREATE TABLE IF NOT EXISTS stock_ledger (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT NOT NULL,
 branch_id BIGINT NULL,
 product_id BIGINT NOT NULL,
 txn_type VARCHAR(50) NOT NULL,
 reference_type VARCHAR(50),
 reference_id BIGINT,
 qty_in DECIMAL(18,3) DEFAULT 0,
 qty_out DECIMAL(18,3) DEFAULT 0,
 unit_cost DECIMAL(18,2) DEFAULT 0,
 balance_qty DECIMAL(18,3) DEFAULT 0,
 note VARCHAR(255),
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX(company_id,product_id,created_at)
)`,
`CREATE TABLE IF NOT EXISTS credit_debit_notes (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT NOT NULL,
 gst_registration_id BIGINT NULL,
 party_type VARCHAR(30) NOT NULL,
 party_id BIGINT NOT NULL,
 note_type VARCHAR(20) NOT NULL,
 note_no VARCHAR(80) NOT NULL,
 note_date DATE NOT NULL,
 reason VARCHAR(255),
 taxable_value DECIMAL(18,2) DEFAULT 0,
 cgst DECIMAL(18,2) DEFAULT 0,
 sgst DECIMAL(18,2) DEFAULT 0,
 igst DECIMAL(18,2) DEFAULT 0,
 cess DECIMAL(18,2) DEFAULT 0,
 rcm_tax DECIMAL(18,2) DEFAULT 0,
 total DECIMAL(18,2) DEFAULT 0,
 status VARCHAR(40) DEFAULT 'Posted',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_note(company_id,note_type,note_no)
)`,
`CREATE TABLE IF NOT EXISTS credit_debit_note_items (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 note_id BIGINT NOT NULL,
 product_id BIGINT NULL,
 description VARCHAR(255),
 qty DECIMAL(18,3) DEFAULT 0,
 rate DECIMAL(18,2) DEFAULT 0,
 taxable_value DECIMAL(18,2) DEFAULT 0,
 gst_rate DECIMAL(6,2) DEFAULT 0,
 cgst DECIMAL(18,2) DEFAULT 0,
 sgst DECIMAL(18,2) DEFAULT 0,
 igst DECIMAL(18,2) DEFAULT 0,
 cess DECIMAL(18,2) DEFAULT 0
)`,
`CREATE TABLE IF NOT EXISTS gst_integration_queue (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT NOT NULL,
 invoice_id BIGINT NULL,
 integration_type VARCHAR(30) NOT NULL,
 status VARCHAR(30) DEFAULT 'PENDING',
 attempt_count INT DEFAULT 0,
 request_json JSON NULL,
 response_json JSON NULL,
 external_reference VARCHAR(150),
 error_message TEXT,
 requested_at DATETIME NULL,
 completed_at DATETIME NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX(company_id,status,integration_type)
)`,
`CREATE TABLE IF NOT EXISTS gst_report_snapshots (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT NOT NULL,
 gst_registration_id BIGINT NULL,
 period_from DATE NOT NULL,
 period_to DATE NOT NULL,
 report_type VARCHAR(50) NOT NULL,
 payload JSON NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`
];

export async function initDb() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const p = getPool();
    for (const sql of ddl) await p.query(sql);
    const [c] = await p.query("SELECT COUNT(*) AS n FROM companies");
    if (Number(c[0].n) === 0) {
      await p.query(
        "INSERT INTO companies(name,legal_name,state) VALUES(?,?,?)",
        ["LifeBridge MedTech PVT. LTD.", "LifeBridge MedTech PVT. LTD.", "Maharashtra"]
      );
    }
  })();
  return initPromise;
}

export async function transaction(fn) {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
