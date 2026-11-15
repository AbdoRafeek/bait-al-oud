
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Search,
  RefreshCw,
  Pencil,
  Trash2,
  X,
  Tags,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Category = {
  id: string;
  name_ar: string;
  name_en: string;
  slug: string;
  is_active: boolean;
  created_at: string;
};

const emptyForm = {
  name_ar: "",
  name_en: "",
  slug: "",
  is_active: true,
};

function createSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function CategoriesPage() {
  const supabase = useMemo(() => createClient(), []);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<Category | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("categories")
      .select("id, name_ar, name_en, slug, is_active, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setCategories([]);
    } else {
      setCategories((data || []) as Category[]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const filteredCategories = categories.filter((category) => {
    const term = search.toLowerCase();

    return (
      category.name_en?.toLowerCase().includes(term) ||
      category.name_ar?.toLowerCase().includes(term) ||
      category.slug?.toLowerCase().includes(term)
    );
  });

  const activeCount = categories.filter((c) => c.is_active).length;
  const inactiveCount = categories.length - activeCount;

  function openAddModal() {
    setEditingCategory(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  function openEditModal(category: Category) {
    setEditingCategory(category);
    setForm({
      name_ar: category.name_ar || "",
      name_en: category.name_en || "",
      slug: category.slug || "",
      is_active: category.is_active,
    });
    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.name_en.trim() || !form.name_ar.trim()) {
      setError("Please enter both Arabic and English names.");
      return;
    }

    const slug = createSlug(form.slug || form.name_en);

    if (!slug) {
      setError("Please enter a valid category name or slug.");
      return;
    }

    setSaving(true);

    const categoryData = {
      name_ar: form.name_ar.trim(),
      name_en: form.name_en.trim(),
      slug,
      is_active: form.is_active,
    };

    const result = editingCategory
      ? await supabase
          .from("categories")
          .update(categoryData)
          .eq("id", editingCategory.id)
      : await supabase.from("categories").insert(categoryData);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setModalOpen(false);
    setSuccess(
      editingCategory
        ? "Category updated successfully."
        : "Category created successfully."
    );

    await loadCategories();
  }

  async function toggleCategory(category: Category) {
    setError("");
    setSuccess("");

    const { error } = await supabase
      .from("categories")
      .update({ is_active: !category.is_active })
      .eq("id", category.id);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess(
      category.is_active
        ? "Category deactivated."
        : "Category activated."
    );

    await loadCategories();
  }

  async function deleteCategory(category: Category) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${category.name_en}"?`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", category.id);

    if (error) {
      setError(
        "Could not delete this category. It may be linked to existing products. Try deactivating it instead. Details: " +
          error.message
      );
      return;
    }

    setSuccess("Category deleted successfully.");
    await loadCategories();
  }

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <div className="border-b border-white/10 px-6 py-6 md:px-10">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <Link
              href="/admin"
              className="mb-5 inline-flex items-center gap-2 text-sm text-gray-400 transition hover:text-[#d6ad60]"
            >
              <ArrowLeft size={17} />
              Back to Dashboard
            </Link>

            <h1 className="font-serif text-3xl md:text-4xl">
              Categories <span className="text-[#d6ad60]">Management</span>
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Create and manage your store product categories.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={loadCategories}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm transition hover:border-[#d6ad60] disabled:opacity-50"
            >
              <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>

            <button
              onClick={openAddModal}
              className="flex items-center gap-2 rounded-xl bg-[#d6ad60] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#e5c27d]"
            >
              <Plus size={18} />
              Add Category
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1500px] space-y-8 px-5 py-8 md:px-10">
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300">
            {success}
          </div>
        )}

        <section className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <StatCard
            title="Total Categories"
            value={categories.length}
            icon={<Tags size={25} />}
          />
          <StatCard
            title="Active Categories"
            value={activeCount}
            icon={<CheckCircle2 size={25} />}
          />
          <StatCard
            title="Inactive Categories"
            value={inactiveCount}
            icon={<EyeOff size={25} />}
          />
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#111111] p-5">
          <div className="relative">
            <Search
              size={19}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Arabic name, English name or slug..."
              className="w-full rounded-xl border border-white/10 bg-[#080808] py-4 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-[#d6ad60]"
            />
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#111111]">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
            <h2 className="font-serif text-xl">All Categories</h2>
            <span className="text-sm text-gray-500">
              {filteredCategories.length} categories
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] text-left">
              <thead>
                <tr className="border-b border-white/10 text-sm text-gray-500">
                  <th className="px-6 py-5 font-medium">English Name</th>
                  <th className="px-6 py-5 font-medium">Arabic Name</th>
                  <th className="px-6 py-5 font-medium">Slug</th>
                  <th className="px-6 py-5 font-medium">Status</th>
                  <th className="px-6 py-5 font-medium">Created</th>
                  <th className="px-6 py-5 font-medium">Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      Loading categories...
                    </td>
                  </tr>
                ) : filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No categories found.
                    </td>
                  </tr>
                ) : (
                  filteredCategories.map((category) => (
                    <tr
                      key={category.id}
                      className="border-b border-white/5 transition hover:bg-white/[0.02]"
                    >
                      <td className="px-6 py-5 font-medium">
                        {category.name_en}
                      </td>
                      <td className="px-6 py-5 text-gray-300">
                        <span dir="rtl">{category.name_ar}</span>
                      </td>
                      <td className="px-6 py-5 text-sm text-gray-500">
                        {category.slug}
                      </td>
                      <td className="px-6 py-5">
                        <span
                          className={`rounded-full px-3 py-1 text-xs ${
                            category.is_active
                              ? "bg-green-500/10 text-green-400"
                              : "bg-gray-500/10 text-gray-400"
                          }`}
                        >
                          {category.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-sm text-gray-500">
                        {new Date(category.created_at).toLocaleDateString("en-GB")}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => openEditModal(category)}
                            title="Edit"
                            className="text-[#d6ad60] transition hover:text-white"
                          >
                            <Pencil size={18} />
                          </button>

                          <button
                            onClick={() => toggleCategory(category)}
                            title={category.is_active ? "Deactivate" : "Activate"}
                            className="text-gray-400 transition hover:text-white"
                          >
                            {category.is_active ? (
                              <EyeOff size={18} />
                            ) : (
                              <Eye size={18} />
                            )}
                          </button>

                          <button
                            onClick={() => deleteCategory(category)}
                            title="Delete"
                            className="text-red-400 transition hover:text-red-300"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#151515] p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-serif text-2xl">
                {editingCategory ? "Edit Category" : "Add Category"}
              </h2>

              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 transition hover:text-white"
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  English Name
                </label>
                <input
                  value={form.name_en}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      name_en: e.target.value,
                      slug: prev.slug || createSlug(e.target.value),
                    }))
                  }
                  placeholder="e.g. Men's Perfumes"
                  required
                  className="w-full rounded-xl border border-white/10 bg-[#080808] px-4 py-3 text-white outline-none focus:border-[#d6ad60]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Arabic Name
                </label>
                <input
                  value={form.name_ar}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name_ar: e.target.value }))
                  }
                  placeholder="مثال: عطور رجالي"
                  required
                  dir="rtl"
                  className="w-full rounded-xl border border-white/10 bg-[#080808] px-4 py-3 text-white outline-none focus:border-[#d6ad60]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  URL Slug
                </label>
                <input
                  value={form.slug}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, slug: e.target.value }))
                  }
                  placeholder="mens-perfumes"
                  className="w-full rounded-xl border border-white/10 bg-[#080808] px-4 py-3 text-white outline-none focus:border-[#d6ad60]"
                />
                <p className="mt-2 text-xs text-gray-600">
                  Automatically generated from the English name. You can edit it.
                </p>
              </div>

              <label className="flex cursor-pointer items-center gap-3 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      is_active: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 accent-[#d6ad60]"
                />
                Active category
              </label>

              {error && (
                <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-white/10 px-5 py-3 text-sm text-gray-300 transition hover:bg-white/5"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#d6ad60] px-6 py-3 text-sm font-semibold text-black transition hover:bg-[#e5c27d] disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingCategory
                    ? "Save Changes"
                    : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111111] p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">{title}</p>
        <span className="text-[#d6ad60]">{icon}</span>
      </div>
      <p className="mt-7 text-3xl font-semibold">{value}</p>
    </div>
  );
}
