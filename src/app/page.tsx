"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Menu,
  X,
  ShoppingBag,
} from "lucide-react";
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

type Category = {
  id: string;
  name_ar: string;
  name_en: string;
  slug: string;
  is_active: boolean;
};

type Variant = {
  product_id: string;
  size_ml: number;
  price: number;
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

const CART_KEY = "bait-al-oud-cart";

const reveal = {
  hidden: { opacity: 0, y: 35 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: "easeOut" as const },
  },
};

const stagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.14,
    },
  },
};

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [prices, setPrices] = useState<Record<string, Variant[]>>({});
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [cartCount, setCartCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isArabic = language === "ar";
  const shouldReduceMotion = useReducedMotion();

  const heroRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const heroY = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0.25]);

  useEffect(() => {
    try {
      const savedCart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      if (Array.isArray(savedCart)) {
        const total = savedCart.reduce(
          (sum: number, item: CartItem) => sum + (Number(item.quantity) || 0),
          0
        );
        setCartCount(total);
      }
    } catch {
      setCartCount(0);
    }

    async function loadProducts() {
      const supabase = createClient();

      // Load active categories
      const { data: categoryData, error: categoryError } = await supabase
        .from("categories")
        .select("id, name_ar, name_en, slug, is_active")
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (categoryError) {
        console.error("Categories error:", categoryError.message);
      } else {
        setCategories((categoryData || []) as Category[]);
      }

      // Load active products
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, name_en, name_ar, slug, description_en, description_ar, product_type, image_url, is_featured"
        )
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Products error:", error.message);
        setLoading(false);
        return;
      }

      const items = (data || []) as Product[];
      setProducts(items);

      if (items.length > 0) {
        const { data: variants, error: variantsError } = await supabase
          .from("product_variants")
          .select("product_id, size_ml, price")
          .in(
            "product_id",
            items.map((item) => item.id)
          )
          .eq("is_active", true)
          .order("price", { ascending: true });

        if (!variantsError && variants) {
          const grouped: Record<string, Variant[]> = {};

          (variants as Variant[]).forEach((variant) => {
            if (!grouped[variant.product_id]) {
              grouped[variant.product_id] = [];
            }

            grouped[variant.product_id].push(variant);
          });

          setPrices(grouped);
        }
      }

      setLoading(false);
    }

    loadProducts();
  }, []);

  function addItemToLocalStorage(product: Product) {
    const variants = prices[product.id] || [];
    if (!variants.length) return;

    const defaultVariant = variants[0];
    const newItem: CartItem = {
      productId: product.id,
      slug: product.slug,
      name: isArabic ? product.name_ar : product.name_en,
      imageUrl: product.image_url,
      size: defaultVariant.size_ml,
      price: Number(defaultVariant.price),
      quantity: 1,
    };

    try {
      const existing = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      const cartArray: CartItem[] = Array.isArray(existing) ? existing : [];
      const foundIndex = cartArray.findIndex(
        (item) =>
          item.productId === newItem.productId && item.size === newItem.size
      );

      if (foundIndex > -1) {
        cartArray[foundIndex].quantity += 1;
      } else {
        cartArray.push(newItem);
      }

      localStorage.setItem(CART_KEY, JSON.stringify(cartArray));
      const totalItems = cartArray.reduce((sum, i) => sum + i.quantity, 0);
      setCartCount(totalItems);
    } catch (error) {
      console.error("Failed to update cart:", error);
    }
  }

  const featuredProducts = products.filter((p) => p.is_featured);
  const originalProducts = products.filter(
    (p) => p.product_type === "original"
  );
  const customProducts = products.filter((p) => p.product_type === "custom");

  const formatPrice = (price: number) =>
    new Intl.NumberFormat(isArabic ? "ar-EG" : "en-US").format(price);

  const entrance = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 30 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.12 },
        transition: { duration: 0.7, ease: "easeOut" as const },
      };

  function ProductCard({ product }: { product: Product }) {
    const variants = prices[product.id] || [];
    const lowestPrice = variants.length ? variants[0].price : null;

    return (
      <motion.article
        variants={reveal}
        whileHover={
          shouldReduceMotion
            ? {}
            : {
                y: -8,
                transition: { duration: 0.3 },
              }
        }
        className="group overflow-hidden rounded-2xl border border-white/10 bg-[#181715] transition-colors duration-500 hover:border-[#c5a36a]/60"
      >
        <Link href={`/products/${product.slug}`} className="block">
          <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden bg-[#211e19]">
            {product.image_url ? (
              <motion.img
                src={product.image_url}
                alt={isArabic ? product.name_ar : product.name_en}
                className="h-full w-full object-cover"
                whileHover={shouldReduceMotion ? {} : { scale: 1.07 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-[#c5a36a]/50">
                <span className="text-4xl md:text-5xl">✧</span>
                <span className="text-[10px] tracking-[0.3em] md:text-xs">
                  BAIT AL OUD
                </span>
              </div>
            )}

            {product.is_featured && (
              <span className="absolute left-3 top-3 rounded-full bg-[#c5a36a] px-3 py-1 text-[10px] font-semibold tracking-wider text-black md:left-4 md:top-4">
                {isArabic ? "مميز" : "FEATURED"}
              </span>
            )}

            <div className="absolute inset-0 hidden items-center justify-center bg-black/30 opacity-0 transition-opacity duration-300 group-hover:opacity-100 md:flex">
              <span className="border border-white/70 px-5 py-3 text-xs tracking-widest text-white">
                {isArabic ? "اكتشف العطر" : "DISCOVER"}
              </span>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <p className="mb-1.5 text-[10px] uppercase tracking-[0.25em] text-[#c5a36a]">
              {product.product_type === "original"
                ? "Original Collection"
                : "Custom Collection"}
            </p>

            <h3 className="text-base font-medium text-white sm:text-lg">
              {isArabic ? product.name_ar : product.name_en}
            </h3>

            <p className="mt-1.5 line-clamp-2 min-h-10 text-xs leading-6 text-white/45 sm:text-sm">
              {(isArabic
                ? product.description_ar
                : product.description_en) || ""}
            </p>
          </div>
        </Link>

        <div className="flex items-center justify-between gap-2 border-t border-white/10 px-4 py-3.5 sm:px-5 sm:py-4">
          <div>
            {lowestPrice !== null ? (
              <>
                <span className="text-base font-semibold text-[#c5a36a] sm:text-lg">
                  {formatPrice(lowestPrice)}
                </span>
                <span className="ml-1 text-[11px] text-white/40 sm:text-xs">
                  EGP
                </span>
              </>
            ) : (
              <span className="text-xs text-white/40 sm:text-sm">
                {isArabic ? "السعر غير متاح" : "Price unavailable"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => addItemToLocalStorage(product)}
              className="rounded-full border border-[#c5a36a]/50 px-3 py-1.5 text-xs text-[#c5a36a] transition hover:bg-[#c5a36a] hover:text-black sm:px-3.5 sm:py-2"
            >
              {isArabic ? "أضف للسلة" : "Add to cart"}
            </motion.button>

            <Link
              href={`/products/${product.slug}`}
              className="rounded-full bg-[#c5a36a] px-3.5 py-1.5 text-xs font-semibold text-black transition hover:bg-white sm:px-4 sm:py-2"
            >
              {isArabic ? "شراء" : "Buy"}
            </Link>
          </div>
        </div>
      </motion.article>
    );
  }

  function ProductSection({
    title,
    subtitle,
    items,
  }: {
    title: string;
    subtitle: string;
    items: Product[];
  }) {
    if (!items.length) return null;

    return (
      <motion.section
        {...entrance}
        className="mx-auto max-w-7xl px-5 py-14 sm:px-6 md:py-20"
      >
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 md:mb-10">
          <div>
            <p className="mb-2 text-[11px] tracking-[0.3em] text-[#c5a36a] md:mb-3 md:text-xs md:tracking-[0.35em]">
              {subtitle}
            </p>

            <h2 className="font-serif text-2xl text-white sm:text-3xl md:text-4xl">
              {title}
            </h2>
          </div>

          <Link
            href="/products"
            className="text-xs text-[#c5a36a] transition hover:text-white sm:text-sm"
          >
            {isArabic ? "عرض الكل ←" : "View All →"}
          </Link>
        </div>

        <motion.div
          variants={shouldReduceMotion ? {} : stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.08 }}
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:gap-6 lg:grid-cols-3"
        >
          {items.slice(0, 3).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </motion.div>
      </motion.section>
    );
  }

  return (
    <main
      dir={isArabic ? "rtl" : "ltr"}
      className="min-h-screen overflow-x-hidden bg-[#100f0d] text-white"
    >
      {/* NAVBAR */}
      <motion.header
        initial={shouldReduceMotion ? false : { opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="sticky top-0 z-50 border-b border-white/10 bg-[#100f0d]/95 backdrop-blur-xl"
      >
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-20 sm:px-6">
          <Link
            href="/"
            aria-label="Bait Al Oud"
            className="flex shrink-0 items-center"
          >
            <img
              src="/logo.png"
              alt="بيت العود"
              className="h-11 w-auto max-w-[130px] object-contain sm:h-15 sm:max-w-[150px]"
            />
          </Link>

          {/* Desktop Links */}
          <div className="hidden items-center gap-8 text-sm text-white/65 md:flex lg:gap-9">
            <a href="#home" className="nav-link transition hover:text-[#c5a36a]">
              {isArabic ? "الرئيسية" : "Home"}
            </a>

            <a
              href="#categories"
              className="nav-link transition hover:text-[#c5a36a]"
            >
              {isArabic ? "التصنيفات" : "Categories"}
            </a>

            <a
              href="#original"
              className="nav-link transition hover:text-[#c5a36a]"
            >
              {isArabic ? "العطور الأصلية" : "Original Perfumes"}
            </a>

            <a
              href="#custom"
              className="nav-link transition hover:text-[#c5a36a]"
            >
              {isArabic ? "العطور المخصصة" : "Custom Perfumes"}
            </a>

            <Link
              href="/custom-mix"
              className="nav-link text-[#c5a36a] transition hover:text-white"
            >
              {isArabic ? "ركّب عطرك" : "Create Your Mix"}
            </Link>

            <a
              href="#about"
              className="nav-link transition hover:text-[#c5a36a]"
            >
              {isArabic ? "عن البراند" : "About Us"}
            </a>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={() =>
                setLanguage((current) => (current === "en" ? "ar" : "en"))
              }
              className="rounded-full border border-[#c5a36a]/30 px-3 py-1 text-xs text-[#c5a36a] transition hover:border-[#c5a36a] hover:text-white"
            >
              {isArabic ? "English" : "العربية"}
            </button>

            <Link
              href="/cart"
              className="relative p-1 text-white transition hover:text-[#c5a36a]"
              aria-label="Shopping cart"
            >
              <ShoppingBag size={20} />
              {cartCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#c5a36a] text-[10px] font-bold text-black">
                  {cartCount}
                </span>
              )}
            </Link>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1 text-white transition hover:text-[#c5a36a] md:hidden"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </nav>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-col gap-4 border-t border-white/10 bg-[#141310] px-6 py-6 text-sm text-white/80 md:hidden"
          >
            <a
              href="#home"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 transition hover:text-[#c5a36a]"
            >
              {isArabic ? "الرئيسية" : "Home"}
            </a>
            <a
              href="#categories"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 transition hover:text-[#c5a36a]"
            >
              {isArabic ? "التصنيفات" : "Categories"}
            </a>
            <a
              href="#original"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 transition hover:text-[#c5a36a]"
            >
              {isArabic ? "العطور الأصلية" : "Original Perfumes"}
            </a>
            <a
              href="#custom"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 transition hover:text-[#c5a36a]"
            >
              {isArabic ? "العطور المخصصة" : "Custom Perfumes"}
            </a>
            <Link
              href="/custom-mix"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 font-semibold text-[#c5a36a]"
            >
              {isArabic ? "ركّب عطرك" : "Create Your Mix"}
            </Link>
            <a
              href="#about"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 transition hover:text-[#c5a36a]"
            >
              {isArabic ? "عن البراند" : "About Us"}
            </a>
          </motion.div>
        )}
      </motion.header>

      {/* HERO */}
      <section
        ref={heroRef}
        id="home"
        className="relative flex min-h-[540px] items-center overflow-hidden border-b border-white/10 md:min-h-[650px]"
      >
        <motion.div
          style={shouldReduceMotion ? {} : { y: heroY, opacity: heroOpacity }}
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_75%_50%,rgba(160,112,48,0.2),transparent_60%)]"
        />

        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-8 px-5 py-12 sm:px-6 md:grid-cols-2 md:gap-12 md:py-24">
          {/* Text Content */}
          <div className="order-2 max-w-xl text-center md:order-1 md:text-start">
            <motion.p
              initial={shouldReduceMotion ? false : { opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="mb-4 text-[11px] tracking-[0.35em] text-[#c5a36a] md:mb-6 md:text-xs md:tracking-[0.45em]"
            >
              {isArabic ? "فن العطور الفاخرة" : "THE ART OF LUXURY FRAGRANCE"}
            </motion.p>

            <motion.h1
              initial={
                shouldReduceMotion
                  ? false
                  : { opacity: 0, y: 35, filter: "blur(8px)" }
              }
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="font-serif text-4xl leading-tight text-white sm:text-5xl md:text-7xl"
            >
              {isArabic ? (
                <>
                  عطر يحكي <span className="text-[#c5a36a]">قصتك.</span>
                </>
              ) : (
                <>
                  A Scent That{" "}
                  <span className="text-[#c5a36a]">Defines You.</span>
                </>
              )}
            </motion.h1>

            <motion.p
              initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="mx-auto mt-5 max-w-md text-xs leading-7 text-white/55 sm:text-sm sm:leading-8 md:mx-0 md:mt-7"
            >
              {isArabic
                ? "اكتشف عالمًا من الروائح الاستثنائية، حيث تلتقي الفخامة بالأصالة في كل قطرة."
                : "Discover a world of exceptional fragrances, where luxury meets authenticity in every drop."}
            </motion.p>

            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="mt-8 flex flex-col justify-center gap-3 sm:flex-row md:mt-10 md:justify-start md:gap-4"
            >
              <motion.a
                whileTap={{ scale: 0.97 }}
                href="#collection"
                className="w-full bg-[#c5a36a] px-7 py-3.5 text-center text-xs font-semibold tracking-wider text-black transition hover:bg-white sm:w-auto sm:px-8 sm:py-4"
              >
                {isArabic ? "اكتشف المجموعة" : "EXPLORE COLLECTION"}
              </motion.a>

              <motion.a
                whileTap={{ scale: 0.97 }}
                href="#about"
                className="w-full border border-white/25 px-7 py-3.5 text-center text-xs tracking-wider text-white transition hover:border-[#c5a36a] hover:text-[#c5a36a] sm:w-auto sm:px-8 sm:py-4"
              >
                {isArabic ? "اكتشف عالمنا" : "OUR STORY"}
              </motion.a>
            </motion.div>
          </div>

          {/* ANIMATED BRAND MARK (Compact on Mobile) */}
          <motion.div
            initial={
              shouldReduceMotion
                ? false
                : { opacity: 0, scale: 0.8, rotate: -8 }
            }
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 1.2, delay: 0.2, ease: "easeOut" }}
            className="relative order-1 mx-auto flex h-[250px] w-full max-w-xs items-center justify-center sm:h-[320px] sm:max-w-sm md:order-2 md:h-[420px] md:max-w-md"
          >
            <motion.div
              animate={
                shouldReduceMotion
                  ? {}
                  : { rotate: 360, scale: [1, 1.04, 1] }
              }
              transition={{
                rotate: { duration: 80, repeat: Infinity, ease: "linear" },
                scale: { duration: 5, repeat: Infinity, ease: "easeInOut" },
              }}
              className="absolute h-[220px] w-[220px] rounded-full border border-[#c5a36a]/20 sm:h-[280px] sm:w-[280px] md:h-[350px] md:w-[350px]"
            />

            <motion.div
              animate={
                shouldReduceMotion
                  ? {}
                  : { rotate: -360, opacity: [0.3, 0.8, 0.3] }
              }
              transition={{
                rotate: { duration: 65, repeat: Infinity, ease: "linear" },
                opacity: { duration: 5, repeat: Infinity },
              }}
              className="absolute h-[175px] w-[175px] rounded-full border border-[#c5a36a]/30 sm:h-[230px] sm:w-[230px] md:h-[290px] md:w-[290px]"
            />

            <motion.div
              animate={shouldReduceMotion ? {} : { y: [0, -10, 0] }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="relative flex w-full items-center justify-center px-4"
            >
              <img
                src="/logo.png"
                alt="بيت العود"
                className="h-auto w-full max-w-[190px] object-contain drop-shadow-[0_12px_35px_rgba(197,163,106,0.18)] sm:max-w-[250px] md:max-w-[340px]"
              />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* FEATURES */}
      <motion.section
        {...entrance}
        className="border-b border-white/10 bg-[#171512]"
      >
        <motion.div
          variants={shouldReduceMotion ? {} : stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-white/10 px-5 sm:px-6 md:grid-cols-3 md:divide-x md:divide-y-0"
        >
          {[
            ["✧", "Authentic Fragrances", "Original branded perfumes"],
            ["◇", "Unique Blends", "Personal fragrance creations"],
            ["♧", "Premium Quality", "A luxury experience in every detail"],
          ].map(([icon, title, subtitle]) => (
            <motion.div
              key={title}
              variants={reveal}
              className="flex items-center gap-4 px-4 py-5 transition-colors hover:bg-[#c5a36a]/5 sm:gap-5 sm:px-8 sm:py-8"
            >
              <span className="text-2xl text-[#c5a36a] sm:text-3xl">
                {icon}
              </span>
              <div>
                <h3 className="text-sm font-medium text-white">{title}</h3>
                <p className="mt-0.5 text-xs text-white/40 sm:mt-1">
                  {subtitle}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </motion.section>

      {/* DYNAMIC CATEGORIES */}
      {categories.length > 0 && (
        <motion.section
          id="categories"
          {...entrance}
          className="mx-auto max-w-7xl border-b border-white/10 px-5 py-14 sm:px-6 md:py-20"
        >
          <div className="mb-8 text-center md:mb-10">
            <p className="mb-2 text-[11px] tracking-[0.3em] text-[#c5a36a] md:mb-3 md:text-xs md:tracking-[0.35em]">
              {isArabic ? "تسوق حسب النوع" : "EXPLORE BY CATEGORY"}
            </p>

            <h2 className="font-serif text-2xl text-white sm:text-3xl md:text-4xl">
              {isArabic ? "تصنيفات العطور" : "Our Categories"}
            </h2>
          </div>

          <motion.div
            variants={shouldReduceMotion ? {} : stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.08 }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-3"
          >
            {categories.map((category) => (
              <motion.div key={category.id} variants={reveal}>
                <Link
                  href={`/products?category=${encodeURIComponent(
                    category.slug
                  )}`}
                  className="group flex min-h-28 items-center justify-between rounded-2xl border border-white/10 bg-[#181715] p-5 transition duration-300 hover:border-[#c5a36a]/60 hover:bg-[#211e19] sm:min-h-36 sm:p-7"
                >
                  <div>
                    <p className="mb-2 text-[10px] tracking-[0.3em] text-[#c5a36a] sm:mb-3">
                      BAIT AL OUD
                    </p>

                    <h3 className="font-serif text-xl text-white transition group-hover:text-[#c5a36a] sm:text-2xl">
                      {isArabic ? category.name_ar : category.name_en}
                    </h3>
                  </div>

                  <span className="text-2xl text-[#c5a36a] sm:text-3xl">
                    {isArabic ? "←" : "→"}
                  </span>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </motion.section>
      )}

      {/* CREATE YOUR OWN FRAGRANCE */}
      <motion.section
        {...entrance}
        className="relative overflow-hidden border-y border-[#c5a36a]/20 bg-[#181715] px-5 py-16 text-center sm:px-6 md:py-24"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(197,163,106,0.12),transparent_65%)]" />

        <div className="relative mx-auto max-w-3xl">
          <Sparkles
            size={28}
            className="mx-auto mb-4 text-[#c5a36a] sm:mb-6 sm:h-8 sm:w-8"
          />

          <p className="text-[11px] tracking-[0.35em] text-[#c5a36a] sm:text-xs sm:tracking-[0.4em]">
            {isArabic ? "تجربة عطرية فريدة" : "A UNIQUE FRAGRANCE EXPERIENCE"}
          </p>

          <h2 className="mt-4 font-serif text-3xl leading-tight text-white sm:mt-6 sm:text-4xl md:text-6xl">
            {isArabic ? (
              <>
                اصنع عطرك <span className="text-[#c5a36a]">الخاص</span>
              </>
            ) : (
              <>
                Create Your{" "}
                <span className="text-[#c5a36a]">Signature Scent</span>
              </>
            )}
          </h2>

          <p className="mx-auto mt-4 max-w-xl text-xs leading-7 text-white/50 sm:mt-6 sm:text-sm sm:leading-8">
            {isArabic
              ? "اختر العطور التي تحبها، وامزجها بطريقتك الخاصة. فريقنا سيحول فكرتك إلى تركيبة عطرية مميزة."
              : "Choose the fragrances you love and combine them your way. Our team will help turn your idea into a unique fragrance."}
          </p>

          <Link
            href="/custom-mix"
            className="mt-8 inline-flex w-full items-center justify-center gap-3 bg-[#c5a36a] px-8 py-3.5 text-xs font-semibold tracking-wider text-black transition hover:bg-white sm:mt-10 sm:w-auto sm:px-9 sm:py-4"
          >
            {isArabic ? "ابدأ تركيب عطرك" : "CREATE YOUR OWN MIX"}
            {isArabic ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
          </Link>
        </div>
      </motion.section>

      {/* COLLECTIONS */}
      <div id="collection">
        {loading ? (
          <div className="py-20 text-center text-sm text-[#c5a36a] md:py-28">
            <motion.div
              animate={shouldReduceMotion ? {} : { rotate: 360 }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "linear",
              }}
              className="mx-auto mb-4 h-7 w-7 rounded-full border-2 border-[#c5a36a]/20 border-t-[#c5a36a] sm:h-8 sm:w-8"
            />
            {isArabic ? "جاري تحميل العطور..." : "Loading fragrances..."}
          </div>
        ) : (
          <>
            <ProductSection
              title={isArabic ? "اختياراتنا المميزة" : "Featured Collection"}
              subtitle="CURATED FOR YOU"
              items={featuredProducts}
            />

            <div id="original" className="border-t border-white/10">
              <ProductSection
                title={isArabic ? "العطور الأصلية" : "Original Perfumes"}
                subtitle="AUTHENTIC COLLECTION"
                items={originalProducts}
              />
            </div>

            <div id="custom" className="border-t border-white/10">
              <ProductSection
                title={isArabic ? "عطورك الخاصة" : "Custom Perfumes"}
                subtitle="MADE FOR YOU"
                items={customProducts}
              />
            </div>

            {products.length === 0 && (
              <motion.div
                {...entrance}
                className="px-5 py-16 text-center md:py-24"
              >
                <p className="font-serif text-2xl text-white sm:text-3xl">
                  {isArabic ? "قريبًا..." : "Coming Soon"}
                </p>
                <p className="mt-2 text-xs text-white/40 sm:mt-3 sm:text-sm">
                  {isArabic
                    ? "نعمل على تجهيز مجموعتنا المميزة."
                    : "Our fragrance collection is being prepared."}
                </p>
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* ABOUT */}
      <motion.section
        id="about"
        {...entrance}
        className="border-y border-white/10 bg-[#171512] px-5 py-16 text-center sm:px-6 md:py-24"
      >
        <p className="text-[11px] tracking-[0.35em] text-[#c5a36a] sm:text-xs sm:tracking-[0.4em]">
          OUR PHILOSOPHY
        </p>

        <h2 className="mx-auto mt-4 max-w-2xl font-serif text-2xl leading-relaxed text-white sm:mt-6 sm:text-3xl md:text-5xl">
          {isArabic
            ? "الفخامة ليست مجرد رائحة، بل إحساس يبقى."
            : "Luxury is not just a fragrance. It is a feeling that stays."}
        </h2>

        <p className="mx-auto mt-4 max-w-xl text-xs leading-7 text-white/45 sm:mt-6 sm:text-sm sm:leading-8">
          {isArabic
            ? "في بيت العود، نؤمن أن لكل شخص بصمته الخاصة، ونقدم لك عطورًا تعبر عن شخصيتك."
            : "At Bait Al Oud, we believe every person has a signature. We bring you fragrances that express who you are."}
        </p>
      </motion.section>

      {/* FOOTER */}
      <motion.footer {...entrance} className="px-5 py-10 sm:px-6 md:py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 text-center md:flex-row md:text-start">
          <div className="flex justify-center md:justify-start">
            <img
              src="/logo.png"
              alt="بيت العود"
              className="h-auto w-28 object-contain sm:w-36"
            />
          </div>

          <p className="text-xs text-white/35">
            © 2026 Bait Al Oud. All rights reserved.
          </p>
        </div>
      </motion.footer>
    </main>
  );
}