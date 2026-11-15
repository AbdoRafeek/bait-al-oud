
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Package,
  ArrowLeft,
  RefreshCw,
  Eye,
  Pencil,
  Trash2,
  X,
  Save,
  Loader2,
  ImagePlus,
  Upload,
  CheckCircle2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Product = {
  id: string;
  name_en: string;
  name_ar: string;
  slug: string;
  description_en: string | null;
  description_ar: string | null;
  product_type: "original" | "custom";
  category_id: string | null;
  image_url: string | null;
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
};

type Category = {
  id: string;
  name_en: string;
  name_ar: string;
};

type ProductVariant = {
  id?: string;
  size_ml: number | string;
  price: number | string;
  stock: number | string;
  is_active: boolean;
};

type EditForm = {
  name_en: string;
  name_ar: string;
  slug: string;
  description_en: string;
  description_ar: string;
  product_type: "original" | "custom";
  category_id: string;
  image_url: string;
  is_active: boolean;
  is_featured: boolean;
};

const emptyForm: EditForm = {
  name_en: "",
  name_ar: "",
  slug: "",
  description_en: "",
  description_ar: "",
  product_type: "original",
  category_id: "",
  image_url: "",
  is_active: true,
  is_featured: false,
};

export default function ProductsPage() {
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingProduct, setEditingProduct] =
    useState<Product | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(emptyForm);
  const [editVariants, setEditVariants] = useState<ProductVariant[]>([]);
  const [variantsLoading, setVariantsLoading] = useState(false);

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [removeCurrentImage, setRemoveCurrentImage] = useState(false);

  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [message, setMessage] = useState("");

  const inputClass =
    "w-full bg-[#11100F] border border-white/10 rounded-lg p-3 text-white outline-none focus:border-[#C6A568] transition";

  // Load products and categories
  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();

      const [
        { data, error: productsError },
        { data: categoryData, error: categoriesError },
      ] = await Promise.all([
        supabase
          .from("products")
          .select(
            "id, name_en, name_ar, slug, description_en, description_ar, product_type, category_id, image_url, is_active, is_featured, created_at"
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("categories")
          .select("id, name_en, name_ar")
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
      ]);

      if (productsError) throw productsError;

      if (categoriesError) {
        console.error(categoriesError);
      } else {
        setCategories((categoryData ?? []) as Category[]);
      }

      setProducts((data ?? []) as Product[]);
    } catch (err) {
      console.error("Products loading error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Could not load products."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  // Search and filters
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const query = search.trim().toLowerCase();

      const matchesSearch =
        product.name_en.toLowerCase().includes(query) ||
        product.name_ar.includes(search.trim()) ||
        product.slug.toLowerCase().includes(query);

      const matchesType =
        filter === "all" || product.product_type === filter;

      return matchesSearch && matchesType;
    });
  }, [products, search, filter]);

  const originalCount = products.filter(
    (p) => p.product_type === "original"
  ).length;

  const customCount = products.filter(
    (p) => p.product_type === "custom"
  ).length;

  // Open edit modal and load sizes, prices and stock
  async function openEdit(product: Product) {
    setEditingProduct(product);
    setVariantsLoading(true);
    setEditVariants([]);
    setMessage("");

    setEditForm({
      name_en: product.name_en || "",
      name_ar: product.name_ar || "",
      slug: product.slug || "",
      description_en: product.description_en || "",
      description_ar: product.description_ar || "",
      product_type: product.product_type,
      category_id: product.category_id || "",
      image_url: product.image_url || "",
      is_active: product.is_active,
      is_featured: product.is_featured,
    });

    setSelectedImage(null);
    setImagePreview("");
    setRemoveCurrentImage(false);

    try {
      const supabase = createClient();
      const { data, error: variantsError } = await supabase
        .from("product_variants")
        .select("id, size_ml, price, stock, is_active")
        .eq("product_id", product.id)
        .order("size_ml", { ascending: true });

      if (variantsError) throw variantsError;
      setEditVariants((data || []).map((v) => ({
        id: v.id,
        size_ml: v.size_ml,
        price: v.price,
        stock: v.stock,
        is_active: v.is_active,
      })));
    } catch (err) {
      console.error("Variant loading error:", err);
      setMessage(err instanceof Error ? err.message : "Could not load product sizes.");
    } finally {
      setVariantsLoading(false);
    }
  }

  function updateVariant(index: number, field: keyof ProductVariant, value: string | boolean) {
    setEditVariants((current) => current.map((v, i) =>
      i === index ? { ...v, [field]: value } : v
    ));
  }

  function addVariant() {
    setEditVariants((current) => [...current, {
      size_ml: "", price: "", stock: 0, is_active: true,
    }]);
  }

  function removeVariant(index: number) {
    setEditVariants((current) => current.map((v, i) =>
      i === index ? { ...v, is_active: false } : v
    ));
  }

  // Close edit modal and clean preview
  function closeEdit() {
    if (saving || uploadingImage) return;

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setEditingProduct(null);
    setSelectedImage(null);
    setImagePreview("");
    setRemoveCurrentImage(false);
    setEditVariants([]);
    setMessage("");
  }

  // Select image from device
  function selectProductImage(file?: File) {
    if (!file) return;

    setMessage("");

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setMessage("Only JPG, PNG and WebP images are allowed.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("Image must be smaller than 5 MB.");
      return;
    }

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
    setRemoveCurrentImage(false);
  }

  // Remove selected or current image
  function removeImage() {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setSelectedImage(null);
    setImagePreview("");
    setRemoveCurrentImage(true);

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  }

  // Upload image to existing Cloudinary API
  async function uploadProductImage(): Promise<string> {
    if (!selectedImage) return editForm.image_url;

    setUploadingImage(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedImage);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success || !result.imageUrl) {
        throw new Error(result.error || "Image upload failed.");
      }

      return result.imageUrl;
    } finally {
      setUploadingImage(false);
    }
  }

  // Update product
  async function handleUpdate(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (!editingProduct) return;
    const editingProductId = editingProduct.id;

    setMessage("");

    if (
      !editForm.name_en.trim() ||
      !editForm.name_ar.trim() ||
      !editForm.slug.trim()
    ) {
      setMessage("Please complete the product names and slug.");
      return;
    }

    if (!editForm.category_id) {
      setMessage("Please select a product category.");
      return;
    }

    const activeVariants = editVariants.filter((v) => v.is_active);
    if (!activeVariants.length || activeVariants.some((v) =>
      !Number.isInteger(Number(v.size_ml)) || Number(v.size_ml) <= 0 ||
      !Number.isFinite(Number(v.price)) || Number(v.price) <= 0 ||
      !Number.isInteger(Number(v.stock)) || Number(v.stock) < 0
    )) {
      setMessage("Add at least one valid size. Price must be greater than 0 and stock cannot be negative.");
      return;
    }
    const sizes = activeVariants.map((v) => Number(v.size_ml));
    if (new Set(sizes).size !== sizes.length) {
      setMessage("Each product size must be unique.");
      return;
    }

    setSaving(true);

    try {
      // Upload the new image first, if selected
      const uploadedImageUrl = selectedImage
        ? await uploadProductImage()
        : removeCurrentImage
          ? null
          : editForm.image_url.trim() || null;

      const supabase = createClient();

      const { error: updateError } = await supabase
        .from("products")
        .update({
          name_en: editForm.name_en.trim(),
          name_ar: editForm.name_ar.trim(),
          slug: editForm.slug.trim(),
          description_en:
            editForm.description_en.trim() || null,
          description_ar:
            editForm.description_ar.trim() || null,
          product_type: editForm.product_type,
          category_id: editForm.category_id,
          image_url: uploadedImageUrl,
          is_active: editForm.is_active,
          is_featured: editForm.is_featured,
        })
        .eq("id", editingProductId);

      if (updateError) throw updateError;

      // Update existing sizes, add new sizes and deactivate removed sizes.
      for (const variant of editVariants) {
        if (variant.id) {
          const { error: variantError } = await supabase
            .from("product_variants")
            .update({
              size_ml: Number(variant.size_ml),
              price: Number(variant.price),
              stock: Number(variant.stock),
              is_active: variant.is_active,
            })
            .eq("id", variant.id)
            .eq("product_id", editingProductId);
          if (variantError) throw variantError;
        } else if (variant.is_active) {
          const { error: variantError } = await supabase
            .from("product_variants")
            .insert({
              product_id: editingProductId,
              size_ml: Number(variant.size_ml),
              price: Number(variant.price),
              stock: Number(variant.stock),
              is_active: true,
            });
          if (variantError) throw variantError;
        }
      }

      setProducts((current) =>
        current.map((product) =>
          product.id === editingProductId
            ? {
                ...product,
                ...editForm,
                description_en:
                  editForm.description_en.trim() || null,
                description_ar:
                  editForm.description_ar.trim() || null,
                image_url: uploadedImageUrl,
              }
            : product
        )
      );

      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }

      setEditingProduct(null);
      setSelectedImage(null);
      setImagePreview("");
      setRemoveCurrentImage(false);
      setEditVariants([]);
      setMessage("");
    } catch (err) {
      console.error("Product update error:", err);

      setMessage(
        err instanceof Error
          ? err.message
          : "Could not update product."
      );
    } finally {
      setSaving(false);
    }
  }

  // Permanently delete product. Foreign-key constraints may protect products used in past orders.
  async function handlePermanentDelete(product: Product) {
    const confirmed = window.confirm(
      `Permanently delete "${product.name_en}"? This cannot be undone. If it is linked to previous orders, the database may block deletion.`
    );
    if (!confirmed) return;

    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from("products")
        .delete()
        .eq("id", product.id);

      if (deleteError) throw deleteError;

      setProducts((current) => current.filter((item) => item.id !== product.id));
    } catch (err) {
      console.error("Permanent product deletion error:", err);
      window.alert(
        err instanceof Error
          ? `Could not permanently delete this product. It may be linked to previous orders. You can hide it instead.\\n\\n${err.message}`
          : "Could not permanently delete this product. Try hiding it instead."
      );
    }
  }

  return (
    <main className="min-h-screen bg-[#11100F] text-white p-5 md:p-10">
      <div className="max-w-7xl mx-auto">

        {/* BACK */}
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-[#C6A568] text-sm mb-8"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>

        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 mb-9">
          <div>
            <p className="text-[#C6A568] text-xs tracking-[3px]">
              STORE MANAGEMENT
            </p>

            <h1 className="text-3xl md:text-4xl font-serif mt-3">
              Products
            </h1>

            <p className="text-gray-500 text-sm mt-2">
              Manage your fragrance collection.
            </p>
          </div>

          <Link
            href="/admin/products/new"
            className="flex items-center justify-center gap-2 bg-[#C6A568] text-black px-5 py-3 rounded-lg font-medium hover:bg-[#D8B97E] transition"
          >
            <Plus size={18} />
            Add Product
          </Link>
        </div>

        {/* STATISTICS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7">
          <div className="bg-[#1B1917] border border-white/10 rounded-xl p-5">
            <p className="text-sm text-gray-400">All Products</p>
            <h2 className="text-3xl mt-3 font-semibold">
              {products.length}
            </h2>
          </div>

          <div className="bg-[#1B1917] border border-white/10 rounded-xl p-5">
            <p className="text-sm text-gray-400">Original Perfumes</p>
            <h2 className="text-3xl mt-3 font-semibold">
              {originalCount}
            </h2>
          </div>

          <div className="bg-[#1B1917] border border-white/10 rounded-xl p-5">
            <p className="text-sm text-gray-400">Custom Perfumes</p>
            <h2 className="text-3xl mt-3 font-semibold">
              {customCount}
            </h2>
          </div>
        </div>

        {/* SEARCH AND FILTER */}
        <div className="bg-[#1B1917] border border-white/10 rounded-xl p-5 mb-6">
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
              />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search perfumes..."
                className="w-full bg-[#11100F] border border-white/10 rounded-lg py-3 pl-11 pr-4 outline-none focus:border-[#C6A568] text-sm"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              {[
                { label: "All", value: "all" },
                { label: "Original", value: "original" },
                { label: "Custom", value: "custom" },
              ].map((item) => (
                <button
                  type="button"
                  key={item.value}
                  onClick={() => setFilter(item.value)}
                  className={`px-4 py-2 rounded-lg text-sm border transition ${
                    filter === item.value
                      ? "bg-[#C6A568] text-black border-[#C6A568]"
                      : "bg-[#11100F] text-gray-400 border-white/10 hover:border-[#C6A568]"
                  }`}
                >
                  {item.label}
                </button>
              ))}

              <button
                type="button"
                onClick={() => void loadProducts()}
                disabled={loading}
                className="p-3 border border-white/10 rounded-lg text-gray-400 hover:text-[#C6A568] disabled:opacity-50"
                title="Refresh products"
              >
                <RefreshCw
                  size={17}
                  className={loading ? "animate-spin" : ""}
                />
              </button>
            </div>
          </div>
        </div>

        {/* PRODUCT COLLECTION */}
        <div className="bg-[#1B1917] border border-white/10 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-white/10 flex items-center gap-2">
            <Package className="text-[#C6A568]" size={19} />

            <h2 className="font-medium">Product Collection</h2>

            <span className="text-xs text-gray-500 ml-auto">
              {filteredProducts.length} products
            </span>
          </div>

          {loading ? (
            <div className="p-16 text-center text-gray-400">
              <RefreshCw
                size={25}
                className="mx-auto mb-3 animate-spin text-[#C6A568]"
              />
              Loading products...
            </div>
          ) : error ? (
            <div className="p-10 text-center">
              <p className="text-red-400 text-sm">{error}</p>

              <button
                type="button"
                onClick={() => void loadProducts()}
                className="mt-4 text-[#C6A568] text-sm hover:underline"
              >
                Try again
              </button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-16 text-center">
              <Package
                size={38}
                className="mx-auto text-[#C6A568]"
              />

              <h3 className="mt-4 text-lg">
                {search || filter !== "all"
                  ? "No matching perfumes"
                  : "No perfumes found"}
              </h3>

              <p className="text-gray-500 text-sm mt-2">
                Try changing your search or filter.
              </p>

              {!search && filter === "all" && (
                <Link
                  href="/admin/products/new"
                  className="inline-flex items-center gap-2 mt-5 bg-[#C6A568] text-black px-5 py-3 rounded-lg text-sm font-medium hover:bg-[#D8B97E]"
                >
                  <Plus size={17} />
                  Add Your First Perfume
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-white/[0.03] text-gray-500">
                  <tr>
                    <th className="p-4">Product</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProducts.map((product) => (
                    <tr
                      key={product.id}
                      className="border-t border-white/5 hover:bg-white/[0.02]"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3 min-w-52">
                          <div className="w-12 h-12 rounded-lg bg-[#28231C] overflow-hidden flex items-center justify-center shrink-0">
                            {product.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={product.image_url}
                                alt={product.name_en}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="text-[#C6A568]" />
                            )}
                          </div>

                          <div>
                            <p className="text-white">
                              {product.name_en}
                            </p>
                            <p className="text-gray-500 text-xs mt-1">
                              {product.name_ar}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <span className="text-[#C6A568]">
                          {product.product_type === "original"
                            ? "Original"
                            : "Custom"}
                        </span>
                      </td>

                      <td className="p-4">
                        <span
                          className={
                            product.is_active
                              ? "text-green-400"
                              : "text-gray-500"
                          }
                        >
                          {product.is_active ? "Active" : "Hidden"}
                        </span>
                      </td>

                      <td className="p-4 text-gray-400">
                        {new Date(
                          product.created_at
                        ).toLocaleDateString("en-GB")}
                      </td>

                      <td className="p-4">
                        <div className="flex gap-4 items-center text-gray-400">
                          <Link
                            href={`/products/${product.slug}`}
                            target="_blank"
                            title="View product"
                            className="hover:text-[#C6A568] transition"
                          >
                            <Eye size={17} />
                          </Link>

                          <button
                            type="button"
                            title="Edit product"
                            onClick={() => openEdit(product)}
                            className="hover:text-[#C6A568] transition"
                          >
                            <Pencil size={17} />
                          </button>

                          <button
                            type="button"
                            title="Permanently delete product"
                            onClick={() => void handlePermanentDelete(product)}
                            className="hover:text-red-400 transition"
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-600 mt-5">
          BAIT AL OUD · PRODUCT MANAGEMENT
        </p>
      </div>

      {/* EDIT PRODUCT MODAL */}
      {editingProduct && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#1B1917] border border-white/10 rounded-2xl shadow-2xl">

            {/* MODAL HEADER */}
            <div className="sticky top-0 z-10 bg-[#1B1917] border-b border-white/10 p-5 flex items-center justify-between">
              <div>
                <p className="text-[#C6A568] text-xs tracking-[3px]">
                  PRODUCT MANAGEMENT
                </p>

                <h2 className="text-xl font-serif mt-2">
                  Edit Product
                </h2>
              </div>

              <button
                type="button"
                onClick={closeEdit}
                disabled={saving || uploadingImage}
                className="text-gray-400 hover:text-white p-2 disabled:opacity-40"
              >
                <X size={21} />
              </button>
            </div>

            {/* EDIT FORM */}
            <form
              onSubmit={handleUpdate}
              className="p-5 md:p-7 space-y-5"
            >
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Product Name (English)
                </label>

                <input
                  required
                  value={editForm.name_en}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      name_en: e.target.value,
                    })
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Product Name (Arabic)
                </label>

                <input
                  required
                  value={editForm.name_ar}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      name_ar: e.target.value,
                    })
                  }
                  className={inputClass}
                  dir="rtl"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Product Slug
                </label>

                <input
                  required
                  value={editForm.slug}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      slug: e.target.value,
                    })
                  }
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Product Type
                  </label>

                  <select
                    value={editForm.product_type}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        product_type: e.target.value as
                          | "original"
                          | "custom",
                      })
                    }
                    className={inputClass}
                  >
                    <option value="original">Original</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Category
                  </label>

                  <select
                    required
                    value={editForm.category_id}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        category_id: e.target.value,
                      })
                    }
                    className={inputClass}
                  >
                    <option value="">Select Category</option>

                    {categories.map((category) => (
                      <option
                        key={category.id}
                        value={category.id}
                      >
                        {category.name_en} / {category.name_ar}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  English Description
                </label>

                <textarea
                  rows={3}
                  value={editForm.description_en}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      description_en: e.target.value,
                    })
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Arabic Description
                </label>

                <textarea
                  rows={3}
                  value={editForm.description_ar}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      description_ar: e.target.value,
                    })
                  }
                  className={inputClass}
                  dir="rtl"
                />
              </div>

              {/* SIZE / PRICE / STOCK MANAGEMENT */}
              <div className="border-t border-white/10 pt-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-lg">Sizes, Prices & Stock</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Change the bottle size, selling price and available stock.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addVariant}
                    disabled={saving || variantsLoading}
                    className="bg-[#C6A568]/10 border border-[#C6A568]/40 text-[#C6A568] px-4 py-2 rounded-lg text-sm hover:bg-[#C6A568]/20 disabled:opacity-50"
                  >
                    + Add Size
                  </button>
                </div>

                {variantsLoading ? (
                  <div className="py-8 text-center text-gray-400">
                    <Loader2 className="animate-spin mx-auto mb-2" />
                    Loading sizes and prices...
                  </div>
                ) : editVariants.length === 0 ? (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                    <p className="text-sm text-amber-200">
                      No sizes were found for this product. Click Add Size to create its first size.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {editVariants.map((variant, index) => (
                      <div
                        key={variant.id || `new-${index}`}
                        className={`grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border p-4 ${
                          variant.is_active
                            ? "border-white/10 bg-[#11100F]"
                            : "border-red-500/20 bg-red-500/5 opacity-60"
                        }`}
                      >
                        <div>
                          <label className="block text-xs text-gray-400 mb-2">
                            Bottle Size (ml)
                          </label>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={variant.size_ml}
                            disabled={!variant.is_active || saving}
                            onChange={(e) =>
                              updateVariant(index, "size_ml", e.target.value)
                            }
                            className={inputClass}
                            placeholder="50"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-400 mb-2">
                            Price (EGP)
                          </label>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={variant.price}
                            disabled={!variant.is_active || saving}
                            onChange={(e) =>
                              updateVariant(index, "price", e.target.value)
                            }
                            className={inputClass}
                            placeholder="500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-400 mb-2">
                            Stock Quantity
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={variant.stock}
                            disabled={!variant.is_active || saving}
                            onChange={(e) =>
                              updateVariant(index, "stock", e.target.value)
                            }
                            className={inputClass}
                            placeholder="10"
                          />
                        </div>

                        <div className="sm:col-span-3 flex items-center justify-between gap-3">
                          <span className="text-xs text-gray-500">
                            {variant.is_active
                              ? `Size ${variant.size_ml || "—"} ml is available`
                              : "This size is disabled and hidden from customers"}
                          </span>
                          {variant.is_active && (
                            <button
                              type="button"
                              onClick={() => removeVariant(index)}
                              disabled={saving}
                              className="inline-flex items-center gap-2 text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
                            >
                              <Trash2 size={16} />
                              Remove size
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* CLOUDINARY IMAGE UPLOAD */}
              <div>
                <label className="block text-sm text-gray-400 mb-3">
                  Product Image
                </label>

                {imagePreview ||
                (!removeCurrentImage && editForm.image_url) ? (
                  <div className="relative max-w-sm mx-auto">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview || editForm.image_url}
                      alt="Product preview"
                      className="w-full h-72 object-contain rounded-xl bg-[#11100F] border border-white/10"
                    />

                    <button
                      type="button"
                      onClick={removeImage}
                      disabled={saving || uploadingImage}
                      className="absolute top-3 right-3 p-2 rounded-full bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                      title="Remove image"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={saving || uploadingImage}
                    className="w-full border border-dashed border-white/20 rounded-xl p-10 text-center hover:border-[#C6A568] transition disabled:opacity-50"
                  >
                    <ImagePlus
                      size={38}
                      className="mx-auto text-[#C6A568]"
                    />

                    <p className="mt-4 text-sm font-medium">
                      Choose Product Image
                    </p>

                    <p className="text-xs text-gray-500 mt-2">
                      Click to browse your device
                    </p>
                  </button>
                )}

                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) =>
                    selectProductImage(e.target.files?.[0])
                  }
                />

                {imagePreview && (
                  <p className="text-sm text-green-400 mt-3 text-center">
                    <CheckCircle2
                      size={16}
                      className="inline mr-2"
                    />
                    New image selected
                  </p>
                )}

                <p className="text-xs text-gray-500 mt-3 text-center">
                  JPG, PNG or WebP · Maximum 5 MB
                </p>

                {(imagePreview ||
                  (!removeCurrentImage && editForm.image_url)) && (
                  <button
                    type="button"
                    disabled={saving || uploadingImage}
                    onClick={() => imageInputRef.current?.click()}
                    className="mt-4 mx-auto flex items-center gap-2 text-sm text-[#C6A568] hover:text-white disabled:opacity-50"
                  >
                    <Upload size={17} />
                    Change Image
                  </button>
                )}
              </div>

              {/* SETTINGS */}
              <div className="space-y-3 border-t border-white/10 pt-5">
                <label className="flex items-center gap-3 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.is_active}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        is_active: e.target.checked,
                      })
                    }
                    className="accent-[#C6A568] w-4 h-4"
                  />
                  Active - Visible in store
                </label>

                <label className="flex items-center gap-3 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.is_featured}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        is_featured: e.target.checked,
                      })
                    }
                    className="accent-[#C6A568] w-4 h-4"
                  />
                  Featured Product
                </label>
              </div>

              {/* MESSAGE */}
              {message && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                  {message}
                </div>
              )}

              {/* ACTIONS */}
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 border-t border-white/10 pt-5">
                <button
                  type="button"
                  onClick={closeEdit}
                  disabled={saving || uploadingImage}
                  className="px-5 py-3 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving || uploadingImage}
                  className="flex items-center justify-center gap-2 bg-[#C6A568] text-black px-6 py-3 rounded-lg font-medium hover:bg-[#D8B97E] transition disabled:opacity-50"
                >
                  {uploadingImage ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Uploading Image...
                    </>
                  ) : saving ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
