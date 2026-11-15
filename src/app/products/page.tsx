
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  category_id: string | null;
  image_url: string | null;
  is_featured: boolean;
};

type Variant = {
  product_id: string;
  size_ml: number;
  price: number;
  stock: number;
};

type Category = {
  id: string;
  name_en: string;
  name_ar: string;
  slug: string;
};

type FilterType = "all" | "original" | "custom";
type SortType = "newest" | "price-low" | "price-high";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("newest");
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [categorySlug, setCategorySlug] = useState<string | null>(null);

  const isArabic = language === "ar";
  const shouldReduceMotion = useReducedMotion();

  // Read category from URL
  useEffect(() => {
    const readCategoryFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      setCategorySlug(params.get("category"));
    };

    readCategoryFromUrl();

    window.addEventListener("popstate", readCategoryFromUrl);

    return () => {
      window.removeEventListener("popstate", readCategoryFromUrl);
    };
  }, []);

  // Select category and update URL
  function selectCategory(slug: string | null) {
    setCategorySlug(slug);

    const url = slug
      ? `/products?category=${encodeURIComponent(slug)}`
      : "/products";

    window.history.pushState({}, "", url);
  }

  // Load products and categories from Supabase
  useEffect(() => {
    async function loadProducts() {
      const supabase = createClient();

      const [
        { data: productData, error: productError },
        { data: categoryData, error: categoryError },
      ] = await Promise.all([
        supabase
          .from("products")
          .select(
            "id, name_en, name_ar, slug, description_en, description_ar, product_type, category_id, image_url, is_featured"
          )
          .eq("is_active", true)
          .order("created_at", { ascending: false }),

        supabase
          .from("categories")
          .select("id, name_en, name_ar, slug")
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
      ]);

      if (productError) {
        console.error("Products loading error:", productError.message);
        setLoading(false);
        return;
      }

      if (categoryError) {
        console.error("Categories loading error:", categoryError.message);
      } else {
        setCategories((categoryData || []) as Category[]);
      }

      const items = (productData || []) as Product[];
      setProducts(items);

      if (items.length > 0) {
        const { data: variantData, error: variantError } = await supabase
          .from("product_variants")
          .select("product_id, size_ml, price, stock")
          .in(
            "product_id",
            items.map((item) => item.id)
          )
          .eq("is_active", true);

        if (variantError) {
          console.error("Variants loading error:", variantError.message);
        } else {
          setVariants((variantData || []) as Variant[]);
        }
      }

      setLoading(false);
    }

    loadProducts();
  }, []);

  // Find selected category
  const selectedCategory = categories.find(
    (category) => category.slug === categorySlug
  );

  // Get the lowest product price
  const getProductPrice = (productId: string) => {
    const productVariants = variants.filter(
      (variant) => variant.product_id === productId
    );

    if (!productVariants.length) return null;

    return Math.min(
      ...productVariants.map((variant) => Number(variant.price))
    );
  };

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Filter by category
    if (categorySlug) {
      const selected = categories.find(
        (category) => category.slug === categorySlug
      );

      if (selected) {
        result = result.filter(
          (product) => product.category_id === selected.id
        );
      } else {
        result = [];
      }
    }

    // Filter by product type
    if (filter !== "all") {
      result = result.filter(
        (product) => product.product_type === filter
      );
    }

    // Search
    const searchTerm = search.trim().toLowerCase();

    if (searchTerm) {
      result = result.filter((product) => {
        const nameEn = product.name_en?.toLowerCase() || "";
        const nameAr = product.name_ar?.toLowerCase() || "";

        return (
          nameEn.includes(searchTerm) ||
          nameAr.includes(searchTerm)
        );
      });
    }

    // Sort
    if (sort === "price-low") {
      result.sort((a, b) => {
        const priceA = getProductPrice(a.id) ?? Infinity;
        const priceB = getProductPrice(b.id) ?? Infinity;
        return priceA - priceB;
      });
    }

    if (sort === "price-high") {
      result.sort((a, b) => {
        const priceA = getProductPrice(a.id) ?? -Infinity;
        const priceB = getProductPrice(b.id) ?? -Infinity;
        return priceB - priceA;
      });
    }

    return result;
  }, [products, variants, categories, categorySlug, filter, search, sort]);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat(isArabic ? "ar-EG" : "en-US").format(price);

  const filters: { value: FilterType; label: string }[] = [
    {
      value: "all",
      label: isArabic ? "كل العطور" : "All Products",
    },
    {
      value: "original",
      label: isArabic ? "العطور الأصلية" : "Original",
    },
    {
      value: "custom",
      label: isArabic ? "العطور المخصصة" : "Custom",
    },
  ];

  // Clear all filters
  const clearFilters = () => {
    setSearch("");
    setFilter("all");
    selectCategory(null);
  };

  // Motion Variants
  const reveal = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 30,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.65,
        ease: "easeOut" as const,
      },
    },
  };

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

            <Link href="/products" className="text-[#c5a36a]">
              {isArabic ? "العطور" : "Collection"}
            </Link>

            <Link
              href="/#about"
              className="transition hover:text-[#c5a36a]"
            >
              {isArabic ? "عن البراند" : "About Us"}
            </Link>
          </div>

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
        </nav>
      </header>

      {/* PAGE HERO */}
      <section className="relative overflow-hidden border-b border-white/10 px-6 py-24 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(197,163,106,0.15),transparent_65%)]" />

        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9 }}
          className="relative mx-auto max-w-3xl"
        >
          <p className="text-xs tracking-[0.5em] text-[#c5a36a]">
            BAIT AL OUD COLLECTION
          </p>

          <h1 className="mt-6 font-serif text-5xl text-white md:text-7xl">
            {selectedCategory ? (
              <>
                {isArabic
                  ? selectedCategory.name_ar
                  : selectedCategory.name_en}
              </>
            ) : isArabic ? (
              <>
                عالم من <span className="text-[#c5a36a]">العطور</span>
              </>
            ) : (
              <>
                Our <span className="text-[#c5a36a]">Collection</span>
              </>
            )}
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-sm leading-8 text-white/50">
            {selectedCategory
              ? isArabic
                ? `اكتشف مجموعتنا من ${selectedCategory.name_ar}.`
                : `Explore our ${selectedCategory.name_en} collection.`
              : isArabic
                ? "اكتشف مجموعتنا المختارة من العطور الأصلية والتركيبات الخاصة."
                : "Explore our curated collection of authentic fragrances and unique custom creations."}
          </p>
        </motion.div>
      </section>

      {/* PRODUCTS */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        {/* CATEGORY FILTERS */}
        {categories.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => selectCategory(null)}
              className={`rounded-xl border px-5 py-3 text-xs transition-all ${
                !categorySlug
                  ? "border-[#c5a36a] bg-[#c5a36a] text-black"
                  : "border-white/10 bg-[#181715] text-white/60 hover:border-[#c5a36a]/60 hover:text-[#c5a36a]"
              }`}
            >
              {isArabic ? "كل الأقسام" : "All Categories"}
            </button>

            {categories.map((category) => (
              <button
                type="button"
                key={category.id}
                onClick={() => selectCategory(category.slug)}
                className={`rounded-xl border px-5 py-3 text-xs transition-all ${
                  categorySlug === category.slug
                    ? "border-[#c5a36a] bg-[#c5a36a] text-black"
                    : "border-white/10 bg-[#181715] text-white/60 hover:border-[#c5a36a]/60 hover:text-[#c5a36a]"
                }`}
              >
                {isArabic ? category.name_ar : category.name_en}
              </button>
            ))}
          </div>
        )}

        {/* FILTER BAR */}
        <div className="mb-10 flex flex-col gap-5 rounded-2xl border border-white/10 bg-[#181715] p-5 lg:flex-row lg:items-center lg:justify-between">
          {/* SEARCH */}
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-white/40">
              ⌕
            </span>

            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                isArabic ? "ابحث عن عطرك..." : "Search fragrances..."
              }
              className="w-full rounded-xl border border-white/10 bg-[#100f0d] py-4 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#c5a36a]/70"
            />
          </div>

          {/* PRODUCT TYPE FILTERS */}
          <div className="flex flex-wrap gap-2">
            {filters.map((item) => (
              <button
                type="button"
                key={item.value}
                onClick={() => setFilter(item.value)}
                className={`rounded-xl border px-5 py-3 text-xs transition-all duration-300 ${
                  filter === item.value
                    ? "border-[#c5a36a] bg-[#c5a36a] text-black"
                    : "border-white/10 bg-[#100f0d] text-white/60 hover:border-[#c5a36a]/60 hover:text-[#c5a36a]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* SORT */}
          <select
            value={sort}
            onChange={(event) =>
              setSort(event.target.value as SortType)
            }
            className="rounded-xl border border-white/10 bg-[#100f0d] px-4 py-3 text-xs text-white/70 outline-none focus:border-[#c5a36a]"
          >
            <option value="newest">
              {isArabic ? "الأحدث أولاً" : "Newest First"}
            </option>
            <option value="price-low">
              {isArabic
                ? "السعر: من الأقل للأعلى"
                : "Price: Low to High"}
            </option>
            <option value="price-high">
              {isArabic
                ? "السعر: من الأعلى للأقل"
                : "Price: High to Low"}
            </option>
          </select>
        </div>

        {/* RESULTS COUNT */}
        <div className="mb-8 flex items-center justify-between">
          <p className="text-sm text-white/50">
            {isArabic
              ? `${filteredProducts.length} عطر`
              : `${filteredProducts.length} fragrances`}
          </p>

          {(search || filter !== "all" || categorySlug) && (
            <button
              onClick={clearFilters}
              className="text-xs text-[#c5a36a] hover:text-white"
            >
              {isArabic ? "مسح الفلاتر" : "Clear Filters"}
            </button>
          )}
        </div>

        {/* LOADING */}
        {loading && (
          <div className="flex min-h-[300px] flex-col items-center justify-center">
            <motion.div
              animate={shouldReduceMotion ? {} : { rotate: 360 }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "linear",
              }}
              className="mb-5 h-10 w-10 rounded-full border-2 border-[#c5a36a]/20 border-t-[#c5a36a]"
            />

            <p className="text-sm text-[#c5a36a]">
              {isArabic ? "جاري تحميل العطور..." : "Loading collection..."}
            </p>
          </div>
        )}

        {/* PRODUCT GRID */}
        {!loading && filteredProducts.length > 0 && (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: {
                transition: {
                  staggerChildren: shouldReduceMotion ? 0 : 0.12,
                },
              },
            }}
            className="grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3"
          >
            {filteredProducts.map((product) => {
              const productVariants = variants.filter(
                (variant) => variant.product_id === product.id
              );

              const lowestPrice = getProductPrice(product.id);

              return (
                <motion.article
                  key={product.id}
                  layout
                  variants={reveal}
                  whileHover={shouldReduceMotion ? {} : { y: -8 }}
                  transition={{ duration: 0.3 }}
                  className="group overflow-hidden rounded-2xl border border-white/10 bg-[#181715] transition-colors duration-500 hover:border-[#c5a36a]/50"
                >
                  <Link href={`/products/${product.slug}`}>
                    <div className="relative aspect-[4/5] overflow-hidden bg-[#211e19]">
                      {product.image_url ? (
                        <motion.img
                          src={product.image_url}
                          alt={
                            isArabic
                              ? product.name_ar
                              : product.name_en
                          }
                          className="h-full w-full object-cover"
                          whileHover={
                            shouldReduceMotion ? {} : { scale: 1.08 }
                          }
                          transition={{ duration: 0.8 }}
                        />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-4 text-[#c5a36a]/50">
                          <span className="text-6xl">✧</span>
                          <span className="text-xs tracking-[0.3em]">
                            BAIT AL OUD
                          </span>
                        </div>
                      )}

                      {product.is_featured && (
                        <span className="absolute left-4 top-4 rounded-full bg-[#c5a36a] px-3 py-2 text-[9px] font-semibold tracking-wider text-black">
                          FEATURED
                        </span>
                      )}

                      <div className="absolute bottom-0 left-0 right-0 translate-y-full bg-black/75 px-5 py-4 text-center text-xs tracking-widest text-[#dfc18b] backdrop-blur-sm transition-transform duration-500 group-hover:translate-y-0">
                        {isArabic ? "اكتشف العطر" : "DISCOVER FRAGRANCE"}
                      </div>
                    </div>

                    <div className="p-5">
                      <p className="mb-3 text-[10px] uppercase tracking-[0.25em] text-[#c5a36a]">
                        {product.product_type === "original"
                          ? "ORIGINAL COLLECTION"
                          : "CUSTOM COLLECTION"}
                      </p>

                      <h2 className="text-lg text-white transition-colors group-hover:text-[#c5a36a]">
                        {isArabic
                          ? product.name_ar
                          : product.name_en}
                      </h2>

                      <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-6 text-white/40">
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
                          <span className="ml-1 text-xs text-white/40">
                            EGP
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-white/40">
                          {isArabic
                            ? "السعر غير متاح"
                            : "Price unavailable"}
                        </span>
                      )}
                    </div>

                    <span className="text-[10px] text-white/40">
                      {productVariants.length > 0
                        ? isArabic
                          ? `${productVariants.length} أحجام متاحة`
                          : `${productVariants.length} sizes`
                        : isArabic
                          ? "لا توجد أحجام"
                          : "No sizes"}
                    </span>
                  </div>
                </motion.article>
              );
            })}
          </motion.div>
        )}

        {/* EMPTY STATE */}
        {!loading && filteredProducts.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex min-h-[350px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#181715] px-6 text-center"
          >
            <span className="text-5xl text-[#c5a36a]/60">✧</span>

            <h2 className="mt-6 font-serif text-2xl text-white">
              {isArabic ? "لم نجد أي عطور" : "No Fragrances Found"}
            </h2>

            <p className="mt-3 text-sm text-white/40">
              {isArabic
                ? "جرب البحث باسم مختلف أو تغيير الفلاتر."
                : "Try another search term or change your filters."}
            </p>

            <button
              onClick={clearFilters}
              className="mt-7 bg-[#c5a36a] px-7 py-3 text-xs font-semibold text-black transition hover:bg-white"
            >
              {isArabic ? "عرض كل العطور" : "VIEW ALL PRODUCTS"}
            </button>
          </motion.div>
        )}
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
