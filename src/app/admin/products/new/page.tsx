
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Gem,
  FlaskConical,
  Save,
  ImagePlus,
  Upload,
  X,
  Loader2,
  CheckCircle2,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { createProduct } from "./actions";

type Variant = {
  size: string;
  price: string;
  stock: string;
};

type Category = {
  id: string;
  name_en: string;
  name_ar: string;
  slug: string;
};

export default function NewProductPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<"original" | "custom">("original");
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [brand, setBrand] = useState("");
  const [featured, setFeatured] = useState(false);

  // Categories
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [variants, setVariants] = useState<Variant[]>([
    { size: "50", price: "", stock: "" },
  ]);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [imageUploaded, setImageUploaded] = useState(false);

  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const inputClass =
    "w-full bg-[#11100F] border border-white/10 rounded-lg p-3 text-white outline-none focus:border-[#C6A568] transition placeholder:text-gray-600";

  // Load active categories
  useEffect(() => {
    async function loadCategories() {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("categories")
        .select("id, name_en, name_ar, slug")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Categories loading error:", error.message);
        setMessage("Could not load categories. Please refresh the page.");
      } else {
        const loadedCategories = (data || []) as Category[];
        setCategories(loadedCategories);

        if (loadedCategories.length > 0) {
          setCategoryId(loadedCategories[0].id);
        }
      }

      setLoadingCategories(false);
    }

    loadCategories();
  }, []);

  function updateVariant(
    index: number,
    field: keyof Variant,
    value: string
  ) {
    setVariants((old) =>
      old.map((variant, i) =>
        i === index ? { ...variant, [field]: value } : variant
      )
    );
  }

  function addVariant() {
    setVariants((old) => [
      ...old,
      { size: "", price: "", stock: "" },
    ]);
  }

  function removeVariant(index: number) {
    setVariants((old) => old.filter((_, i) => i !== index));
  }

  function selectImage(file?: File) {
    setMessage("");

    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      setMessage("Only JPG, PNG and WebP images are allowed.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("Image must be smaller than 5 MB.");
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setImageUrl("");
    setImageUploaded(false);
  }

  function removeImage() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(null);
    setPreviewUrl("");
    setImageUrl("");
    setImageUploaded(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function uploadImage(): Promise<string> {
    if (!selectedFile) return "";

    setUploading(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success || !result.imageUrl) {
        throw new Error(result.error || "Image upload failed.");
      }

      setImageUrl(result.imageUrl);
      setImageUploaded(true);

      return result.imageUrl;
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");

    if (!nameEn.trim() || !nameAr.trim()) {
      setMessage("Please enter the product name in both languages.");
      return;
    }

    if (!categoryId) {
      setMessage("Please select a product category.");
      return;
    }

    if (type === "original" && !brand.trim()) {
      setMessage("Please enter the perfume brand.");
      return;
    }

    if (
      variants.length === 0 ||
      variants.some(
        (v) =>
          !v.size ||
          !Number.isInteger(Number(v.size)) ||
          Number(v.size) <= 0 ||
          !v.price ||
          !Number.isFinite(Number(v.price)) ||
          Number(v.price) < 0 ||
          v.stock === "" ||
          !Number.isInteger(Number(v.stock)) ||
          Number(v.stock) < 0
      )
    ) {
      setMessage("Please complete all size, price and stock fields.");
      return;
    }

    const sizes = variants.map((v) => Number(v.size));

    if (new Set(sizes).size !== sizes.length) {
      setMessage("Each product size must be unique.");
      return;
    }

    setSaving(true);

    try {
      let uploadedImageUrl = imageUrl || null;

      if (selectedFile && !imageUploaded) {
        uploadedImageUrl = await uploadImage();
      }

      const result = await createProduct({
        nameEn,
        nameAr,
        descriptionEn,
        descriptionAr,
        type,
        brand,
        categoryId,
        featured,
        imageUrl: uploadedImageUrl,
        variants: variants.map((v) => ({
          size: Number(v.size),
          price: Number(v.price),
          stock: Number(v.stock),
        })),
      });

      if (!result.success) {
        setMessage(result.message);
        return;
      }

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      router.push("/admin/products");
      router.refresh();
    } catch (error) {
      console.error(error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#11100F] text-white p-5 md:p-10">
      <div className="max-w-5xl mx-auto">
        <Link
          href="/admin/products"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-[#C6A568] mb-8 text-sm"
        >
          <ArrowLeft size={17} />
          Back to Products
        </Link>

        <div className="mb-9">
          <p className="text-xs tracking-[3px] text-[#C6A568]">
            PRODUCT MANAGEMENT
          </p>

          <h1 className="text-3xl md:text-4xl font-serif mt-3">
            Add New Product
          </h1>

          <p className="text-gray-500 mt-2 text-sm">
            Add a new fragrance to your collection.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* PRODUCT TYPE */}
          <section className="bg-[#1B1917] border border-white/10 rounded-xl p-6">
            <h2 className="text-lg mb-5">Product Type</h2>

            <div className="grid sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setType("original")}
                className={`p-5 rounded-xl border flex items-center gap-4 transition ${
                  type === "original"
                    ? "border-[#C6A568] bg-[#C6A568]/10"
                    : "border-white/10 hover:border-white/30"
                }`}
              >
                <Gem className="text-[#C6A568]" size={27} />

                <div className="text-left">
                  <p>Original Perfume</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Authentic branded fragrances
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setType("custom")}
                className={`p-5 rounded-xl border flex items-center gap-4 transition ${
                  type === "custom"
                    ? "border-[#C6A568] bg-[#C6A568]/10"
                    : "border-white/10 hover:border-white/30"
                }`}
              >
                <FlaskConical className="text-[#C6A568]" size={27} />

                <div className="text-left">
                  <p>Custom Perfume</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Bait Al Oud fragrance collection
                  </p>
                </div>
              </button>
            </div>
          </section>

          {/* PRODUCT INFORMATION */}
          <section className="bg-[#1B1917] border border-white/10 rounded-xl p-6">
            <h2 className="text-lg mb-6">Product Information</h2>

            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <label className="text-sm text-gray-400 block mb-2">
                  Product Name (English) *
                </label>

                <input
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder="e.g. Luxury Oud"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-2">
                  اسم المنتج بالعربي *
                </label>

                <input
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  placeholder="مثال: عطر العود الفاخر"
                  dir="rtl"
                  required
                  className={inputClass}
                />
              </div>

              {type === "original" && (
                <div className="md:col-span-2">
                  <label className="text-sm text-gray-400 block mb-2">
                    Perfume Brand *
                  </label>

                  <input
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="e.g. Dior, Chanel, Gucci"
                    required
                    className={inputClass}
                  />
                </div>
              )}

              <div>
                <label className="text-sm text-gray-400 block mb-2">
                  Description (English)
                </label>

                <textarea
                  value={descriptionEn}
                  onChange={(e) => setDescriptionEn(e.target.value)}
                  rows={4}
                  placeholder="Describe the fragrance..."
                  className={inputClass}
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-2">
                  وصف المنتج بالعربي
                </label>

                <textarea
                  value={descriptionAr}
                  onChange={(e) => setDescriptionAr(e.target.value)}
                  rows={4}
                  dir="rtl"
                  placeholder="اكتب وصف العطر..."
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          {/* CATEGORY SELECTION */}
          <section className="bg-[#1B1917] border border-white/10 rounded-xl p-6">
            <h2 className="text-lg mb-2">Product Category</h2>

            <p className="text-sm text-gray-500 mb-5">
              Choose the category where this product will appear.
            </p>

            {loadingCategories ? (
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <Loader2 size={18} className="animate-spin text-[#C6A568]" />
                Loading categories...
              </div>
            ) : categories.length > 0 ? (
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                className={inputClass}
              >
                <option value="" disabled>
                  Select a category
                </option>

                {categories.map((category) => (
                  <option
                    key={category.id}
                    value={category.id}
                    className="bg-[#11100F]"
                  >
                    {category.name_en} — {category.name_ar}
                  </option>
                ))}
              </select>
            ) : (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
                <p className="text-sm text-red-300">
                  No active categories found. Please add or activate a
                  category before creating a product.
                </p>
              </div>
            )}
          </section>

          {/* SIZES AND PRICING */}
          <section className="bg-[#1B1917] border border-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg">Sizes & Pricing</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Add sizes, prices and available stock.
                </p>
              </div>

              <button
                type="button"
                onClick={addVariant}
                className="flex items-center gap-2 text-sm text-[#C6A568] hover:text-white"
              >
                <Plus size={17} />
                Add Size
              </button>
            </div>

            <div className="space-y-4">
              {variants.map((variant, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end border border-white/10 rounded-lg p-4"
                >
                  <div>
                    <label className="text-xs text-gray-500 block mb-2">
                      Size (ML)
                    </label>

                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={variant.size}
                      onChange={(e) =>
                        updateVariant(index, "size", e.target.value)
                      }
                      placeholder="50"
                      required
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 block mb-2">
                      Price (EGP)
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={variant.price}
                      onChange={(e) =>
                        updateVariant(index, "price", e.target.value)
                      }
                      placeholder="450"
                      required
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 block mb-2">
                      Stock
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={variant.stock}
                      onChange={(e) =>
                        updateVariant(index, "stock", e.target.value)
                      }
                      placeholder="20"
                      required
                      className={inputClass}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removeVariant(index)}
                    disabled={variants.length === 1}
                    className="p-3 text-red-400 hover:bg-red-400/10 rounded-lg disabled:opacity-20"
                    title="Remove size"
                  >
                    <Trash2 size={19} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* PRODUCT SETTINGS */}
          <section className="bg-[#1B1917] border border-white/10 rounded-xl p-6">
            <h2 className="text-lg mb-5">Product Settings</h2>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="accent-[#C6A568] w-4 h-4"
              />

              <span className="text-sm text-gray-300">
                Feature this product on homepage
              </span>
            </label>
          </section>

          {/* CLOUDINARY IMAGE UPLOAD */}
          <section className="bg-[#1B1917] border border-white/10 rounded-xl p-6">
            <h2 className="text-lg mb-2">Product Image</h2>

            <p className="text-sm text-gray-500 mb-5">
              Upload a high-quality image of your perfume.
              JPG, PNG or WebP. Maximum 5 MB.
            </p>

            {previewUrl ? (
              <div className="relative max-w-sm mx-auto">
                <img
                  src={previewUrl}
                  alt="Product preview"
                  className="w-full h-72 object-contain rounded-xl bg-[#11100F] border border-white/10"
                />

                <button
                  type="button"
                  onClick={removeImage}
                  disabled={saving || uploading}
                  className="absolute top-3 right-3 p-2 rounded-full bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                  title="Remove image"
                >
                  <X size={18} />
                </button>

                <div className="mt-3 text-center">
                  {imageUploaded ? (
                    <p className="text-sm text-green-400 flex items-center justify-center gap-2">
                      <CheckCircle2 size={17} />
                      Image uploaded successfully
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400">
                      {selectedFile?.name}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border border-dashed border-white/20 rounded-xl p-10 text-center hover:border-[#C6A568] transition"
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
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => selectImage(e.target.files?.[0])}
            />

            {previewUrl && (
              <button
                type="button"
                disabled={saving || uploading}
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 mx-auto flex items-center gap-2 text-sm text-[#C6A568] hover:text-white disabled:opacity-50"
              >
                <Upload size={17} />
                Change Image
              </button>
            )}
          </section>

          {/* MESSAGE */}
          {message && (
            <div className="rounded-lg border border-[#C6A568]/30 bg-[#C6A568]/10 p-4 text-sm text-[#DCC18D]">
              {message}
            </div>
          )}

          {/* ACTIONS */}
          <div className="flex justify-end gap-3">
            <Link
              href="/admin/products"
              className="px-5 py-3 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={
                saving ||
                uploading ||
                loadingCategories ||
                categories.length === 0
              }
              className="flex items-center gap-2 bg-[#C6A568] text-black px-6 py-3 rounded-lg font-medium hover:bg-[#D8B97E] transition disabled:opacity-50"
            >
              {saving || uploading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {uploading ? "Uploading Image..." : "Saving Product..."}
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save Product
                </>
              )}
            </button>
          </div>
        </form>

        <p className="text-xs text-gray-600 mt-8">
          BAIT AL OUD · PRODUCT CREATION
        </p>
      </div>
    </main>
  );
}
