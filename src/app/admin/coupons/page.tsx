"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Search,
  RefreshCw,
  Pencil,
  Trash2,
  X,
  TicketPercent,
  CheckCircle2,
  Eye,
  EyeOff,
  Copy,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Coupon = {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  min_order_amount: number | null;
  expires_at: string | null;
  usage_limit: number | null;
  used_count: number | null;
  is_active: boolean | null;
  created_at: string;
};

type CouponForm = {
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: string;
  min_order_amount: string;
  expires_at: string;
  usage_limit: string;
  is_active: boolean;
};

const emptyForm: CouponForm = {
  code: "",
  discount_type: "percentage",
  discount_value: "",
  min_order_amount: "0",
  expires_at: "",
  usage_limit: "",
  is_active: true,
};

function money(value: number) {
  return `EGP ${Number(value || 0).toLocaleString("en-EG", {
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null) {
  if (!value) return "No expiry";
  return new Date(value).toLocaleDateString("en-GB");
}

function isExpired(coupon: Coupon) {
  return Boolean(coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now());
}

function isLimitReached(coupon: Coupon) {
  return coupon.usage_limit !== null &&
    Number(coupon.used_count || 0) >= Number(coupon.usage_limit);
}

export default function CouponsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [form, setForm] = useState<CouponForm>(emptyForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadCoupons = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error: queryError } = await supabase
      .from("coupons")
      .select("id, code, discount_type, discount_value, min_order_amount, expires_at, usage_limit, used_count, is_active, created_at")
      .order("created_at", { ascending: false });

    if (queryError) {
      setError(queryError.message);
      setCoupons([]);
    } else {
      setCoupons((data || []) as Coupon[]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadCoupons();
  }, [loadCoupons]);

  const filteredCoupons = coupons.filter((coupon) =>
    coupon.code.toLowerCase().includes(search.trim().toLowerCase())
  );

  const activeCount = coupons.filter((coupon) => coupon.is_active).length;
  const expiredCount = coupons.filter(isExpired).length;
  const totalUses = coupons.reduce((sum, coupon) => sum + Number(coupon.used_count || 0), 0);

  function openAddModal() {
    setEditingCoupon(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  function openEditModal(coupon: Coupon) {
    setEditingCoupon(coupon);
    setForm({
      code: coupon.code,
      discount_type: coupon.discount_type === "fixed" ? "fixed" : "percentage",
      discount_value: String(coupon.discount_value),
      min_order_amount: String(coupon.min_order_amount ?? 0),
      expires_at: coupon.expires_at ? new Date(coupon.expires_at).toISOString().slice(0, 16) : "",
      usage_limit: coupon.usage_limit === null ? "" : String(coupon.usage_limit),
      is_active: coupon.is_active ?? true,
    });
    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const code = form.code.trim().toUpperCase().replace(/\s+/g, "");
    const discountValue = Number(form.discount_value);
    const minimum = Number(form.min_order_amount || 0);
    const usageLimit = form.usage_limit.trim() === "" ? null : Number(form.usage_limit);

    if (!code) {
      setError("Please enter a coupon code.");
      return;
    }
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      setError("Discount value must be greater than zero.");
      return;
    }
    if (form.discount_type === "percentage" && discountValue > 100) {
      setError("Percentage discount cannot be greater than 100.");
      return;
    }
    if (!Number.isFinite(minimum) || minimum < 0) {
      setError("Minimum order amount cannot be negative.");
      return;
    }
    if (usageLimit !== null && (!Number.isInteger(usageLimit) || usageLimit < 1)) {
      setError("Usage limit must be a positive whole number.");
      return;
    }

    setSaving(true);

    const couponData = {
      code,
      discount_type: form.discount_type,
      discount_value: discountValue,
      min_order_amount: minimum,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      usage_limit: usageLimit,
      is_active: form.is_active,
    };

    const result = editingCoupon
      ? await supabase.from("coupons").update(couponData).eq("id", editingCoupon.id)
      : await supabase.from("coupons").insert(couponData);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setModalOpen(false);
    setSuccess(editingCoupon ? "Coupon updated successfully." : "Coupon created successfully.");
    await loadCoupons();
  }

  async function toggleCoupon(coupon: Coupon) {
    setError("");
    setSuccess("");

    const { error: updateError } = await supabase
      .from("coupons")
      .update({ is_active: !(coupon.is_active ?? false) })
      .eq("id", coupon.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(coupon.is_active ? "Coupon deactivated." : "Coupon activated.");
    await loadCoupons();
  }

  async function deleteCoupon(coupon: Coupon) {
    if (!window.confirm(`Are you sure you want to delete coupon "${coupon.code}"?`)) return;

    setError("");
    setSuccess("");

    const { error: deleteError } = await supabase
      .from("coupons")
      .delete()
      .eq("id", coupon.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setSuccess("Coupon deleted successfully.");
    await loadCoupons();
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setSuccess(`Coupon code ${code} copied.`);
      setError("");
    } catch {
      setError("Could not copy the code. Please copy it manually.");
    }
  }

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <div className="border-b border-white/10 px-6 py-6 md:px-10">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <Link href="/admin" className="mb-5 inline-flex items-center gap-2 text-sm text-gray-400 transition hover:text-[#d6ad60]">
              <ArrowLeft size={17} /> Back to Dashboard
            </Link>
            <h1 className="font-serif text-3xl md:text-4xl">
              Coupons <span className="text-[#d6ad60]">Management</span>
            </h1>
            <p className="mt-2 text-sm text-gray-500">Create and manage discount codes for your store.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => void loadCoupons()} disabled={loading} className="flex items-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm transition hover:border-[#d6ad60] disabled:opacity-50">
              <RefreshCw size={17} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <button onClick={openAddModal} className="flex items-center gap-2 rounded-xl bg-[#d6ad60] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#e5c27d]">
              <Plus size={18} /> Add Coupon
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1500px] space-y-8 px-5 py-8 md:px-10">
        {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
        {success && <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300">{success}</div>}

        <section className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <StatCard title="Total Coupons" value={coupons.length} icon={<TicketPercent size={25} />} />
          <StatCard title="Active Coupons" value={activeCount} icon={<CheckCircle2 size={25} />} />
          <StatCard title="Total Uses" value={totalUses} icon={<TicketPercent size={25} />} />
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#111111] p-5">
          <div className="relative">
            <Search size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search coupon code..." className="w-full rounded-xl border border-white/10 bg-[#080808] py-4 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-[#d6ad60]" />
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#111111]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-5">
            <h2 className="font-serif text-xl">All Coupons</h2>
            <span className="text-sm text-gray-500">{filteredCoupons.length} coupons · {expiredCount} expired</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left">
              <thead>
                <tr className="border-b border-white/10 text-sm text-gray-500">
                  <th className="px-6 py-5 font-medium">Code</th>
                  <th className="px-6 py-5 font-medium">Discount</th>
                  <th className="px-6 py-5 font-medium">Min. Order</th>
                  <th className="px-6 py-5 font-medium">Usage</th>
                  <th className="px-6 py-5 font-medium">Expires</th>
                  <th className="px-6 py-5 font-medium">Status</th>
                  <th className="px-6 py-5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500">Loading coupons...</td></tr>
                ) : filteredCoupons.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500">No coupons found. Create your first coupon.</td></tr>
                ) : filteredCoupons.map((coupon) => {
                  const expired = isExpired(coupon);
                  const limitReached = isLimitReached(coupon);
                  const active = Boolean(coupon.is_active) && !expired && !limitReached;
                  return (
                    <tr key={coupon.id} className="border-b border-white/5 transition hover:bg-white/[0.02]">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 font-semibold text-[#d6ad60]">
                          {coupon.code}
                          <button onClick={() => void copyCode(coupon.code)} title="Copy code" className="text-gray-500 transition hover:text-white"><Copy size={15} /></button>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-sm">
                        {coupon.discount_type === "percentage" ? `${coupon.discount_value}%` : money(Number(coupon.discount_value))}
                      </td>
                      <td className="px-6 py-5 text-sm text-gray-300">{money(Number(coupon.min_order_amount || 0))}</td>
                      <td className="px-6 py-5 text-sm text-gray-300">
                        {Number(coupon.used_count || 0)} / {coupon.usage_limit ?? "∞"}
                      </td>
                      <td className="px-6 py-5 text-sm text-gray-400">{formatDate(coupon.expires_at)}</td>
                      <td className="px-6 py-5">
                        <span className={`rounded-full px-3 py-1 text-xs ${active ? "bg-green-500/10 text-green-400" : "bg-gray-500/10 text-gray-400"}`}>
                          {expired ? "Expired" : limitReached ? "Limit reached" : coupon.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <button onClick={() => openEditModal(coupon)} title="Edit" className="text-[#d6ad60] transition hover:text-white"><Pencil size={18} /></button>
                          <button onClick={() => void toggleCoupon(coupon)} title={coupon.is_active ? "Deactivate" : "Activate"} className="text-gray-400 transition hover:text-white">
                            {coupon.is_active ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                          <button onClick={() => void deleteCoupon(coupon)} title="Delete" className="text-red-400 transition hover:text-red-300"><Trash2 size={18} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4">
          <div className="my-8 w-full max-w-xl rounded-2xl border border-white/10 bg-[#151515] p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-serif text-2xl">{editingCoupon ? "Edit Coupon" : "Add Coupon"}</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 transition hover:text-white"><X size={22} /></button>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              <Field label="Coupon Code">
                <input value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))} placeholder="e.g. WELCOME10" required className={inputClass} />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Discount Type">
                  <select value={form.discount_type} onChange={(event) => setForm((prev) => ({ ...prev, discount_type: event.target.value as CouponForm["discount_type"] }))} className={inputClass}>
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed amount (EGP)</option>
                  </select>
                </Field>
                <Field label={form.discount_type === "percentage" ? "Discount Percentage" : "Discount Amount (EGP)"}>
                  <input type="number" min="0.01" max={form.discount_type === "percentage" ? 100 : undefined} step="0.01" value={form.discount_value} onChange={(event) => setForm((prev) => ({ ...prev, discount_value: event.target.value }))} placeholder="10" required className={inputClass} />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Minimum Order Amount (EGP)">
                  <input type="number" min="0" step="0.01" value={form.min_order_amount} onChange={(event) => setForm((prev) => ({ ...prev, min_order_amount: event.target.value }))} className={inputClass} />
                </Field>
                <Field label="Usage Limit (optional)">
                  <input type="number" min="1" step="1" value={form.usage_limit} onChange={(event) => setForm((prev) => ({ ...prev, usage_limit: event.target.value }))} placeholder="Unlimited" className={inputClass} />
                </Field>
              </div>

              <Field label="Expiry Date (optional)">
                <input type="datetime-local" value={form.expires_at} onChange={(event) => setForm((prev) => ({ ...prev, expires_at: event.target.value }))} className={inputClass} />
              </Field>

              <label className="flex cursor-pointer items-center gap-3 text-sm text-gray-300">
                <input type="checkbox" checked={form.is_active} onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))} className="h-4 w-4 accent-[#d6ad60]" />
                Active coupon
              </label>

              {error && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-white/10 px-5 py-3 text-sm text-gray-300 transition hover:bg-white/5">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-xl bg-[#d6ad60] px-6 py-3 text-sm font-semibold text-black transition hover:bg-[#e5c27d] disabled:opacity-50">
                  {saving ? "Saving..." : editingCoupon ? "Save Changes" : "Create Coupon"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

const inputClass = "w-full rounded-xl border border-white/10 bg-[#080808] px-4 py-3 text-white outline-none transition focus:border-[#d6ad60]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm text-gray-400">{label}</label>
      {children}
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111111] p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">{title}</p>
        <span className="text-[#d6ad60]">{icon}</span>
      </div>
      <p className="mt-7 text-3xl font-semibold">{value.toLocaleString("en-EG")}</p>
    </div>
  );
}
