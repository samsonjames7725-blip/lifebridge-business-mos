# LifeBridge Business MOS — Phase 3 Billing

Phase 3 adds a working GST billing foundation on the Phase 2 MySQL master-data system.

## Included

- Sales invoices
- Invoice line items
- Automatic invoice numbering per company
- Customer and product selection
- CGST + SGST for intra-state sales
- IGST for inter-state sales
- GST rate per product
- Taxable value calculation
- Discount calculation
- Payment recording
- Outstanding balance
- Invoice status
- Printable GST invoice page
- Invoice API
- Dashboard billing metrics
- Multi-company and multi-GSTIN ready schema
- Audit log

## MySQL

Set:

DB_HOST
DB_PORT
DB_NAME
DB_USER
DB_PASSWORD

The application creates the Phase 2 and Phase 3 tables automatically.

## API

GET /api/health
GET /api/dashboard
GET /api/companies
GET /api/gst-registrations
GET /api/customers
GET /api/products
GET /api/invoices
POST /api/invoices
GET /api/invoices/:id
POST /api/invoices/:id/payments
GET /api/invoices/:id/print

## Tax behavior

The invoice endpoint calculates GST from the product GST rate and compares the selected seller GST state with the customer's state.

- Same state: CGST + SGST
- Different state: IGST

This is a billing-engine foundation, not a claim of automatic legal compliance with every future GST change. GST rules should be validated and updated from authoritative government sources before production use.

## Phase 4

Purchases, inventory movement, credit/debit notes, e-invoice/e-way-bill integration architecture, GST reports and accounting.
