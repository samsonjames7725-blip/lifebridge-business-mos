const app=document.querySelector("#app");
const nav=[
 ["dashboard","Dashboard"],["billing","Billing"],["invoices","Invoices"],
 ["customers","Customers"],["products","Products"],["companies","Companies"],
 ["gst","GSTINs"]
];
const state={page:"dashboard",companies:[],customers:[],products:[],gst:[],invoiceItems:[]};

const api={
 async get(u){const r=await fetch(u),j=await r.json();if(!r.ok||j.ok===false)throw Error(j.error||"Request failed");return j.data},
 async post(u,b){const r=await fetch(u,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)}),j=await r.json();if(!r.ok||j.ok===false)throw Error(j.error||"Request failed");return j.data}
};
const money=n=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(n||0));
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
function toast(x){const t=document.querySelector(".toast");t.textContent=x;t.style.display="block";setTimeout(()=>t.style.display="none",2300)}

async function shell(){
 app.innerHTML=`<div class="layout"><aside class="side"><div class="brand">LifeBridge<br><small>Business MOS · Phase 3</small></div><nav class="nav">${nav.map(n=>`<button class="${state.page===n[0]?"active":""}" data-p="${n[0]}">${n[1]}</button>`).join("")}</nav></aside><main class="main"><div class="top"><div><h1>${nav.find(n=>n[0]===state.page)?.[1]||"Billing"}</h1><p>LifeBridge MedTech PVT. LTD. · Multi-company · Multi-GSTIN · GST Billing</p></div><div class="toolbar"><button class="btn" id="refresh">↻ Refresh</button></div></div><div id="content"></div></main></div><nav class="mobile">${nav.slice(0,5).map(n=>`<button class="${state.page===n[0]?"active":""}" data-p="${n[0]}">${n[1]}</button>`).join("")}</nav><div class="toast"></div>`;
 document.querySelectorAll("[data-p]").forEach(b=>b.onclick=()=>{state.page=b.dataset.p;shell()});
 document.querySelector("#refresh").onclick=shell;
 if(state.page==="dashboard")await dashboard();
 else if(state.page==="billing")await billing();
 else if(state.page==="invoices")await invoices();
 else await master(state.page);
}

async function loadMasters(){
 [state.companies,state.customers,state.products,state.gst]=await Promise.all([
  api.get("/api/companies"),api.get("/api/customers"),api.get("/api/products"),api.get("/api/gst-registrations")
 ]);
}

async function dashboard(){
 const d=await api.get("/api/dashboard");
 document.querySelector("#content").innerHTML=`
 <section class="grid cards">
 ${[
  ["Invoices",d.invoice_count,"Billing documents"],["Billed",money(d.billed),"Invoice value"],
  ["Collected",money(d.collected),"Payments received"],["Outstanding",money(d.outstanding),"Receivables"],
  ["Companies",d.companies,"Multi-company"],["GSTINs",d.gstins,"Registrations"],["Customers",d.customers,"Master data"],["Products",d.products,"HSN/SAC master"]
 ].map(x=>`<div class="card"><span class="label">${x[0]}</span><div class="value">${x[1]}</div><span class="${x[0]==="Outstanding"?"warn":"ok"}">${x[2]}</span></div>`).join("")}
 </section>
 <section class="grid two">
  <div class="card"><div class="head"><h2>Today's Billing</h2><span class="badge">${d.count_today} invoices</span></div><div class="value">${money(d.value_today)}</div><span class="muted">Created today</span></div>
  <div class="card"><div class="head"><h2>GST Billing Engine</h2><span class="badge">Active</span></div><p class="muted">Same-state sales calculate CGST + SGST. Inter-state sales calculate IGST. Tax values are stored on every invoice line for auditability.</p></div>
 </section>
 <section class="card" style="margin-top:14px"><div class="head"><h2>Phase 3</h2><span class="badge">Working</span></div><p class="muted">Create GST invoices, print them, record payments and track outstanding balances. Invoice numbering is separated by company and financial year.</p><button class="btn primary" id="goBilling">+ New GST Invoice</button></section>`;
 document.querySelector("#goBilling").onclick=()=>{state.page="billing";shell()};
}

async function billing(){
 try{await loadMasters()}catch(e){toast(e.message);return}
 if(!state.invoiceItems.length)state.invoiceItems=[{product_id:"",quantity:1,rate:"",discount_percent:0}];
 const content=document.querySelector("#content");
 content.innerHTML=`
 <div class="card">
  <div class="head"><h2>Create GST Tax Invoice</h2><span class="badge">Auto GST</span></div>
  <form id="invoiceForm">
   <div class="form">
    <label>Company *<select id="company_id" required>${state.companies.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select></label>
    <label>GST Registration<select id="gst_registration_id"><option value="">Auto active GSTIN</option>${state.gst.map(g=>`<option value="${g.id}">${esc(g.gstin)} — ${esc(g.state_name||"")}</option>`).join("")}</select></label>
    <label>Customer *<select id="customer_id" required><option value="">Select customer</option>${state.customers.map(c=>`<option value="${c.id}">${esc(c.name)}${c.gstin?" · "+esc(c.gstin):""}</option>`).join("")}</select></label>
    <label>Invoice Date *<input id="invoice_date" type="date" value="${new Date().toISOString().slice(0,10)}" required></label>
    <label>Due Date<input id="due_date" type="date"></label>
    <label>Buyer State<input id="buyer_state" placeholder="e.g. Maharashtra" required></label>
    <label>Supply State<input id="supply_state" placeholder="Seller GST state (optional)"></label>
    <label>Place of Supply<input id="place_of_supply" placeholder="State"></label>
    <label class="full">Notes<textarea id="notes" placeholder="Optional invoice notes"></textarea></label>
   </div>
   <div class="head" style="margin-top:20px"><h2>Items</h2><button type="button" class="btn" id="addItem">+ Add Item</button></div>
   <div id="items"></div>
   <div class="summary" id="preview"></div>
   <div style="margin-top:15px"><button class="btn primary">Create Invoice</button></div>
  </form>
 </div>`;
 renderItems();
 document.querySelector("#addItem").onclick=()=>{state.invoiceItems.push({product_id:"",quantity:1,rate:"",discount_percent:0});renderItems()};
 document.querySelector("#invoiceForm").onsubmit=createInvoice;
 document.querySelector("#customer_id").onchange=()=>{
   const c=state.customers.find(x=>String(x.id)===document.querySelector("#customer_id").value);
   if(c){document.querySelector("#buyer_state").value=c.state||"";document.querySelector("#place_of_supply").value=c.state||""}
 };
}

function renderItems(){
 const el=document.querySelector("#items");
 el.innerHTML=state.invoiceItems.map((it,i)=>`
 <div class="invoice-item">
  <label class="desc">Product<select data-i="${i}" data-k="product_id"><option value="">Select product</option>${state.products.map(p=>`<option value="${p.id}" ${String(it.product_id)===String(p.id)?"selected":""}>${esc(p.name)} · HSN ${esc(p.hsn_sac)}</option>`).join("")}</select></label>
  <label>Qty<input data-i="${i}" data-k="quantity" type="number" min="0.001" step="0.001" value="${it.quantity}"></label>
  <label>Rate<input data-i="${i}" data-k="rate" type="number" min="0" step="0.01" value="${it.rate}"></label>
  <label>Discount %<input data-i="${i}" data-k="discount_percent" type="number" min="0" max="100" step="0.01" value="${it.discount_percent}"></label>
  <button type="button" class="btn danger remove" data-i="${i}">×</button>
 </div>`).join("");
 el.querySelectorAll("[data-k]").forEach(x=>x.oninput=()=>{
  const i=Number(x.dataset.i),k=x.dataset.k;
  state.invoiceItems[i][k]=x.value;
  if(k==="product_id"){
   const p=state.products.find(z=>String(z.id)===String(x.value));
   if(p){state.invoiceItems[i].rate=p.sale_price||0}
   renderItems();return;
  }
  preview();
 });
 el.querySelectorAll(".remove").forEach(x=>x.onclick=()=>{state.invoiceItems.splice(Number(x.dataset.i),1);if(!state.invoiceItems.length)state.invoiceItems.push({product_id:"",quantity:1,rate:"",discount_percent:0});renderItems()});
 preview();
}

function preview(){
 const box=document.querySelector("#preview");if(!box)return;
 let subtotal=0,discount=0,taxable=0;
 state.invoiceItems.forEach(it=>{
  const p=state.products.find(x=>String(x.id)===String(it.product_id));
  const gross=Number(it.quantity||0)*Number(it.rate||p?.sale_price||0);
  const dis=gross*Number(it.discount_percent||0)/100;
  subtotal+=gross;discount+=dis;taxable+=gross-dis;
 });
 box.innerHTML=`<div><span>Subtotal</span><b>${money(subtotal)}</b></div><div><span>Discount</span><b>${money(discount)}</b></div><div><span>Taxable</span><b>${money(taxable)}</b></div><div class="grand"><span>GST calculated on save</span><b>Auto</b></div>`;
}

async function createInvoice(e){
 e.preventDefault();
 const body={
  company_id:Number(document.querySelector("#company_id").value),
  gst_registration_id:document.querySelector("#gst_registration_id").value?Number(document.querySelector("#gst_registration_id").value):null,
  customer_id:Number(document.querySelector("#customer_id").value),
  invoice_date:document.querySelector("#invoice_date").value,
  due_date:document.querySelector("#due_date").value||null,
  buyer_state:document.querySelector("#buyer_state").value,
  supply_state:document.querySelector("#supply_state").value||"",
  place_of_supply:document.querySelector("#place_of_supply").value||"",
  notes:document.querySelector("#notes").value,
  round_off:"auto",
  items:state.invoiceItems.map(it=>({product_id:Number(it.product_id),quantity:Number(it.quantity),rate:Number(it.rate),discount_percent:Number(it.discount_percent||0)}))
 };
 try{
  const inv=await api.post("/api/invoices",body);
  state.invoiceItems=[];
  toast(`Invoice ${inv.invoice_no} created`);
  state.page="invoices";await shell();
 }catch(e){toast(e.message)}
}

async function invoices(){
 let rows=[];
 try{rows=await api.get("/api/invoices")}catch(e){toast(e.message)}
 document.querySelector("#content").innerHTML=`
 <div class="card"><div class="head"><h2>Sales Invoices</h2><button class="btn primary" id="newInv">+ New Invoice</button></div>
 <div class="table-wrap"><table class="table"><thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Action</th></tr></thead>
 <tbody>${rows.length?rows.map(r=>`<tr><td><b>${esc(r.invoice_no)}</b></td><td>${esc(r.invoice_date)}</td><td>${esc(r.customer_name||"")}</td><td>${money(r.grand_total)}</td><td>${money(r.paid_total)}</td><td>${money(r.balance_due)}</td><td><span class="badge">${esc(r.status)}</span></td><td><button class="btn view" data-id="${r.id}">View</button></td></tr>`).join(""):`<tr><td colspan="8" class="empty">No invoices yet.</td></tr>`}</tbody></table></div></div>`;
 document.querySelector("#newInv").onclick=()=>{state.page="billing";shell()};
 document.querySelectorAll(".view").forEach(b=>b.onclick=()=>viewInvoice(b.dataset.id));
}

async function viewInvoice(id){
 const i=await api.get("/api/invoices/"+id);
 document.querySelector("#content").innerHTML=`
 <div class="card"><div class="head"><h2>${esc(i.invoice_no)}</h2><div class="toolbar"><button class="btn" id="back">← Back</button><button class="btn primary" id="print">Print / PDF</button></div></div>
 <div class="grid two">
  <div><b>${esc(i.company_legal_name||i.company_name)}</b><p class="muted">GSTIN: ${esc(i.seller_gstin||"Not configured")}<br>${esc(i.company_state||"")}</p></div>
  <div><b>Bill To</b><p class="muted">${esc(i.customer_name||"")}<br>GSTIN: ${esc(i.customer_gstin||"Unregistered")}<br>${esc(i.customer_state||"")}</p></div>
 </div>
 <div class="table-wrap"><table class="table"><thead><tr><th>Item</th><th>HSN</th><th>Qty</th><th>Rate</th><th>Taxable</th><th>GST</th><th>Total</th></tr></thead><tbody>
 ${i.items.map(x=>`<tr><td>${esc(x.description)}</td><td>${esc(x.hsn_sac)}</td><td>${x.quantity}</td><td>${money(x.rate)}</td><td>${money(x.taxable_value)}</td><td>${i.is_interstate?money(x.igst_amount):money(Number(x.cgst_amount)+Number(x.sgst_amount))}</td><td>${money(x.line_total)}</td></tr>`).join("")}
 </tbody></table></div>
 <div class="summary"><div><span>Taxable</span><b>${money(i.taxable_total)}</b></div><div><span>CGST</span><b>${money(i.cgst_total)}</b></div><div><span>SGST</span><b>${money(i.sgst_total)}</b></div><div><span>IGST</span><b>${money(i.igst_total)}</b></div><div><span>Cess</span><b>${money(i.cess_total)}</b></div><div class="grand"><span>Total</span><b>${money(i.grand_total)}</b></div><div><span>Paid</span><b>${money(i.paid_total)}</b></div><div><span>Balance</span><b>${money(i.balance_due)}</b></div></div>
 <div class="card" style="margin-top:14px;background:#f8fafc"><div class="head"><h2>Record Payment</h2><span class="badge">${esc(i.status)}</span></div><form id="pay" class="form"><label>Amount<input id="payAmount" type="number" min="0.01" step="0.01" max="${i.balance_due}" required></label><label>Mode<select id="payMode"><option>Bank</option><option>UPI</option><option>Cash</option><option>Card</option><option>Cheque</option></select></label><label>Reference<input id="payRef"></label><label>Payment Date<input id="payDate" type="date" value="${new Date().toISOString().slice(0,10)}"></label><div class="full"><button class="btn primary">Record Payment</button></div></form></div>
 </div>`;
 document.querySelector("#back").onclick=()=>{state.page="invoices";shell()};
 document.querySelector("#print").onclick=()=>window.open("/api/invoices/"+id+"/print","_blank");
 document.querySelector("#pay").onsubmit=async e=>{e.preventDefault();try{await api.post("/api/invoices/"+id+"/payments",{amount:Number(document.querySelector("#payAmount").value),mode:document.querySelector("#payMode").value,reference_no:document.querySelector("#payRef").value,payment_date:document.querySelector("#payDate").value});toast("Payment recorded");viewInvoice(id)}catch(x){toast(x.message)}};
}

async function master(page){
 const route={customers:"customers",products:"products",companies:"companies",gst:"gst-registrations"}[page];
 const rows=await api.get("/api/"+route);
 document.querySelector("#content").innerHTML=`<div class="card"><div class="head"><h2>${nav.find(x=>x[0]===page)[1]}</h2><span class="muted">${rows.length} records</span></div><div class="table-wrap"><table class="table"><thead><tr>${(rows[0]?Object.keys(rows[0]):[]).filter(k=>!["created_at","updated_at"].includes(k)).map(k=>`<th>${esc(k)}</th>`).join("")}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${Object.keys(r).filter(k=>!["created_at","updated_at"].includes(k)).map(k=>`<td>${esc(r[k])}</td>`).join("")}</tr>`).join(""):`<tr><td class="empty">No records.</td></tr>`}</tbody></table></div></div>`;
}
shell();
