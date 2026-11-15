
"use client";

import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  Package,
  MapPin,
  Sparkles,
  XCircle,
  RefreshCw,
  FlaskConical,
  CreditCard,
  Upload,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type MixItem = {
  fragrance_name: string;
  grams: number | null;
  notes: string | null;
};

type MixRequest = {
  request_number: number;
  customer_name: string;
  bottle_size_ml: number;
  notes: string | null;
  status: string;
  quoted_price: number | null;
  admin_notes: string | null;
  shipping_city: string | null;
  shipping_address: string | null;
  payment_method: string | null;
  payment_status: string;
  payment_proof_url: string | null;
  transaction_reference: string | null;
  created_at: string;
  items: MixItem[];
};

type ApiResponse = {
  success: boolean;
  message?: string;
  request?: MixRequest;
};

const statusLabels: Record<string, { en: string; ar: string }> = {
  pending_review: { en: "Under Review", ar: "قيد المراجعة" },
  price_sent: { en: "Price Sent", ar: "تم تحديد السعر" },
  awaiting_address: { en: "Awaiting Address", ar: "في انتظار العنوان" },
  awaiting_payment: { en: "Awaiting Payment", ar: "في انتظار الدفع" },
  approved: { en: "Approved", ar: "تمت الموافقة" },
  paid: { en: "Paid", ar: "تم الدفع" },
  preparing: { en: "Preparing", ar: "جاري التجهيز" },
  completed: { en: "Completed", ar: "مكتمل" },
  rejected: { en: "Rejected", ar: "مرفوض" },
};

function CustomMixTrackingContent() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [request, setRequest] = useState<MixRequest | null>(null);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");

  const [paymentMethod, setPaymentMethod] = useState<
    "vodafone_cash" | "instapay"
  >("vodafone_cash");

  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [transactionReference, setTransactionReference] = useState("");

  const isArabic = language === "ar";
  const supabase = createClient();

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-[#100f0d] px-4 py-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#c5a36a]";

  const loadRequest = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "get_custom_mix_request_by_token",
        { p_tracking_token: token }
      );

      if (rpcError) throw new Error(rpcError.message);

      const result = data as ApiResponse;

      if (!result?.success || !result.request) {
        throw new Error(
          isArabic
            ? "رابط التتبع غير صحيح أو الطلب غير موجود."
            : "Invalid tracking link or request not found."
        );
      }

      setRequest(result.request);
      setCity(result.request.shipping_city || "");
      setAddress(result.request.shipping_address || "");

      if (
        result.request.payment_method === "vodafone_cash" ||
        result.request.payment_method === "instapay"
      ) {
        setPaymentMethod(result.request.payment_method);
      }
    } catch (err) {
      console.error("Tracking error:", err);
      setError(
        err instanceof Error
          ? err.message
          : isArabic
            ? "حدث خطأ أثناء تحميل الطلب."
            : "Could not load your request."
      );
    } finally {
      setLoading(false);
    }
  }, [token, isArabic]);

  useEffect(() => {
    loadRequest();
  }, [loadRequest]);

  async function respondToQuote(approve: boolean) {
    const confirmed = window.confirm(
      approve
        ? isArabic
          ? "هل أنت متأكد من قبول السعر؟"
          : "Are you sure you want to accept this quote?"
        : isArabic
          ? "هل أنت متأكد من رفض السعر؟"
          : "Are you sure you want to reject this quote?"
    );

    if (!confirmed) return;

    setActionLoading(true);
    setError("");

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "respond_custom_mix_quote",
        {
          p_tracking_token: token,
          p_approve: approve,
        }
      );

      if (rpcError) throw new Error(rpcError.message);

      const result = data as { success: boolean; message?: string };

      if (!result?.success) {
        throw new Error(result?.message || "Could not update your request.");
      }

      await loadRequest();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function submitAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (city.trim().length < 2 || address.trim().length < 5) {
      setError(
        isArabic
          ? "من فضلك أدخل المدينة والعنوان بالتفصيل."
          : "Please enter a valid city and full address."
      );
      return;
    }

    setActionLoading(true);

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "submit_custom_mix_address",
        {
          p_tracking_token: token,
          p_city: city.trim(),
          p_address: address.trim(),
        }
      );

      if (rpcError) throw new Error(rpcError.message);

      const result = data as { success: boolean; message?: string };

      if (!result?.success) {
        throw new Error(result?.message || "Could not save your address.");
      }

      await loadRequest();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function submitPaymentProof(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!paymentProof) {
      setError(
        isArabic
          ? "من فضلك اختر صورة إثبات التحويل."
          : "Please select your payment proof image."
      );
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(paymentProof.type)) {
      setError(
        isArabic
          ? "الصورة لازم تكون JPG أو PNG أو WebP."
          : "The image must be JPG, PNG, or WebP."
      );
      return;
    }

    if (paymentProof.size > 5 * 1024 * 1024) {
      setError(
        isArabic
          ? "حجم الصورة لازم يكون 5 ميجابايت أو أقل."
          : "The image must be 5 MB or smaller."
      );
      return;
    }

    setActionLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", paymentProof);

      const uploadResponse = await fetch("/api/payment-proof", {
        method: "POST",
        body: formData,
      });

      const uploadResult = await uploadResponse.json();

      if (
        !uploadResponse.ok ||
        !uploadResult?.success ||
        !uploadResult?.imageUrl
      ) {
        throw new Error(
          uploadResult?.error ||
            (isArabic
              ? "فشل رفع صورة إثبات الدفع."
              : "Could not upload payment proof.")
        );
      }

      const { data, error: rpcError } = await supabase.rpc(
        "submit_custom_mix_payment_proof",
        {
          p_tracking_token: token,
          p_payment_method: paymentMethod,
          p_payment_proof_url: uploadResult.imageUrl,
          p_transaction_reference: transactionReference.trim() || null,
        }
      );

      if (rpcError) throw new Error(rpcError.message);

      const result = data as { success: boolean; message?: string };

      if (!result?.success) {
        throw new Error(
          result?.message ||
            (isArabic
              ? "تعذر إرسال إثبات الدفع."
              : "Could not submit payment proof.")
        );
      }

      setPaymentProof(null);
      setTransactionReference("");
      await loadRequest();
    } catch (err) {
      console.error("Payment proof error:", err);
      setError(
        err instanceof Error
          ? err.message
          : isArabic
            ? "حدث خطأ أثناء إرسال إثبات الدفع."
            : "Something went wrong while submitting payment proof."
      );
    } finally {
      setActionLoading(false);
    }
  }

  const currentStatus = request
    ? statusLabels[request.status] || {
        en: request.status,
        ar: request.status,
      }
    : null;

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString(
      isArabic ? "ar-EG" : "en-US",
      { year: "numeric", month: "long", day: "numeric" }
    );
  }

  return (
    <main
      dir={isArabic ? "rtl" : "ltr"}
      className="min-h-screen bg-[#100f0d] text-white"
    >
      <header className="border-b border-white/10 bg-[#100f0d]">
        <nav className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex flex-col">
            <span className="font-serif text-2xl tracking-[0.12em] text-[#d3b477]">
              BAIT AL OUD
            </span>
            <span className="mt-1 text-[8px] tracking-[0.4em] text-white/40">
              THE ART OF FRAGRANCE
            </span>
          </Link>

          <button
            type="button"
            onClick={() =>
              setLanguage((current) => (current === "en" ? "ar" : "en"))
            }
            className="text-xs text-[#c5a36a] hover:text-white"
          >
            {isArabic ? "English" : "العربية"}
          </button>
        </nav>
      </header>

      <section className="border-b border-white/10 px-5 py-16 text-center">
        <Sparkles size={30} className="mx-auto mb-5 text-[#c5a36a]" />

        <p className="text-xs tracking-[0.4em] text-[#c5a36a]">
          BAIT AL OUD
        </p>

        <h1 className="mt-5 font-serif text-4xl md:text-5xl">
          {isArabic ? "متابعة طلبك" : "Track Your Request"}
        </h1>

        <p className="mt-4 text-sm text-white/45">
          {isArabic
            ? "تابع حالة تركيبتك واعرف آخر التحديثات."
            : "Follow your custom fragrance request and its latest updates."}
        </p>
      </section>

      <section className="mx-auto max-w-3xl space-y-6 px-5 py-12">
        {loading && (
          <div className="flex flex-col items-center py-20 text-[#c5a36a]">
            <Loader2 size={35} className="animate-spin" />
            <p className="mt-5 text-sm text-white/50">
              {isArabic ? "جاري تحميل الطلب..." : "Loading your request..."}
            </p>
          </div>
        )}

        {!loading && error && !request && (
          <div className="rounded-2xl border border-red-500/20 bg-[#181715] p-8 text-center">
            <XCircle size={45} className="mx-auto mb-5 text-red-400" />
            <h2 className="text-xl">
              {isArabic ? "تعذر العثور على الطلب" : "Request Not Found"}
            </h2>
            <p className="mt-3 text-sm text-white/50">{error}</p>
            <Link
              href="/custom-mix"
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#c5a36a] px-6 py-3 text-sm font-semibold text-black"
            >
              {isArabic ? "إنشاء تركيبة جديدة" : "Create New Mix"}
            </Link>
          </div>
        )}

        {!loading && request && (
          <>
            {/* REQUEST SUMMARY */}
            <section className="rounded-2xl border border-[#c5a36a]/25 bg-[#181715] p-6 md:p-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs tracking-widest text-white/40">
                    {isArabic ? "رقم الطلب" : "REQUEST NUMBER"}
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-wider text-[#c5a36a]">
                    #{request.request_number}
                  </h2>
                </div>

                <div className="rounded-xl border border-[#c5a36a]/30 bg-[#c5a36a]/10 px-4 py-3 text-sm text-[#c5a36a]">
                  <span className="flex items-center gap-2">
                    <Clock size={16} />
                    {isArabic ? currentStatus?.ar : currentStatus?.en}
                  </span>
                </div>
              </div>

              <div className="mt-7 grid grid-cols-2 gap-4 border-t border-white/10 pt-6">
                <div>
                  <p className="text-xs text-white/40">
                    {isArabic ? "اسم العميل" : "CUSTOMER"}
                  </p>
                  <p className="mt-2 text-sm">{request.customer_name}</p>
                </div>

                <div>
                  <p className="text-xs text-white/40">
                    {isArabic ? "حجم الزجاجة" : "BOTTLE SIZE"}
                  </p>
                  <p className="mt-2 text-sm">{request.bottle_size_ml} ml</p>
                </div>

                <div className="col-span-2">
                  <p className="text-xs text-white/40">
                    {isArabic ? "تاريخ الطلب" : "REQUEST DATE"}
                  </p>
                  <p className="mt-2 text-sm">
                    {formatDate(request.created_at)}
                  </p>
                </div>
              </div>
            </section>

            {/* FRAGRANCES */}
            <section className="rounded-2xl border border-white/10 bg-[#181715] p-6 md:p-8">
              <div className="mb-6 flex items-center gap-3">
                <FlaskConical className="text-[#c5a36a]" />
                <h2 className="font-serif text-2xl">
                  {isArabic ? "مكونات تركيبتك" : "Your Fragrance Mix"}
                </h2>
              </div>

              <div className="space-y-3">
                {request.items?.map((item, index) => (
                  <div
                    key={`${item.fragrance_name}-${index}`}
                    className="rounded-xl border border-white/10 bg-[#100f0d] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        {index + 1}. {item.fragrance_name}
                      </p>

                      {item.grams !== null && (
                        <span className="text-xs text-[#c5a36a]">
                          {item.grams} g
                        </span>
                      )}
                    </div>

                    {item.notes && (
                      <p className="mt-2 text-xs text-white/40">
                        {item.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {request.notes && (
                <div className="mt-5 border-t border-white/10 pt-5">
                  <p className="text-xs text-white/40">
                    {isArabic ? "ملاحظات إضافية" : "ADDITIONAL NOTES"}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-white/70">
                    {request.notes}
                  </p>
                </div>
              )}
            </section>

            {/* PRICE */}
            <section className="rounded-2xl border border-[#c5a36a]/25 bg-[#c5a36a]/5 p-6 md:p-8">
              <p className="text-xs tracking-widest text-[#c5a36a]">
                {isArabic ? "السعر النهائي" : "FINAL QUOTATION"}
              </p>

              {request.quoted_price !== null ? (
                <p className="mt-3 text-4xl font-semibold text-white">
                  {Number(request.quoted_price).toLocaleString(
                    isArabic ? "ar-EG" : "en-US"
                  )}
                  <span className="ms-2 text-base font-normal text-[#c5a36a]">
                    {isArabic ? "جنيه" : "EGP"}
                  </span>
                </p>
              ) : (
                <p className="mt-3 text-sm leading-7 text-white/50">
                  {isArabic
                    ? "الإدارة تراجع تركيبتك حاليًا وستحدد السعر النهائي قريبًا."
                    : "Our team is reviewing your mix and will determine the final price soon."}
                </p>
              )}

              {request.admin_notes && (
                <div className="mt-5 border-t border-[#c5a36a]/20 pt-4">
                  <p className="text-xs text-[#c5a36a]">
                    {isArabic ? "ملاحظة من الإدارة" : "MESSAGE FROM OUR TEAM"}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-white/70">
                    {request.admin_notes}
                  </p>
                </div>
              )}
            </section>

            {/* ACCEPT / REJECT QUOTE */}
            {request.status === "price_sent" && (
              <section className="rounded-2xl border border-white/10 bg-[#181715] p-6 md:p-8">
                <h2 className="font-serif text-2xl">
                  {isArabic
                    ? "هل توافق على السعر؟"
                    : "Do You Accept This Quote?"}
                </h2>

                <p className="mt-3 text-sm leading-7 text-white/45">
                  {isArabic
                    ? "راجع السعر النهائي، ثم اختر قبول أو رفض."
                    : "Please review the final quotation and choose whether to accept or reject it."}
                </p>

                <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => respondToQuote(true)}
                    className="flex items-center justify-center gap-2 rounded-xl bg-[#c5a36a] px-5 py-4 text-sm font-semibold text-black transition hover:bg-white disabled:opacity-50"
                  >
                    <CheckCircle2 size={18} />
                    {isArabic ? "قبول السعر" : "Accept Quote"}
                  </button>

                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => respondToQuote(false)}
                    className="flex items-center justify-center gap-2 rounded-xl border border-red-500/30 px-5 py-4 text-sm text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
                  >
                    <XCircle size={18} />
                    {isArabic ? "رفض السعر" : "Reject Quote"}
                  </button>
                </div>
              </section>
            )}

            {/* ADDRESS FORM */}
            {request.status === "awaiting_address" && (
              <section className="rounded-2xl border border-white/10 bg-[#181715] p-6 md:p-8">
                <div className="mb-6 flex items-center gap-3">
                  <MapPin className="text-[#c5a36a]" />
                  <h2 className="font-serif text-2xl">
                    {isArabic ? "عنوان التوصيل" : "Shipping Address"}
                  </h2>
                </div>

                <p className="mb-6 text-sm leading-7 text-white/45">
                  {isArabic
                    ? "تم قبول السعر. أدخل عنوانك حتى نتمكن من تجهيز طلبك."
                    : "Your quote has been accepted. Please enter your delivery address."}
                </p>

                <form onSubmit={submitAddress} className="space-y-5">
                  <div>
                    <label className="mb-2 block text-sm text-white/60">
                      {isArabic ? "المدينة / المحافظة" : "City / Governorate"}
                    </label>
                    <input
                      required
                      maxLength={100}
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder={isArabic ? "مثال: القاهرة" : "Example: Cairo"}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-white/60">
                      {isArabic ? "العنوان بالتفصيل" : "Full Address"}
                    </label>
                    <textarea
                      required
                      rows={4}
                      maxLength={500}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder={
                        isArabic
                          ? "الشارع، رقم العقار، الدور، وأي تفاصيل تساعد في الوصول..."
                          : "Street, building number, floor, and delivery details..."
                      }
                      className={`${inputClass} resize-none`}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#c5a36a] py-4 text-sm font-semibold text-black transition hover:bg-white disabled:opacity-50"
                  >
                    {actionLoading ? (
                      <Loader2 size={19} className="animate-spin" />
                    ) : (
                      <MapPin size={18} />
                    )}
                    {isArabic ? "حفظ عنوان التوصيل" : "Save Shipping Address"}
                  </button>
                </form>
              </section>
            )}

            {/* SAVED ADDRESS */}
            {request.shipping_address && (
              <section className="rounded-2xl border border-white/10 bg-[#181715] p-6">
                <div className="mb-4 flex items-center gap-3 text-[#c5a36a]">
                  <MapPin size={19} />
                  <h2 className="font-serif text-xl">
                    {isArabic ? "عنوان التوصيل" : "Shipping Address"}
                  </h2>
                </div>

                <p className="text-sm text-white/70">
                  {request.shipping_city}
                </p>
                <p className="mt-2 text-sm leading-7 text-white/50">
                  {request.shipping_address}
                </p>
              </section>
            )}

            {/* PAYMENT */}
            {request.status === "awaiting_payment" && (
              <section className="rounded-2xl border border-[#c5a36a]/25 bg-[#181715] p-6 md:p-8">
                <div className="mb-4 flex items-center gap-3 text-[#c5a36a]">
                  <CreditCard size={21} />
                  <h2 className="font-serif text-2xl">
                    {isArabic ? "إتمام الدفع" : "Complete Your Payment"}
                  </h2>
                </div>

                <p className="mb-6 text-sm leading-7 text-white/50">
                  {isArabic
                    ? "حوّل المبلغ باستخدام إحدى الطريقتين التاليتين، ثم ارفع صورة واضحة لإثبات التحويل."
                    : "Transfer the amount using one of the methods below, then upload a clear image of your payment receipt."}
                </p>

                <div className="mb-6 rounded-xl border border-[#c5a36a]/20 bg-[#100f0d] p-5">
                  <p className="mb-4 text-xs tracking-widest text-[#c5a36a]">
                    {isArabic ? "بيانات التحويل" : "TRANSFER DETAILS"}
                  </p>

                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-white/40">Vodafone Cash</p>
                      <p
                        dir="ltr"
                        className="mt-1 text-lg font-semibold tracking-wider text-white"
                      >
                        01092841181
                      </p>
                    </div>

                    <div className="border-t border-white/10 pt-4">
                      <p className="text-xs text-white/40">InstaPay</p>
                      <p
                        dir="ltr"
                        className="mt-1 break-all text-lg font-semibold text-white"
                      >
                        rafeek_1@instapay
                      </p>
                    </div>
                  </div>
                </div>

                {request.quoted_price !== null && (
                  <div className="mb-6 flex items-center justify-between rounded-xl bg-[#c5a36a]/10 p-4">
                    <span className="text-sm text-white/60">
                      {isArabic ? "المبلغ المطلوب" : "Amount to Pay"}
                    </span>
                    <strong className="text-xl text-[#d3b477]">
                      {Number(request.quoted_price).toLocaleString(
                        isArabic ? "ar-EG" : "en-US"
                      )}{" "}
                      {isArabic ? "جنيه" : "EGP"}
                    </strong>
                  </div>
                )}

                {request.payment_proof_url ? (
                  <div className="rounded-xl border border-[#c5a36a]/25 bg-[#100f0d] p-5">
                    <div className="flex items-center gap-3 text-[#d3b477]">
                      <Clock size={20} />
                      <p className="font-medium">
                        {isArabic
                          ? "تم استلام إثبات الدفع وفي انتظار المراجعة."
                          : "Payment proof received. Waiting for verification."}
                      </p>
                    </div>

                    <a
                      href={request.payment_proof_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-2 text-sm text-white/60 underline underline-offset-4 hover:text-[#d3b477]"
                    >
                      {isArabic ? "عرض صورة التحويل" : "View payment receipt"}
                    </a>
                  </div>
                ) : (
                  <form onSubmit={submitPaymentProof} className="space-y-5">
                    <div>
                      <label className="mb-3 block text-sm text-white/60">
                        {isArabic ? "اختر طريقة الدفع" : "Choose Payment Method"}
                      </label>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("vodafone_cash")}
                          className={`rounded-xl border p-4 text-sm transition ${
                            paymentMethod === "vodafone_cash"
                              ? "border-[#c5a36a] bg-[#c5a36a]/10 text-[#d3b477]"
                              : "border-white/10 bg-[#100f0d] text-white/60 hover:border-white/25"
                          }`}
                        >
                          Vodafone Cash
                        </button>

                        <button
                          type="button"
                          onClick={() => setPaymentMethod("instapay")}
                          className={`rounded-xl border p-4 text-sm transition ${
                            paymentMethod === "instapay"
                              ? "border-[#c5a36a] bg-[#c5a36a]/10 text-[#d3b477]"
                              : "border-white/10 bg-[#100f0d] text-white/60 hover:border-white/25"
                          }`}
                        >
                          InstaPay
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm text-white/60">
                        {isArabic
                          ? "صورة إثبات التحويل"
                          : "Payment Receipt Image"}
                      </label>

                      <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-[#100f0d] px-5 py-8 text-center transition hover:border-[#c5a36a]">
                        <Upload size={25} className="mb-3 text-[#c5a36a]" />

                        <span className="text-sm text-white/75">
                          {paymentProof
                            ? paymentProof.name
                            : isArabic
                              ? "اضغط لاختيار صورة التحويل"
                              : "Click to choose your receipt image"}
                        </span>

                        <span className="mt-2 text-xs text-white/35">
                          JPG, PNG, WebP —{" "}
                          {isArabic
                            ? "بحد أقصى 5 ميجابايت"
                            : "up to 5 MB"}
                        </span>

                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(event) =>
                            setPaymentProof(event.target.files?.[0] || null)
                          }
                        />
                      </label>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm text-white/60">
                        {isArabic
                          ? "رقم العملية (اختياري)"
                          : "Transaction Reference (Optional)"}
                      </label>

                      <input
                        type="text"
                        maxLength={120}
                        value={transactionReference}
                        onChange={(event) =>
                          setTransactionReference(event.target.value)
                        }
                        placeholder={
                          isArabic
                            ? "أدخل رقم العملية إن وجد"
                            : "Enter transaction ID if available"
                        }
                        className={inputClass}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={actionLoading || !paymentProof}
                      className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#c5a36a] py-4 text-sm font-semibold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {actionLoading ? (
                        <Loader2 size={19} className="animate-spin" />
                      ) : (
                        <Upload size={18} />
                      )}

                      {isArabic
                        ? "إرسال إثبات الدفع"
                        : "Submit Payment Proof"}
                    </button>

                    <p className="text-center text-xs leading-6 text-white/35">
                      {isArabic
                        ? "سيتم مراجعة التحويل من الإدارة قبل تأكيد الدفع."
                        : "Your transfer will be reviewed by our team before payment is confirmed."}
                    </p>
                  </form>
                )}
              </section>
            )}

            {/* OTHER STATUS MESSAGES */}
            {request.status === "pending_review" && (
              <div className="rounded-2xl border border-white/10 bg-[#181715] p-6 text-center">
                <Clock className="mx-auto mb-4 text-[#c5a36a]" size={30} />
                <p className="text-sm leading-7 text-white/50">
                  {isArabic
                    ? "طلبك وصل بنجاح. فريقنا بيراجع التركيبة وهيحدد السعر النهائي."
                    : "Your request has been received. Our team is reviewing your mix and will send the final quotation."}
                </p>
              </div>
            )}

            {request.status === "rejected" && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
                <XCircle className="mx-auto mb-4 text-red-400" size={30} />
                <p className="text-sm text-white/70">
                  {isArabic
                    ? "تم رفض عرض السعر لهذا الطلب."
                    : "The quotation for this request has been rejected."}
                </p>
              </div>
            )}

            {request.status === "paid" && (
              <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-6 text-center">
                <CheckCircle2
                  className="mx-auto mb-4 text-green-400"
                  size={30}
                />
                <p className="text-sm text-white/70">
                  {isArabic ? "تم تأكيد الدفع." : "Your payment has been confirmed."}
                </p>
              </div>
            )}

            {request.status === "preparing" && (
              <div className="rounded-2xl border border-[#c5a36a]/20 bg-[#c5a36a]/5 p-6 text-center">
                <Package className="mx-auto mb-4 text-[#c5a36a]" size={30} />
                <p className="text-sm text-white/70">
                  {isArabic
                    ? "تركيبتك قيد التجهيز."
                    : "Your fragrance is being prepared."}
                </p>
              </div>
            )}

            {request.status === "completed" && (
              <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-6 text-center">
                <CheckCircle2
                  className="mx-auto mb-4 text-green-400"
                  size={30}
                />
                <p className="text-sm text-white/70">
                  {isArabic
                    ? "اكتمل طلبك. شكرًا لثقتك في بيت العود."
                    : "Your order is complete. Thank you for choosing Bait Al Oud."}
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={loadRequest}
              disabled={loading || actionLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-4 text-sm text-white/50 transition hover:border-[#c5a36a] hover:text-[#c5a36a] disabled:opacity-50"
            >
              <RefreshCw size={16} />
              {isArabic ? "تحديث حالة الطلب" : "Refresh Request Status"}
            </button>
          </>
        )}

        <div className="pt-4 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs text-white/35 transition hover:text-[#c5a36a]"
          >
            {isArabic ? <ArrowRight size={15} /> : <ArrowLeft size={15} />}
            {isArabic ? "العودة للرئيسية" : "Back to Home"}
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/10 px-5 py-10 text-center">
        <p className="font-serif text-lg tracking-[0.15em] text-[#c5a36a]">
          BAIT AL OUD
        </p>
        <p className="mt-2 text-[9px] tracking-[0.3em] text-white/30">
          THE ART OF FRAGRANCE
        </p>
      </footer>
    </main>
  );
}

export default function CustomMixTrackingPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#100f0d] text-[#c5a36a]">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#c5a36a] border-t-transparent" />
            <p className="mt-4 text-sm text-white/50">
              Loading your request...
            </p>
          </div>
        </main>
      }
    >
      <CustomMixTrackingContent />
    </Suspense>
  );
}
