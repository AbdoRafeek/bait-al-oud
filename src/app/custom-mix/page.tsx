
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  Sparkles,
  FlaskConical,
  X,
  Copy,
  ExternalLink,
  Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type MixItem = {
  id: number;
  fragrance_name: string;
  grams: string;
  notes: string;
};

type CreatedRequest = {
  request_number: string;
  tracking_token: string;
};

export default function CustomMixPage() {
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [bottleSize, setBottleSize] = useState(50);
  const [generalNotes, setGeneralNotes] = useState("");

  const [items, setItems] = useState<MixItem[]>([
    { id: 1, fragrance_name: "", grams: "", notes: "" },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successRequest, setSuccessRequest] =
    useState<CreatedRequest | null>(null);
  const [copied, setCopied] = useState(false);

  const isArabic = language === "ar";

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-[#100f0d] px-4 py-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#c5a36a]";

  const labels = {
    eyebrow: isArabic ? "اصنع عطرك الخاص" : "CREATE YOUR SIGNATURE SCENT",
    title: isArabic ? "تركيبتك الخاصة" : "Your Custom Mix",
    subtitle: isArabic
      ? "امزج العطور التي تحبها واصنع تركيبتك الفريدة."
      : "Combine the fragrances you love and create something unique.",
    customer: isArabic ? "بيانات العميل" : "Customer Information",
    name: isArabic ? "الاسم بالكامل" : "Full Name",
    phone: isArabic ? "رقم الهاتف" : "Phone Number",
    fragrances: isArabic ? "العطور المختارة" : "Your Fragrances",
    fragranceName: isArabic ? "اسم العطر" : "Fragrance Name",
    grams: isArabic ? "الكمية بالجرام (اختياري)" : "Quantity in grams (optional)",
    itemNotes: isArabic ? "ملاحظات للعطر (اختياري)" : "Fragrance notes (optional)",
    add: isArabic ? "إضافة عطر آخر" : "Add Another Fragrance",
    bottle: isArabic ? "حجم الزجاجة" : "Bottle Size",
    notes: isArabic ? "ملاحظات إضافية" : "Additional Notes",
    notesPlaceholder: isArabic
      ? "اكتب أي تفاصيل أو تفضيلات خاصة بالتركيبة..."
      : "Tell us about your preferences or special requests...",
    submit: isArabic ? "إرسال طلب التركيب" : "Submit Mix Request",
    submitting: isArabic ? "جاري إرسال الطلب..." : "Submitting Request...",
    remove: isArabic ? "حذف العطر" : "Remove fragrance",
  };

  function addFragrance() {
    setItems((current) => [
      ...current,
      {
        id: Date.now() + Math.random(),
        fragrance_name: "",
        grams: "",
        notes: "",
      },
    ]);
  }

  function removeFragrance(id: number) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  function updateItem(
    id: number,
    field: keyof Omit<MixItem, "id">,
    value: string
  ) {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  }

  function getTrackingUrl() {
    if (!successRequest) return "";

    return `${window.location.origin}/custom-mix/track/${successRequest.tracking_token}`;
  }

  async function copyTrackingLink() {
    try {
      await navigator.clipboard.writeText(getTrackingUrl());
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2500);
    } catch {
      setError(
        isArabic
          ? "تعذر نسخ الرابط. يمكنك نسخه يدويًا."
          : "Could not copy the link. Please copy it manually."
      );
    }
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!customerName.trim() || !customerPhone.trim()) {
      setError(
        isArabic
          ? "من فضلك اكتب اسمك ورقم هاتفك."
          : "Please enter your name and phone number."
      );
      return;
    }

    if (
      items.length === 0 ||
      items.some((item) => !item.fragrance_name.trim())
    ) {
      setError(
        isArabic
          ? "من فضلك اكتب اسم كل العطور المضافة."
          : "Please enter the name of every fragrance."
      );
      return;
    }

    const invalidGrams = items.some(
      (item) =>
        item.grams.trim() !== "" &&
        (!Number.isFinite(Number(item.grams)) || Number(item.grams) <= 0)
    );

    if (invalidGrams) {
      setError(
        isArabic
          ? "الجرامات يجب أن تكون أرقامًا أكبر من صفر."
          : "Gram quantities must be numbers greater than zero."
      );
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { data, error: requestError } = await supabase.rpc(
        "create_custom_mix_request",
        {
          p_customer_name: customerName.trim(),
          p_customer_phone: customerPhone.trim(),
          p_bottle_size_ml: bottleSize,
          p_notes: generalNotes.trim() || null,
          p_items: items.map((item) => ({
            fragrance_name: item.fragrance_name.trim(),
            grams: item.grams.trim() || null,
            notes: item.notes.trim() || null,
          })),
        }
      );

      if (requestError) {
        throw new Error(requestError.message);
      }

      const result = Array.isArray(data) ? data[0] : data;

      if (
        !result?.success ||
        !result?.request_number ||
        !result?.tracking_token
      ) {
        throw new Error(
          isArabic
            ? "لم نتمكن من تأكيد إنشاء الطلب."
            : "The request could not be confirmed."
        );
      }

      setSuccessRequest({
        request_number: String(result.request_number),
        tracking_token: String(result.tracking_token),
      });
    } catch (err) {
      console.error("Custom mix request error:", err);

      setError(
        err instanceof Error
          ? err.message
          : isArabic
            ? "حدث خطأ أثناء إرسال الطلب. حاول مرة أخرى."
            : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  // SUCCESS SCREEN
  if (successRequest) {
    const trackingPath =
      `/custom-mix/track/${successRequest.tracking_token}`;

    return (
      <main
        dir={isArabic ? "rtl" : "ltr"}
        className="flex min-h-screen items-center justify-center bg-[#100f0d] px-5 py-12 text-white"
      >
        <div className="w-full max-w-xl rounded-3xl border border-[#c5a36a]/30 bg-[#181715] p-8 text-center md:p-12">
          <CheckCircle2
            size={65}
            className="mx-auto mb-6 text-[#c5a36a]"
          />

          <p className="text-xs tracking-[0.35em] text-[#c5a36a]">
            BAIT AL OUD
          </p>

          <h1 className="mt-5 font-serif text-3xl md:text-4xl">
            {isArabic ? "تم إرسال طلبك بنجاح" : "Request Submitted"}
          </h1>

          <p className="mt-5 text-sm leading-8 text-white/50">
            {isArabic
              ? "شكرًا لثقتك بنا. ستقوم الإدارة بمراجعة تركيبتك وتحديد السعر النهائي."
              : "Thank you for choosing us. Our team will review your fragrance mix and determine the final price."}
          </p>

          {/* Request Number */}
          <div className="my-6 rounded-2xl border border-white/10 bg-[#100f0d] p-6">
            <p className="text-xs text-white/40">
              {isArabic ? "رقم طلبك" : "YOUR REQUEST NUMBER"}
            </p>

            <p className="mt-3 text-3xl font-semibold tracking-wider text-[#c5a36a]">
              {successRequest.request_number}
            </p>
          </div>

          {/* Tracking Link */}
          <div className="rounded-2xl border border-[#c5a36a]/20 bg-[#c5a36a]/5 p-5">
            <div className="mb-3 flex items-center justify-center gap-2 text-[#c5a36a]">
              <ExternalLink size={18} />

              <p className="text-sm font-medium">
                {isArabic ? "رابط متابعة طلبك" : "YOUR TRACKING LINK"}
              </p>
            </div>

            <p
              dir="ltr"
              className="mb-4 break-all rounded-lg bg-[#100f0d] p-3 text-xs text-white/60"
            >
              {typeof window !== "undefined" ? getTrackingUrl() : ""}
            </p>

            <button
              type="button"
              onClick={copyTrackingLink}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#c5a36a]/40 px-5 py-3 text-sm text-[#c5a36a] transition hover:bg-[#c5a36a]/10"
            >
              {copied ? <Check size={17} /> : <Copy size={17} />}

              {copied
                ? isArabic
                  ? "تم نسخ الرابط"
                  : "Link Copied"
                : isArabic
                  ? "نسخ رابط المتابعة"
                  : "Copy Tracking Link"}
            </button>
          </div>

          <p className="my-6 text-xs leading-7 text-white/40">
            {isArabic
              ? "احتفظ برقم الطلب ورابط المتابعة. يمكنك استخدام الرابط لمعرفة السعر وحالة طلبك عندما تصبح صفحة المتابعة جاهزة."
              : "Keep your request number and tracking link. You will use this private link to check your quote and request status."}
          </p>

          <Link
            href={trackingPath}
            className="mb-3 inline-flex w-full items-center justify-center gap-3 rounded-xl bg-[#c5a36a] px-8 py-4 text-sm font-semibold text-black transition hover:bg-white"
          >
            {isArabic ? "متابعة الطلب" : "Track My Request"}
            {isArabic ? <ArrowLeft size={17} /> : <ArrowRight size={17} />}
          </Link>

          <Link
            href="/"
            className="inline-flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 px-8 py-4 text-sm text-white/60 transition hover:border-[#c5a36a] hover:text-white"
          >
            {isArabic ? "العودة للرئيسية" : "Back to Home"}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      dir={isArabic ? "rtl" : "ltr"}
      className="min-h-screen overflow-hidden bg-[#100f0d] text-white"
    >
      {/* NAVBAR */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#100f0d]/95 backdrop-blur-xl">
        <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex flex-col">
            <span className="font-serif text-2xl tracking-[0.12em] text-[#d3b477]">
              BAIT AL OUD
            </span>
            <span className="mt-1 text-[8px] tracking-[0.4em] text-white/40">
              THE ART OF FRAGRANCE
            </span>
          </Link>

          <div className="hidden items-center gap-8 text-sm text-white/60 md:flex">
            <Link href="/" className="transition hover:text-[#c5a36a]">
              {isArabic ? "الرئيسية" : "Home"}
            </Link>

            <Link href="/products" className="transition hover:text-[#c5a36a]">
              {isArabic ? "العطور" : "Collection"}
            </Link>

            <Link href="/custom-mix" className="text-[#c5a36a]">
              {isArabic ? "ركّب عطرك" : "Custom Mix"}
            </Link>
          </div>

          <button
            type="button"
            onClick={() =>
              setLanguage((current) => (current === "en" ? "ar" : "en"))
            }
            className="text-xs text-[#c5a36a] transition hover:text-white"
          >
            {isArabic ? "English" : "العربية"}
          </button>
        </nav>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-white/10 px-6 py-24 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(197,163,106,0.16),transparent_65%)]" />

        <div className="relative mx-auto max-w-3xl">
          <Sparkles
            size={32}
            className="mx-auto mb-7 text-[#c5a36a]"
          />

          <p className="text-xs tracking-[0.5em] text-[#c5a36a]">
            {labels.eyebrow}
          </p>

          <h1 className="mt-6 font-serif text-5xl text-white md:text-7xl">
            {isArabic ? (
              <>
                اصنع <span className="text-[#c5a36a]">عطرك الخاص</span>
              </>
            ) : (
              <>
                Create Your <span className="text-[#c5a36a]">Signature</span>
              </>
            )}
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-sm leading-8 text-white/50">
            {labels.subtitle}
          </p>
        </div>
      </section>

      {/* FORM */}
      <section className="mx-auto max-w-4xl px-5 py-16 md:px-6">
        <form onSubmit={submitRequest} className="space-y-8">
          {/* CUSTOMER INFORMATION */}
          <section className="rounded-2xl border border-white/10 bg-[#181715] p-6 md:p-8">
            <div className="mb-7 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#c5a36a]/10 text-[#c5a36a]">
                01
              </div>

              <h2 className="font-serif text-2xl">
                {labels.customer}
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-white/60">
                  {labels.name} *
                </label>

                <input
                  required
                  maxLength={120}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={isArabic ? "اسمك بالكامل" : "Your full name"}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-white/60">
                  {labels.phone} *
                </label>

                <input
                  required
                  type="tel"
                  maxLength={30}
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className={inputClass}
                />
              </div>
            </div>

            <p className="mt-4 text-xs leading-6 text-white/35">
              {isArabic
                ? "هنستخدم رقم هاتفك للتواصل معك بعد مراجعة التركيبة. مش محتاج تكتب عنوانك دلوقتي."
                : "We will use your phone number to contact you after reviewing your mix. You do not need to provide your address now."}
            </p>
          </section>

          {/* FRAGRANCES */}
          <section className="rounded-2xl border border-white/10 bg-[#181715] p-6 md:p-8">
            <div className="mb-7 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#c5a36a]/10 text-[#c5a36a]">
                02
              </div>

              <div>
                <h2 className="font-serif text-2xl">
                  {labels.fragrances}
                </h2>

                <p className="mt-1 text-xs text-white/40">
                  {isArabic
                    ? "اكتب أسماء العطور التي تريد دمجها."
                    : "Enter the fragrances you want to combine."}
                </p>
              </div>
            </div>

            <div className="space-y-5">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-white/10 bg-[#100f0d] p-5"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <p className="text-xs tracking-widest text-[#c5a36a]">
                      {isArabic
                        ? `العطر ${index + 1}`
                        : `FRAGRANCE ${index + 1}`}
                    </p>

                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeFragrance(item.id)}
                        title={labels.remove}
                        className="flex items-center gap-2 text-xs text-red-400 transition hover:text-red-300"
                      >
                        <Trash2 size={15} />
                        {isArabic ? "حذف" : "Remove"}
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 block text-sm text-white/60">
                        {labels.fragranceName} *
                      </label>

                      <input
                        required
                        maxLength={150}
                        value={item.fragrance_name}
                        onChange={(e) =>
                          updateItem(item.id, "fragrance_name", e.target.value)
                        }
                        placeholder={
                          isArabic
                            ? "مثال: Dior Sauvage"
                            : "Example: Dior Sauvage"
                        }
                        className={inputClass}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm text-white/60">
                          {labels.grams}
                        </label>

                        <input
                          type="number"
                          min="0.01"
                          max="10000"
                          step="0.01"
                          value={item.grams}
                          onChange={(e) =>
                            updateItem(item.id, "grams", e.target.value)
                          }
                          placeholder={isArabic ? "مثال: 10" : "Example: 10"}
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm text-white/60">
                          {labels.itemNotes}
                        </label>

                        <input
                          maxLength={300}
                          value={item.notes}
                          onChange={(e) =>
                            updateItem(item.id, "notes", e.target.value)
                          }
                          placeholder={isArabic ? "ملاحظاتك..." : "Your notes..."}
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addFragrance}
              className="mt-5 flex w-full items-center justify-center gap-3 rounded-xl border border-dashed border-[#c5a36a]/40 bg-[#c5a36a]/5 py-4 text-sm text-[#c5a36a] transition hover:border-[#c5a36a] hover:bg-[#c5a36a]/10"
            >
              <Plus size={18} />
              {labels.add}
            </button>
          </section>

          {/* BOTTLE SIZE */}
          <section className="rounded-2xl border border-white/10 bg-[#181715] p-6 md:p-8">
            <div className="mb-7 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#c5a36a]/10 text-[#c5a36a]">
                03
              </div>

              <h2 className="font-serif text-2xl">
                {labels.bottle}
              </h2>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[30, 50, 100].map((size) => (
                <button
                  type="button"
                  key={size}
                  onClick={() => setBottleSize(size)}
                  className={`rounded-xl border p-5 text-center transition ${
                    bottleSize === size
                      ? "border-[#c5a36a] bg-[#c5a36a]/10 text-[#c5a36a]"
                      : "border-white/10 bg-[#100f0d] text-white/50 hover:border-[#c5a36a]/50"
                  }`}
                >
                  <FlaskConical
                    size={23}
                    className="mx-auto mb-3"
                  />

                  <span className="text-xl font-semibold">{size}</span>
                  <span className="ms-1 text-xs">ml</span>
                </button>
              ))}
            </div>
          </section>

          {/* GENERAL NOTES */}
          <section className="rounded-2xl border border-white/10 bg-[#181715] p-6 md:p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#c5a36a]/10 text-[#c5a36a]">
                04
              </div>

              <h2 className="font-serif text-2xl">
                {labels.notes}
              </h2>
            </div>

            <textarea
              rows={4}
              maxLength={1000}
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              placeholder={labels.notesPlaceholder}
              className={`${inputClass} resize-none`}
            />
          </section>

          {/* PRICE NOTICE */}
          <div className="rounded-xl border border-[#c5a36a]/20 bg-[#c5a36a]/5 p-5">
            <p className="text-sm font-medium text-[#c5a36a]">
              {isArabic ? "كيف يتم تحديد السعر؟" : "How is the price determined?"}
            </p>

            <p className="mt-2 text-xs leading-7 text-white/45">
              {isArabic
                ? "بعد إرسال الطلب، ستقوم الإدارة بمراجعة أسماء العطور والكميات وحجم الزجاجة، ثم تحديد السعر النهائي والتواصل معك. لن تحتاج إلى الدفع الآن."
                : "After submitting your request, our team will review the fragrances, quantities, and bottle size, then determine the final price and contact you. No payment is required now."}
            </p>
          </div>

          {/* ERROR */}
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
              <X size={18} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {/* SUBMIT */}
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#c5a36a] py-5 text-sm font-semibold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 size={19} className="animate-spin" />
                {labels.submitting}
              </>
            ) : (
              <>
                <Sparkles size={18} />
                {labels.submit}
                {isArabic ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
              </>
            )}
          </button>

          <p className="text-center text-xs text-white/30">
            {isArabic
              ? "إرسال الطلب لا يعني تأكيد الشراء أو الدفع."
              : "Submitting this request does not confirm a purchase or payment."}
          </p>
        </form>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 px-6 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row">
          <div className="text-center md:text-left">
            <Link
              href="/"
              className="font-serif text-xl tracking-[0.15em] text-[#c5a36a]"
            >
              BAIT AL OUD
            </Link>

            <p className="mt-2 text-[10px] tracking-[0.3em] text-white/35">
              THE ART OF FRAGRANCE
            </p>
          </div>

          <p className="text-xs text-white/35">
            © 2026 Bait Al Oud. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
