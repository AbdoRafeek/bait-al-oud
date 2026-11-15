
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  Package,
  Clock,
  CreditCard,
  X,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Order = {
  id: string;
  source: "regular" | "custom_mix";
  custom_status?: string;
  bottle_size_ml?: number;
  custom_mix_items?: {
    id: string;
    fragrance_name: string;
    grams: number | null;
    notes: string | null;
  }[];
  admin_notes?: string | null;
  order_number: number | string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  shipping_city: string;
  shipping_address: string;
  subtotal: number;
  discount: number;
  shipping_fee: number;
  total: number;
  payment_method: "vodafone_cash" | "instapay";
  payment_status: string;
  order_status: string;
  payment_proof_url: string | null;
  transaction_reference: string | null;
  created_at: string;
  notes: string | null;
};

type OrderStatusHistory = {
  id: string;
  old_status: string | null;
  new_status: string;
  changed_at: string;
};

type OrderItem = {
  id: string;
  order_id: string;
  variant_id: string;
  product_name: string;
  size_ml: number;
  quantity: number;
  unit_price: number;
  total_price: number;
};

const orderStatuses = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;

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
  return `EGP ${Number(value || 0).toLocaleString("en-EG")}`;
}

function StatusBadge({ value }: { value: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    paid: "bg-green-500/10 text-green-400 border-green-500/20",
    confirmed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    processing: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    shipped: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    delivered: "bg-green-500/10 text-green-400 border-green-500/20",
    failed: "bg-red-500/10 text-red-400 border-red-500/20",
    cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
    pending_review: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    price_sent: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    awaiting_address: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    awaiting_payment: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    preparing: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    completed: "bg-green-500/10 text-green-400 border-green-500/20",
    rejected: "bg-red-500/10 text-red-400 border-red-500/20",
    refunded: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${
        colors[value] || "bg-white/5 text-white/60 border-white/10"
      }`}
    >
      {paymentLabels[value] || orderLabels[value] || value}
    </span>
  );
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [statusHistory, setStatusHistory] = useState<OrderStatusHistory[]>([]);
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [orderFilter, setOrderFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const supabase = useMemo(() => createClient(), []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");

    const [
      { data: regularData, error: regularError },
      { data: mixData, error: mixError },
    ] = await Promise.all([
      supabase
        .from("orders")
        .select(`
          id,
          order_number,
          customer_name,
          customer_phone,
          customer_email,
          shipping_city,
          shipping_address,
          subtotal,
          discount,
          shipping_fee,
          total,
          payment_method,
          payment_status,
          order_status,
          payment_proof_url,
          transaction_reference,
          created_at,
          notes
        `)
        .order("created_at", { ascending: false }),
      supabase
        .from("custom_mix_requests")
        .select(`
          id,
          request_number,
          customer_name,
          customer_phone,
          bottle_size_ml,
          notes,
          status,
          quoted_price,
          admin_notes,
          shipping_city,
          shipping_address,
          payment_method,
          payment_status,
          payment_proof_url,
          transaction_reference,
          created_at
        `)
        .order("created_at", { ascending: false }),
    ]);

    if (regularError || mixError) {
      setError(
        [regularError?.message, mixError?.message]
          .filter(Boolean)
          .join(" | ")
      );
      setOrders([]);
      setLoading(false);
      return;
    }

    const mixIds = (mixData || []).map((mix) => mix.id);
    let mixItemsByRequest: Record<string, Order["custom_mix_items"]> = {};

    if (mixIds.length > 0) {
      const { data: mixItemsData, error: mixItemsError } = await supabase
        .from("custom_mix_request_items")
        .select("id, request_id, fragrance_name, grams, notes")
        .in("request_id", mixIds);

      if (mixItemsError) {
        setError(`Could not load custom mix ingredients: ${mixItemsError.message}`);
      } else {
        mixItemsByRequest = (mixItemsData || []).reduce((groups, item) => {
          const requestId = item.request_id as string;
          if (!groups[requestId]) groups[requestId] = [];
          groups[requestId]!.push({
            id: item.id,
            fragrance_name: item.fragrance_name,
            grams: item.grams,
            notes: item.notes,
          });
          return groups;
        }, {} as Record<string, NonNullable<Order["custom_mix_items"]>>);
      }
    }

    const regularOrders = (regularData || []).map((order) => ({
      ...order,
      source: "regular" as const,
    })) as Order[];

    const customMixOrders = (mixData || []).map((mix) => {
      const customStatus = String(mix.status || "pending_review");
      const mappedOrderStatus =
        customStatus === "completed" ? "delivered" :
        customStatus === "preparing" ? "processing" :
        customStatus === "paid" ? "confirmed" :
        customStatus === "rejected" ? "cancelled" : "pending";

      return {
        id: mix.id,
        source: "custom_mix" as const,
        custom_status: customStatus,
        order_number: `CM-${mix.request_number}`,
        customer_name: mix.customer_name,
        customer_phone: mix.customer_phone,
        customer_email: null,
        shipping_city: mix.shipping_city || "—",
        shipping_address: mix.shipping_address || "—",
        subtotal: Number(mix.quoted_price || 0),
        discount: 0,
        shipping_fee: 0,
        total: Number(mix.quoted_price || 0),
        payment_method: mix.payment_method === "instapay" ? "instapay" as const : "vodafone_cash" as const,
        payment_status:
          mix.payment_status === "paid" ? "paid" :
          mix.payment_status === "rejected" ? "failed" : "pending",
        order_status: mappedOrderStatus,
        payment_proof_url: mix.payment_proof_url,
        transaction_reference: mix.transaction_reference,
        created_at: mix.created_at,
        notes: mix.notes,
        bottle_size_ml: mix.bottle_size_ml,
        admin_notes: mix.admin_notes,
        custom_mix_items: mixItemsByRequest[mix.id] || [],
      } satisfies Order;
    });

    setOrders(
      [...regularOrders, ...customMixOrders].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    );
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  async function openOrder(order: Order) {
    setSelectedOrder(order);
    setDetailsLoading(true);
    setItems([]);
    setStatusHistory([]);
    setError("");

    if (order.source === "custom_mix") {
      setItems([]);
      setDetailsLoading(false);
      return;
    }

    const { data, error: itemsError } = await supabase
      .from("order_items")
      .select(`
        id,
        order_id,
        variant_id,
        product_name,
        size_ml,
        quantity,
        unit_price,
        total_price
      `)
      .eq("order_id", order.id);

    if (itemsError) {
      setError(itemsError.message);
    } else {
      setItems((data || []) as OrderItem[]);
    }

    const { data: historyData, error: historyError } = await supabase
      .from("order_status_history")
      .select("id, old_status, new_status, changed_at")
      .eq("order_id", order.id)
      .order("changed_at", { ascending: false });

    if (historyError) {
      setError((current) => current || `Could not load status history: ${historyError.message}`);
    } else {
      setStatusHistory((historyData || []) as OrderStatusHistory[]);
    }

    setDetailsLoading(false);
  }

  async function updateOrder(
    order: Order,
    changes: Partial<Pick<Order, "payment_status" | "order_status">>
  ) {
    if (order.source !== "regular") return;

    const isPaymentApproval =
      changes.payment_status === "paid";

    const confirmation = isPaymentApproval
      ? "Confirm that you checked the transfer and received the money?"
      : changes.payment_status === "failed"
        ? "Reject this payment proof?"
        : "Update this order?";

    if (!window.confirm(confirmation)) return;

    setUpdating(true);
    setError("");
    setNotice("");

    const { data, error: updateError } = await supabase
      .from("orders")
      .update(changes)
      .eq("id", order.id)
      .eq("payment_status", order.payment_status)
      .select()
      .single();
    if (updateError) {
      setError(updateError.message);
      setUpdating(false);
      return;
    }

    const updated = { ...(data as Order), source: "regular" as const };

    setOrders((current) =>
      current.map((item) =>
        item.id === order.id ? updated : item
      )
    );

    setSelectedOrder((current) =>
      current?.id === order.id ? updated : current
    );

    setNotice("Order updated successfully.");
    setUpdating(false);
  }

  const filteredOrders = orders.filter((order) => {
    const term = search.toLowerCase();

    const matchesSearch =
      String(order.order_number).toLowerCase().includes(term) ||
      order.customer_name.toLowerCase().includes(term) ||
      order.customer_phone.toLowerCase().includes(term);

    const matchesPayment =
      paymentFilter === "all" ||
      order.payment_status === paymentFilter;

    const matchesOrder =
      orderFilter === "all" ||
      order.order_status === orderFilter;

    return matchesSearch && matchesPayment && matchesOrder;
  });

  const stats = {
    total: orders.length,
    pending: orders.filter(
      (order) => order.payment_status === "pending"
    ).length,
    paid: orders.filter(
      (order) => order.payment_status === "paid"
    ).length,
    revenue: orders
      .filter((order) => order.payment_status === "paid")
      .reduce((sum, order) => sum + Number(order.total), 0),
  };

  return (
    <main className="min-h-screen bg-[#090909] text-white">
      <header className="border-b border-white/10 px-5 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <Link
              href="/admin"
              className="text-sm text-white/40 hover:text-[#c9a45c] flex items-center gap-2 mb-3"
            >
              <ArrowLeft size={15} />
              Back to Dashboard
            </Link>

            <h1 className="text-3xl font-serif">
              Orders <span className="text-[#c9a45c]">Management</span>
            </h1>
          </div>

          <button
            onClick={loadOrders}
            disabled={loading}
            className="border border-white/10 rounded-lg px-4 py-3 hover:border-[#c9a45c] transition flex items-center gap-2 text-sm"
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

        {notice && (
          <div className="mb-6 bg-green-500/10 border border-green-500/20 text-green-300 rounded-xl p-4 text-sm">
            {notice}
          </div>
        )}

        {/* Statistics */}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Total Orders"
            value={stats.total}
            icon={<Package />}
          />

          <StatCard
            title="Awaiting Payment"
            value={stats.pending}
            icon={<Clock />}
          />

          <StatCard
            title="Paid Orders"
            value={stats.paid}
            icon={<CheckCircle2 />}
          />

          <StatCard
            title="Confirmed Revenue"
            value={money(stats.revenue)}
            icon={<CreditCard />}
          />
        </div>

        {/* Filters */}

        <section className="bg-[#111] border border-white/10 rounded-2xl p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
              />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search order, customer or phone..."
                className="checkout-input pl-11"
              />
            </div>

            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="checkout-input"
            >
              <option value="all">All Payment Statuses</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>

            <select
              value={orderFilter}
              onChange={(e) => setOrderFilter(e.target.value)}
              className="checkout-input"
            >
              <option value="all">All Order Statuses</option>
              {orderStatuses.map((status) => (
                <option key={status} value={status}>
                  {orderLabels[status]}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Orders table */}

        <section className="bg-[#111] border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-white/10 flex justify-between">
            <h2 className="font-serif text-xl">All Orders</h2>
            <span className="text-white/40 text-sm">
              {filteredOrders.length} orders
            </span>
          </div>

          {loading ? (
            <div className="py-20 flex justify-center">
              <Loader2
                className="animate-spin text-[#c9a45c]"
                size={30}
              />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-20 text-center text-white/40">
              No orders found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[850px]">
                <thead>
                  <tr className="text-xs text-white/40 border-b border-white/10">
                    <th className="p-5">Order</th>
                    <th className="p-5">Type</th>
                    <th className="p-5">Customer</th>
                    <th className="p-5">Payment</th>
                    <th className="p-5">Total</th>
                    <th className="p-5">Order Status</th>
                    <th className="p-5">Date</th>
                    <th className="p-5">Details</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-white/5 hover:bg-white/[0.025]"
                    >
                      <td className="p-5 text-[#c9a45c] font-semibold">
                        #{order.order_number}
                      </td>

                      <td className="p-5">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${
                          order.source === "custom_mix"
                            ? "border-[#c9a45c]/30 bg-[#c9a45c]/10 text-[#d3b477]"
                            : "border-white/10 bg-white/5 text-white/60"
                        }`}>
                          {order.source === "custom_mix" ? "Custom Mix" : "Regular"}
                        </span>
                      </td>

                      <td className="p-5">
                        <p className="font-medium">
                          {order.customer_name}
                        </p>
                        <p className="text-xs text-white/40 mt-1">
                          {order.customer_phone}
                        </p>
                      </td>

                      <td className="p-5">
                        <StatusBadge value={order.payment_status} />
                        <p className="text-xs text-white/40 mt-2">
                          {order.payment_method === "instapay"
                            ? "InstaPay"
                            : "Vodafone Cash"}
                        </p>
                      </td>

                      <td className="p-5 font-medium">
                        {money(order.total)}
                      </td>

                      <td className="p-5">
                        <StatusBadge
                          value={
                            order.source === "custom_mix"
                              ? order.custom_status || "pending_review"
                              : order.order_status
                          }
                        />
                      </td>

                      <td className="p-5 text-sm text-white/50">
                        {new Date(order.created_at).toLocaleDateString(
                          "en-GB"
                        )}
                      </td>

                      <td className="p-5">
                        <button
                          onClick={() => openOrder(order)}
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

      {/* Order details modal */}

      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto p-4 flex items-start justify-center">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-3xl my-8">
            <div className="p-6 border-b border-white/10 flex justify-between">
              <div>
                <p className="text-[#c9a45c] text-xs tracking-widest mb-2">
                  ORDER DETAILS
                </p>
                <h2 className="text-2xl font-serif">
                  #{selectedOrder.order_number}
                </h2>
              </div>

              <button
                onClick={() => setSelectedOrder(null)}
                className="text-white/50 hover:text-white"
              >
                <X size={23} />
              </button>
            </div>

            <div className="p-6 space-y-7">
              {/* Customer */}

              <div>
                <h3 className="font-semibold mb-4">Customer Information</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <Detail label="Name" value={selectedOrder.customer_name} />
                  <Detail label="Phone" value={selectedOrder.customer_phone} />
                  <Detail label="Email" value={selectedOrder.customer_email || "—"} />
                  <Detail label="City" value={selectedOrder.shipping_city} />
                  <div className="md:col-span-2">
                    <Detail
                      label="Address"
                      value={selectedOrder.shipping_address}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Detail
                      label="Notes"
                      value={selectedOrder.notes || "—"}
                    />
                  </div>
                </div>
              </div>

              {/* Items */}

              <div>
                <h3 className="font-semibold mb-4">
                  {selectedOrder.source === "custom_mix" ? "Custom Mix Ingredients" : "Order Items"}
                </h3>

                {detailsLoading ? (
                  <Loader2
                    className="animate-spin text-[#c9a45c]"
                    size={24}
                  />
                ) : selectedOrder.source === "custom_mix" ? (
                  <div className="space-y-3">
                    <div className="bg-[#c9a45c]/5 border border-[#c9a45c]/20 rounded-xl p-4 mb-3">
                      <Detail
                        label="Bottle Size"
                        value={`${selectedOrder.bottle_size_ml || "—"} ml`}
                      />
                    </div>
                    {(selectedOrder.custom_mix_items || []).length === 0 ? (
                      <p className="text-sm text-white/40">No ingredients found for this custom mix.</p>
                    ) : (
                      selectedOrder.custom_mix_items?.map((item) => (
                        <div
                          key={item.id}
                          className="bg-black border border-white/10 rounded-xl p-4"
                        >
                          <div className="flex justify-between gap-4">
                            <p className="font-medium">{item.fragrance_name}</p>
                            {item.grams !== null && (
                              <span className="text-xs text-[#c9a45c]">{item.grams} g</span>
                            )}
                          </div>
                          {item.notes && (
                            <p className="mt-2 text-xs text-white/40">{item.notes}</p>
                          )}
                        </div>
                      ))
                    )}
                    {selectedOrder.notes && (
                      <div className="bg-black border border-white/10 rounded-xl p-4">
                        <p className="text-xs text-white/40 mb-2">Customer Notes</p>
                        <p className="text-sm text-white/80">{selectedOrder.notes}</p>
                      </div>
                    )}
                    {selectedOrder.admin_notes && (
                      <div className="bg-black border border-[#c9a45c]/20 rounded-xl p-4">
                        <p className="text-xs text-[#c9a45c] mb-2">Admin Notes</p>
                        <p className="text-sm text-white/80">{selectedOrder.admin_notes}</p>
                      </div>
                    )}
                    <p className="text-xs text-white/35">
                      Custom Mix workflow remains managed from the Custom Mixes page.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="bg-black border border-white/10 rounded-xl p-4 flex justify-between gap-4"
                      >
                        <div>
                          <p className="font-medium">{item.product_name}</p>
                          <p className="text-xs text-white/40 mt-1">
                            {item.size_ml} ml × {item.quantity}
                          </p>
                        </div>

                        <p className="text-[#c9a45c]">
                          {money(item.total_price)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment */}

              <div>
                <h3 className="font-semibold mb-4">Payment Verification</h3>

                <div className="bg-black border border-white/10 rounded-xl p-5 space-y-3">
                  <Detail
                    label="Method"
                    value={
                      selectedOrder.payment_method === "instapay"
                        ? "InstaPay"
                        : "Vodafone Cash"
                    }
                  />

                  <Detail
                    label="Payment Status"
                    value={paymentLabels[selectedOrder.payment_status]}
                  />

                  <Detail
                    label="Transaction Reference"
                    value={selectedOrder.transaction_reference || "—"}
                  />

                  <div className="border-t border-white/10 pt-4">
                    <p className="text-xs text-white/40 mb-3">
                      Payment Screenshot
                    </p>

                    {selectedOrder.payment_proof_url ? (
                      <a
                        href={selectedOrder.payment_proof_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-[#c9a45c] text-sm mb-3"
                      >
                        Open payment proof
                        <ExternalLink size={15} />
                      </a>
                    ) : (
                      <p className="text-sm text-red-400">
                        No payment proof uploaded.
                      </p>
                    )}

                    {selectedOrder.payment_proof_url && (
                      <a
                        href={selectedOrder.payment_proof_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img
                          src={selectedOrder.payment_proof_url}
                          alt="Payment proof"
                          className="max-h-80 rounded-lg border border-white/10 object-contain bg-white"
                        />
                      </a>
                    )}
                  </div>
                </div>

                {selectedOrder.source === "regular" && selectedOrder.payment_status === "pending" && (
                  <div className="flex flex-wrap gap-3 mt-4">
                    <button
                      disabled={
                        updating || !selectedOrder.payment_proof_url
                      }
                      onClick={() =>
                        updateOrder(selectedOrder, {
                          payment_status: "paid",
                          order_status: "confirmed",
                        })
                      }
                      className="flex-1 min-w-[150px] bg-green-600 hover:bg-green-500 disabled:opacity-40 rounded-lg py-3 font-semibold flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 size={17} />
                      Verify Payment
                    </button>

                    <button
                      disabled={updating}
                      onClick={() =>
                        updateOrder(selectedOrder, {
                          payment_status: "failed",
                        })
                      }
                      className="flex-1 min-w-[150px] bg-red-600/80 hover:bg-red-500 disabled:opacity-40 rounded-lg py-3 font-semibold flex items-center justify-center gap-2"
                    >
                      <XCircle size={17} />
                      Reject Payment
                    </button>
                  </div>
                )}
              </div>

              {/* Order status */}

              {selectedOrder.source === "regular" ? (
              <div>
                <h3 className="font-semibold mb-4">Order Status</h3>

                <div className="flex flex-wrap gap-2">
                  {orderStatuses.map((status) => {
                    const current = selectedOrder.order_status;
                    const nextStatus: Record<string, string | null> = {
                      pending: "confirmed",
                      confirmed: "processing",
                      processing: "shipped",
                      shipped: "delivered",
                      delivered: null,
                      cancelled: null,
                    };
                    const isNextStep =
                      nextStatus[current] === status &&
                      selectedOrder.payment_status === "paid";
                    const canCancel =
                      status === "cancelled" &&
                      !["shipped", "delivered", "cancelled"].includes(current);
                    const isCurrent = current === status;
                    const allowed = isNextStep || canCancel;

                    return (
                      <button
                        key={status}
                        disabled={updating || isCurrent || !allowed}
                        onClick={() =>
                          updateOrder(selectedOrder, {
                            order_status: status,
                          })
                        }
                        className={`px-3 py-2 rounded-lg border text-xs transition ${
                          isCurrent
                            ? "border-[#c9a45c] text-[#c9a45c] bg-[#c9a45c]/10"
                            : allowed && status === "cancelled"
                              ? "border-red-500/30 text-red-300 hover:border-red-400"
                              : "border-white/10 text-white/60 hover:border-white/30"
                        } disabled:opacity-40`}
                      >
                        {orderLabels[status]}
                      </button>
                    );
                  })}
                </div>

                {selectedOrder.payment_status !== "paid" && (
                  <p className="text-xs text-white/35 mt-3">
                    Verify payment before moving an order to fulfillment.
                  </p>
                )}
                <p className="text-xs text-white/35 mt-2">
                  Only the next step is available. Cancelling an order restores its reserved stock.
                </p>
              </div>
              ) : (
                <div className="rounded-xl border border-[#c9a45c]/20 bg-[#c9a45c]/5 p-5">
                  <h3 className="font-semibold mb-2">Custom Mix Status</h3>
                  <p className="text-sm text-[#d3b477]">
                    {selectedOrder.custom_status?.replaceAll("_", " ") || "Under review"}
                  </p>
                  <p className="mt-2 text-xs text-white/40">
                    Update payment and preparation stages from the Custom Mixes page to keep its workflow unchanged.
                  </p>
                </div>
              )}

              {/* Status history */}

              {selectedOrder.source === "regular" && (
              <div>
                <h3 className="font-semibold mb-4">Status History</h3>
                {detailsLoading ? (
                  <Loader2 className="animate-spin text-[#c9a45c]" size={22} />
                ) : statusHistory.length === 0 ? (
                  <p className="text-sm text-white/40 bg-black border border-white/10 rounded-xl p-4">
                    No status changes recorded yet. New changes will appear here.
                  </p>
                ) : (
                  <div className="bg-black border border-white/10 rounded-xl p-4 space-y-4">
                    {statusHistory.map((entry) => (
                      <div key={entry.id} className="flex items-start justify-between gap-4 text-sm">
                        <div>
                          <p className="text-white/85">
                            {entry.old_status
                              ? `${orderLabels[entry.old_status] || entry.old_status} → ${orderLabels[entry.new_status] || entry.new_status}`
                              : `Created as ${orderLabels[entry.new_status] || entry.new_status}`}
                          </p>
                          <p className="text-xs text-white/40 mt-1">
                            {new Date(entry.changed_at).toLocaleString("en-GB")}
                          </p>
                        </div>
                        <StatusBadge value={entry.new_status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )}

              {/* Total */}

              <div className="border-t border-white/10 pt-5">
                <div className="flex justify-between text-sm text-white/50 mb-2">
                  <span>Subtotal</span>
                  <span>{money(selectedOrder.subtotal)}</span>
                </div>

                <div className="flex justify-between text-sm text-white/50 mb-2">
                  <span>Shipping</span>
                  <span>{money(selectedOrder.shipping_fee)}</span>
                </div>

                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span className="text-[#c9a45c]">
                    {money(selectedOrder.total)}
                  </span>
                </div>
              </div>
            </div>

            {updating && (
              <div className="border-t border-white/10 p-4 text-sm text-[#c9a45c] flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Updating order...
              </div>
            )}
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

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs text-white/40 mb-1">{label}</p>
      <p className="text-white/85 break-words">{value}</p>
    </div>
  );
}
