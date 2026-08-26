import Database from 'better-sqlite3';
const db = new Database(process.env.DB_FILE || 'lifebridge.db');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS companies (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 legal_name TEXT,
 pan TEXT,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS gst_registrations (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 company_id INTEGER NOT NULL,
 gstin TEXT NOT NULL UNIQUE,
 state_code TEXT,
 status TEXT DEFAULT 'active',
 effective_from TEXT,
 FOREIGN KEY(company_id) REFERENCES companies(id)
);
CREATE TABLE IF NOT EXISTS customers (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 company_id INTEGER NOT NULL,
 name TEXT NOT NULL,
 gstin TEXT,
 state TEXT,
 phone TEXT,
 email TEXT,
 FOREIGN KEY(company_id) REFERENCES companies(id)
);
CREATE TABLE IF NOT EXISTS products (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 company_id INTEGER NOT NULL,
 name TEXT NOT NULL,
 sku TEXT,
 hsn_sac TEXT,
 unit TEXT DEFAULT 'Nos',
 gst_rate REAL DEFAULT 18,
 sale_price REAL DEFAULT 0,
 FOREIGN KEY(company_id) REFERENCES companies(id)
);
CREATE TABLE IF NOT EXISTS gst_rules (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 rule_code TEXT NOT NULL,
 hsn_sac TEXT,
 gst_rate REAL NOT NULL,
 cgst_rate REAL,
 sgst_rate REAL,
 igst_rate REAL,
 effective_from TEXT NOT NULL,
 effective_to TEXT,
 source_reference TEXT,
 status TEXT DEFAULT 'active'
);
CREATE TABLE IF NOT EXISTS invoices (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 company_id INTEGER NOT NULL,
 invoice_no TEXT NOT NULL,
 customer_id INTEGER,
 invoice_date TEXT NOT NULL,
 subtotal REAL DEFAULT 0,
 cgst REAL DEFAULT 0,
 sgst REAL DEFAULT 0,
 igst REAL DEFAULT 0,
 total REAL DEFAULT 0,
 status TEXT DEFAULT 'draft',
 FOREIGN KEY(company_id) REFERENCES companies(id),
 FOREIGN KEY(customer_id) REFERENCES customers(id)
);
`);
if (db.prepare('SELECT COUNT(*) n FROM companies').get().n === 0) {
  db.prepare('INSERT INTO companies(name,legal_name,pan) VALUES (?,?,?)')
    .run('LifeBridge MedTech PVT. LTD.','LifeBridge MedTech PVT. LTD.','');
}
export default db;
