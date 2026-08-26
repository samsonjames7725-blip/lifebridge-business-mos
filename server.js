import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from './src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_, res) => res.json({ ok:true, service:'LifeBridge Business MOS' }));
app.get('/api/dashboard', (_, res) => {
  const companies = db.prepare('SELECT COUNT(*) n FROM companies').get().n;
  const customers = db.prepare('SELECT COUNT(*) n FROM customers').get().n;
  const invoices = db.prepare('SELECT COUNT(*) n FROM invoices').get().n;
  const products = db.prepare('SELECT COUNT(*) n FROM products').get().n;
  res.json({ companies, customers, invoices, products, currency:'INR' });
});
app.get('/api/companies', (_, res) => res.json(db.prepare('SELECT * FROM companies ORDER BY name').all()));
app.get('/api/customers', (_, res) => res.json(db.prepare('SELECT * FROM customers ORDER BY name').all()));
app.get('/api/products', (_, res) => res.json(db.prepare('SELECT * FROM products ORDER BY name').all()));
app.get('/api/invoices', (_, res) => res.json(db.prepare('SELECT * FROM invoices ORDER BY id DESC').all()));

app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`LifeBridge Business MOS running on ${port}`));
