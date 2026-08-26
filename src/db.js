import mysql from "mysql2/promise";

const config={
  host:process.env.DB_HOST,
  port:Number(process.env.DB_PORT||3306),
  user:process.env.DB_USER,
  password:process.env.DB_PASSWORD,
  database:process.env.DB_NAME,
  waitForConnections:true,
  connectionLimit:8,
  queueLimit:0
};

let pool;
let initPromise;

function getPool(){
  if(!pool){
    if(!config.host||!config.user||!config.database)
      throw new Error("MySQL environment variables are not configured");
    pool=mysql.createPool(config);
  }
  return pool;
}

const tables={
  companies:"companies",
  "gst-registrations":"gst_registrations",
  customers:"customers",
  vendors:"vendors",
  products:"products"
};

async function init(){
  if(initPromise)return initPromise;
  initPromise=(async()=>{
    const p=getPool();

    await p.query(`CREATE TABLE IF NOT EXISTS companies(
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL, legal_name VARCHAR(255), pan VARCHAR(20),
      email VARCHAR(255), phone VARCHAR(40), address TEXT, city VARCHAR(120),
      state VARCHAR(120), pincode VARCHAR(20),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);

    await p.query(`CREATE TABLE IF NOT EXISTS gst_registrations(
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL, gstin VARCHAR(20) NOT NULL UNIQUE,
      legal_name VARCHAR(255), trade_name VARCHAR(255),
      state_code VARCHAR(10), state_name VARCHAR(120),
      registration_type VARCHAR(40) DEFAULT 'Regular',
      status VARCHAR(40) DEFAULT 'Active',
      effective_from DATE, effective_to DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX(company_id),
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
    )`);

    await p.query(`CREATE TABLE IF NOT EXISTS customers(
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL, name VARCHAR(255) NOT NULL,
      gstin VARCHAR(20), pan VARCHAR(20), state VARCHAR(120), city VARCHAR(120),
      phone VARCHAR(40), email VARCHAR(255), billing_address TEXT,
      shipping_address TEXT, credit_limit DECIMAL(15,2) DEFAULT 0,
      payment_terms_days INT DEFAULT 0, active TINYINT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX(company_id),
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
    )`);

    await p.query(`CREATE TABLE IF NOT EXISTS vendors(
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL, name VARCHAR(255) NOT NULL,
      gstin VARCHAR(20), pan VARCHAR(20), state VARCHAR(120), city VARCHAR(120),
      phone VARCHAR(40), email VARCHAR(255), address TEXT,
      payment_terms_days INT DEFAULT 0, active TINYINT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX(company_id),
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
    )`);

    await p.query(`CREATE TABLE IF NOT EXISTS products(
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL, name VARCHAR(255) NOT NULL,
      sku VARCHAR(100), barcode VARCHAR(100), hsn_sac VARCHAR(30) NOT NULL,
      description TEXT, unit VARCHAR(30) DEFAULT 'Nos',
      gst_rate DECIMAL(5,2) DEFAULT 18, cess_rate DECIMAL(5,2) DEFAULT 0,
      purchase_price DECIMAL(15,2) DEFAULT 0, sale_price DECIMAL(15,2) DEFAULT 0,
      opening_stock DECIMAL(15,3) DEFAULT 0, reorder_level DECIMAL(15,3) DEFAULT 0,
      active TINYINT DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX(company_id),
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
    )`);

    await p.query(`CREATE TABLE IF NOT EXISTS gst_rules(
      id INT AUTO_INCREMENT PRIMARY KEY,
      rule_code VARCHAR(100) NOT NULL, hsn_sac VARCHAR(30),
      description TEXT, gst_rate DECIMAL(5,2) NOT NULL,
      cgst_rate DECIMAL(5,2), sgst_rate DECIMAL(5,2), igst_rate DECIMAL(5,2),
      cess_rate DECIMAL(5,2) DEFAULT 0, effective_from DATE NOT NULL,
      effective_to DATE, source_reference TEXT, source_date DATE,
      status VARCHAR(40) DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX(hsn_sac), INDEX(effective_from)
    )`);

    await p.query(`CREATE TABLE IF NOT EXISTS invoice_sequences(
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL, fiscal_year VARCHAR(20) NOT NULL,
      prefix VARCHAR(30) DEFAULT 'INV',
      next_number INT NOT NULL DEFAULT 1,
      UNIQUE KEY company_year(company_id,fiscal_year),
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
    )`);

    await p.query(`CREATE TABLE IF NOT EXISTS invoices(
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      gst_registration_id INT,
      customer_id INT,
      invoice_no VARCHAR(80) NOT NULL,
      invoice_date DATE NOT NULL,
      due_date DATE,
      place_of_supply VARCHAR(120),
      supply_state VARCHAR(120),
      buyer_state VARCHAR(120),
      is_interstate TINYINT DEFAULT 0,
      subtotal DECIMAL(15,2) DEFAULT 0,
      discount_total DECIMAL(15,2) DEFAULT 0,
      taxable_total DECIMAL(15,2) DEFAULT 0,
      cgst_total DECIMAL(15,2) DEFAULT 0,
      sgst_total DECIMAL(15,2) DEFAULT 0,
      igst_total DECIMAL(15,2) DEFAULT 0,
      cess_total DECIMAL(15,2) DEFAULT 0,
      round_off DECIMAL(15,2) DEFAULT 0,
      grand_total DECIMAL(15,2) DEFAULT 0,
      paid_total DECIMAL(15,2) DEFAULT 0,
      balance_due DECIMAL(15,2) DEFAULT 0,
      status VARCHAR(30) DEFAULT 'Issued',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX(company_id), INDEX(invoice_date), INDEX(customer_id),
      UNIQUE KEY company_invoice(company_id,invoice_no),
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE RESTRICT,
      FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE SET NULL,
      FOREIGN KEY(gst_registration_id) REFERENCES gst_registrations(id) ON DELETE SET NULL
    )`);

    await p.query(`CREATE TABLE IF NOT EXISTS invoice_items(
      id INT AUTO_INCREMENT PRIMARY KEY,
      invoice_id INT NOT NULL, product_id INT,
      description VARCHAR(500), hsn_sac VARCHAR(30), unit VARCHAR(30),
      quantity DECIMAL(15,3) NOT NULL, rate DECIMAL(15,2) NOT NULL,
      discount_percent DECIMAL(7,3) DEFAULT 0,
      discount_amount DECIMAL(15,2) DEFAULT 0,
      taxable_value DECIMAL(15,2) DEFAULT 0,
      gst_rate DECIMAL(5,2) DEFAULT 0,
      cgst_rate DECIMAL(5,2) DEFAULT 0, cgst_amount DECIMAL(15,2) DEFAULT 0,
      sgst_rate DECIMAL(5,2) DEFAULT 0, sgst_amount DECIMAL(15,2) DEFAULT 0,
      igst_rate DECIMAL(5,2) DEFAULT 0, igst_amount DECIMAL(15,2) DEFAULT 0,
      cess_rate DECIMAL(5,2) DEFAULT 0, cess_amount DECIMAL(15,2) DEFAULT 0,
      line_total DECIMAL(15,2) DEFAULT 0,
      INDEX(invoice_id), INDEX(product_id),
      FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
    )`);

    await p.query(`CREATE TABLE IF NOT EXISTS payments(
      id INT AUTO_INCREMENT PRIMARY KEY,
      invoice_id INT NOT NULL, payment_date DATE NOT NULL,
      amount DECIMAL(15,2) NOT NULL, mode VARCHAR(40) DEFAULT 'Bank',
      reference_no VARCHAR(100), notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX(invoice_id),
      FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    )`);

    await p.query(`CREATE TABLE IF NOT EXISTS audit_log(
      id INT AUTO_INCREMENT PRIMARY KEY,
      entity_type VARCHAR(80) NOT NULL, entity_id INT,
      action VARCHAR(40) NOT NULL, details JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    const [rows]=await p.query("SELECT COUNT(*) n FROM companies");
    if(Number(rows[0].n)===0){
      await p.query(
        "INSERT INTO companies(name,legal_name,state) VALUES(?,?,?)",
        ["LifeBridge MedTech PVT. LTD.","LifeBridge MedTech PVT. LTD.","Maharashtra"]
      );
    }
  })();
  return initPromise;
}

function round(n){return Math.round((Number(n)+Number.EPSILON)*100)/100}
function normalizeState(v){return String(v||"").trim().toLowerCase()}

function fyFor(dateString){
  const d=new Date(dateString+"T00:00:00");
  const y=d.getFullYear(), m=d.getMonth()+1;
  return m>=4 ? `${y}-${String(y+1).slice(-2)}` : `${y-1}-${String(y).slice(-2)}`;
}

async function nextInvoiceNumber(conn,companyId,date,prefix="INV"){
  const fy=fyFor(date);
  await conn.query(
    `INSERT INTO invoice_sequences(company_id,fiscal_year,prefix,next_number)
     VALUES(?,?,?,1)
     ON DUPLICATE KEY UPDATE next_number=next_number`,
    [companyId,fy,prefix]
  );
  const [rows]=await conn.query(
    "SELECT next_number,prefix FROM invoice_sequences WHERE company_id=? AND fiscal_year=? FOR UPDATE",
    [companyId,fy]
  );
  const n=Number(rows[0].next_number);
  await conn.query(
    "UPDATE invoice_sequences SET next_number=? WHERE company_id=? AND fiscal_year=?",
    [n+1,companyId,fy]
  );
  return `${rows[0].prefix}/${fy}/${String(n).padStart(5,"0")}`;
}

async function list(route){
  await init();
  const p=getPool();
  const table=tables[route];
  if(!table)throw Error("Invalid resource");
  const [rows]=await p.query(`SELECT * FROM ${table} ORDER BY id DESC`);
  return rows;
}

async function createInvoice(input){
  await init();
  const p=getPool();
  const conn=await p.getConnection();
  try{
    await conn.beginTransaction();

    if(!input.company_id)throw Error("company_id is required");
    if(!input.customer_id)throw Error("customer_id is required");
    if(!Array.isArray(input.items)||!input.items.length)throw Error("At least one invoice item is required");

    const [companies]=await conn.query("SELECT * FROM companies WHERE id=?",[input.company_id]);
    if(!companies.length)throw Error("Company not found");
    const company=companies[0];

    const [customers]=await conn.query("SELECT * FROM customers WHERE id=? AND company_id=?",[input.customer_id,input.company_id]);
    if(!customers.length)throw Error("Customer not found for this company");
    const customer=customers[0];

    let gstReg=null;
    if(input.gst_registration_id){
      const [gr]=await conn.query(
        "SELECT * FROM gst_registrations WHERE id=? AND company_id=?",
        [input.gst_registration_id,input.company_id]
      );
      if(!gr.length)throw Error("GST registration not found for this company");
      gstReg=gr[0];
    }else{
      const [gr]=await conn.query(
        "SELECT * FROM gst_registrations WHERE company_id=? AND status='Active' ORDER BY id LIMIT 1",
        [input.company_id]
      );
      gstReg=gr[0]||null;
    }

    const invoiceDate=input.invoice_date||new Date().toISOString().slice(0,10);
    const buyerState=input.buyer_state||customer.state||"";
    const sellerState=input.supply_state||gstReg?.state_name||company.state||"";
    const interstate=normalizeState(buyerState)!==normalizeState(sellerState);
    const invoiceNo=await nextInvoiceNumber(conn,input.company_id,invoiceDate,input.prefix||"INV");

    let subtotal=0,discountTotal=0,taxableTotal=0,cgstTotal=0,sgstTotal=0,igstTotal=0,cessTotal=0;
    const calculated=[];

    for(const raw of input.items){
      if(!raw.product_id)throw Error("Each item needs product_id");
      const [products]=await conn.query("SELECT * FROM products WHERE id=? AND company_id=?",[raw.product_id,input.company_id]);
      if(!products.length)throw Error(`Product ${raw.product_id} not found for this company`);
      const product=products[0];

      const qty=Number(raw.quantity);
      const rate=Number(raw.rate ?? product.sale_price ?? 0);
      if(!(qty>0))throw Error("Quantity must be greater than zero");
      if(rate<0)throw Error("Rate cannot be negative");

      const gross=round(qty*rate);
      const dp=Number(raw.discount_percent||0);
      const discount=round(gross*Math.max(0,Math.min(100,dp))/100);
      const taxable=round(gross-discount);
      const gstRate=Number(raw.gst_rate ?? product.gst_rate ?? 0);
      const cessRate=Number(raw.cess_rate ?? product.cess_rate ?? 0);

      let cgstRate=0,sgstRate=0,igstRate=0;
      if(interstate) igstRate=gstRate;
      else {cgstRate=gstRate/2;sgstRate=gstRate/2;}

      const cgst=round(taxable*cgstRate/100);
      const sgst=round(taxable*sgstRate/100);
      const igst=round(taxable*igstRate/100);
      const cess=round(taxable*cessRate/100);
      const lineTotal=round(taxable+cgst+sgst+igst+cess);

      subtotal=round(subtotal+gross);
      discountTotal=round(discountTotal+discount);
      taxableTotal=round(taxableTotal+taxable);
      cgstTotal=round(cgstTotal+cgst);
      sgstTotal=round(sgstTotal+sgst);
      igstTotal=round(igstTotal+igst);
      cessTotal=round(cessTotal+cess);

      calculated.push({
        product_id:product.id,
        description:raw.description||product.name,
        hsn_sac:product.hsn_sac,
        unit:raw.unit||product.unit||"Nos",
        quantity:qty,rate,discount_percent:dp,discount_amount:discount,
        taxable_value:taxable,gst_rate:gstRate,
        cgst_rate:cgstRate,cgst_amount:cgst,
        sgst_rate:sgstRate,sgst_amount:sgst,
        igst_rate:igstRate,igst_amount:igst,
        cess_rate:cessRate,cess_amount:cess,line_total:lineTotal
      });
    }

    const beforeRound=round(taxableTotal+cgstTotal+sgstTotal+igstTotal+cessTotal);
    const roundOff=Number(input.round_off==="auto" ? Math.round(beforeRound)-beforeRound : Number(input.round_off||0));
    const grandTotal=round(beforeRound+roundOff);
    const dueDate=input.due_date||invoiceDate;

    const [ir]=await conn.query(
      `INSERT INTO invoices(
        company_id,gst_registration_id,customer_id,invoice_no,invoice_date,due_date,
        place_of_supply,supply_state,buyer_state,is_interstate,subtotal,discount_total,taxable_total,
        cgst_total,sgst_total,igst_total,cess_total,round_off,grand_total,paid_total,balance_due,status,notes
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        input.company_id,gstReg?.id||null,input.customer_id,invoiceNo,invoiceDate,dueDate,
        input.place_of_supply||buyerState,sellerState,buyerState,interstate?1:0,
        subtotal,discountTotal,taxableTotal,cgstTotal,sgstTotal,igstTotal,cessTotal,
        round(roundOff),grandTotal,0,grandTotal,"Issued",input.notes||null
      ]
    );

    for(const item of calculated){
      await conn.query(
        `INSERT INTO invoice_items(
          invoice_id,product_id,description,hsn_sac,unit,quantity,rate,discount_percent,discount_amount,
          taxable_value,gst_rate,cgst_rate,cgst_amount,sgst_rate,sgst_amount,igst_rate,igst_amount,
          cess_rate,cess_amount,line_total
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          ir.insertId,item.product_id,item.description,item.hsn_sac,item.unit,item.quantity,item.rate,
          item.discount_percent,item.discount_amount,item.taxable_value,item.gst_rate,
          item.cgst_rate,item.cgst_amount,item.sgst_rate,item.sgst_amount,item.igst_rate,item.igst_amount,
          item.cess_rate,item.cess_amount,item.line_total
        ]
      );
    }

    await conn.query(
      "INSERT INTO audit_log(entity_type,entity_id,action,details) VALUES(?,?,?,?)",
      ["invoice",ir.insertId,"CREATE",JSON.stringify({invoice_no:invoiceNo,grand_total:grandTotal})]
    );

    await conn.commit();
    return await getInvoice(ir.insertId);
  }catch(e){
    await conn.rollback();
    throw e;
  }finally{conn.release();}
}

async function getInvoice(id){
  await init();
  const p=getPool();
  const [head]=await p.query(
    `SELECT i.*,c.name company_name,c.legal_name company_legal_name,c.state company_state,
      c.address company_address,c.city company_city,c.pincode company_pincode,
      cu.name customer_name,cu.gstin customer_gstin,cu.pan customer_pan,
      cu.state customer_state,cu.city customer_city,cu.billing_address customer_address,
      gr.gstin seller_gstin,gr.trade_name seller_trade_name,gr.state_name seller_state_name
     FROM invoices i
     JOIN companies c ON c.id=i.company_id
     LEFT JOIN customers cu ON cu.id=i.customer_id
     LEFT JOIN gst_registrations gr ON gr.id=i.gst_registration_id
     WHERE i.id=?`,
    [id]
  );
  if(!head.length)throw Error("Invoice not found");
  const [items]=await p.query("SELECT * FROM invoice_items WHERE invoice_id=? ORDER BY id",[id]);
  const [payments]=await p.query("SELECT * FROM payments WHERE invoice_id=? ORDER BY payment_date,id",[id]);
  return {...head[0],items,payments};
}

async function listInvoices(query){
  await init();
  const p=getPool();
  let sql=`SELECT i.id,i.invoice_no,i.invoice_date,i.due_date,i.grand_total,i.paid_total,i.balance_due,
    i.status,c.name customer_name,co.name company_name
    FROM invoices i JOIN companies co ON co.id=i.company_id
    LEFT JOIN customers c ON c.id=i.customer_id`;
  const params=[];
  const where=[];
  if(query.company_id){where.push("i.company_id=?");params.push(Number(query.company_id))}
  if(query.status){where.push("i.status=?");params.push(query.status)}
  if(where.length)sql+=" WHERE "+where.join(" AND ");
  sql+=" ORDER BY i.invoice_date DESC,i.id DESC";
  const [rows]=await p.query(sql,params);
  return rows;
}

async function addPayment(invoiceId,input){
  await init();
  const p=getPool();
  const conn=await p.getConnection();
  try{
    await conn.beginTransaction();
    const amount=round(Number(input.amount));
    if(!(amount>0))throw Error("Payment amount must be greater than zero");
    const [inv]=await conn.query("SELECT * FROM invoices WHERE id=? FOR UPDATE",[invoiceId]);
    if(!inv.length)throw Error("Invoice not found");
    const invoice=inv[0];
    if(amount>Number(invoice.balance_due)+0.01)throw Error("Payment exceeds outstanding balance");

    const date=input.payment_date||new Date().toISOString().slice(0,10);
    await conn.query(
      "INSERT INTO payments(invoice_id,payment_date,amount,mode,reference_no,notes) VALUES(?,?,?,?,?,?)",
      [invoiceId,date,amount,input.mode||"Bank",input.reference_no||null,input.notes||null]
    );

    const newPaid=round(Number(invoice.paid_total)+amount);
    const balance=round(Number(invoice.grand_total)-newPaid);
    const status=balance<=0.01?"Paid":"Partially Paid";
    await conn.query("UPDATE invoices SET paid_total=?,balance_due=?,status=? WHERE id=?",[newPaid,Math.max(0,balance),status,invoiceId]);
    await conn.query("INSERT INTO audit_log(entity_type,entity_id,action,details) VALUES(?,?,?,?)",["invoice",invoiceId,"PAYMENT",JSON.stringify({amount,mode:input.mode||"Bank"})]);
    await conn.commit();
    return await getInvoice(invoiceId);
  }catch(e){await conn.rollback();throw e}
  finally{conn.release();}
}

async function dashboard(){
  await init();
  const p=getPool();
  const counts={};
  for(const [key,table] of Object.entries(tables)){
    const [r]=await p.query(`SELECT COUNT(*) n FROM ${table}`);
    counts[key==="gst-registrations"?"gstins":key]=Number(r[0].n);
  }
  const [inv]=await p.query(`SELECT
    COUNT(*) invoice_count,
    COALESCE(SUM(grand_total),0) billed,
    COALESCE(SUM(paid_total),0) collected,
    COALESCE(SUM(balance_due),0) outstanding
    FROM invoices`);
  const [today]=await p.query(`SELECT COUNT(*) count_today,COALESCE(SUM(grand_total),0) value_today
    FROM invoices WHERE invoice_date=CURDATE()`);
  return {...counts,...inv[0],...today[0],database:"mysql",phase:3};
}

function esc(s){
  return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
}
function money(n){return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(n||0));}

function printInvoiceHtml(i){
  const rows=i.items.map((x,n)=>`<tr>
    <td>${n+1}</td><td>${esc(x.description)}<br><small>HSN/SAC: ${esc(x.hsn_sac)}</small></td>
    <td>${esc(x.quantity)} ${esc(x.unit)}</td><td>${money(x.rate)}</td>
    <td>${money(x.taxable_value)}</td><td>${x.gst_rate}%</td><td>${money(x.line_total)}</td>
  </tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(i.invoice_no)}</title>
  <style>
  body{font-family:Arial,sans-serif;margin:28px;color:#172033}h1{margin:0 0 4px;font-size:24px}
  .muted{color:#667085;font-size:12px}.top{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #111;padding-bottom:16px}
  .box{border:1px solid #ddd;padding:12px;margin-top:14px}.row{display:flex;justify-content:space-between;gap:20px}
  table{width:100%;border-collapse:collapse;margin-top:14px;font-size:12px}th,td{border:1px solid #ddd;padding:8px;text-align:left}
  th{background:#f5f5f5}.right{text-align:right}.totals{margin-left:auto;width:320px}.print{padding:9px 14px;border:1px solid #aaa;background:#fff}
  @media print{.no-print{display:none}}
  </style></head><body>
  <div class="no-print"><button class="print" onclick="window.print()">Print / Save PDF</button></div>
  <div class="top"><div><h1>${esc(i.company_legal_name||i.company_name)}</h1>
  <div class="muted">${esc(i.company_address||"")} ${esc(i.company_city||"")} ${esc(i.company_state||"")} ${esc(i.company_pincode||"")}</div>
  <b>GSTIN: ${esc(i.seller_gstin||"Not configured")}</b></div>
  <div><h2>TAX INVOICE</h2><div>Invoice No: <b>${esc(i.invoice_no)}</b></div><div>Date: ${esc(i.invoice_date)}</div><div>Due: ${esc(i.due_date||"")}</div></div></div>
  <div class="row">
    <div class="box" style="flex:1"><b>Bill To</b><br>${esc(i.customer_name||"")}<br>${esc(i.customer_address||"")}<br>GSTIN: ${esc(i.customer_gstin||"Unregistered")}<br>State: ${esc(i.customer_state||"")}</div>
    <div class="box" style="width:250px"><b>Supply</b><br>Place of Supply: ${esc(i.place_of_supply||"")}<br>Tax Type: ${i.is_interstate?"IGST":"CGST + SGST"}</div>
  </div>
  <table><thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Rate</th><th>Taxable</th><th>GST</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="totals"><table>
  <tr><td>Subtotal</td><td class="right">${money(i.subtotal)}</td></tr>
  <tr><td>Discount</td><td class="right">${money(i.discount_total)}</td></tr>
  <tr><td>Taxable Value</td><td class="right">${money(i.taxable_total)}</td></tr>
  <tr><td>CGST</td><td class="right">${money(i.cgst_total)}</td></tr>
  <tr><td>SGST</td><td class="right">${money(i.sgst_total)}</td></tr>
  <tr><td>IGST</td><td class="right">${money(i.igst_total)}</td></tr>
  <tr><td>Cess</td><td class="right">${money(i.cess_total)}</td></tr>
  <tr><th>Grand Total</th><th class="right">${money(i.grand_total)}</th></tr>
  </table></div>
  <div class="box"><b>Payment Status:</b> ${esc(i.status)} · Paid ${money(i.paid_total)} · Balance ${money(i.balance_due)}</div>
  <p class="muted">GST calculation is generated by the application rules. Verify applicable GST treatment before issuing the invoice.</p>
  </body></html>`;
}

export default {list,createInvoice,getInvoice,listInvoices,addPayment,dashboard,printInvoiceHtml};
