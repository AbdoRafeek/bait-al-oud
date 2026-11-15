
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type RecentOrder = {
  id: string;
  source: "regular" | "custom_mix";
  order_number: number | string;
  customer_name: string;
  customer_phone: string;
  total: number;
  payment_status: string;
  order_status: string;
  created_at: string;
};

type DashboardData = {
  revenue: number;
  orders: number;
  pendingPayments: number;
  paidOrders: number;
  products: number;
  customers: number;
  recentOrders: RecentOrder[];
  monthlySales: { label: string; total: number }[];
};

const menu = [
  { name: "Overview", icon: "◫", href: "/admin" },
  { name: "Products", icon: "◇", href: "/admin/products" },
  { name: "Custom Mixes", icon: "⚗", href: "/admin/custom-mixes" },
  { name: "Categories", icon: "▦", href: "/admin/categories" },
  { name: "Orders", icon: "▤", href: "/admin/orders" },
  { name: "Customers", icon: "♙", href: "/admin/customers" },
  { name: "Coupons", icon: "％", href: "/admin/coupons" },
  { name: "Settings", icon: "⚙", href: "/admin/settings" },
];

const emptyData: DashboardData = {
  revenue: 0,
  orders: 0,
  pendingPayments: 0,
  paidOrders: 0,
  products: 0,
  customers: 0,
  recentOrders: [],
  monthlySales: [],
};

const paymentLabels: Record<string, string> = {
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
};

const orderLabels: Record<string, string> = {
  pending_review: "Under Review",
  price_sent: "Price Sent",
  awaiting_address: "Awaiting Address",
  awaiting_payment: "Awaiting Payment",
  paid: "Paid",
  preparing: "Preparing",
  completed: "Completed",
  rejected: "Rejected",
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function money(value: number) {
  return `EGP ${Number(value || 0).toLocaleString("en-EG", {
    maximumFractionDigits: 2,
  })}`;
}

function statusClass(status: string) {
  if (status === "paid" || status === "delivered" || status === "completed") {
    return "border-green-500/20 bg-green-500/10 text-green-400";
  }

  if (["pending", "pending_review", "awaiting_payment", "awaiting_address"].includes(status)) {
    return "border-yellow-500/20 bg-yellow-500/10 text-yellow-400";
  }

  if (status === "failed" || status === "cancelled" || status === "rejected") {
    return "border-red-500/20 bg-red-500/10 text-red-400";
  }

  return "border-[#C6A568]/20 bg-[#C6A568]/10 text-[#D5B77E]";
}

export default function AdminDashboard() {
  const [active, setActive] = useState("Overview");
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const supabase = useMemo(() => createClient(), []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [ordersResult, customMixesResult, productsCountResult] =
        await Promise.all([
          supabase
            .from("orders")
            .select("id, order_number, customer_name, customer_phone, total, payment_status, order_status, created_at"),
          supabase
            .from("custom_mix_requests")
            .select("id, request_number, customer_name, customer_phone, quoted_price, payment_status, status, created_at"),
          supabase
            .from("products")
            .select("id", { count: "exact", head: true })
            .eq("is_active", true),
        ]);

      const firstError =
        ordersResult.error ||
        customMixesResult.error ||
        productsCountResult.error;
      if (firstError) throw firstError;

      const regularOrders = ordersResult.data || [];
      const customMixes = customMixesResult.data || [];
      const paidRegularOrders = regularOrders.filter(
        (order) => order.payment_status === "paid"
      );
      const paidCustomMixes = customMixes.filter(
        (mix) => mix.payment_status === "paid"
      );

      const revenue =
        paidRegularOrders.reduce((sum, order) => sum + Number(order.total || 0), 0) +
        paidCustomMixes.reduce((sum, mix) => sum + Number(mix.quoted_price || 0), 0);

      const pendingPayments =
        regularOrders.filter((order) => order.payment_status === "pending").length +
        customMixes.filter((mix) => mix.status === "awaiting_payment").length;

      const uniquePhones = new Set(
        [...regularOrders, ...customMixes]
          .map((row) => row.customer_phone?.trim())
          .filter((phone): phone is string => Boolean(phone))
      );

      const paidSales = [
        ...paidRegularOrders.map((order) => ({
          total: Number(order.total || 0),
          created_at: order.created_at,
        })),
        ...paidCustomMixes.map((mix) => ({
          total: Number(mix.quoted_price || 0),
          created_at: mix.created_at,
        })),
      ];

      const now = new Date();
      const monthlySales = Array.from({ length: 6 }, (_, index) => {
        const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
        const total = paidSales.reduce((sum, order) => {
          const orderDate = new Date(order.created_at);
          return orderDate.getFullYear() === date.getFullYear() &&
            orderDate.getMonth() === date.getMonth()
            ? sum + order.total
            : sum;
        }, 0);

        return {
          label: date.toLocaleDateString("en-US", { month: "short" }),
          total,
        };
      });

      const recentRegular: RecentOrder[] = regularOrders.map((order) => ({
        ...order,
        source: "regular",
      }));

      const recentCustomMixes: RecentOrder[] = customMixes.map((mix) => ({
        id: mix.id,
        source: "custom_mix",
        order_number: `CM-${mix.request_number}`,
        customer_name: mix.customer_name,
        customer_phone: mix.customer_phone,
        total: Number(mix.quoted_price || 0),
        payment_status:
          mix.payment_status === "paid" ? "paid" :
          mix.payment_status === "rejected" ? "failed" : "pending",
        order_status: String(mix.status || "pending_review"),
        created_at: mix.created_at,
      }));

      const recentOrders = [...recentRegular, ...recentCustomMixes]
        .sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        .slice(0, 5);

      setData({
        revenue,
        orders: regularOrders.length + customMixes.length,
        pendingPayments,
        paidOrders: paidRegularOrders.length + paidCustomMixes.length,
        products: productsCountResult.count || 0,
        customers: uniquePhones.size,
        recentOrders,
        monthlySales,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load dashboard data."
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const maxMonthlySales = Math.max(
    1,
    ...data.monthlySales.map((month) => month.total)
  );

  const stats = [
    {
      label: "Total Revenue",
      value: money(data.revenue),
      change: "From paid orders",
      icon: "↗",
    },
    {
      label: "Total Orders",
      value: data.orders.toLocaleString("en-EG"),
      change: `${data.pendingPayments} awaiting payment`,
      icon: "▤",
    },
    {
      label: "Active Products",
      value: data.products.toLocaleString("en-EG"),
      change: "Currently visible in store",
      icon: "◇",
    },
    {
      label: "Customers",
      value: data.customers.toLocaleString("en-EG"),
      change: "Unique phone numbers with orders",
      icon: "♙",
    },
  ];

  return (
    <div className="min-h-screen bg-[#11100F] text-white flex">

      {/* Sidebar */}
      <aside className="w-64 border-r border-white/10 bg-[#171513] hidden md:flex flex-col">
        <div className="p-7 border-b border-white/10">
          <h1 className="text-2xl font-serif tracking-widest text-[#C6A568]">
            BAIT AL OUD
          </h1>

          <p className="text-xs text-gray-500 mt-2 tracking-[3px]">
            ADMINISTRATION
          </p>
        </div>

        <div className="px-5 py-7">
          <p className="text-[10px] text-gray-500 tracking-widest mb-4">
            MAIN MENU
          </p>

          <nav className="space-y-2">
            {menu.map((item) =>
              item.href ? (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setActive(item.name)}
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg text-sm transition ${
                    active === item.name
                      ? "bg-[#C6A568]/15 text-[#D5B77E] border border-[#C6A568]/20"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.name}
                </Link>
              ) : (
                <button
                  key={item.name}
                  onClick={() => setActive(item.name)}
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg text-sm transition ${
                    active === item.name
                      ? "bg-[#C6A568]/15 text-[#D5B77E] border border-[#C6A568]/20"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.name}
                </button>
              )
            )}
          </nav>
        </div>

        <div className="mt-auto p-5 border-t border-white/10">
          <p className="text-xs text-gray-500">BAIT AL OUD</p>
          <p className="text-xs text-[#C6A568] mt-1">
            Store Management
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">

        <header className="min-h-20 border-b border-white/10 px-5 md:px-10 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-gray-500">
              BAIT AL OUD / ADMIN
            </p>

            <h2 className="text-xl font-medium mt-1">
              {active}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadDashboard}
              disabled={loading}
              className="border border-white/10 rounded-lg px-4 py-2.5 text-sm hover:border-[#C6A568]/50 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "↻ Refresh"}
            </button>

            <div className="hidden sm:block text-right">
              <p className="text-sm">Store Admin</p>
              <p className="text-xs text-gray-500">
                Bait Al Oud
              </p>
            </div>

            <div className="w-10 h-10 rounded-full bg-[#C6A568]/15 border border-[#C6A568]/30 flex items-center justify-center text-[#C6A568]">
              BA
            </div>
          </div>
        </header>

        {/* Mobile Navigation */}
        <div className="md:hidden flex gap-2 overflow-x-auto p-4 border-b border-white/10">
          {menu.map((item) =>
            item.href ? (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setActive(item.name)}
                className={`shrink-0 px-4 py-2 rounded-lg text-xs ${
                  active === item.name
                    ? "bg-[#C6A568] text-black"
                    : "bg-white/5 text-gray-400"
                }`}
              >
                {item.name}
              </Link>
            ) : (
              <button
                key={item.name}
                onClick={() => setActive(item.name)}
                className={`shrink-0 px-4 py-2 rounded-lg text-xs ${
                  active === item.name
                    ? "bg-[#C6A568] text-black"
                    : "bg-white/5 text-gray-400"
                }`}
              >
                {item.name}
              </button>
            )
          )}
        </div>

        <div className="p-5 md:p-10 max-w-7xl mx-auto">

          {active === "Overview" ? (
            <>

              {/* Welcome */}
              <div className="mb-9">
                <p className="text-[#C6A568] text-xs tracking-[3px]">
                  STORE OVERVIEW
                </p>

                <h1 className="text-3xl md:text-4xl font-serif mt-3">
                  Welcome to Bait Al Oud
                </h1>

                <p className="text-gray-500 text-sm mt-2">
                  Manage your store and track your business performance.
                </p>
              </div>

              {error && (
                <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                  {error}
                </div>
              )}

              {/* Statistics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-[#1B1917] border border-white/10 rounded-xl p-6 hover:border-[#C6A568]/40 transition"
                  >
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-gray-400">
                        {stat.label}
                      </p>

                      <span className="text-[#C6A568] text-xl">
                        {stat.icon}
                      </span>
                    </div>

                    <h3 className="text-2xl font-semibold mt-5">
                      {loading ? "—" : stat.value}
                    </h3>

                    <p className="text-xs text-gray-500 mt-2">
                      {stat.change}
                    </p>
                  </div>
                ))}
              </div>

              {/* Sales and Quick Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-8">

                <div className="lg:col-span-2 bg-[#1B1917] border border-white/10 rounded-xl p-6">
                  <h3 className="text-lg">
                    Sales Overview
                  </h3>

                  <p className="text-xs text-gray-500 mt-1">
                    Monthly revenue from paid regular orders and custom mixes · Last 6 months
                  </p>

                  {loading ? (
                    <div className="h-56 flex items-center justify-center text-gray-500 text-sm">
                      Loading sales data...
                    </div>
                  ) : data.monthlySales.every(
                      (month) => month.total === 0
                    ) ? (
                    <div className="h-56 flex flex-col items-center justify-center text-gray-500">
                      <span className="text-4xl text-[#C6A568]">
                        ⌁
                      </span>

                      <p className="text-sm mt-3">
                        No paid sales in this period
                      </p>
                    </div>
                  ) : (
                    <div className="h-56 flex items-end gap-3 pt-8">
                      {data.monthlySales.map((month) => (
                        <div
                          key={month.label}
                          className="flex-1 h-full flex flex-col justify-end items-center gap-2 min-w-0"
                        >
                          <span className="text-[10px] text-gray-400 truncate max-w-full">
                            {month.total > 0
                              ? money(month.total)
                              : ""}
                          </span>

                          <div className="w-full max-w-16 h-36 flex items-end">
                            <div
                              className="w-full rounded-t-md bg-gradient-to-t from-[#8D6A31] to-[#D5B77E] transition-all"
                              style={{
                                height: `${Math.max(
                                  month.total > 0 ? 8 : 0,
                                  (month.total / maxMonthlySales) * 100
                                )}%`,
                              }}
                            />
                          </div>

                          <span className="text-xs text-gray-500">
                            {month.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="bg-[#1B1917] border border-white/10 rounded-xl p-6">
                  <h3 className="text-lg">
                    Quick Actions
                  </h3>

                  <p className="text-xs text-gray-500 mt-1 mb-6">
                    Manage your store
                  </p>

                  <div className="space-y-3">
                    {[
                      {
                        name: "Products",
                        href: "/admin/products",
                      },
                      {
                        name: "Custom Mixes",
                        href: "/admin/custom-mixes",
                      },
                      {
                        name: "Orders",
                        href: "/admin/orders",
                      },
                      {
                        name: "Customers",
                        href: "/admin/customers",
                      },
                      {
                        name: "Coupons",
                        href: "/admin/coupons",
                      },
                    ].map((item) => (
                      <Link
                        key={item.name}
                        href={item.href}
                        className="w-full flex justify-between items-center p-4 rounded-lg bg-white/5 hover:bg-[#C6A568]/10 border border-white/5 text-sm transition"
                      >
                        {item.name}
                        <span className="text-[#C6A568]">→</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent Orders */}
              <div className="mt-8 bg-[#1B1917] border border-white/10 rounded-xl overflow-hidden">

                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg">
                      Recent Orders
                    </h3>

                    <p className="text-xs text-gray-500 mt-1">
                      Latest orders received by your store
                    </p>
                  </div>

                  <Link
                    href="/admin/orders"
                    className="text-sm text-[#C6A568] hover:text-white"
                  >
                    View all →
                  </Link>
                </div>

                {loading ? (
                  <div className="py-12 text-center text-gray-500 text-sm">
                    Loading recent orders...
                  </div>
                ) : data.recentOrders.length === 0 ? (
                  <div className="py-12 text-center text-gray-500 text-sm">
                    No orders have been received yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] text-left">
                      <thead>
                        <tr className="border-b border-white/10 text-xs text-gray-500">
                          <th className="p-5">Order</th>
                          <th className="p-5">Type</th>
                          <th className="p-5">Customer</th>
                          <th className="p-5">Payment</th>
                          <th className="p-5">Total</th>
                          <th className="p-5">Order Status</th>
                          <th className="p-5">Date</th>
                        </tr>
                      </thead>

                      <tbody>
                        {data.recentOrders.map((order) => (
                          <tr
                            key={order.id}
                            className="border-b border-white/5 last:border-0"
                          >
                            <td className="p-5 text-[#C6A568] font-semibold">
                              #{order.order_number}
                            </td>

                            <td className="p-5">
                              <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${
                                order.source === "custom_mix"
                                  ? "border-[#C6A568]/20 bg-[#C6A568]/10 text-[#D5B77E]"
                                  : "border-white/10 bg-white/5 text-gray-400"
                              }`}>
                                {order.source === "custom_mix" ? "Custom Mix" : "Regular"}
                              </span>
                            </td>

                            <td className="p-5">
                              <p className="text-sm">
                                {order.customer_name}
                              </p>

                              <p className="text-xs text-gray-500 mt-1">
                                {order.customer_phone}
                              </p>
                            </td>

                            <td className="p-5">
                              <span
                                className={`inline-flex rounded-full border px-3 py-1 text-xs ${statusClass(
                                  order.payment_status
                                )}`}
                              >
                                {paymentLabels[order.payment_status] ||
                                  order.payment_status}
                              </span>
                            </td>

                            <td className="p-5 text-sm">
                              {money(order.total)}
                            </td>

                            <td className="p-5">
                              <span
                                className={`inline-flex rounded-full border px-3 py-1 text-xs ${statusClass(
                                  order.order_status
                                )}`}
                              >
                                {orderLabels[order.order_status] ||
                                  order.order_status}
                              </span>
                            </td>

                            <td className="p-5 text-xs text-gray-500">
                              {new Date(
                                order.created_at
                              ).toLocaleDateString("en-GB")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-[#1B1917] border border-white/10 rounded-xl p-10 text-center">
              <div className="text-4xl text-[#C6A568] mb-4">
                ◇
              </div>

              <h2 className="text-2xl font-serif">
                {active}
              </h2>

              <p className="text-gray-500 text-sm mt-3">
                This section will be implemented in the next development stage.
              </p>

              {active === "Categories" && (
                <p className="text-xs text-gray-600 mt-4">
                  Categories management is not connected yet.
                </p>
              )}

              {active === "Coupons" && (
                <p className="text-xs text-gray-600 mt-4">
                  Coupons management is not connected yet.
                </p>
              )}

              {active === "Settings" && (
                <p className="text-xs text-gray-600 mt-4">
                  Store settings are not connected yet.
                </p>
              )}
            </div>
          )}

          <footer className="mt-12 pt-6 border-t border-white/10 text-center text-xs text-gray-600">
            © 2026 BAIT AL OUD. ALL RIGHTS RESERVED.
          </footer>
        </div>
      </main>
    </div>
  );
}
