
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

const reveal = {
  hidden: { opacity: 0, y: 45 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: "easeOut" as const },
  },
};

const stagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.16,
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

  const isArabic = language === "ar";
  const shouldReduceMotion = useReducedMotion();

  const heroRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const heroY = useTransform(scrollYProgress, [0, 1], [0, 130]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.2]);

  useEffect(() => {
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
          .in("product_id", items.map((item) => item.id))
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

  const featuredProducts = products.filter((p) => p.is_featured);

  const originalProducts = products.filter(
    (p) => p.product_type === "original"
  );

  const customProducts = products.filter(
    (p) => p.product_type === "custom"
  );

  const formatPrice = (price: number) =>
    new Intl.NumberFormat(isArabic ? "ar-EG" : "en-US").format(price);

  const entrance = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 35 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.15 },
        transition: { duration: 0.8, ease: "easeOut" as const },
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
                y: -9,
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
                whileHover={shouldReduceMotion ? {} : { scale: 1.08 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            ) : (
              <motion.div
                className="flex flex-col items-center gap-3 text-[#c5a36a]/50"
                whileHover={shouldReduceMotion ? {} : { scale: 1.08 }}
              >
                <span className="text-5xl">✧</span>
                <span className="text-xs tracking-[0.3em]">
                  BAIT AL OUD
                </span>
              </motion.div>
            )}

            {product.is_featured && (
              <span className="absolute left-4 top-4 rounded-full bg-[#c5a36a] px-3 py-1 text-[10px] font-semibold tracking-wider text-black">
                {isArabic ? "مميز" : "FEATURED"}
              </span>
            )}

            <motion.div
              initial={{ opacity: 0 }}
              whileHover={{ opacity: 1 }}
              className="absolute inset-0 flex items-center justify-center bg-black/30"
            >
              <span className="border border-white/70 px-5 py-3 text-xs tracking-widest text-white">
                {isArabic ? "اكتشف العطر" : "DISCOVER"}
              </span>
            </motion.div>
          </div>

          <div className="p-5">
            <p className="mb-2 text-[10px] uppercase tracking-[0.25em] text-[#c5a36a]">
              {product.product_type === "original"
                ? "Original Collection"
                : "Custom Collection"}
            </p>

            <h3 className="text-lg text-white">
              {isArabic ? product.name_ar : product.name_en}
            </h3>

            <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-6 text-white/45">
              {(isArabic
                ? product.description_ar
                : product.description_en) || ""}
            </p>
          </div>
        </Link>

        <div className="flex items-center justify-between border-t border-white/10 px-5 py-4">
          <div>
            {lowestPrice !== null ? (
              <>
                <span className="text-lg font-semibold text-[#c5a36a]">
                  {formatPrice(lowestPrice)}
                </span>
                <span className="ml-1 text-xs text-white/40">EGP</span>
              </>
            ) : (
              <span className="text-sm text-white/40">
                {isArabic ? "السعر غير متاح" : "Price unavailable"}
              </span>
            )}
          </div>

          <motion.button
            whileHover={shouldReduceMotion ? {} : { scale: 1.05 }}
            whileTap={shouldReduceMotion ? {} : { scale: 0.95 }}
            onClick={() => setCartCount((count) => count + 1)}
            className="rounded-full border border-[#c5a36a]/50 px-4 py-2 text-xs text-[#c5a36a] transition hover:bg-[#c5a36a] hover:text-black"
          >
            {isArabic ? "أضف للسلة" : "Add to cart"}
          </motion.button>
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
        className="mx-auto max-w-7xl px-6 py-20"
      >
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-3 text-xs tracking-[0.35em] text-[#c5a36a]">
              {subtitle}
            </p>

            <h2 className="font-serif text-3xl text-white md:text-4xl">
              {title}
            </h2>
          </div>

          <Link
            href="/products"
            className="text-sm text-[#c5a36a] transition hover:text-white"
          >
            {isArabic ? "عرض الكل ←" : "View All →"}
          </Link>
        </div>

        <motion.div
          variants={shouldReduceMotion ? {} : stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
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
      className="min-h-screen overflow-hidden bg-[#100f0d] text-white"
    >
      {/* NAVBAR */}
      <motion.header
        initial={shouldReduceMotion ? false : { opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="sticky top-0 z-50 border-b border-white/10 bg-[#100f0d]/95 backdrop-blur-xl"
      >
        <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <Link href="/" aria-label="Bait Al Oud" className="flex shrink-0 items-center">
            <img
              src="/logo.png"
              alt="بيت العود"
              className="h-14 w-auto max-w-[150px] object-contain sm:h-16"
            />
          </Link>

          <div className="hidden items-center gap-9 text-sm text-white/65 md:flex">
            <a href="#home" className="transition hover:text-[#c5a36a]">
              {isArabic ? "الرئيسية" : "Home"}
            </a>

            <a href="#categories" className="transition hover:text-[#c5a36a]">
              {isArabic ? "التصنيفات" : "Categories"}
            </a>

            <a href="#original" className="transition hover:text-[#c5a36a]">
              {isArabic ? "العطور الأصلية" : "Original Perfumes"}
            </a>

            <a href="#custom" className="transition hover:text-[#c5a36a]">
              {isArabic ? "العطور المخصصة" : "Custom Perfumes"}
            </a>

            <Link
              href="/custom-mix"
              className="transition text-[#c5a36a] hover:text-white"
            >
              {isArabic ? "ركّب عطرك" : "Create Your Mix"}
            </Link>

            <a href="#about" className="transition hover:text-[#c5a36a]">
              {isArabic ? "عن البراند" : "About Us"}
            </a>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() =>
                setLanguage((current) => current === "en" ? "ar" : "en")
              }
              className="text-xs text-[#c5a36a] hover:text-white"
            >
              {isArabic ? "English" : "العربية"}
            </button>

            <motion.button
              whileHover={shouldReduceMotion ? {} : { scale: 1.15 }}
              whileTap={shouldReduceMotion ? {} : { scale: 0.9 }}
              className="relative text-sm text-white"
              aria-label="Shopping cart"
            >
              ♧
              {cartCount > 0 && (
                <span className="absolute -right-3 -top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#c5a36a] text-[10px] text-black">
                  {cartCount}
                </span>
              )}
            </motion.button>
          </div>
        </nav>
      </motion.header>

      {/* HERO */}
      <section
        ref={heroRef}
        id="home"
        className="relative flex min-h-[650px] items-center overflow-hidden border-b border-white/10"
      >
        <motion.div
          style={
            shouldReduceMotion
              ? {}
              : { y: heroY, opacity: heroOpacity }
          }
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_75%_50%,rgba(160,112,48,0.2),transparent_55%)]"
        />

        <motion.div
          animate={
            shouldReduceMotion
              ? {}
              : {
                  scale: [1, 1.08, 1],
                  opacity: [0.35, 0.75, 0.35],
                }
          }
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          className="absolute right-[-10%] top-[-20%] h-[600px] w-[600px] rounded-full border border-[#c5a36a]/10"
        />

        <motion.div
          animate={
            shouldReduceMotion
              ? {}
              : {
                  rotate: [0, 360],
                }
          }
          transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
          className="absolute right-[-5%] top-[-10%] h-[500px] w-[500px] rounded-full border border-[#c5a36a]/10"
        />

        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-12 px-6 py-24 md:grid-cols-2">
          <div className="max-w-xl">
            <motion.p
              initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mb-6 text-xs tracking-[0.45em] text-[#c5a36a]"
            >
              {isArabic ? "فن العطور الفاخرة" : "THE ART OF LUXURY FRAGRANCE"}
            </motion.p>

            <motion.h1
              initial={
                shouldReduceMotion
                  ? false
                  : { opacity: 0, y: 55, filter: "blur(12px)" }
              }
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="font-serif text-5xl leading-tight text-white md:text-7xl"
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
              initial={shouldReduceMotion ? false : { opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.5 }}
              className="mt-7 max-w-md text-sm leading-8 text-white/55"
            >
              {isArabic
                ? "اكتشف عالمًا من الروائح الاستثنائية، حيث تلتقي الفخامة بالأصالة في كل قطرة."
                : "Discover a world of exceptional fragrances, where luxury meets authenticity in every drop."}
            </motion.p>

            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.8 }}
              className="mt-10 flex flex-wrap gap-4"
            >
              <motion.a
                whileHover={shouldReduceMotion ? {} : { y: -5, scale: 1.03 }}
                whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
                href="#collection"
                className="bg-[#c5a36a] px-8 py-4 text-xs font-semibold tracking-wider text-black transition hover:bg-white"
              >
                {isArabic ? "اكتشف المجموعة" : "EXPLORE COLLECTION"}
              </motion.a>

              <motion.a
                whileHover={shouldReduceMotion ? {} : { y: -5 }}
                href="#about"
                className="border border-white/25 px-8 py-4 text-xs tracking-wider text-white transition hover:border-[#c5a36a] hover:text-[#c5a36a]"
              >
                {isArabic ? "اكتشف عالمنا" : "OUR STORY"}
              </motion.a>
            </motion.div>
          </div>

          {/* ANIMATED BRAND MARK */}
          <motion.div
            initial={
              shouldReduceMotion
                ? false
                : { opacity: 0, scale: 0.7, rotate: -12 }
            }
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 1.4, delay: 0.3, ease: "easeOut" }}
            className="relative mx-auto flex h-[420px] w-full max-w-md items-center justify-center"
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
              className="absolute h-[350px] w-[350px] rounded-full border border-[#c5a36a]/20"
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
              className="absolute h-[290px] w-[290px] rounded-full border border-[#c5a36a]/30"
            />

            <motion.div
              animate={shouldReduceMotion ? {} : { y: [0, -13, 0] }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="relative flex w-full items-center justify-center px-5"
            >
              <img
                src="/logo.png"
                alt="بيت العود"
                className="h-auto w-full max-w-[340px] object-contain drop-shadow-[0_12px_35px_rgba(197,163,106,0.18)]"
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
          className="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-white/10 px-6 md:grid-cols-3 md:divide-x md:divide-y-0"
        >
          {[
            ["✧", "Authentic Fragrances", "Original branded perfumes"],
            ["◇", "Unique Blends", "Personal fragrance creations"],
            ["♧", "Premium Quality", "A luxury experience in every detail"],
          ].map(([icon, title, subtitle]) => (
            <motion.div
              key={title}
              variants={reveal}
              whileHover={shouldReduceMotion ? {} : { y: -5 }}
              className="flex items-center gap-5 px-8 py-8 transition-colors hover:bg-[#c5a36a]/5"
            >
              <span className="text-3xl text-[#c5a36a]">{icon}</span>
              <div>
                <h3 className="text-sm text-white">{title}</h3>
                <p className="mt-1 text-xs text-white/40">{subtitle}</p>
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
          className="mx-auto max-w-7xl border-b border-white/10 px-6 py-20"
        >
          <div className="mb-10 text-center">
            <p className="mb-3 text-xs tracking-[0.35em] text-[#c5a36a]">
              {isArabic ? "تسوق حسب النوع" : "EXPLORE BY CATEGORY"}
            </p>

            <h2 className="font-serif text-3xl text-white md:text-4xl">
              {isArabic ? "تصنيفات العطور" : "Our Categories"}
            </h2>
          </div>

          <motion.div
            variants={shouldReduceMotion ? {} : stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {categories.map((category) => (
              <motion.div
                key={category.id}
                variants={reveal}
                whileHover={shouldReduceMotion ? {} : { y: -6 }}
              >
                <Link
                  href={`/products?category=${encodeURIComponent(category.slug)}`}
                  className="group flex min-h-36 items-center justify-between rounded-2xl border border-white/10 bg-[#181715] p-7 transition duration-300 hover:border-[#c5a36a]/60 hover:bg-[#211e19]"
                >
                  <div>
                    <p className="mb-3 text-[10px] tracking-[0.3em] text-[#c5a36a]">
                      BAIT AL OUD
                    </p>

                    <h3 className="font-serif text-2xl text-white transition group-hover:text-[#c5a36a]">
                      {isArabic ? category.name_ar : category.name_en}
                    </h3>
                  </div>

                  <span className="text-3xl text-[#c5a36a]">
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
        className="relative overflow-hidden border-y border-[#c5a36a]/20 bg-[#181715] px-6 py-24 text-center"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(197,163,106,0.12),transparent_65%)]" />

        <div className="relative mx-auto max-w-3xl">
          <Sparkles
            size={32}
            className="mx-auto mb-6 text-[#c5a36a]"
          />

          <p className="text-xs tracking-[0.4em] text-[#c5a36a]">
            {isArabic ? "تجربة عطرية فريدة" : "A UNIQUE FRAGRANCE EXPERIENCE"}
          </p>

          <h2 className="mt-6 font-serif text-4xl leading-tight text-white md:text-6xl">
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

          <p className="mx-auto mt-6 max-w-xl text-sm leading-8 text-white/50">
            {isArabic
              ? "اختر العطور التي تحبها، وامزجها بطريقتك الخاصة. فريقنا سيحول فكرتك إلى تركيبة عطرية مميزة."
              : "Choose the fragrances you love and combine them your way. Our team will help turn your idea into a unique fragrance."}
          </p>

          <Link
            href="/custom-mix"
            className="mt-10 inline-flex items-center gap-3 bg-[#c5a36a] px-9 py-4 text-xs font-semibold tracking-wider text-black transition hover:bg-white"
          >
            {isArabic ? "ابدأ تركيب عطرك" : "CREATE YOUR OWN MIX"}
            {isArabic ? <ArrowLeft size={17} /> : <ArrowRight size={17} />}
          </Link>
        </div>
      </motion.section>

      {/* COLLECTIONS */}
      <div id="collection">
        {loading ? (
          <div className="py-28 text-center text-[#c5a36a]">
            <motion.div
              animate={shouldReduceMotion ? {} : { rotate: 360 }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "linear",
              }}
              className="mx-auto mb-5 h-8 w-8 rounded-full border-2 border-[#c5a36a]/20 border-t-[#c5a36a]"
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
                className="py-24 text-center"
              >
                <p className="font-serif text-3xl text-white">
                  {isArabic ? "قريبًا..." : "Coming Soon"}
                </p>
                <p className="mt-3 text-sm text-white/40">
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
        className="border-y border-white/10 bg-[#171512] px-6 py-24 text-center"
      >
        <motion.p
          initial={shouldReduceMotion ? false : { opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-xs tracking-[0.4em] text-[#c5a36a]"
        >
          OUR PHILOSOPHY
        </motion.p>

        <motion.h2
          initial={
            shouldReduceMotion
              ? false
              : { opacity: 0, y: 35, filter: "blur(8px)" }
          }
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="mx-auto mt-6 max-w-2xl font-serif text-3xl leading-relaxed text-white md:text-5xl"
        >
          {isArabic
            ? "الفخامة ليست مجرد رائحة، بل إحساس يبقى."
            : "Luxury is not just a fragrance. It is a feeling that stays."}
        </motion.h2>

        <motion.p
          initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mx-auto mt-6 max-w-xl text-sm leading-8 text-white/45"
        >
          {isArabic
            ? "في بيت العود، نؤمن أن لكل شخص بصمته الخاصة، ونقدم لك عطورًا تعبر عن شخصيتك."
            : "At Bait Al Oud, we believe every person has a signature. We bring you fragrances that express who you are."}
        </motion.p>
      </motion.section>

      {/* FOOTER */}
      <motion.footer
        {...entrance}
        className="px-6 py-12"
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex justify-center md:justify-start">
            <img
              src="/logo.png"
              alt="بيت العود"
              className="h-auto w-36 object-contain"
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
