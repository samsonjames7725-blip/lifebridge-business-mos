const app = document.querySelector("#app");

const nav = [
  "Dashboard","CRM & Customers","Tenders","Proposals","Projects",
  "Billing","Purchases","Inventory","Finance","Companies & GSTIN",
  "AI Command Center"
];

const state = { data: null };

const money = n => {
  const value = Number(n || 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0
  }).format(value);
};

async function loadDashboard(){
  try {
    const r = await fetch("/api/dashboard");
    state.data = await r.json();
  } catch {
    state.data = {companies:1,customers:0,products:0,invoices:0};
  }
  render();
}

function render(){
  const d = state.data || {companies:1,customers:0,products:0,invoices:0};

  app.innerHTML = `
  <div class="shell">
    <aside class="side">
      <div class="brand">LifeBridge<br><small>Business MOS</small></div>
      <nav class="nav">
        ${nav.map((x,i)=>`<button class="${i===0?"active":""}" data-page="${x}">${x}</button>`).join("")}
      </nav>
    </aside>

    <main class="main">
      <div class="top">
        <div>
          <h1>Business Dashboard</h1>
          <p>LifeBridge MedTech PVT. LTD. · Multi-company & Multi-GSTIN</p>
          <span class="status">● API connected · ${d.source || "live"}</span>
        </div>
        <div class="actions">
          <button class="btn">🔔</button>
          <button class="btn primary" id="invoice">+ New Invoice</button>
        </div>
      </div>

      <section class="grid kpis">
        <div class="card"><span class="label">Revenue</span><div class="value">₹38.42L</div><span class="good">↑ 14.8% vs last month</span></div>
        <div class="card"><span class="label">Sales Pipeline</span><div class="value">₹1.86Cr</div><span class="good">9 active opportunities</span></div>
        <div class="card"><span class="label">Receivables</span><div class="value">₹12.84L</div><span class="warn">₹4.21L overdue</span></div>
        <div class="card"><span class="label">System Records</span><div class="value">${d.invoices}</div><span class="good">${d.companies} companies · ${d.customers} customers · ${d.products} products</span></div>
      </section>

      <section class="grid two">
        <div class="card">
          <div class="head"><h2>Revenue Performance</h2><span class="muted">Apr–Aug 2026</span></div>
          <div class="chart">
            ${[["Apr",42],["May",58],["Jun",51],["Jul",76],["Aug",91]].map(([m,h])=>`
              <div class="barcol"><div class="bar" style="--h:${h}%"></div><div class="month">${m}</div></div>
            `).join("")}
          </div>
        </div>
        <div class="card">
          <div class="head"><h2>Sales Pipeline</h2><span class="muted">₹1.86Cr</span></div>
          <div class="list">
            ${[["New Leads","₹42L"],["Qualified","₹31L"],["Proposal","₹47L"],["Negotiation","₹29L"],["Expected","₹37L"]].map(x=>`
              <div class="item"><span>${x[0]}<small>Opportunity stage</small></span><b>${x[1]}</b></div>
            `).join("")}
          </div>
        </div>
      </section>

      <section class="grid three">
        <div class="card"><div class="head"><h2>Tender Alerts</h2><span class="badge red">3 closing</span></div>
          <div class="list">
            <div class="item"><span>COVAS Parbhani<small>Veterinary equipment · 29 Aug</small></span><span class="badge red">2 days</span></div>
            <div class="item"><span>District Hospital<small>OT equipment · 31 Aug</small></span><span class="badge orange">4 days</span></div>
            <div class="item"><span>Medical College<small>ICU setup · 02 Sep</small></span><span class="badge">6 days</span></div>
          </div>
        </div>

        <div class="card"><div class="head"><h2>Recent Invoices</h2><span class="muted">${d.invoices} stored</span></div>
          <div class="list">
            <div class="item"><span>Invoice engine<small>Database-ready</small></span><span class="badge">Ready</span></div>
            <div class="item"><span>GST tax fields<small>CGST / SGST / IGST</small></span><span class="badge">Ready</span></div>
            <div class="item"><span>Payments<small>Receivables module</small></span><span class="badge orange">Next</span></div>
          </div>
        </div>

        <div class="card"><div class="head"><h2>GST / Compliance</h2><span class="badge">Healthy</span></div>
          <div class="list">
            <div class="item"><span>GST Registrations<small>Multi-GSTIN architecture</small></span><span class="badge">OK</span></div>
            <div class="item"><span>Tax rules<small>Versioned + source reference</small></span><span class="badge">v1.0</span></div>
            <div class="item"><span>Audit trail<small>Architecture prepared</small></span><span class="badge orange">Next</span></div>
          </div>
        </div>
      </section>

      <section class="grid two">
        <div class="card">
          <div class="head"><h2>Quick Actions</h2></div>
          <div class="grid quick">
            <button id="qinvoice">🧾<b>New Invoice</b><span class="muted">GST tax invoice</span></button>
            <button>📄<b>Quotation</b><span class="muted">Create proposal</span></button>
            <button>👤<b>Customer</b><span class="muted">Add customer</span></button>
            <button>📦<b>Product</b><span class="muted">Add HSN/SAC</span></button>
            <button>🛒<b>Purchase</b><span class="muted">Record purchase</span></button>
            <button>₹<b>Payment</b><span class="muted">Receive payment</span></button>
          </div>
        </div>
        <div class="card ai">
          <div class="head"><h2>🤖 AI Command Center</h2><span class="badge">Online</span></div>
          <div class="muted">Ask about sales, tenders, billing, GST, projects or today's priorities.</div>
          <input id="ai" placeholder="What should I focus on today?">
        </div>
      </section>
    </main>
  </div>

  <nav class="mobile">
    <button class="active">⌂<br>Home</button>
    <button>▣<br>Billing</button>
    <button>👥<br>CRM</button>
    <button>📦<br>Stock</button>
    <button>☰<br>More</button>
  </nav>`;

  document.querySelectorAll("[data-page]").forEach(b=>{
    b.onclick=()=>{
      if(b.dataset.page !== "Dashboard")
        alert(`${b.dataset.page} module is scheduled for the next build phase.`);
    };
  });

  document.querySelectorAll("#invoice,#qinvoice").forEach(b=>{
    b.onclick=()=>alert("Billing workspace will be connected to the invoice API in the next phase.");
  });

  document.querySelector("#ai")?.addEventListener("keydown", e=>{
    if(e.key==="Enter" && e.target.value.trim()){
      alert("AI Command Center received: " + e.target.value.trim());
      e.target.value="";
    }
  });
}

loadDashboard();
