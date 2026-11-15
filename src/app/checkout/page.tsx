
"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Loader2,
  ShoppingBag,
  Upload,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type CartItem = {
  productId: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  size: number;
  price: number;
  quantity: number;
};

type PaymentMethod = "vodafone_cash" | "instapay";

const CART_KEY = "bait-al-oud-cart";

const paymentDetails = {
  vodafone_cash: {
    name: "Vodafone Cash",
    account: "01092841181",
  },
  instapay: {
    name: "InstaPay",
    account: "rafeek_1@instapay",
  },
};

export default function CheckoutPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [pageReady, setPageReady] = useState(false);
  const [loading, setLoading] = useState(false);

  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    city: "",
    address: "",
    notes: "",
  });

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("vodafone_cash");

  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState("");
  const [transactionReference, setTransactionReference] = useState("");

  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponMessage, setCouponMessage] = useState("");

  const [error, setError] = useState("");
  const [successOrder, setSuccessOrder] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          setCart(parsed);
        }
      }
    } catch {
      setCart([]);
    }

    setPageReady(true);
  }, []);

  const subtotal = useMemo(() => {
    return cart.reduce(
      (sum, item) =>
        sum + Number(item.price) * Number(item.quantity),
      0
    );
  }, [cart]);

  const shipping = 0;
  const discount = appliedCoupon ? Math.min(appliedCoupon.discount, subtotal) : 0;
  const total = Math.max(0, subtotal + shipping - discount);

  async function applyCoupon() {
    const code = couponCode.trim();
    if (!code) {
      setCouponMessage("Please enter a coupon code.");
      setAppliedCoupon(null);
      return;
    }
    if (subtotal <= 0) {
      setCouponMessage("Your cart subtotal is invalid.");
      setAppliedCoupon(null);
      return;
    }

    setCouponLoading(true);
    setCouponMessage("");
    setError("");
    try {
      const supabase = createClient();
      const { data, error: couponError } = await supabase.rpc("validate_store_coupon", {
        p_code: code,
        p_subtotal: subtotal,
      });
      if (couponError) throw new Error(couponError.message);

      const result = Array.isArray(data) ? data[0] : data;
      if (!result?.valid) {
        setAppliedCoupon(null);
        setCouponMessage(result?.message || "This coupon is not valid.");
        return;
      }

      setAppliedCoupon({
        code: String(result.code || code).trim(),
        discount: Number(result.discount) || 0,
      });
      setCouponCode(String(result.code || code));
      setCouponMessage("Coupon applied successfully.");
    } catch (err) {
      setAppliedCoupon(null);
      setCouponMessage(err instanceof Error ? err.message : "Could not validate this coupon.");
    } finally {
      setCouponLoading(false);
    }
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponMessage("Coupon removed.");
  }

  function updateCustomer(
    field: keyof typeof customer,
    value: string
  ) {
    setCustomer((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function selectProof(file?: File) {
    if (!file) return;

    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setError("Please upload a JPG, PNG, or WebP image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be 5MB or less.");
      return;
    }

    setError("");
    setProofFile(file);

    const reader = new FileReader();

    reader.onload = () => {
      setProofPreview(String(reader.result || ""));
    };

    reader.readAsDataURL(file);
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (cart.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    if (!proofFile) {
      setError("Please upload your payment screenshot.");
      return;
    }

    if (
      !customer.name.trim() ||
      !customer.phone.trim() ||
      !customer.city.trim() ||
      !customer.address.trim()
    ) {
      setError("Please complete all required customer details.");
      return;
    }

    if (
      cart.some(
        (item) =>
          !item.productId ||
          !item.size ||
          item.quantity < 1
      )
    ) {
      setError("Your cart contains invalid items. Please review it.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      // STEP 1: Create the order in Supabase.
      // IMPORTANT: These field names must match the SQL function.

      const { data: orderData, error: orderError } =
        await supabase.rpc("create_store_order", {
          p_customer: {
            customer_name: customer.name.trim(),
            phone: customer.phone.trim(),
            email: customer.email.trim() || null,
            city: customer.city.trim(),
            address: customer.address.trim(),
            notes: customer.notes.trim() || null,
          },

          p_items: cart.map((item) => ({
            productId: item.productId,
            size: item.size,
            quantity: item.quantity,
          })),

          p_payment_method: paymentMethod,
          p_coupon_code: appliedCoupon?.code || null,
        });

      if (orderError) {
        throw new Error(orderError.message);
      }

      const order = Array.isArray(orderData)
        ? orderData[0]
        : orderData;

      const orderNumber = order?.order_number;

      if (!orderNumber) {
        throw new Error(
          "Order was created but its number was not returned."
        );
      }

      // STEP 2: Upload payment proof to Cloudinary.

      const formData = new FormData();
      formData.append("file", proofFile);

      const uploadResponse = await fetch("/api/payment-proof", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadResponse.json();

      if (
        !uploadResponse.ok ||
        !uploadData.success ||
        !uploadData.imageUrl
      ) {
        throw new Error(
          uploadData.error ||
            `Order ${orderNumber} was created, but payment proof upload failed. Contact the store with your order number.`
        );
      }

      // STEP 3: Attach payment proof to the created order.

      const { error: proofError } = await supabase.rpc(
        "submit_payment_proof",
        {
          p_order_number: orderNumber,
          p_phone: customer.phone.trim(),
          p_payment_proof_url: uploadData.imageUrl,
          p_transaction_reference:
            transactionReference.trim() || null,
        }
      );

      if (proofError) {
        throw new Error(
          `Order ${orderNumber} was created, but payment proof could not be saved. Please contact the store and provide your order number.`
        );
      }

      // STEP 4: Clear cart only after successful submission.

      localStorage.removeItem(CART_KEY);
      setCart([]);
      setSuccessOrder(orderNumber);
    } catch (err) {
      console.error("Checkout error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  if (!pageReady) {
    return (
      <main className="min-h-screen bg-[#090909] text-white flex items-center justify-center">
        <Loader2
          className="animate-spin text-[#c9a45c]"
          size={30}
        />
      </main>
    );
  }

  // SUCCESS SCREEN

  if (successOrder) {
    return (
      <main className="min-h-screen bg-[#090909] text-white flex items-center justify-center px-5">
        <div className="max-w-lg w-full text-center border border-[#c9a45c]/30 bg-[#111] p-8 md:p-12 rounded-2xl">
          <CheckCircle2
            className="mx-auto text-[#c9a45c] mb-5"
            size={58}
          />

          <p className="text-[#c9a45c] uppercase tracking-[0.3em] text-xs mb-3">
            Order submitted
          </p>

          <h1 className="text-3xl font-serif mb-4">
            Thank You
          </h1>

          <p className="text-white/60 mb-5">
            Your order and payment proof have been submitted.
            Your payment is pending manual verification.
          </p>

          <div className="bg-black border border-white/10 rounded-xl p-4 mb-7">
            <p className="text-white/40 text-xs mb-2">
              Order Number
            </p>

            <p className="text-[#c9a45c] text-xl font-semibold">
              {successOrder}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={`/track-order?order=${encodeURIComponent(successOrder)}`}
              className="inline-flex items-center justify-center gap-2 bg-[#c9a45c] text-black px-7 py-3 rounded-lg font-semibold hover:bg-[#dfbd78] transition"
            >
              Track Your Order
              <ArrowRight size={17} />
            </Link>
            <Link
              href="/products"
              className="inline-flex items-center justify-center gap-2 border border-white/15 text-white px-7 py-3 rounded-lg font-semibold hover:border-[#c9a45c] transition"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#090909] text-white">
      {/* HEADER */}

      <header className="border-b border-white/10 px-5 py-6">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Link
            href="/"
            className="text-xl tracking-[0.18em] font-serif"
          >
            BAIT <span className="text-[#c9a45c]">AL OUD</span>
          </Link>

          <Link
            href="/cart"
            className="text-white/60 hover:text-[#c9a45c] text-sm flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            Back to Cart
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-5 py-12">
        {/* PAGE TITLE */}

        <div className="mb-10">
          <p className="text-[#c9a45c] text-xs tracking-[0.3em] uppercase mb-3">
            Complete your purchase
          </p>

          <h1 className="text-4xl md:text-5xl font-serif">
            Checkout
          </h1>

          <p className="text-white/45 mt-3">
            Complete your details and submit your payment proof.
          </p>
        </div>

        {cart.length === 0 ? (
          <div className="border border-white/10 bg-[#111] rounded-2xl p-10 text-center">
            <ShoppingBag
              size={40}
              className="mx-auto text-[#c9a45c] mb-4"
            />

            <h2 className="text-2xl font-serif mb-3">
              Your cart is empty
            </h2>

            <Link
              href="/products"
              className="text-[#c9a45c] underline"
            >
              Explore perfumes
            </Link>
          </div>
        ) : (
          <form
            onSubmit={submitOrder}
            className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8"
          >
            <div className="space-y-7">

              {/* CUSTOMER INFORMATION */}

              <section className="bg-[#111] border border-white/10 rounded-2xl p-6 md:p-8">
                <h2 className="text-xl font-serif mb-6">
                  01. Customer Information
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field label="Full Name *">
                    <input
                      required
                      value={customer.name}
                      onChange={(e) =>
                        updateCustomer("name", e.target.value)
                      }
                      className="checkout-input"
                      placeholder="Your full name"
                    />
                  </Field>

                  <Field label="Phone Number *">
                    <input
                      required
                      type="tel"
                      value={customer.phone}
                      onChange={(e) =>
                        updateCustomer("phone", e.target.value)
                      }
                      className="checkout-input"
                      placeholder="01XXXXXXXXX"
                    />
                  </Field>

                  <Field label="Email Address">
                    <input
                      type="email"
                      value={customer.email}
                      onChange={(e) =>
                        updateCustomer("email", e.target.value)
                      }
                      className="checkout-input"
                      placeholder="you@example.com"
                    />
                  </Field>

                  <Field label="City / Governorate *">
                    <input
                      required
                      value={customer.city}
                      onChange={(e) =>
                        updateCustomer("city", e.target.value)
                      }
                      className="checkout-input"
                      placeholder="Your city"
                    />
                  </Field>

                  <div className="md:col-span-2">
                    <Field label="Full Address *">
                      <textarea
                        required
                        rows={3}
                        value={customer.address}
                        onChange={(e) =>
                          updateCustomer("address", e.target.value)
                        }
                        className="checkout-input resize-none"
                        placeholder="Street, building, apartment..."
                      />
                    </Field>
                  </div>

                  <div className="md:col-span-2">
                    <Field label="Order Notes (Optional)">
                      <textarea
                        rows={2}
                        value={customer.notes}
                        onChange={(e) =>
                          updateCustomer("notes", e.target.value)
                        }
                        className="checkout-input resize-none"
                        placeholder="Additional delivery instructions..."
                      />
                    </Field>
                  </div>
                </div>
              </section>

              {/* COUPON CODE */}

              <section className="bg-[#111] border border-white/10 rounded-2xl p-6 md:p-8">
                <h2 className="text-xl font-serif mb-2">Discount Code</h2>
                <p className="text-white/40 text-sm mb-5">
                  Have a coupon? Enter it below to get your discount.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    value={couponCode}
                    onChange={(e) => {
                      setCouponCode(e.target.value.toUpperCase());
                      if (appliedCoupon) setAppliedCoupon(null);
                      setCouponMessage("");
                    }}
                    disabled={couponLoading || loading}
                    className="checkout-input flex-1"
                    placeholder="Enter coupon code"
                    aria-label="Coupon code"
                  />
                  {appliedCoupon ? (
                    <button
                      type="button"
                      onClick={removeCoupon}
                      disabled={loading}
                      className="border border-white/20 hover:border-red-400 text-white/75 px-6 py-3 rounded-lg transition"
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={applyCoupon}
                      disabled={couponLoading || loading || !couponCode.trim()}
                      className="bg-[#c9a45c] hover:bg-[#dfbd78] disabled:opacity-50 text-black font-semibold px-6 py-3 rounded-lg transition flex items-center justify-center gap-2"
                    >
                      {couponLoading && <Loader2 className="animate-spin" size={17} />}
                      {couponLoading ? "Checking..." : "Apply"}
                    </button>
                  )}
                </div>

                {couponMessage && (
                  <p className={`text-sm mt-3 ${appliedCoupon ? "text-green-400" : "text-white/55"}`}>
                    {couponMessage}
                  </p>
                )}
              </section>

              {/* PAYMENT METHOD */}

              <section className="bg-[#111] border border-white/10 rounded-2xl p-6 md:p-8">
                <h2 className="text-xl font-serif mb-6">
                  02. Payment Method
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(
                    ["vodafone_cash", "instapay"] as PaymentMethod[]
                  ).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`text-left p-5 rounded-xl border transition ${
                        paymentMethod === method
                          ? "border-[#c9a45c] bg-[#c9a45c]/10"
                          : "border-white/10 hover:border-white/30"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <CreditCard
                          className="text-[#c9a45c]"
                          size={23}
                        />

                        <span
                          className={`w-4 h-4 rounded-full border ${
                            paymentMethod === method
                              ? "border-[#c9a45c] bg-[#c9a45c]"
                              : "border-white/40"
                          }`}
                        />
                      </div>

                      <p className="font-semibold">
                        {paymentDetails[method].name}
                      </p>

                      <p className="text-white/45 text-sm mt-2 break-all">
                        {paymentDetails[method].account}
                      </p>
                    </button>
                  ))}
                </div>

                <div className="mt-6 bg-black border border-[#c9a45c]/20 rounded-xl p-5">
                  <p className="text-[#c9a45c] text-xs uppercase tracking-widest mb-3">
                    Transfer payment to
                  </p>

                  <p className="text-white/60 text-sm mb-2">
                    {paymentDetails[paymentMethod].name}
                  </p>

                  <p className="text-xl font-semibold break-all">
                    {paymentDetails[paymentMethod].account}
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        paymentDetails[paymentMethod].account
                      );
                    }}
                    className="text-[#c9a45c] text-sm mt-3 underline"
                  >
                    Copy account details
                  </button>

                  <p className="text-white/40 text-xs mt-4">
                    Transfer the exact total amount, then upload a
                    screenshot of your payment.
                  </p>
                </div>
              </section>

              {/* PAYMENT PROOF */}

              <section className="bg-[#111] border border-white/10 rounded-2xl p-6 md:p-8">
                <h2 className="text-xl font-serif mb-6">
                  03. Payment Confirmation
                </h2>

                <Field label="Transaction Reference (Optional)">
                  <input
                    value={transactionReference}
                    onChange={(e) =>
                      setTransactionReference(e.target.value)
                    }
                    className="checkout-input"
                    placeholder="Transaction ID / reference"
                  />
                </Field>

                <div className="mt-5">
                  <label className="block text-sm text-white/65 mb-3">
                    Payment Screenshot *
                  </label>

                  {proofPreview ? (
                    <div className="relative max-w-sm">
                      <img
                        src={proofPreview}
                        alt="Payment proof preview"
                        className="w-full max-h-72 object-contain rounded-xl border border-white/10 bg-black"
                      />

                      <button
                        type="button"
                        onClick={() => {
                          setProofFile(null);
                          setProofPreview("");
                        }}
                        className="absolute top-2 right-2 bg-black/80 p-2 rounded-full"
                        aria-label="Remove image"
                      >
                        <X size={17} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-3 border border-dashed border-white/20 hover:border-[#c9a45c] rounded-xl p-9 cursor-pointer transition">
                      <Upload
                        className="text-[#c9a45c]"
                        size={30}
                      />

                      <span className="text-sm text-white/70">
                        Click to upload payment screenshot
                      </span>

                      <span className="text-xs text-white/35">
                        JPG, PNG, WebP · Maximum 5MB
                      </span>

                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) =>
                          selectProof(e.target.files?.[0])
                        }
                      />
                    </label>
                  )}

                  {proofPreview && (
                    <label className="inline-flex mt-3 text-sm text-[#c9a45c] underline cursor-pointer">
                      Change image

                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) =>
                          selectProof(e.target.files?.[0])
                        }
                      />
                    </label>
                  )}
                </div>
              </section>

              {/* ERROR MESSAGE */}

              {error && (
                <div className="border border-red-500/30 bg-red-500/10 text-red-300 rounded-xl p-4 text-sm">
                  {error}
                </div>
              )}

              {/* SUBMIT BUTTON */}

              <button
                type="submit"
                disabled={loading || cart.length === 0}
                className="w-full bg-[#c9a45c] hover:bg-[#dfbd78] disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold rounded-xl py-4 flex items-center justify-center gap-3 transition"
              >
                {loading ? (
                  <>
                    <Loader2
                      className="animate-spin"
                      size={19}
                    />
                    Submitting Order...
                  </>
                ) : (
                  <>
                    Submit Order
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <p className="text-xs text-white/35 text-center">
                Your payment will remain pending until it is
                manually verified.
              </p>
            </div>

            {/* ORDER SUMMARY */}

            <aside className="h-fit bg-[#111] border border-white/10 rounded-2xl p-6 lg:sticky lg:top-6">
              <h2 className="text-xl font-serif mb-6">
                Order Summary
              </h2>

              <div className="space-y-5">
                {cart.map((item, index) => (
                  <div
                    key={`${item.productId}-${item.size}-${index}`}
                    className="flex gap-4"
                  >
                    <div className="w-16 h-20 rounded-lg bg-black overflow-hidden shrink-0">
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {item.name}
                      </p>

                      <p className="text-xs text-white/40 mt-1">
                        {item.size} ml × {item.quantity}
                      </p>

                      <p className="text-sm text-[#c9a45c] mt-2">
                        EGP{" "}
                        {(item.price * item.quantity).toLocaleString(
                          "en-EG"
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-white/10 mt-6 pt-5 space-y-3">
                <SummaryRow
                  label="Subtotal"
                  value={subtotal}
                />

                <SummaryRow
                  label="Shipping"
                  value={shipping}
                />

                {appliedCoupon && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-400">Discount ({appliedCoupon.code})</span>
                    <span className="text-green-400">- EGP {discount.toLocaleString("en-EG")}</span>
                  </div>
                )}

                <div className="border-t border-white/10 pt-4 flex justify-between items-center">
                  <span className="font-semibold">Total</span>

                  <span className="text-xl text-[#c9a45c] font-semibold">
                    EGP {total.toLocaleString("en-EG")}
                  </span>
                </div>

                <p className="text-xs text-white/35">
                  Final total is calculated and validated by the
                  store database.
                </p>
              </div>
            </aside>
          </form>
        )}
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm text-white/65 mb-2">
        {label}
      </label>

      {children}
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-white/45">{label}</span>

      <span>
        EGP {value.toLocaleString("en-EG")}
      </span>
    </div>
  );
}
