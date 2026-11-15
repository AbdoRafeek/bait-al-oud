
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

type CartItem = {
  productId: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  size: number;
  price: number;
  quantity: number;
};

export default function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<"en" | "ar">("en");

  const isArabic = language === "ar";
  const shouldReduceMotion = useReducedMotion();

  // Load saved cart
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem("bait-al-oud-cart");

      if (savedCart) {
        const parsedCart = JSON.parse(savedCart);

        if (Array.isArray(parsedCart)) {
          setCart(parsedCart);
        }
      }
    } catch (error) {
      console.error("Unable to load cart:", error);
      setCart([]);
    }

    setLoading(false);
  }, []);

  // Save cart whenever it changes
  useEffect(() => {
    if (!loading) {
      localStorage.setItem("bait-al-oud-cart", JSON.stringify(cart));
    }
  }, [cart, loading]);

  const subtotal = useMemo(() => {
    return cart.reduce(
      (total, item) =>
        total + Number(item.price) * Number(item.quantity),
      0
    );
  }, [cart]);

  const totalItems = useMemo(() => {
    return cart.reduce(
      (total, item) => total + Number(item.quantity),
      0
    );
  }, [cart]);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat(isArabic ? "ar-EG" : "en-US").format(price);

  // Update quantity
  function updateQuantity(index: number, amount: number) {
    setCart((currentCart) =>
      currentCart.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              quantity: Math.max(1, item.quantity + amount),
            }
          : item
      )
    );
  }

  // Remove item
  function removeItem(index: number) {
    setCart((currentCart) =>
      currentCart.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  // Clear cart
  function clearCart() {
    if (
      window.confirm(
        isArabic
          ? "هل أنت متأكد من حذف جميع المنتجات؟"
          : "Are you sure you want to clear your cart?"
      )
    ) {
      setCart([]);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#100f0d] text-[#c5a36a]">
        <motion.div
          animate={shouldReduceMotion ? {} : { rotate: 360 }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "linear",
          }}
          className="h-10 w-10 rounded-full border-2 border-[#c5a36a]/20 border-t-[#c5a36a]"
        />
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

          <div className="flex items-center gap-5">
            <Link
              href="/products"
              className="text-sm text-white/60 transition hover:text-[#c5a36a]"
            >
              {isArabic ? "تسوق العطور" : "Continue Shopping"}
            </Link>

            <button
              onClick={() =>
                setLanguage((current) =>
                  current === "en" ? "ar" : "en"
                )
              }
              className="text-xs text-[#c5a36a] transition hover:text-white"
            >
              {isArabic ? "English" : "العربية"}
            </button>
          </div>
        </nav>
      </header>

      {/* PAGE HEADER */}
      <section className="relative overflow-hidden border-b border-white/10 px-6 py-16">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(197,163,106,0.12),transparent_65%)]" />

        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative mx-auto max-w-7xl"
        >
          <p className="text-xs tracking-[0.4em] text-[#c5a36a]">
            YOUR SELECTION
          </p>

          <h1 className="mt-5 font-serif text-5xl md:text-6xl">
            {isArabic ? (
              <>
                حقيبة <span className="text-[#c5a36a]">التسوق</span>
              </>
            ) : (
              <>
                Shopping <span className="text-[#c5a36a]">Bag</span>
              </>
            )}
          </h1>

          <p className="mt-5 text-sm text-white/45">
            {isArabic
              ? `${totalItems} منتج في حقيبتك`
              : `${totalItems} items in your bag`}
          </p>
        </motion.div>
      </section>

      {/* CART CONTENT */}
      <section className="mx-auto max-w-7xl px-6 py-14">
        {cart.length === 0 ? (
          /* EMPTY CART */
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#181715] px-6 text-center"
          >
            <span className="text-7xl text-[#c5a36a]/60">✧</span>

            <h2 className="mt-7 font-serif text-3xl">
              {isArabic ? "حقيبتك فارغة" : "Your Bag Is Empty"}
            </h2>

            <p className="mt-4 max-w-md text-sm leading-7 text-white/40">
              {isArabic
                ? "اكتشف مجموعتنا من العطور واختر عطرك المفضل."
                : "Discover our fragrance collection and find your perfect scent."}
            </p>

            <Link
              href="/products"
              className="mt-8 bg-[#c5a36a] px-9 py-4 text-xs font-semibold tracking-wider text-black transition hover:bg-[#dfc18b]"
            >
              {isArabic ? "اكتشف العطور" : "EXPLORE COLLECTION"}
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1fr_370px]">
            {/* CART ITEMS */}
            <div>
              <div className="mb-6 flex items-center justify-between">
                <h2 className="font-serif text-2xl">
                  {isArabic ? "منتجاتك" : "Your Items"}
                </h2>

                <button
                  onClick={clearCart}
                  className="text-xs text-red-400/70 transition hover:text-red-400"
                >
                  {isArabic ? "حذف الكل" : "Clear Cart"}
                </button>
              </div>

              <div className="space-y-4">
                {cart.map((item, index) => (
                  <motion.article
                    key={`${item.productId}-${item.size}`}
                    layout
                    initial={
                      shouldReduceMotion ? false : { opacity: 0, y: 20 }
                    }
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 30 }}
                    transition={{ duration: 0.35 }}
                    className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-[#181715] p-5 sm:flex-row"
                  >
                    {/* IMAGE */}
                    <Link
                      href={`/products/${item.slug}`}
                      className="h-32 w-full shrink-0 overflow-hidden rounded-xl bg-[#211e19] sm:w-28"
                    >
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="h-full w-full object-cover transition duration-500 hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-4xl text-[#c5a36a]/50">
                          ✧
                        </div>
                      )}
                    </Link>

                    {/* INFO */}
                    <div className="flex flex-1 flex-col justify-between gap-4">
                      <div>
                        <Link
                          href={`/products/${item.slug}`}
                          className="font-serif text-lg transition hover:text-[#c5a36a]"
                        >
                          {item.name}
                        </Link>

                        <p className="mt-2 text-xs text-white/40">
                          {isArabic ? "الحجم" : "Size"}: {item.size} ML
                        </p>

                        <p className="mt-2 text-sm text-[#c5a36a]">
                          {formatPrice(Number(item.price))} EGP
                        </p>
                      </div>

                      <div className="flex items-center justify-between">
                        {/* QUANTITY */}
                        <div className="inline-flex items-center overflow-hidden rounded-lg border border-white/10">
                          <button
                            onClick={() => updateQuantity(index, -1)}
                            className="px-4 py-2 text-white/70 transition hover:bg-white/10"
                            aria-label="Decrease quantity"
                          >
                            −
                          </button>

                          <span className="min-w-10 text-center text-sm">
                            {item.quantity}
                          </span>

                          <button
                            onClick={() => updateQuantity(index, 1)}
                            className="px-4 py-2 text-white/70 transition hover:bg-white/10"
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>

                        {/* ITEM TOTAL */}
                        <span className="text-sm font-semibold text-white">
                          {formatPrice(
                            Number(item.price) * Number(item.quantity)
                          )}{" "}
                          EGP
                        </span>

                        {/* REMOVE */}
                        <button
                          onClick={() => removeItem(index)}
                          className="text-xs text-red-400/70 transition hover:text-red-400"
                        >
                          {isArabic ? "حذف" : "Remove"}
                        </button>
                      </div>
                    </div>
                  </motion.article>
                ))}
              </div>

              <Link
                href="/products"
                className="mt-8 inline-flex items-center gap-3 text-xs tracking-wider text-[#c5a36a] transition hover:text-white"
              >
                <span>{isArabic ? "←" : "←"}</span>
                {isArabic ? "متابعة التسوق" : "CONTINUE SHOPPING"}
              </Link>
            </div>

            {/* ORDER SUMMARY */}
            <motion.aside
              initial={shouldReduceMotion ? false : { opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="sticky top-28 rounded-2xl border border-white/10 bg-[#181715] p-7"
            >
              <h2 className="font-serif text-2xl">
                {isArabic ? "ملخص الطلب" : "Order Summary"}
              </h2>

              <div className="mt-8 space-y-5 border-b border-white/10 pb-6">
                <div className="flex justify-between text-sm text-white/50">
                  <span>{isArabic ? "عدد المنتجات" : "Items"}</span>
                  <span>{totalItems}</span>
                </div>

                <div className="flex justify-between text-sm text-white/50">
                  <span>{isArabic ? "المجموع الفرعي" : "Subtotal"}</span>
                  <span>{formatPrice(subtotal)} EGP</span>
                </div>

                <div className="flex justify-between text-sm text-white/50">
                  <span>{isArabic ? "الشحن" : "Shipping"}</span>
                  <span>{isArabic ? "يحدد لاحقًا" : "Calculated at checkout"}</span>
                </div>
              </div>

              <div className="flex items-center justify-between py-7">
                <span className="text-sm text-white/60">
                  {isArabic ? "الإجمالي" : "Total"}
                </span>

                <div className="text-right">
                  <p className="font-serif text-3xl text-[#c5a36a]">
                    {formatPrice(subtotal)}
                  </p>
                  <span className="text-xs text-white/40">EGP</span>
                </div>
              </div>

              <Link
                href="/checkout"
                className="block w-full bg-[#c5a36a] py-5 text-center text-xs font-semibold tracking-[0.2em] text-black transition hover:bg-[#dfc18b]"
              >
                {isArabic ? "إتمام الطلب" : "PROCEED TO CHECKOUT"}
              </Link>

              <p className="mt-5 text-center text-[10px] leading-6 text-white/35">
                {isArabic
                  ? "تكلفة الشحن وطريقة الدفع سيتم تحديدهما في الخطوة التالية."
                  : "Shipping costs and payment method will be confirmed at checkout."}
              </p>

              <div className="mt-7 flex items-center justify-center gap-3 border-t border-white/10 pt-6 text-[10px] tracking-wider text-white/40">
                <span>✧</span>
                <span>BAIT AL OUD</span>
                <span>✧</span>
              </div>
            </motion.aside>
          </div>
        )}
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 px-6 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row">
          <Link
            href="/"
            className="font-serif text-xl tracking-[0.15em] text-[#c5a36a]"
          >
            BAIT AL OUD
          </Link>

          <p className="text-xs text-white/35">
            © 2026 Bait Al Oud. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
