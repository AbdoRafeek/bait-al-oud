"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { createClient } from "@/lib/supabase/client";

type Product = {
  id: string;
  name_en: string;
  name_ar: string;
  slug: string;
  description_en: string | null;
  description_ar: string | null;
  product_type: string;
  image_url: string | null;
  is_featured: boolean;
};

type Variant = {
  product_id: string;
  size_ml: number;
  price: number;
  stock: number;
};

type CartItem = {
  productId: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  size: number;
  price: number;
  quantity: number;
};

function ProductDetailsContent() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params.slug;

  const shouldReduceMotion = useReducedMotion();

  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const isArabic = language === "ar";

  useEffect(() => {
    let cancelled = false;

    async function loadProduct() {
      setLoading(true);
      setError("");

      const supabase = createClient();

      const { data, error: productError } = await supabase
        .from("products")
        .select(
          "id, name_en, name_ar, slug, description_en, description_ar, product_type, image_url, is_featured"
        )
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (cancelled) return;

      if (productError) {
        console.error("Product error:", productError.message);
        setError("Unable to load this product.");
        setLoading(false);
        return;
      }

      if (!data) {
        setProduct(null);
        setLoading(false);
        return;
      }

      const currentProduct = data as Product;
      setProduct(currentProduct);

      const { data: variantData, error: variantError } = await supabase
        .from("product_variants")
        .select("product_id, size_ml, price, stock")
        .eq("product_id", currentProduct.id)
        .eq("is_active", true)
        .order("size_ml", { ascending: true });

      if (cancelled) return;

      if (variantError) {
        console.error("Variants error:", variantError.message);
        setError("Unable to load product sizes.");
        setLoading(false);
        return;
      }

      const availableVariants = (variantData || []) as Variant[];

      setVariants(availableVariants);

      if (availableVariants.length > 0) {
        setSelectedVariant(availableVariants[0]);
      }

      setLoading(false);
    }

    if (slug) {
      loadProduct();
    }

    return () => {
      cancelled = true;
    };
  }, [slug]);

  function addToCart(redirectToCheckout = false) {
    if (!product || !selectedVariant || selectedVariant.stock <= 0) {
      return;
    }

    const item: CartItem = {
      productId: product.id,
      slug: product.slug,
      name: isArabic ? product.name_ar : product.name_en,
      imageUrl: product.image_url,
      size: selectedVariant.size_ml,
      price: Number(selectedVariant.price),
      quantity,
    };

    try {
      const savedCart = localStorage.getItem("bait-al-oud-cart");
      const cart: CartItem[] = savedCart ? JSON.parse(savedCart) : [];

      const existingIndex = cart.findIndex(
        (cartItem) =>
          cartItem.productId === item.productId &&
          cartItem.size === item.size
      );

      if (existingIndex >= 0) {
        const newQuantity = cart[existingIndex].quantity + quantity;

        if (newQuantity > selectedVariant.stock) {
          alert(
            isArabic
              ? "الكمية المطلوبة أكبر من المخزون المتاح."
              : "Requested quantity exceeds available stock."
          );
          return;
        }

        cart[existingIndex].quantity = newQuantity;
      } else {
        cart.push(item);
      }

      localStorage.setItem("bait-al-oud-cart", JSON.stringify(cart));
      setAdded(true);

      if (redirectToCheckout) {
        router.push("/checkout");
      }
    } catch (cartError) {
      console.error("Cart error:", cartError);
      alert(
        isArabic
          ? "حدث خطأ أثناء إضافة المنتج للسلة."
          : "Could not add this product to your cart."
      );
    }
  }

  const formatPrice = (price: number) =>
    new Intl.NumberFormat(isArabic ? "ar-EG" : "en-US").format(price);

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

  if (!product) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#100f0d] px-6 text-center text-white">
        <p className="font-serif text-4xl">Product Not Found</p>
        <p className="mt-4 text-sm text-white/50">
          {error || "This fragrance is unavailable or does not exist."}
        </p>
        <Link
          href="/products"
          className="mt-8 bg-[#c5a36a] px-7 py-3 text-sm text-black"
        >
          Back to Collection
        </Link>
      </main>
    );
  }

  const outOfStock = !selectedVariant || selectedVariant.stock <= 0;

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
              {isArabic ? "كل العطور" : "Collection"}
            </Link>

            <button
              onClick={() => {
                setLanguage((current) =>
                  current === "en" ? "ar" : "en"
                );
                setAdded(false);
              }}
              className="text-xs text-[#c5a36a] hover:text-white"
            >
              {isArabic ? "English" : "العربية"}
            </button>
          </div>
        </nav>
      </header>

      {/* BREADCRUMB */}
      <div className="mx-auto max-w-7xl px-6 py-7">
        <div className="flex items-center gap-3 text-xs text-white/40">
          <Link href="/" className="hover:text-[#c5a36a]">
            {isArabic ? "الرئيسية" : "Home"}
          </Link>
          <span>/</span>
          <Link href="/products" className="hover:text-[#c5a36a]">
            {isArabic ? "العطور" : "Collection"}
          </Link>
          <span>/</span>
          <span className="text-[#c5a36a]">
            {isArabic ? product.name_ar : product.name_en}
          </span>
        </div>
      </div>

      {/* PRODUCT DETAILS */}
      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 pb-24 lg:grid-cols-2 lg:gap-20">
        {/* PRODUCT IMAGE */}
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, x: -35 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="relative"
        >
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/10 bg-[#211e19]">
            {product.image_url ? (
              <motion.img
                initial={shouldReduceMotion ? false : { scale: 1.08 }}
                animate={{ scale: 1 }}
                transition={{ duration: 1.2 }}
                src={product.image_url}
                alt={isArabic ? product.name_ar : product.name_en}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-5 text-[#c5a36a]/50">
                <span className="text-8xl">✧</span>
                <span className="text-sm tracking-[0.4em]">
                  BAIT AL OUD
                </span>
              </div>
            )}

            {product.is_featured && (
              <span className="absolute left-6 top-6 rounded-full bg-[#c5a36a] px-4 py-2 text-[10px] font-semibold tracking-wider text-black">
                FEATURED
              </span>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between border-b border-white/10 pb-5">
            <span className="text-xs tracking-[0.2em] text-[#c5a36a]">
              BAIT AL OUD
            </span>
            <span className="text-xs text-white/35">
              {product.product_type === "original"
                ? "ORIGINAL COLLECTION"
                : "CUSTOM COLLECTION"}
            </span>
          </div>
        </motion.div>

        {/* PRODUCT INFORMATION */}
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, x: 35 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="flex flex-col justify-center py-5"
        >
          <p className="text-xs tracking-[0.35em] text-[#c5a36a]">
            {product.product_type === "original"
              ? "AUTHENTIC FRAGRANCE"
              : "PERSONAL FRAGRANCE"}
          </p>

          <h1 className="mt-6 font-serif text-4xl leading-tight text-white md:text-5xl">
            {isArabic ? product.name_ar : product.name_en}
          </h1>

          <p className="mt-6 text-sm leading-8 text-white/50">
            {(isArabic
              ? product.description_ar
              : product.description_en) ||
              (isArabic
                ? "اكتشف تجربة عطرية مميزة من بيت العود."
                : "Discover a distinctive fragrance experience from Bait Al Oud.")}
          </p>

          {/* SIZE SELECTOR */}
          <div className="my-9 border-y border-white/10 py-7">
            <p className="mb-5 text-xs tracking-[0.2em] text-white/60">
              {isArabic ? "اختر الحجم" : "SELECT SIZE"}
            </p>

            {variants.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {variants.map((variant) => {
                  const selected =
                    selectedVariant?.size_ml === variant.size_ml;

                  return (
                    <motion.button
                      key={variant.size_ml}
                      whileHover={shouldReduceMotion ? {} : { y: -3 }}
                      whileTap={shouldReduceMotion ? {} : { scale: 0.96 }}
                      onClick={() => {
                        setSelectedVariant(variant);
                        setQuantity(1);
                        setAdded(false);
                      }}
                      className={`min-w-24 rounded-xl border px-5 py-4 transition-all ${
                        selected
                          ? "border-[#c5a36a] bg-[#c5a36a]/10 text-[#dfc18b]"
                          : "border-white/10 bg-[#181715] text-white/60 hover:border-[#c5a36a]/50"
                      }`}
                    >
                      <span className="block text-sm font-semibold">
                        {variant.size_ml} ML
                      </span>
                      <span className="mt-2 block text-[10px] text-white/40">
                        {formatPrice(Number(variant.price))} EGP
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-white/40">
                {isArabic
                  ? "لا توجد أحجام متاحة لهذا المنتج حاليًا."
                  : "No sizes are currently available for this product."}
              </p>
            )}
          </div>

          {/* PRICE */}
          <div className="mb-8">
            <p className="text-xs text-white/40">
              {isArabic ? "السعر" : "PRICE"}
            </p>

            <div className="mt-2">
              {selectedVariant ? (
                <>
                  <span className="font-serif text-4xl text-[#c5a36a]">
                    {formatPrice(Number(selectedVariant.price))}
                  </span>
                  <span className="ml-2 text-sm text-white/40">
                    EGP
                  </span>
                </>
              ) : (
                <span className="text-sm text-white/40">
                  {isArabic ? "غير متاح" : "Unavailable"}
                </span>
              )}
            </div>
          </div>

          {/* STOCK */}
          {selectedVariant && (
            <p className="mb-6 text-xs">
              {selectedVariant.stock > 0 ? (
                <span className="text-emerald-400">
                  {isArabic
                    ? `متوفر في المخزون (${selectedVariant.stock})`
                    : `${selectedVariant.stock} available in stock`}
                </span>
              ) : (
                <span className="text-red-400">
                  {isArabic ? "نفد المخزون" : "Out of stock"}
                </span>
              )}
            </p>
          )}

          {/* QUANTITY */}
          {selectedVariant && selectedVariant.stock > 0 && (
            <div className="mb-7">
              <p className="mb-3 text-xs tracking-wider text-white/60">
                {isArabic ? "الكمية" : "QUANTITY"}
              </p>

              <div className="inline-flex items-center overflow-hidden rounded-xl border border-white/10">
                <button
                  onClick={() =>
                    setQuantity((current) => Math.max(1, current - 1))
                  }
                  className="px-5 py-3 text-white/70 transition hover:bg-white/10"
                >
                  −
                </button>

                <span className="min-w-12 text-center text-sm">
                  {quantity}
                </span>

                <button
                  onClick={() =>
                    setQuantity((current) =>
                      Math.min(selectedVariant.stock, current + 1)
                    )
                  }
                  className="px-5 py-3 text-white/70 transition hover:bg-white/10"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {/* ACTION BUTTONS */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <motion.button
              whileHover={
                shouldReduceMotion || outOfStock ? {} : { y: -3 }
              }
              whileTap={
                shouldReduceMotion || outOfStock ? {} : { scale: 0.98 }
              }
              disabled={outOfStock}
              onClick={() => addToCart(false)}
              className={`flex-1 py-5 text-xs font-semibold tracking-[0.2em] transition ${
                outOfStock
                  ? "cursor-not-allowed border border-white/10 bg-white/5 text-white/30"
                  : "border border-[#c5a36a] text-[#c5a36a] hover:bg-[#c5a36a]/10"
              }`}
            >
              {outOfStock
                ? isArabic
                  ? "غير متاح حاليًا"
                  : "CURRENTLY UNAVAILABLE"
                : added
                  ? isArabic
                    ? "تمت الإضافة للسلة ✓"
                    : "ADDED TO CART ✓"
                  : isArabic
                    ? "أضف إلى السلة"
                    : "ADD TO CART"}
            </motion.button>

            {!outOfStock && (
              <motion.button
                whileHover={shouldReduceMotion ? {} : { y: -3 }}
                whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
                onClick={() => addToCart(true)}
                className="flex-1 bg-[#c5a36a] py-5 text-xs font-semibold tracking-[0.2em] text-black transition hover:bg-[#dfc18b]"
              >
                {isArabic ? "شراء الآن" : "BUY NOW"}
              </motion.button>
            )}
          </div>

          {added && (
            <Link
              href="/cart"
              className="mt-4 text-center text-xs text-[#c5a36a] underline underline-offset-4"
            >
              {isArabic ? "الانتقال إلى السلة" : "View Shopping Cart"}
            </Link>
          )}

          <p className="mt-5 text-center text-[10px] tracking-wider text-white/35">
            {isArabic
              ? "تجربة بيت العود — الفخامة في كل قطرة"
              : "THE BAIT AL OUD EXPERIENCE — LUXURY IN EVERY DROP"}
          </p>
        </motion.div>
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

export default function ProductDetailsPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#100f0d] text-[#c5a36a]">
          Loading fragrance...
        </main>
      }
    >
      <ProductDetailsContent />
    </Suspense>
  );
}