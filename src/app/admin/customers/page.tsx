"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  RefreshCw,
  Users,
  ShoppingBag,
  Wallet,
  CalendarDays,
  Eye,
  X,
  Loader2,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Order = {
  id: string;
  source: "regular" | "custom_mix";
  custom_status?: string;
  bottle_size_ml?: number;
  admin_notes?: string | null;
  custom_mix_items?: {
    id: string;
    fragrance_name: string;
    grams: number | null;
    notes: string | null;
  }[];
  order_number: number | string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  shipping_city: string;
  shipping_address: string;
  total: number;
  payment_status: string;
  order_status: string;
  created_at: string;
};

type Customer = {
  key: string;
  name: string;
  phone: string;
  email: string | null;
  city: string;
  address: string;
  orders: Order[];
  totalOrders: number;
  paidOrders: number;
  totalSpent: number;
  lastOrderAt: string;
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

function buildCustomers(orders: Order[]): Customer[] {
  const grouped = new Map<string, Order[]>();

  for (const order of orders) {
    const phone = (order.customer_phone || "").trim();
    const key = phone || `order:${order.id}`;
    const current = grouped.get(key) || [];
    current.push(order);
    grouped.set(key, current);
  }

  return Array.from(grouped.entries())
    .map(([key, customerOrders]) => {
      const sorted = [...customerOrders].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const latest = sorted[0];
      const paidOrders = customerOrders.filter(
        (order) => order.payment_status === "paid"
      );

      return {
        key,
        name: latest.customer_name || "Unknown customer",
        phone: latest.customer_phone || "—",
        email:
          customerOrders.find((order) => order.customer_email)?.customer_email ||
          null,
        city: latest.shipping_city || "—",
        address: latest.shipping_address || "—",
        orders: sorted,
        totalOrders: customerOrders.length,
        paidOrders: paidOrders.length,
        totalSpent: paidOrders.reduce(
          (sum, order) => sum + Number(order.total || 0),
          0
        ),
        lastOrderAt: latest.created_at,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.lastOrderAt).getTime() - new Date(a.lastOrderAt).getTime()
    );
}

export default function AdminCustomersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const supabase = useMemo(() => createClient(), []);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError("");

    const [
      { data: regularData, error: regularError },
      { data: mixData, error: mixError },
    ] = await Promise.all([
      supabase
        .from("orders")
        .select(
          "id, order_number, customer_name, customer_phone, customer_email, shipping_city, shipping_address, total, payment_status, order_status, created_at"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("custom_mix_requests")
        .select(
          "id, request_number, customer_name, customer_phone, bottle_size_ml, notes, status, quoted_price, admin_notes, shipping_city, shipping_address, payment_status, created_at"
        )
        .order("created_at", { ascending: false }),
    ]);

    if (regularError || mixError) {
      setError(
        [regularError?.message, mixError?.message].filter(Boolean).join(" | ")
      );
      setOrders([]);
      setLoading(false);
      return;
    }

    const mixes = mixData || [];
    const mixIds = mixes.map((mix) => mix.id);
    let mixItemsByRequest: Record<
      string,
      NonNullable<Order["custom_mix_items"]>
    > = {};

    if (mixIds.length > 0) {
      const { data: mixItemsData, error: mixItemsError } = await supabase
        .from("custom_mix_request_items")
        .select("id, request_id, fragrance_name, grams, notes")
        .in("request_id", mixIds);

      if (mixItemsError) {
        setError(
          `Could not load custom mix ingredients: ${mixItemsError.message}`
        );
      } else {
        mixItemsByRequest = (mixItemsData || []).reduce((groups, item) => {
          const requestId = item.request_id as string;
          if (!groups[requestId]) groups[requestId] = [];
          groups[requestId].push({
            id: item.id,
            fragrance_name: item.fragrance_name,
            grams: item.grams,
            notes: item.notes,
          });
          return groups;
        }, {} as Record<string, NonNullable<Order["custom_mix_items"]>>);
      }
    }

    const regularOrders: Order[] = (regularData || []).map((order) => ({
      ...order,
      source: "regular",
    }));

    const customMixOrders: Order[] = mixes.map((mix) => {
      const customStatus = String(mix.status || "pending_review");
      const mappedOrderStatus =
        customStatus === "paid"
          ? "confirmed"
          : customStatus === "preparing"
            ? "processing"
            : customStatus === "completed"
              ? "delivered"
              : customStatus === "rejected"
                ? "cancelled"
                : "pending";

      return {
        id: mix.id,
        source: "custom_mix",
        custom_status: customStatus,
        order_number: `CM-${mix.request_number}`,
        customer_name: mix.customer_name,
        customer_phone: mix.customer_phone,
        customer_email: null,
        shipping_city: mix.shipping_city || "—",
        shipping_address: mix.shipping_address || "—",
        total: Number(mix.quoted_price || 0),
        payment_status:
          mix.payment_status === "paid"
            ? "paid"
            : mix.payment_status === "rejected"
              ? "failed"
              : "pending",
        order_status: mappedOrderStatus,
        created_at: mix.created_at,
        bottle_size_ml: mix.bottle_size_ml,
        admin_notes: mix.admin_notes,
        custom_mix_items: mixItemsByRequest[mix.id] || [],
      };
    });

    setOrders(
      [...regularOrders, ...customMixOrders].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    );
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const customers = useMemo(() => buildCustomers(orders), [orders]);

  const filteredCustomers = customers.filter((customer) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;

    return (
      customer.name.toLowerCase().includes(term) ||
      customer.phone.toLowerCase().includes(term) ||
      (customer.email || "").toLowerCase().includes(term) ||
      customer.city.toLowerCase().includes(term)
    );
  });

  const totalPaidRevenue = customers.reduce(
    (sum, customer) => sum + customer.totalSpent,
    0
  );
  const repeatCustomers = customers.filter(
    (customer) => customer.totalOrders > 1
  ).length;

  return (
    <main className="min-h-screen bg-[#090909] text-white">
      <header className="border-b border-white/10 px-5 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div>
            <Link
              href="/admin"
              className="text-sm text-white/40 hover:text-[#c9a45c] flex items-center gap-2 mb-3"
            >
              <ArrowLeft size={15} />
              Back to Dashboard
            </Link>
            <h1 className="text-3xl font-serif">
              Customers <span className="text-[#c9a45c]">Management</span>
            </h1>
            <p className="text-sm text-white/40 mt-2">
              Customer records are grouped by phone number across regular orders and custom mixes.
            </p>
          </div>

          <button
            onClick={loadCustomers}
            disabled={loading}
            className="border border-white/10 rounded-lg px-4 py-3 hover:border-[#c9a45c] transition flex items-center gap-2 text-sm disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 py-8">
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-300 rounded-xl p-4 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <StatCard title="Total Customers" value={loading ? "—" : customers.length} icon={<Users />} />
          <StatCard title="Total Orders" value={loading ? "—" : orders.length} icon={<ShoppingBag />} />
          <StatCard title="Paid Revenue" value={loading ? "—" : money(totalPaidRevenue)} icon={<Wallet />} />
          <StatCard title="Repeat Customers" value={loading ? "—" : repeatCustomers} icon={<Users />} />
        </div>

        <section className="bg-[#111] border border-white/10 rounded-2xl p-5 mb-6">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, phone, email or city..."
              className="checkout-input pl-11"
            />
          </div>
        </section>

        <section className="bg-[#111] border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-white/10 flex justify-between">
            <h2 className="font-serif text-xl">All Customers</h2>
            <span className="text-white/40 text-sm">
              {filteredCustomers.length} customers
            </span>
          </div>

          {loading ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="animate-spin text-[#c9a45c]" size={30} />
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="py-20 text-center text-white/40">
              No customers found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[900px]">
                <thead>
                  <tr className="text-xs text-white/40 border-b border-white/10">
                    <th className="p-5">Customer</th>
                    <th className="p-5">Contact</th>
                    <th className="p-5">Orders</th>
                    <th className="p-5">Paid Total</th>
                    <th className="p-5">Last Order</th>
                    <th className="p-5">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer) => (
                    <tr
                      key={customer.key}
                      className="border-b border-white/5 hover:bg-white/[0.025]"
                    >
                      <td className="p-5">
                        <p className="font-medium">{customer.name}</p>
                        <p className="text-xs text-white/40 mt-1">
                          {customer.city}
                        </p>
                      </td>
                      <td className="p-5">
                        <p className="text-sm">{customer.phone}</p>
                        <p className="text-xs text-white/40 mt-1">
                          {customer.email || "No email"}
                        </p>
                      </td>
                      <td className="p-5">
                        <p>{customer.totalOrders}</p>
                        <p className="text-xs text-white/40 mt-1">
                          {customer.paidOrders} paid
                        </p>
                      </td>
                      <td className="p-5 text-[#c9a45c] font-medium">
                        {money(customer.totalSpent)}
                      </td>
                      <td className="p-5 text-sm text-white/50">
                        {new Date(customer.lastOrderAt).toLocaleDateString(
                          "en-GB"
                        )}
                      </td>
                      <td className="p-5">
                        <button
                          onClick={() => setSelectedCustomer(customer)}
                          className="text-[#c9a45c] hover:text-white flex items-center gap-2 text-sm"
                        >
                          <Eye size={16} />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto p-4 flex items-start justify-center">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-3xl my-8">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <p className="text-[#c9a45c] text-xs tracking-widest mb-2">
                  CUSTOMER PROFILE
                </p>
                <h2 className="text-2xl font-serif">
                  {selectedCustomer.name}
                </h2>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-white/50 hover:text-white"
                aria-label="Close customer details"
              >
                <X size={23} />
              </button>
            </div>

            <div className="p-6 space-y-7">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Info icon={<Phone size={16} />} label="Phone" value={selectedCustomer.phone} />
                <Info icon={<Mail size={16} />} label="Email" value={selectedCustomer.email || "—"} />
                <Info icon={<MapPin size={16} />} label="City" value={selectedCustomer.city} />
                <Info icon={<MapPin size={16} />} label="Address" value={selectedCustomer.address} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <MiniStat label="Total Orders" value={selectedCustomer.totalOrders} />
                <MiniStat label="Paid Orders" value={selectedCustomer.paidOrders} />
                <MiniStat label="Paid Total" value={money(selectedCustomer.totalSpent)} />
              </div>

              <div>
                <h3 className="font-semibold mb-4">Order History</h3>
                <div className="space-y-3">
                  {selectedCustomer.orders.map((order) => (
                    <div
                      key={order.id}
                      className="bg-black border border-white/10 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-[#c9a45c]">
                            Order #{order.order_number}
                          </p>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] ${
                            order.source === "custom_mix"
                              ? "border-[#c9a45c]/30 bg-[#c9a45c]/10 text-[#d5b77e]"
                              : "border-white/10 bg-white/5 text-white/50"
                          }`}>
                            {order.source === "custom_mix" ? "Custom Mix" : "Regular"}
                          </span>
                        </div>
                        {order.source === "custom_mix" && (
                          <div className="mt-2 space-y-1 text-xs text-white/45">
                            <p>Bottle: {order.bottle_size_ml || "—"} ml</p>
                            {order.custom_mix_items?.map((item) => (
                              <p key={item.id}>
                                {item.fragrance_name}{item.grams !== null ? ` · ${item.grams} g` : ""}
                              </p>
                            ))}
                            {order.admin_notes && <p>Admin note: {order.admin_notes}</p>}
                          </div>
                        )}
                        <p className="text-xs text-white/40 mt-1 flex items-center gap-2">
                          <CalendarDays size={13} />
                          {new Date(order.created_at).toLocaleString("en-GB")}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-medium">{money(order.total)}</p>
                          <p className="text-xs text-white/40 mt-1">
                            {paymentLabels[order.payment_status] || order.payment_status}
                          </p>
                        </div>
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs ${statusClass(
                            order.source === "custom_mix"
                              ? order.custom_status || "pending_review"
                              : order.order_status
                          )}`}
                        >
                          {orderLabels[
                            order.source === "custom_mix"
                              ? order.custom_status || "pending_review"
                              : order.order_status
                          ] || (order.source === "custom_mix" ? order.custom_status : order.order_status)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Link
                href="/admin/orders"
                className="inline-flex text-sm text-[#c9a45c] hover:text-white"
              >
                Open Orders Management →
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-[#111] border border-white/10 rounded-2xl p-5">
      <div className="flex justify-between items-center mb-5">
        <p className="text-sm text-white/45">{title}</p>
        <span className="text-[#c9a45c]">{icon}</span>
      </div>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Info({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-black border border-white/10 rounded-xl p-4">
      <p className="text-xs text-white/40 mb-2 flex items-center gap-2">
        <span className="text-[#c9a45c]">{icon}</span>
        {label}
      </p>
      <p className="text-sm break-words">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-black border border-white/10 rounded-xl p-4">
      <p className="text-xs text-white/40">{label}</p>
      <p className="text-lg font-semibold mt-2">{value}</p>
    </div>
  );
}
