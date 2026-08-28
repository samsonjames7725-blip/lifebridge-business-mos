import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { FileText, Users, Package, ShoppingCart, Shield, TrendingUp } from "lucide-react";

export default async function DashboardPage() {
  const session = await getSession();
  const companyId = session?.companyId;
  let stats = { invoices: 0, customers: 0, products: 0, openPOs: 0, gstTxns: 0 };

  if (companyId) {
    const [invoices, customers, products, openPOs, gstTxns] = await Promise.all([
      prisma.invoice.count({ where: { companyId } }),
      prisma.customer.count({ where: { companyId, status: "ACTIVE" } }),
      prisma.product.count({ where: { companyId, status: "ACTIVE" } }),
      prisma.purchaseOrder.count({ where: { companyId, status: { in: ["DRAFT", "SENT", "CONFIRMED"] } } }),
      prisma.gstTransaction.count({ where: { companyId } }),
    ]);
    stats = { invoices, customers, products, openPOs, gstTxns };
  }

  const cards = [
    { label: "Invoices", value: stats.invoices, icon: FileText, href: "/billing/invoices", color: "bg-indigo-50 text-indigo-600" },
    { label: "Customers", value: stats.customers, icon: Users, href: "/customers", color: "bg-emerald-50 text-emerald-600" },
    { label: "Products", value: stats.products, icon: Package, href: "/products", color: "bg-amber-50 text-amber-600" },
    { label: "Open POs", value: stats.openPOs, icon: ShoppingCart, href: "/purchases", color: "bg-sky-50 text-sky-600" },
    { label: "GST Transactions", value: stats.gstTxns, icon: Shield, href: "/gst", color: "bg-violet-50 text-violet-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Welcome back. Multi-company Indian GST Business OS.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <a key={c.label} href={c.href} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className={`rounded-lg p-2 ${c.color}`}><Icon className="h-4 w-4" /></div>
                <TrendingUp className="h-3.5 w-3.5 text-slate-300" />
              </div>
              <div className="mt-3 text-2xl font-semibold text-slate-900">{c.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{c.label}</div>
            </a>
          );
        })}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-2">System status</h2>
        <ul className="text-sm text-slate-600 space-y-1.5">
          <li>✓ Single integrated architecture</li>
          <li>✓ Multi-company / multi-GSTIN schema</li>
          <li>✓ Centralized GST tax engine</li>
          <li>✓ Hostinger MySQL + Vercel compatible</li>
        </ul>
      </div>
    </div>
  );
}
