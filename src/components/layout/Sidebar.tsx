"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Building2, FileText, Users, Package, ShoppingCart,
  Warehouse, Briefcase, Wrench, BarChart3, Settings, Shield, Bot, LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/billing/invoices", label: "Billing", icon: FileText },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/products", label: "Products", icon: Package },
  { href: "/purchases", label: "Purchases", icon: ShoppingCart },
  { href: "/inventory", label: "Inventory", icon: Warehouse },
  { href: "/tenders", label: "Tenders", icon: Briefcase },
  { href: "/service", label: "Service / AMC", icon: Wrench },
  { href: "/gst", label: "GST DAS", icon: Shield },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/ai", label: "AI Command", icon: Bot },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
  return (
    <aside className="hidden lg:flex w-60 flex-col border-r border-slate-200 bg-white">
      <div className="px-5 py-5 border-b border-slate-100">
        <div className="font-semibold text-slate-900 text-sm tracking-tight">LIFEBridge MedTech</div>
        <div className="text-xs text-slate-500 mt-0.5">Business OS</div>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                active ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}>
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-slate-100">
        <button onClick={logout} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </aside>
  );
}
