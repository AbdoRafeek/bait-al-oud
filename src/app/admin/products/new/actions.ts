
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type ProductInput = {
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  type: "original" | "custom";
  brand: string;
  categoryId: string;
  featured: boolean;
  imageUrl: string | null;
  variants: {
    size: number;
    price: number;
    stock: number;
  }[];
};

function makeSlug(value: string) {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${base || "perfume"}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function createProduct(input: ProductInput) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, message: "Please sign in first." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (
    profileError ||
    !profile ||
    !["owner", "admin", "manager"].includes(profile.role)
  ) {
    return {
      success: false,
      message: "You are not authorized to manage products.",
    };
  }

  if (
    !input ||
    !input.nameEn?.trim() ||
    !input.nameAr?.trim() ||
    !["original", "custom"].includes(input.type) ||
    !input.categoryId?.trim() ||
    !Array.isArray(input.variants) ||
    input.variants.length === 0 ||
    input.variants.length > 20
  ) {
    return {
      success: false,
      message: "Invalid product information.",
    };
  }

  if (
    input.variants.some(
      (v) =>
        !Number.isInteger(v.size) ||
        v.size <= 0 ||
        !Number.isFinite(v.price) ||
        v.price < 0 ||
        !Number.isInteger(v.stock) ||
        v.stock < 0
    )
  ) {
    return {
      success: false,
      message: "Please check sizes, prices and stock.",
    };
  }

  const sizes = input.variants.map((v) => v.size);

  if (new Set(sizes).size !== sizes.length) {
    return {
      success: false,
      message: "Duplicate product sizes are not allowed.",
    };
  }

  if (input.type === "original" && !input.brand?.trim()) {
    return {
      success: false,
      message: "Brand name is required.",
    };
  }

  // Validate uploaded image URL
  if (input.imageUrl) {
    try {
      const imageUrl = new URL(input.imageUrl);

      if (
        imageUrl.protocol !== "https:" ||
        imageUrl.hostname !== "res.cloudinary.com"
      ) {
        return {
          success: false,
          message: "Invalid product image URL.",
        };
      }
    } catch {
      return {
        success: false,
        message: "Invalid product image URL.",
      };
    }
  }

  // Validate selected category
  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("id")
    .eq("id", input.categoryId)
    .eq("is_active", true)
    .single();

  if (categoryError || !category) {
    return {
      success: false,
      message: "Please select a valid active category.",
    };
  }

  // Find or create brand
  let brandId: string | null = null;

  if (input.type === "original") {
    const brandName = input.brand.trim();

    const { data: existingBrand, error: lookupError } = await supabase
      .from("brands")
      .select("id")
      .ilike("name", brandName)
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      return {
        success: false,
        message: "Could not check perfume brand.",
      };
    }

    if (existingBrand) {
      brandId = existingBrand.id;
    } else {
      const { data: newBrand, error: brandError } = await supabase
        .from("brands")
        .insert({
          name: brandName,
          slug: makeSlug(brandName),
        })
        .select("id")
        .single();

      if (brandError || !newBrand) {
        return {
          success: false,
          message: brandError?.message || "Could not create brand.",
        };
      }

      brandId = newBrand.id;
    }
  }

  // Create product
  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({
      name_en: input.nameEn.trim(),
      name_ar: input.nameAr.trim(),
      slug: makeSlug(input.nameEn),
      description_en: input.descriptionEn?.trim() || null,
      description_ar: input.descriptionAr?.trim() || null,
      product_type: input.type,
      brand_id: brandId,
      category_id: category.id,
      image_url: input.imageUrl,
      is_featured: Boolean(input.featured),
      is_active: true,
    })
    .select("id")
    .single();

  if (productError || !product) {
    return {
      success: false,
      message: productError?.message || "Could not create product.",
    };
  }

  // Create product variants
  const variantRows = input.variants.map((variant) => ({
    product_id: product.id,
    size_ml: variant.size,
    price: variant.price,
    stock: variant.stock,
    is_active: true,
  }));

  const { error: variantsError } = await supabase
    .from("product_variants")
    .insert(variantRows);

  if (variantsError) {
    const { error: rollbackError } = await supabase
      .from("products")
      .delete()
      .eq("id", product.id);

    return {
      success: false,
      message: rollbackError
        ? "Saving failed. Please check Supabase."
        : `Could not save product sizes: ${variantsError.message}`,
    };
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin");
  revalidatePath("/products");

  return {
    success: true,
    message: "Product created successfully!",
    productId: product.id,
  };
}
