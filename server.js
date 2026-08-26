import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import db from "./src/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json({limit:"2mb"}));
app.use(express.static(path.join(__dirname,"public")));

const ok=(res,data,status=200)=>res.status(status).json({ok:true,data});
const fail=(res,message,status=400)=>res.status(status).json({ok:false,error:message});

app.get("/api/health",async(_req,res)=>{
  try { ok(res,{service:"LifeBridge Business MOS",phase:3,version:"3.0.0",database:"mysql",timestamp:new Date().toISOString()}); }
  catch(e){ fail(res,e.message,500); }
});

app.get("/api/dashboard",async(_req,res)=>{
  try { ok(res,await db.dashboard()); } catch(e){ fail(res,e.message,500); }
});

for (const route of ["companies","gst-registrations","customers","vendors","products"]) {
  app.get(`/api/${route}`,async(_req,res)=>{
    try { ok(res,await db.list(route)); } catch(e){ fail(res,e.message,500); }
  });
}

app.get("/api/invoices",async(req,res)=>{
  try { ok(res,await db.listInvoices(req.query)); } catch(e){ fail(res,e.message,500); }
});

app.get("/api/invoices/:id",async(req,res)=>{
  try { ok(res,await db.getInvoice(req.params.id)); } catch(e){ fail(res,e.message,404); }
});

app.post("/api/invoices",async(req,res)=>{
  try { ok(res,await db.createInvoice(req.body),201); } catch(e){ fail(res,e.message,400); }
});

app.post("/api/invoices/:id/payments",async(req,res)=>{
  try { ok(res,await db.addPayment(req.params.id,req.body),201); } catch(e){ fail(res,e.message,400); }
});

app.get("/api/invoices/:id/print",async(req,res)=>{
  try {
    const invoice=await db.getInvoice(req.params.id);
    res.send(db.printInvoiceHtml(invoice));
  } catch(e) { res.status(404).send("Invoice not found"); }
});

app.get("*",(_req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

const port=Number(process.env.PORT||3000);
app.listen(port,()=>console.log(`LifeBridge Business MOS Phase 3 running on ${port}`));
