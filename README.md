# LifeBridge Business MOS — Unified Full Build

This is the unified application foundation for LifeBridge MedTech.

## Included

### Dashboard
- Mobile responsive dashboard
- Company/GSTIN context
- Revenue, invoices, outstanding, GST and operations KPIs
- AI command-center placeholder

### Core
- Companies
- GST registrations
- Branches
- Users
- Customers
- Vendors
- Products
- HSN/SAC
- Versioned GST rules
- Audit log

### Billing
- Quotations
- Sales invoices
- Invoice lines
- Invoice numbering by company and financial year
- CGST / SGST / IGST
- Place of supply
- B2B / B2C classification
- RCM fields
- Credit notes / debit notes
- Payments
- Outstanding
- Printable invoice

### Inventory / Procurement
- Purchase bills
- Purchase lines
- Stock balances
- Stock ledger
- Stock adjustments

### GST
- Versioned rule engine
- Tax classification
- RCM fields
- GST summary
- Transaction export
- Audit events

### Integration architecture
- E-invoice integration queue
- E-way bill integration queue
- Provider-agnostic adapter status
- Request/response/error storage
- Retry-ready records

## Important production note

The application is designed so GST rules can be updated and versioned. It does NOT claim that it will automatically remain legally compliant with every future Indian GST change without an authoritative update process and validation against official GST/CBIC requirements.

E-invoice and e-way bill adapters are intentionally provider-agnostic. Credentials and production API integration must be configured and validated with an authorised integration route before live filing.

## MySQL

Set these environment variables:

DB_HOST
DB_PORT
DB_NAME
DB_USER
DB_PASSWORD

The application creates its tables automatically. It does not drop existing tables.

## Run

npm install
npm start

Open http://localhost:3000

## Deployment

Use the same environment variables in Vercel/Hostinger. Never commit database passwords.
