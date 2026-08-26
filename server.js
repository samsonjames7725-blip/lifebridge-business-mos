import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool, initDb, transaction } from "./src/db.js";
import { calculateTax, classifySupply, isInterState, resolveRule } from "./src/gst.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json({limit:"4mb"}));
app.use(express.static(path.join(__dirname,"public")));

const n=v=>Number(v||0);
const r2=v=>Math.round((n(v)+Number.EPSILON)*100)/100;
const today=()=>new Date().toISOString().slice(0,10);
const fy=d=>{const x=new Date(d+"T00:00:00"),y=x.getFullYear(),m=x.getMonth()+1;return m>=4?`${y}-${String(y+1).slice(-2)}`:`${y-1}-${String(y).slice(-2)}`};
const ok=(res,data,status=200)=>res.status(status).json({ok:true,data});
const bad=(res,e,status=400)=>res.status(status).json({ok:false,error:e.message||String(e)});

async function nextNo(conn,companyId,date,prefix){
  const year=fy(date);
  await conn.query(`INSERT INTO invoice_sequences(company_id,fiscal_year,prefix,next_number)
    VALUES(?,?,?,1) ON DUPLICATE KEY UPDATE next_number=next_number`,
    [companyId,year,prefix]);
  const [rows]=await conn.query("SELECT prefix,next_number FROM invoice_sequences WHERE company_id=? AND fiscal_year=? FOR UPDATE",[companyId,year]);
  await conn.query("UPDATE invoice_sequences SET next_number=? WHERE company_id=? AND fiscal_year=?",[Number(rows[0].next_number)+1,companyId,year]);
  return `${rows[0].prefix}/${year}/${String(rows[0].next_number).padStart(5,"0")}`;
}

async function audit(conn, companyId, entityType, entityId, action, details){
  await conn.query("INSERT INTO audit_log(company_id,entity_type,entity_id,action,details) VALUES(?,?,?,?,?)",
    [companyId,entityType,entityId,action,JSON.stringify(details||{})]);
}

app.get("/api/health",async(_q,res)=>{try{await getPool().query("SELECT 1");ok(res,{phase:"unified-5.0",database:"mysql",status:"ready",time:new Date().toISOString()})}catch(e){bad(res,e,500)}});

const resources={
 companies:"companies",customers:"customers",vendors:"vendors",products:"products",
 branches:"branches",users:"users","gst-registrations":"gst_registrations","gst-rules":"gst_rules"
};
for(const [route,table] of Object.entries(resources)){
  app.get(`/api/${route}`,async(_q,res)=>{try{const [rows]=await getPool().query(`SELECT * FROM ${table} ORDER BY id DESC`);ok(res,rows)}catch(e){bad(res,e,500)}});
}

app.get("/api/dashboard",async(_q,res)=>{
  try{
    const p=getPool();
    const [[inv]] = await p.query("SELECT COUNT(*) invoice_count,COALESCE(SUM(grand_total),0) revenue,COALESCE(SUM(balance_due),0) outstanding FROM invoices");
    const [[qt]] = await p.query("SELECT COUNT(*) quotation_count,COALESCE(SUM(grand_total),0) quotation_value FROM quotations");
    const [[gst]] = await p.query("SELECT COALESCE(SUM(cgst_total),0) cgst,COALESCE(SUM(sgst_total),0) sgst,COALESCE(SUM(igst_total),0) igst,COALESCE(SUM(cess_total),0) cess FROM invoices");
    const [[stock]] = await p.query("SELECT COUNT(*) stock_items,COALESCE(SUM(CASE WHEN qty<=reorder_level THEN 1 ELSE 0 END),0) low_stock FROM inventory_stock");
    const [[companies]] = await p.query("SELECT COUNT(*) companies FROM companies");
    const [[gstins]] = await p.query("SELECT COUNT(*) gstins FROM gst_registrations");
    ok(res,{...inv,...qt,...gst,...stock,...companies,...gstins});
  }catch(e){bad(res,e,500)}
});

app.post("/api/gst/rules",async(req,res)=>{
  try{
    const b=req.body;
    if(!b.rule_code||b.gst_rate===undefined||!b.effective_from)throw Error("rule_code, gst_rate and effective_from are required");
    const [r]=await getPool().query(
      `INSERT INTO gst_rules(rule_code,hsn_sac,description,gst_rate,cgst_rate,sgst_rate,igst_rate,cess_rate,rcm_applicable,rcm_category,effective_from,effective_to,source_reference,source_date,status)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [b.rule_code,b.hsn_sac||null,b.description||null,n(b.gst_rate),n(b.cgst_rate)||n(b.gst_rate)/2,n(b.sgst_rate)||n(b.gst_rate)/2,n(b.igst_rate)||n(b.gst_rate),n(b.cess_rate),b.rcm_applicable?1:0,b.rcm_category||null,b.effective_from,b.effective_to||null,b.source_reference||null,b.source_date||null,b.status||"Active"]
    );
    ok(res,{id:r.insertId},201);
  }catch(e){bad(res,e)}
});

app.post("/api/invoices",async(req,res)=>{
  try{
    const b=req.body, items=Array.isArray(b.items)?b.items:[];
    if(!b.company_id||!b.customer_id||!items.length)throw Error("company_id, customer_id and at least one item are required");
    const out=await transaction(async conn=>{
      const [[company]]=await conn.query("SELECT * FROM companies WHERE id=?",[b.company_id]);
      if(!company)throw Error("Company not found");
      const [[customer]]=await conn.query("SELECT * FROM customers WHERE id=? AND company_id=?",[b.customer_id,b.company_id]);
      if(!customer)throw Error("Customer not found for this company");
      let gstReg=null;
      if(b.gst_registration_id){
        const [[g]]=await conn.query("SELECT * FROM gst_registrations WHERE id=? AND company_id=?",[b.gst_registration_id,b.company_id]);gstReg=g;
      }else{
        const [[g]]=await conn.query("SELECT * FROM gst_registrations WHERE company_id=? AND status='Active' ORDER BY id LIMIT 1",[b.company_id]);gstReg=g;
      }
      const date=b.invoice_date||today();
      const sellerState=b.seller_state||gstReg?.state_name||company.state||"";
      const buyerState=b.buyer_state||customer.state||"";
      const interstate=isInterState(sellerState,buyerState);
      const supplyType=classifySupply(customer);
      const invoiceNo=await nextNo(conn,b.company_id,date,b.prefix||"INV");
      let subtotal=0,discount=0,taxable=0,cgst=0,sgst=0,igst=0,cess=0,rcmTax=0;
      const calc=[];
      for(const item of items){
        const [[product]]=await conn.query("SELECT * FROM products WHERE id=? AND company_id=?",[item.product_id,b.company_id]);
        if(!product)throw Error(`Product ${item.product_id} not found`);
        const qty=n(item.quantity), rate=n(item.rate ?? product.sale_price);
        const gross=r2(qty*rate), dis=r2(gross*n(item.discount_percent)/100), taxBase=r2(gross-dis);
        const rule=await resolveRule(conn,product.hsn_sac,date);
        const gstRate=n(item.gst_rate ?? rule?.gst_rate ?? product.gst_rate);
        const cessRate=n(item.cess_rate ?? rule?.cess_rate ?? product.cess_rate);
        const rcm=Boolean(b.rcm_applicable ?? rule?.rcm_applicable);
        const t=calculateTax(taxBase,gstRate,cessRate,interstate,rcm);
        subtotal+=gross;discount+=dis;taxable+=taxBase;cgst+=t.cgst_amount;sgst+=t.sgst_amount;igst+=t.igst_amount;cess+=t.cess_amount;rcmTax+=t.rcm_amount;
        calc.push({product,qty,rate,dis,taxBase,gstRate,cessRate,rcm,t});
      }
      const total=r2(taxable+cgst+sgst+igst+cess);
      const [ir]=await conn.query(
        `INSERT INTO invoices(company_id,gst_registration_id,branch_id,customer_id,invoice_no,invoice_date,due_date,place_of_supply,seller_state,buyer_state,supply_type,is_interstate,rcm_applicable,rcm_category,rcm_tax,subtotal,discount_total,taxable_total,cgst_total,sgst_total,igst_total,cess_total,grand_total,balance_due,notes)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [b.company_id,gstReg?.id||null,b.branch_id||null,b.customer_id,invoiceNo,date,b.due_date||date,b.place_of_supply||buyerState,sellerState,buyerState,supplyType,interstate?1:0,b.rcm_applicable?1:0,b.rcm_category||null,r2(rcmTax),r2(subtotal),r2(discount),r2(taxable),r2(cgst),r2(sgst),r2(igst),r2(cess),total,total,b.notes||null]
      );
      for(const x of calc){
        await conn.query(
          `INSERT INTO invoice_items(invoice_id,product_id,description,hsn_sac,unit,quantity,rate,discount_percent,discount_amount,taxable_value,gst_rate,cgst_rate,cgst_amount,sgst_rate,sgst_amount,igst_rate,igst_amount,cess_rate,cess_amount,rcm_amount,line_total)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [ir.insertId,x.product.id,x.product.name,x.product.hsn_sac,x.product.unit,x.qty,x.rate,n(b.items.find(i=>i.product_id===x.product.id)?.discount_percent),x.dis,x.taxBase,x.gstRate,x.t.cgst_rate,x.t.cgst_amount,x.t.sgst_rate,x.t.sgst_amount,x.t.igst_rate,x.t.igst_amount,x.cessRate,x.t.cess_amount,x.t.rcm_amount,r2(x.taxBase+x.t.total_tax)]
        );
      }
      await audit(conn,b.company_id,"invoice",ir.insertId,"INVOICE_ISSUED",{invoice_no:invoiceNo,supply_type:supplyType,place_of_supply:b.place_of_supply||buyerState,interstate,rcm:b.rcm_applicable||false});
      return {id:ir.insertId,invoice_no:invoiceNo,grand_total:total,supply_type:supplyType,interstate,rcm_tax:r2(rcmTax)};
    });
    ok(res,out,201);
  }catch(e){bad(res,e)}
});

app.get("/api/invoices",async(req,res)=>{
  try{
    const [rows]=await getPool().query(
      `SELECT i.*,c.name customer_name,co.name company_name FROM invoices i JOIN companies co ON co.id=i.company_id LEFT JOIN customers c ON c.id=i.customer_id
       WHERE (? IS NULL OR i.company_id=?) ORDER BY i.invoice_date DESC,i.id DESC`,
      [req.query.company_id||null,req.query.company_id||null]
    );ok(res,rows);
  }catch(e){bad(res,e,500)}
});

app.get("/api/invoices/:id",async(req,res)=>{
  try{
    const p=getPool();
    const [[invoice]]=await p.query(`SELECT i.*,co.name company_name,co.legal_name company_legal_name,co.address company_address,co.state company_state,
      c.name customer_name,c.gstin customer_gstin,c.state customer_state,c.billing_address customer_address,
      g.gstin seller_gstin,g.trade_name seller_trade_name
      FROM invoices i JOIN companies co ON co.id=i.company_id LEFT JOIN customers c ON c.id=i.customer_id LEFT JOIN gst_registrations g ON g.id=i.gst_registration_id
      WHERE i.id=?`,[req.params.id]);
    if(!invoice)throw Error("Invoice not found");
    const [items]=await p.query("SELECT * FROM invoice_items WHERE invoice_id=? ORDER BY id",[req.params.id]);
    const [payments]=await p.query("SELECT * FROM payments WHERE invoice_id=? ORDER BY id DESC",[req.params.id]);
    ok(res,{...invoice,items,payments});
  }catch(e){bad(res,e,404)}
});

app.post("/api/invoices/:id/payments",async(req,res)=>{
  try{
    const out=await transaction(async conn=>{
      const [[i]]=await conn.query("SELECT * FROM invoices WHERE id=? FOR UPDATE",[req.params.id]);
      if(!i)throw Error("Invoice not found");
      const amount=r2(req.body.amount);
      if(amount<=0||amount>n(i.balance_due)+.01)throw Error("Invalid payment amount");
      await conn.query("INSERT INTO payments(invoice_id,payment_date,amount,mode,reference_no,notes) VALUES(?,?,?,?,?,?)",
        [req.params.id,req.body.payment_date||today(),amount,req.body.mode||"Bank",req.body.reference_no||null,req.body.notes||null]);
      const paid=r2(n(i.paid_total)+amount), balance=Math.max(0,r2(n(i.grand_total)-paid));
      const status=balance<=.01?"Paid":"Partially Paid";
      await conn.query("UPDATE invoices SET paid_total=?,balance_due=?,status=? WHERE id=?",[paid,balance,status,req.params.id]);
      await audit(conn,i.company_id,"invoice",req.params.id,"PAYMENT",{amount,mode:req.body.mode||"Bank"});
      return {paid,balance,status};
    });ok(res,out,201);
  }catch(e){bad(res,e)}
});

app.post("/api/purchases",async(req,res)=>{
  try{
    const b=req.body,items=b.items||[];
    const out=await transaction(async conn=>{
      let taxable=0,cgst=0,sgst=0,igst=0,cess=0,rcm=0;
      for(const x of items){
        const base=r2(n(x.qty)*n(x.rate)); const t=calculateTax(base,n(x.gst_rate),n(x.cess_rate),!b.intra_state,Boolean(x.rcm));
        taxable+=base;cgst+=t.cgst_amount;sgst+=t.sgst_amount;igst+=t.igst_amount;cess+=t.cess_amount;rcm+=t.rcm_amount;
      }
      const total=r2(taxable+cgst+sgst+igst+cess);
      const [r]=await conn.query(`INSERT INTO purchase_bills(company_id,gst_registration_id,branch_id,vendor_id,bill_no,bill_date,place_of_supply,taxable_value,cgst,sgst,igst,cess,rcm_applicable,rcm_tax,total)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[b.company_id,b.gst_registration_id||null,b.branch_id||null,b.vendor_id,b.bill_no,b.bill_date||today(),b.place_of_supply||null,r2(taxable),r2(cgst),r2(sgst),r2(igst),r2(cess),b.rcm_applicable?1:0,r2(rcm),total]);
      for(const x of items){
        const base=r2(n(x.qty)*n(x.rate));const t=calculateTax(base,n(x.gst_rate),n(x.cess_rate),!b.intra_state,Boolean(x.rcm));
        await conn.query(`INSERT INTO purchase_items(purchase_bill_id,product_id,hsn_sac,qty,rate,taxable_value,gst_rate,cgst,sgst,igst,cess) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
          [r.insertId,x.product_id,x.hsn_sac||null,n(x.qty),n(x.rate),base,n(x.gst_rate),t.cgst_amount,t.sgst_amount,t.igst_amount,t.cess_amount]);
        await conn.query(`INSERT INTO inventory_stock(company_id,branch_id,product_id,qty,avg_cost,reorder_level)
          VALUES(?,?,?,?,?,0) ON DUPLICATE KEY UPDATE qty=qty+VALUES(qty),avg_cost=IF(qty+VALUES(qty)>0,((qty*avg_cost)+(VALUES(qty)*VALUES(avg_cost)))/(qty+VALUES(qty)),avg_cost)`,
          [b.company_id,b.branch_id||null,x.product_id,n(x.qty),n(x.rate)]);
        const [[s]]=await conn.query("SELECT qty FROM inventory_stock WHERE company_id=? AND branch_id <=> ? AND product_id=?",[b.company_id,b.branch_id||null,x.product_id]);
        await conn.query(`INSERT INTO stock_ledger(company_id,branch_id,product_id,txn_type,reference_type,reference_id,qty_in,unit_cost,balance_qty,note) VALUES(?,?,?,?,?,?,?,?,?,?)`,
          [b.company_id,b.branch_id||null,x.product_id,"PURCHASE","PURCHASE_BILL",r.insertId,n(x.qty),n(x.rate),n(s.qty),"Purchase receipt"]);
      }
      await audit(conn,b.company_id,"purchase_bill",r.insertId,"PURCHASE_POSTED",{bill_no:b.bill_no,total});
      return {id:r.insertId,total};
    });ok(res,out,201);
  }catch(e){bad(res,e)}
});

app.post("/api/stock/adjust",async(req,res)=>{
  try{
    const out=await transaction(async conn=>{
      const company=n(req.body.company_id),branch=req.body.branch_id||null,product=n(req.body.product_id),qin=n(req.body.qty_in),qout=n(req.body.qty_out);
      await conn.query(`INSERT INTO inventory_stock(company_id,branch_id,product_id,qty,avg_cost,reorder_level) VALUES(?,?,?,?,?,0) ON DUPLICATE KEY UPDATE qty=qty+VALUES(qty)`,
        [company,branch,product,qin-qout,n(req.body.unit_cost)]);
      const [[s]]=await conn.query("SELECT qty FROM inventory_stock WHERE company_id=? AND branch_id <=> ? AND product_id=?",[company,branch,product]);
      if(n(s.qty)<0)throw Error("Stock cannot become negative");
      await conn.query(`INSERT INTO stock_ledger(company_id,branch_id,product_id,txn_type,qty_in,qty_out,unit_cost,balance_qty,note) VALUES(?,?,?,?,?,?,?,?,?)`,
        [company,branch,product,"ADJUSTMENT",qin,qout,n(req.body.unit_cost),n(s.qty),req.body.note||"Manual adjustment"]);
      return {qty:s.qty};
    });ok(res,out);
  }catch(e){bad(res,e)}
});

app.get("/api/stock",async(req,res)=>{
  try{const [rows]=await getPool().query(`SELECT s.*,p.name product_name,p.sku,p.hsn_sac FROM inventory_stock s JOIN products p ON p.id=s.product_id WHERE s.company_id=? ORDER BY p.name`,[req.query.company_id||1]);ok(res,rows)}catch(e){bad(res,e,500)}
});

app.post("/api/notes",async(req,res)=>{
  try{
    const b=req.body,items=b.items||[];
    const out=await transaction(async conn=>{
      let taxable=0,cgst=0,sgst=0,igst=0,cess=0;
      for(const x of items){const base=r2(n(x.qty)*n(x.rate));const t=calculateTax(base,n(x.gst_rate),n(x.cess_rate),!b.intra_state,false);taxable+=base;cgst+=t.cgst_amount;sgst+=t.sgst_amount;igst+=t.igst_amount;cess+=t.cess_amount}
      const total=r2(taxable+cgst+sgst+igst+cess);
      const [r]=await conn.query(`INSERT INTO credit_debit_notes(company_id,gst_registration_id,party_type,party_id,note_type,note_no,note_date,reason,taxable_value,cgst,sgst,igst,cess,total)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[b.company_id,b.gst_registration_id||null,b.party_type,b.party_id,b.note_type,b.note_no,b.note_date||today(),b.reason||null,r2(taxable),r2(cgst),r2(sgst),r2(igst),r2(cess),total]);
      for(const x of items)await conn.query(`INSERT INTO credit_debit_note_items(note_id,product_id,description,qty,rate,taxable_value,gst_rate,cgst,sgst,igst,cess) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
        [r.insertId,x.product_id||null,x.description||null,n(x.qty),n(x.rate),r2(n(x.qty)*n(x.rate)),n(x.gst_rate),0,0,0,0]);
      await audit(conn,b.company_id,"note",r.insertId,b.note_type+"_NOTE",{note_no:b.note_no,total});
      return {id:r.insertId,total};
    });ok(res,out,201);
  }catch(e){bad(res,e)}
});

app.get("/api/gst/summary",async(req,res)=>{
  try{
    const p=getPool(),company=n(req.query.company_id),from=req.query.from,to=req.query.to;
    const [[s]]=await p.query(`SELECT COUNT(*) invoices,COALESCE(SUM(taxable_total),0) taxable,COALESCE(SUM(cgst_total),0) cgst,COALESCE(SUM(sgst_total),0) sgst,COALESCE(SUM(igst_total),0) igst,COALESCE(SUM(cess_total),0) cess,COALESCE(SUM(rcm_tax),0) rcm FROM invoices WHERE company_id=? AND invoice_date BETWEEN ? AND ?`,[company,from,to]);
    const [[pur]]=await p.query(`SELECT COUNT(*) bills,COALESCE(SUM(taxable_value),0) taxable,COALESCE(SUM(cgst),0) cgst,COALESCE(SUM(sgst),0) sgst,COALESCE(SUM(igst),0) igst,COALESCE(SUM(cess),0) cess,COALESCE(SUM(rcm_tax),0) rcm FROM purchase_bills WHERE company_id=? AND bill_date BETWEEN ? AND ?`,[company,from,to]);
    ok(res,{period:{from,to},outward:s,inward:pur,net_output_tax:r2(n(s.cgst)+n(s.sgst)+n(s.igst)+n(s.cess)),estimated_net_after_input_tax:r2(n(s.cgst)+n(s.sgst)+n(s.igst)+n(s.cess)-n(pur.cgst)-n(pur.sgst)-n(pur.igst)-n(pur.cess)),note:"Validate filing treatment against current official GST requirements."});
  }catch(e){bad(res,e,500)}
});

app.get("/api/audit",async(req,res)=>{
  try{const [rows]=await getPool().query("SELECT * FROM audit_log WHERE (? IS NULL OR company_id=?) ORDER BY id DESC LIMIT 300",[req.query.company_id||null,req.query.company_id||null]);ok(res,rows)}catch(e){bad(res,e,500)}
});

app.get("/api/gst/integrations",async(req,res)=>{
  try{const [rows]=await getPool().query("SELECT * FROM gst_integration_queue WHERE company_id=? ORDER BY id DESC",[req.query.company_id||1]);ok(res,rows)}catch(e){bad(res,e,500)}
});

app.post("/api/gst/integrations/queue",async(req,res)=>{
  try{
    const b=req.body;
    if(!["E_INVOICE","EWAY_BILL"].includes(b.integration_type))throw Error("integration_type must be E_INVOICE or EWAY_BILL");
    const [r]=await getPool().query(`INSERT INTO gst_integration_queue(company_id,invoice_id,integration_type,status,request_json,requested_at) VALUES(?,?,?,?,?,NOW())`,
      [b.company_id,b.invoice_id||null,b.integration_type,"PENDING",JSON.stringify(b.payload||{})]);
    ok(res,{id:r.insertId,status:"PENDING",message:"Queued for an authorised integration adapter."},201);
  }catch(e){bad(res,e)}
});

app.get("/api/reports/gst.csv",async(req,res)=>{
  try{
    const [rows]=await getPool().query(`SELECT invoice_no,invoice_date,supply_type,place_of_supply,rcm_applicable,taxable_total,cgst_total,sgst_total,igst_total,cess_total,rcm_tax,grand_total FROM invoices WHERE company_id=? AND invoice_date BETWEEN ? AND ? ORDER BY invoice_date,invoice_no`,
      [req.query.company_id||1,req.query.from,req.query.to]);
    const head="invoice_no,invoice_date,supply_type,place_of_supply,rcm_applicable,taxable_total,cgst_total,sgst_total,igst_total,cess_total,rcm_tax,grand_total";
    const lines=rows.map(x=>Object.values(x).map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(","));
    res.type("text/csv").send([head,...lines].join("\n"));
  }catch(e){bad(res,e,500)}
});

app.get("/api/invoices/:id/print",async(req,res)=>{
  try{
    const p=getPool();
    const [[i]]=await p.query(`SELECT i.*,co.name company_name,co.legal_name company_legal_name,co.address company_address,co.state company_state,
      c.name customer_name,c.gstin customer_gstin,c.state customer_state,c.billing_address customer_address,g.gstin seller_gstin
      FROM invoices i JOIN companies co ON co.id=i.company_id LEFT JOIN customers c ON c.id=i.customer_id LEFT JOIN gst_registrations g ON g.id=i.gst_registration_id WHERE i.id=?`,[req.params.id]);
    if(!i)throw Error("Invoice not found");
    const [items]=await p.query("SELECT * FROM invoice_items WHERE invoice_id=? ORDER BY id",[req.params.id]);
    const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
    const money=v=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR"}).format(n(v));
    res.send(`<!doctype html><html><head><meta charset=utf-8><title>${esc(i.invoice_no)}</title><style>body{font-family:Arial;margin:30px;color:#172033}table{width:100%;border-collapse:collapse;margin-top:15px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f3f4f6}.r{text-align:right}.top{display:flex;justify-content:space-between}.no-print{margin-bottom:15px}@media print{.no-print{display:none}}</style></head><body>
      <div class=no-print><button onclick="print()">Print / Save PDF</button></div><div class=top><div><h1>${esc(i.company_legal_name||i.company_name)}</h1><div>${esc(i.company_address||"")} ${esc(i.company_state||"")}</div><b>GSTIN: ${esc(i.seller_gstin||"Not configured")}</b></div><div><h2>TAX INVOICE</h2>Invoice: <b>${esc(i.invoice_no)}</b><br>Date: ${esc(i.invoice_date)}<br>Supply: ${esc(i.supply_type)}<br>POS: ${esc(i.place_of_supply)}</div></div>
      <hr><b>Bill To:</b> ${esc(i.customer_name)} · GSTIN ${esc(i.customer_gstin||"Unregistered")} · ${esc(i.customer_state||"")}<table><tr><th>#</th><th>Description</th><th>HSN/SAC</th><th>Qty</th><th>Rate</th><th>Taxable</th><th>Tax</th><th>Total</th></tr>${items.map((x,k)=>`<tr><td>${k+1}</td><td>${esc(x.description)}</td><td>${esc(x.hsn_sac)}</td><td>${x.quantity}</td><td>${money(x.rate)}</td><td>${money(x.taxable_value)}</td><td>${money(n(x.cgst_amount)+n(x.sgst_amount)+n(x.igst_amount)+n(x.cess_amount))}</td><td>${money(x.line_total)}</td></tr>`).join("")}</table><table style="max-width:360px;margin-left:auto"><tr><td>Taxable</td><td class=r>${money(i.taxable_total)}</td></tr><tr><td>CGST</td><td class=r>${money(i.cgst_total)}</td></tr><tr><td>SGST</td><td class=r>${money(i.sgst_total)}</td></tr><tr><td>IGST</td><td class=r>${money(i.igst_total)}</td></tr><tr><td>Cess</td><td class=r>${money(i.cess_total)}</td></tr><tr><th>Grand Total</th><th class=r>${money(i.grand_total)}</th></tr></table><p>RCM: ${i.rcm_applicable?"Applicable":"Not marked"} · B2B/B2C: ${esc(i.supply_type)}</p></body></html>`);
  }catch(e){res.status(404).send(e.message)}
});

app.get("*",(_req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

const port=Number(process.env.PORT||3000);
initDb().then(()=>app.listen(port,()=>console.log("LifeBridge Business MOS Unified 5.0 running on "+port)))
  .catch(e=>{console.error(e);process.exit(1)});
