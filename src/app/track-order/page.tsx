"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Loader2,
  Package,
  Search,
  XCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type TrackedItem = {
  product_name: string;
  size_ml: number;
  quantity: number;
  unit_price: number;
  total_price: number;
};

type TrackedOrder = {
  order_number: number | string;
  customer_name: string;
  order_status: string;
  payment_status: string;
  payment_method: string;
  subtotal: number;
  discount: number;
  shipping_fee: number;
  total: number;
  created_at: string;
  updated_at: string;
  items: TrackedItem[];
};

const steps = [
  { key: "pending", label: "Order received", description: "Your order has been received." },
  { key: "confirmed", label: "Payment confirmed", description: "Your payment has been verified." },
  { key: "processing", label: "Preparing your order", description: "Your order is being prepared." },
  { key: "shipped", label: "Shipped", description: "Your order is on its way." },
  { key: "delivered", label: "Delivered", description: "Your order has been delivered." },
];

function money(value: number) {
  return `EGP ${Number(value || 0).toLocaleString("en-EG", { maximumFractionDigits: 2 })}`;
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    pending: "Pending",
    confirmed: "Confirmed",
    processing: "Processing",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };
  return labels[value] || value;
}

function TrackOrderContent() {
  const searchParams = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(searchParams.get("order") || "");
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setOrderNumber(searchParams.get("order") || "");
  }, [searchParams]);

  async function findOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setOrder(null);

    const number = Number(orderNumber.trim());
    if (!Number.isSafeInteger(number) || number <= 0 || !phone.trim()) {
      setError("Enter a valid order number and the phone number used at checkout.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("get_store_order_tracking", {
        p_order_number: number,
        p_phone: phone.trim(),
      });
      if (rpcError) throw rpcError;

      const result = Array.isArray(data) ? data[0] : data;
      if (!result?.success || !result?.order) {
        setError(result?.message || "Order not found. Check your details and try again.");
        return;
      }
      setOrder(result.order as TrackedOrder);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to retrieve this order.");
    } finally {
      setLoading(false);
    }
  }

  const currentStep = order ? steps.findIndex((step) => step.key === order.order_status) : -1;
  const cancelled = order?.order_status === "cancelled";

  return (
    <main className="min-h-screen bg-[#090909] text-white">
      <header className="border-b border-white/10 px-5 py-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl tracking-[0.18em] font-serif">
            BAIT <span className="text-[#c9a45c]">AL OUD</span>
          </Link>
          <Link href="/products" className="text-sm text-white/55 hover:text-[#c9a45c]">
            Continue Shopping
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-12">
        <Link href="/checkout" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-[#c9a45c] mb-8">
          <ArrowLeft size={16} /> Back
        </Link>

        <div className="mb-8">
          <p className="text-[#c9a45c] text-xs tracking-[0.3em] uppercase mb-3">Order updates</p>
          <h1 className="text-4xl md:text-5xl font-serif">Track Your Order</h1>
          <p className="text-white/45 mt-3">Enter your order number and checkout phone number to view the latest status.</p>
        </div>

        <form onSubmit={findOrder} className="bg-[#111] border border-white/10 rounded-2xl p-5 md:p-7 space-y-4">
          <div>
            <label className="block text-sm text-white/65 mb-2">Order Number</label>
            <input
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              inputMode="numeric"
              placeholder="e.g. 1001"
              className="w-full bg-black border border-white/15 rounded-lg px-4 py-3 outline-none focus:border-[#c9a45c]"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-white/65 mb-2">Phone Number</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              autoComplete="tel"
              placeholder="The phone number used when ordering"
              className="w-full bg-black border border-white/15 rounded-lg px-4 py-3 outline-none focus:border-[#c9a45c]"
              required
            />
          </div>
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#c9a45c] hover:bg-[#dfbd78] disabled:opacity-50 text-black font-semibold rounded-lg py-3 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
            {loading ? "Searching..." : "Find Order"}
          </button>
        </form>

        {order && (
          <section className="mt-8 space-y-6">
            <div className="bg-[#111] border border-[#c9a45c]/25 rounded-2xl p-5 md:p-7">
              <div className="flex flex-wrap justify-between gap-3 items-start">
                <div>
                  <p className="text-xs text-white/40 mb-1">ORDER NUMBER</p>
                  <h2 className="text-2xl text-[#c9a45c] font-semibold">#{order.order_number}</h2>
                  <p className="text-sm text-white/45 mt-2">{order.customer_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/40 mb-1">ORDER STATUS</p>
                  <span className="inline-block border border-[#c9a45c]/30 bg-[#c9a45c]/10 text-[#d8ba80] rounded-full px-3 py-1 text-sm">
                    {statusLabel(order.order_status)}
                  </span>
                  <p className="text-xs text-white/45 mt-2">
                    Payment: {order.payment_status === "paid" ? "Verified" : order.payment_status === "failed" ? "Rejected" : "Under review"}
                  </p>
                </div>
              </div>

              <div className="border-t border-white/10 mt-6 pt-6">
                <h3 className="font-semibold mb-5">Order Progress</h3>
                {cancelled ? (
                  <div className="flex items-center gap-3 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                    <XCircle /> This order has been cancelled.
                  </div>
                ) : (
                  <div className="space-y-5">
                    {steps.map((step, index) => {
                      const complete = currentStep >= index;
                      const active = currentStep === index;
                      return (
                        <div key={step.key} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            {complete
                              ? <CheckCircle2 className={active ? "text-[#c9a45c]" : "text-green-400"} />
                              : <Circle className="text-white/20" />}
                            {index < steps.length - 1 && <div className={`w-px h-8 mt-1 ${currentStep > index ? "bg-green-500/50" : "bg-white/10"}`} />}
                          </div>
                          <div className="pb-2">
                            <p className={complete ? "text-white font-medium" : "text-white/35"}>{step.label}</p>
                            <p className="text-xs text-white/40 mt-1">{step.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-white/35 mt-5">
                  Last updated: {new Date(order.updated_at || order.created_at).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="bg-[#111] border border-white/10 rounded-2xl p-5 md:p-7">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Package size={18} className="text-[#c9a45c]" /> Order Items</h3>
              <div className="space-y-4">
                {order.items.map((item, index) => (
                  <div key={`${item.product_name}-${item.size_ml}-${index}`} className="flex justify-between gap-4 text-sm">
                    <div>
                      <p>{item.product_name}</p>
                      <p className="text-white/40 text-xs mt-1">{item.size_ml} ml × {item.quantity}</p>
                    </div>
                    <p className="text-white/75">{money(item.total_price)}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-white/10 mt-5 pt-4 space-y-2 text-sm">
                <div className="flex justify-between text-white/55"><span>Subtotal</span><span>{money(order.subtotal)}</span></div>
                {Number(order.discount) > 0 && <div className="flex justify-between text-green-400"><span>Discount</span><span>-{money(order.discount)}</span></div>}
                <div className="flex justify-between text-white/55"><span>Shipping</span><span>{money(order.shipping_fee)}</span></div>
                <div className="flex justify-between text-[#c9a45c] font-semibold text-lg pt-2"><span>Total</span><span>{money(order.total)}</span></div>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}


export default function TrackOrderPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#090909] text-white flex items-center justify-center">
          <Loader2 className="animate-spin text-[#c9a45c]" size={28} />
        </main>
      }
    >
      <TrackOrderContent />
    </Suspense>
  );
}
