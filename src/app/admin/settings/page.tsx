"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Store,
  CreditCard,
  Truck,
  Settings2,
  LogOut,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type StoreSettings = {
  id: number;
  store_name: string;
  store_email: string | null;
  store_phone: string | null;
  vodafone_cash_number: string | null;
  instapay_account: string | null;
  shipping_fee: number;
  free_shipping_minimum: number | null;
  currency: string;
  is_store_open: boolean;
};

const initialSettings: StoreSettings = {
  id: 1,
  store_name: "Bait Al Oud",
  store_email: "",
  store_phone: "",
  vodafone_cash_number: "01092841181",
  instapay_account: "rafeek_1@instapay",
  shipping_fee: 0,
  free_shipping_minimum: null,
  currency: "EGP",
  is_store_open: true,
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  hint,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm text-white/65 mb-2">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/10 bg-[#11100F] px-4 py-3 text-white outline-none transition placeholder:text-white/25 focus:border-[#C6A568]"
      />
      {hint && <span className="mt-2 block text-xs text-white/35">{hint}</span>}
    </label>
  );
}

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#1B1917] p-5 md:p-7">
      <div className="mb-6 flex items-start gap-3">
        <div className="rounded-xl border border-[#C6A568]/20 bg-[#C6A568]/10 p-3 text-[#C6A568]">
          {icon}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm text-white/40">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<StoreSettings>(initialSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      setLoading(true);
      setError("");

      const { data, error: loadError } = await supabase
        .from("store_settings")
        .select("*")
        .eq("id", 1)
        .single();

      if (!active) return;

      if (loadError) {
        setError(loadError.message);
      } else if (data) {
        setSettings({
          ...initialSettings,
          ...data,
          shipping_fee: Number(data.shipping_fee ?? 0),
          free_shipping_minimum:
            data.free_shipping_minimum === null
              ? null
              : Number(data.free_shipping_minimum),
        });
      }

      setLoading(false);
    }

    loadSettings();
    return () => {
      active = false;
    };
  }, []);

  function update<K extends keyof StoreSettings>(
    key: K,
    value: StoreSettings[K]
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const payload = {
      store_name: settings.store_name.trim(),
      store_email: settings.store_email?.trim() || null,
      store_phone: settings.store_phone?.trim() || null,
      vodafone_cash_number: settings.vodafone_cash_number?.trim() || null,
      instapay_account: settings.instapay_account?.trim() || null,
      shipping_fee: Number(settings.shipping_fee),
      free_shipping_minimum:
        settings.free_shipping_minimum === null ||
        String(settings.free_shipping_minimum).trim() === ""
          ? null
          : Number(settings.free_shipping_minimum),
      currency: settings.currency,
      is_store_open: settings.is_store_open,
      updated_at: new Date().toISOString(),
    };

    if (!payload.store_name) {
      setError("Store name is required.");
      setSaving(false);
      return;
    }

    if (
      !Number.isFinite(payload.shipping_fee) ||
      payload.shipping_fee < 0 ||
      (payload.free_shipping_minimum !== null &&
        (!Number.isFinite(payload.free_shipping_minimum) ||
          payload.free_shipping_minimum < 0))
    ) {
      setError("Shipping amounts must be valid non-negative numbers.");
      setSaving(false);
      return;
    }

    const { error: saveError } = await supabase
      .from("store_settings")
      .upsert({ id: 1, ...payload }, { onConflict: "id" });

    if (saveError) {
      setError(saveError.message);
    } else {
      setMessage("Store settings saved successfully.");
    }

    setSaving(false);
  }

  async function handleSignOut() {
    setSigningOut(true);
    setError("");
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      setError(signOutError.message);
      setSigningOut(false);
      return;
    }

    router.replace("/admin/login");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-[#C6A568]">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#11100F] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-xs tracking-[0.3em] text-[#C6A568]">
              BAIT AL OUD / ADMIN
            </p>
            <h1 className="text-3xl font-serif md:text-4xl">Store Settings</h1>
            <p className="mt-2 text-sm text-white/40">
              Manage your store information, payments and shipping preferences.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300 transition hover:bg-red-500/15 disabled:opacity-50"
          >
            {signingOut ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <LogOut size={17} />
            )}
            Sign Out
          </button>
        </div>

        {message && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-300">
            <CheckCircle2 size={18} /> {message}
          </div>
        )}
        {error && (
          <div className="mb-6 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={saveSettings} className="space-y-6">
          <Section
            icon={<Store size={20} />}
            title="Store Information"
            description="The main contact details and public identity of your store."
          >
            <div className="grid gap-5 md:grid-cols-2">
              <Field
                label="Store Name"
                value={settings.store_name}
                onChange={(v) => update("store_name", v)}
                placeholder="Bait Al Oud"
              />
              <Field
                label="Store Email"
                value={settings.store_email || ""}
                onChange={(v) => update("store_email", v)}
                placeholder="hello@example.com"
                type="email"
              />
              <Field
                label="Store Phone"
                value={settings.store_phone || ""}
                onChange={(v) => update("store_phone", v)}
                placeholder="01xxxxxxxxx"
                type="tel"
              />
              <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#11100F] p-4">
                <span>
                  <span className="block text-sm font-medium">Store Status</span>
                  <span className="mt-1 block text-xs text-white/40">
                    {settings.is_store_open
                      ? "Store is marked as open"
                      : "Store is marked as closed"}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.is_store_open}
                  onChange={(e) => update("is_store_open", e.target.checked)}
                  className="h-5 w-5 accent-[#C6A568]"
                />
              </label>
            </div>
          </Section>

          <Section
            icon={<CreditCard size={20} />}
            title="Payment Methods"
            description="Payment details customers should use when transferring money."
          >
            <div className="grid gap-5 md:grid-cols-2">
              <Field
                label="Vodafone Cash Number"
                value={settings.vodafone_cash_number || ""}
                onChange={(v) => update("vodafone_cash_number", v)}
                placeholder="010xxxxxxxx"
                type="tel"
              />
              <Field
                label="InstaPay Account"
                value={settings.instapay_account || ""}
                onChange={(v) => update("instapay_account", v)}
                placeholder="name@instapay"
              />
            </div>
          </Section>

          <Section
            icon={<Truck size={20} />}
            title="Shipping"
            description="Set the shipping fee and the order value eligible for free shipping."
          >
            <div className="grid gap-5 md:grid-cols-2">
              <Field
                label="Shipping Fee"
                value={settings.shipping_fee}
                onChange={(v) =>
                  update("shipping_fee", v === "" ? 0 : Number(v))
                }
                placeholder="0"
                type="number"
                hint="Enter 0 if shipping is currently free."
              />
              <Field
                label="Free Shipping Minimum"
                value={settings.free_shipping_minimum ?? ""}
                onChange={(v) =>
                  update(
                    "free_shipping_minimum",
                    v === "" ? null : Number(v)
                  )
                }
                placeholder="Leave empty to disable"
                type="number"
                hint="This value is saved as a setting; checkout must be connected separately to apply it."
              />
            </div>
          </Section>

          <Section
            icon={<Settings2 size={20} />}
            title="General"
            description="Choose the currency used to display store amounts."
          >
            <div className="max-w-sm">
              <label className="block">
                <span className="mb-2 block text-sm text-white/65">Currency</span>
                <select
                  value={settings.currency}
                  onChange={(e) => update("currency", e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#11100F] px-4 py-3 text-white outline-none focus:border-[#C6A568]"
                >
                  <option value="EGP">EGP — Egyptian Pound</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="SAR">SAR — Saudi Riyal</option>
                  <option value="AED">AED — UAE Dirham</option>
                </select>
              </label>
            </div>
          </Section>

          <div className="flex flex-col-reverse justify-between gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm text-white/65 transition hover:border-white/25 hover:text-white"
            >
              <RefreshCw size={16} /> Reload Settings
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#C6A568] px-7 py-3 font-semibold text-black transition hover:bg-[#D8B97E] disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Save size={18} />
              )}
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
