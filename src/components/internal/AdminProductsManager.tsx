import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Trash2,
  Pencil,
  X,
  Upload,
  Star,
  StarOff,
  ImageIcon,
  Package,
} from "lucide-react";
import { ImageCropperDialog } from "@/components/account/ImageCropperDialog";
import { uploadFileToR2 } from "@/lib/upload-client";
import {
  listAdminProducts,
  listAllCategories,
  upsertProduct,
  deleteProduct,
  type CategoryRow,
} from "@/lib/products.functions";
import type { Product, ProductImage } from "@/lib/products";
import { formatBDT } from "@/lib/format";
import { AdminBundlesManager } from "@/components/internal/AdminBundlesManager";

type Draft = {
  id?: string;
  slug: string;
  sku: string;
  title: string;
  subtitle: string;
  description: string;
  price: string;
  compare_price: string;
  product_type_id: string;
  subcategory_ids: string[];
  images: ProductImage[];
  og_image_url: string;
  meta_title: string;
  meta_description: string;
  stock: string;
  is_active: boolean;
  is_featured: boolean;
  is_online_book: boolean;
};

const EMPTY_DRAFT: Draft = {
  slug: "",
  sku: "",
  title: "",
  subtitle: "",
  description: "",
  price: "0",
  compare_price: "",
  product_type_id: "",
  subcategory_ids: [],
  images: [],
  og_image_url: "",
  meta_title: "",
  meta_description: "",
  stock: "",
  is_active: true,
  is_featured: false,
  is_online_book: false,
};

function slugify(v: string) {
  return v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 100);
}

export function AdminProductsManager() {
  const list = useServerFn(listAdminProducts);
  const listCats = useServerFn(listAllCategories);
  const upsert = useServerFn(upsertProduct);
  const remove = useServerFn(deleteProduct);

  const [products, setProducts] = useState<Product[]>([]);
  const [cats, setCats] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [tab, setTab] = useState<"products" | "bundles">("products");

  async function refresh() {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([
        list({ data: undefined as never }),
        listCats({ data: undefined as never }),
      ]);
      setProducts(p ?? []);
      setCats(c ?? []);
    } catch (e) {
      toast.error("Failed to load: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  function openCreate() {
    const firstType = cats.find((c) => c.kind === "product_type" && c.is_active);
    setDraft({ ...EMPTY_DRAFT, product_type_id: firstType?.id ?? "" });
    setEditorOpen(true);
  }

  function openEdit(p: Product) {
    const type = cats.find((c) => c.kind === "product_type" && c.slug === p.type);
    const depIds = cats
      .filter((c) => c.kind === "department" && p.departments.includes(c.slug))
      .map((c) => c.id);
    const semIds = cats
      .filter((c) => c.kind === "semester" && p.semesters.includes(Number(c.slug)))
      .map((c) => c.id);
    setDraft({
      id: p.id,
      slug: p.slug,
      sku: p.sku ?? "",
      title: p.title,
      subtitle: p.subtitle ?? "",
      description: p.description,
      price: String(p.price ?? 0),
      compare_price: p.originalPrice != null ? String(p.originalPrice) : "",
      product_type_id: type?.id ?? "",
      subcategory_ids: [...depIds, ...semIds],
      images: p.images ?? [],
      og_image_url: p.ogImage ?? "",
      meta_title: p.metaTitle ?? "",
      meta_description: p.metaDescription ?? "",
      stock: p.stock != null ? String(p.stock) : "",
      is_active: p.isActive ?? true,
      is_featured: p.featured ?? false,
      is_online_book: p.isOnlineBook ?? false,
    });
    setEditorOpen(true);
  }

  async function saveDraft() {
    const priceNum = Number(draft.price);
    if (!draft.title.trim() || !draft.slug.trim() || !draft.product_type_id) {
      toast.error("Title, slug and product type are required");
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      toast.error("Invalid price");
      return;
    }
    try {
      await upsert({
        data: {
          id: draft.id,
          slug: slugify(draft.slug),
          sku: draft.sku.trim() || null,
          title: draft.title.trim(),
          subtitle: draft.subtitle.trim() || null,
          description: draft.description,
          price: priceNum,
          compare_price: draft.compare_price ? Number(draft.compare_price) : null,
          product_type_id: draft.product_type_id,
          subcategory_ids: draft.subcategory_ids,
          images: draft.images,
          og_image_url: draft.og_image_url || null,
          meta_title: draft.meta_title.trim() || null,
          meta_description: draft.meta_description.trim() || null,
          stock: draft.stock ? Number(draft.stock) : null,
          is_active: draft.is_active,
          is_featured: draft.is_featured,
          is_online_book: draft.is_online_book,
        },
      });
      toast.success(draft.id ? "Product updated" : "Product created");
      setEditorOpen(false);
      await refresh();
    } catch (e) {
      toast.error("Save failed: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function removeProduct(p: Product) {
    if (!confirm(`Delete "${p.title}"?`)) return;
    try {
      await remove({ data: { id: p.id } });
      toast.success("Deleted");
      await refresh();
    } catch (e) {
      toast.error("Delete failed: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600">
            E-Commerce
          </p>
          <h1 className="mt-1 font-display text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            {tab === "products" ? "Products" : "Bundle Products"}
          </h1>
          <p className="mt-2 max-w-xl text-sm font-medium text-slate-500">
            {tab === "products"
              ? "Add, edit and delete every product that appears on the public shop."
              : "Combine 2 or more existing products into a special bundle with its own price and SEO metadata."}
          </p>
        </div>
        {tab === "products" && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800"
          >
            <Plus className="size-4" /> Add Product
          </button>
        )}
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {(["products", "bundles"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              tab === t
                ? "border-b-2 border-slate-900 px-4 py-2 text-sm font-bold text-slate-900"
                : "border-b-2 border-transparent px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800"
            }
          >
            {t === "products" ? "Products" : "Bundle Products"}
          </button>
        ))}
      </div>

      {tab === "bundles" ? (
        <AdminBundlesManager products={products} />
      ) : (
        <>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        {loading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <div className="grid size-14 place-items-center rounded-2xl bg-slate-100">
              <Package className="size-6 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No products yet</p>
            <p className="max-w-sm text-xs font-medium text-slate-500">
              Add your first product — it will appear on the /shop page instantly.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const cover = p.ogImage || p.images?.[0]?.url;
                return (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                          {cover ? (
                            <img src={cover} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-slate-400">
                              <ImageIcon className="size-5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-900">{p.title}</div>
                          <div className="truncate text-xs font-mono text-slate-500">{p.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{p.type}</td>
                    <td className="px-4 py-3 font-semibold tabular-nums">{formatBDT(p.price)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          p.isActive
                            ? "rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700"
                            : "rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700"
                        }
                      >
                        {p.isActive ? "Active" : "Inactive"}
                      </span>
                      {p.featured && (
                        <span className="ml-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                          Featured
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEdit(p)}
                          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => removeProduct(p)}
                          className="rounded-md border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 hover:bg-red-100"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {editorOpen && (
        <ProductEditor
          draft={draft}
          setDraft={setDraft}
          categories={cats}
          onClose={() => setEditorOpen(false)}
          onSave={saveDraft}
        />
      {editorOpen && (
        <ProductEditor
          draft={draft}
          setDraft={setDraft}
          categories={cats}
          onClose={() => setEditorOpen(false)}
          onSave={saveDraft}
        />
      )}
        </>
      )}
    </div>
  );
}


function ProductEditor({
  draft,
  setDraft,
  categories,
  onClose,
  onSave,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  categories: CategoryRow[];
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const productTypes = useMemo(
    () => categories.filter((c) => c.kind === "product_type" && c.is_active),
    [categories],
  );
  const departments = useMemo(
    () => categories.filter((c) => c.kind === "department" && c.is_active),
    [categories],
  );
  const semesters = useMemo(
    () => categories.filter((c) => c.kind === "semester" && c.is_active),
    [categories],
  );

  function toggleSub(id: string) {
    const has = draft.subcategory_ids.includes(id);
    setDraft({
      ...draft,
      subcategory_ids: has
        ? draft.subcategory_ids.filter((x) => x !== id)
        : [...draft.subcategory_ids, id],
    });
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (draft.images.length >= 5) {
      toast.error("Maximum 5 images");
      return;
    }
    setCropFile(f);
  }

  async function handleCropped(blob: Blob) {
    setCropFile(null);
    setUploading(true);
    try {
      const file = new File([blob], `product-${Date.now()}.jpg`, { type: "image/jpeg" });
      const { url, key } = await uploadFileToR2(file, {
        folder: "uploads",
        compress: { maxSizeMB: 0.8, maxWidthOrHeight: 1600, useWebWorker: true },
      });
      const nextImages = [...draft.images, { url, key }];
      setDraft({
        ...draft,
        images: nextImages,
        og_image_url: draft.og_image_url || url,
      });
      toast.success("Image uploaded");
    } catch (e) {
      toast.error("Upload failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setUploading(false);
    }
  }

  function removeImage(url: string) {
    const next = draft.images.filter((i) => i.url !== url);
    setDraft({
      ...draft,
      images: next,
      og_image_url: draft.og_image_url === url ? next[0]?.url ?? "" : draft.og_image_url,
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="font-display text-lg font-bold tracking-tight text-slate-900">
            {draft.id ? "Edit Product" : "Add Product"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Product Title" full>
              <input
                value={draft.title}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraft({
                    ...draft,
                    title: v,
                    slug: draft.id ? draft.slug : slugify(v),
                  });
                }}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                placeholder="e.g. Data Structure & Algorithm"
              />
            </Field>
            <Field label="Slug" full>
              <input
                value={draft.slug}
                onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
                placeholder="data-structure-algorithm"
              />
            </Field>
            <Field label="Subtitle" full>
              <input
                value={draft.subtitle}
                onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                placeholder="Optional short line under the title"
              />
            </Field>

            <Field label="Product Price (BDT)">
              <input
                type="number"
                min={0}
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </Field>
            <Field label="Compare Price (BDT)">
              <input
                type="number"
                min={0}
                value={draft.compare_price}
                onChange={(e) => setDraft({ ...draft, compare_price: e.target.value })}
                placeholder="Original / crossed-out price"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </Field>

            <Field label="Product Type (main category)" full>
              <select
                value={draft.product_type_id}
                onChange={(e) => setDraft({ ...draft, product_type_id: e.target.value })}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="">Select…</option>
                {productTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Description" full>
              <textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={5}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </Field>

            <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
              <SubcategoryBlock
                title="Departments"
                items={departments}
                selected={draft.subcategory_ids}
                onToggle={toggleSub}
              />
              <SubcategoryBlock
                title="Semesters"
                items={semesters}
                selected={draft.subcategory_ids}
                onToggle={toggleSub}
              />
            </div>

            <Field label="Product Images (max 5)" full>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {draft.images.map((img) => {
                  const isOg = draft.og_image_url === img.url;
                  return (
                    <div
                      key={img.url}
                      className="group relative aspect-[3/4] overflow-hidden rounded-lg border border-slate-200"
                    >
                      <img src={img.url} alt="" className="h-full w-full object-cover" />
                      <div className="absolute inset-0 flex items-end justify-between gap-1 bg-gradient-to-t from-black/70 via-black/0 to-black/0 p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => setDraft({ ...draft, og_image_url: img.url })}
                          className={
                            isOg
                              ? "rounded bg-amber-500 p-1 text-white"
                              : "rounded bg-white/90 p-1 text-slate-800 hover:bg-white"
                          }
                          title={isOg ? "OG image" : "Use as OG image"}
                        >
                          {isOg ? <Star className="size-3.5" /> : <StarOff className="size-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeImage(img.url)}
                          className="rounded bg-white/90 p-1 text-red-700 hover:bg-white"
                          title="Remove"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                      {isOg && (
                        <span className="absolute left-1.5 top-1.5 rounded bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                          OG
                        </span>
                      )}
                    </div>
                  );
                })}
                {draft.images.length < 5 && (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="grid aspect-[3/4] place-items-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 transition-colors hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50"
                  >
                    {uploading ? (
                      <Loader2 className="size-5 animate-spin" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-xs font-semibold">
                        <Upload className="size-4" />
                        Upload
                      </div>
                    )}
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onPickFile}
                className="hidden"
              />
              <p className="mt-2 text-xs font-medium text-slate-500">
                Images are cropped to 3:4, compressed in the browser, then uploaded. Click the star
                to choose which image is used for the social preview (OG image).
              </p>
            </Field>

            <Field label="Meta Title" full>
              <input
                value={draft.meta_title}
                onChange={(e) => setDraft({ ...draft, meta_title: e.target.value })}
                placeholder="Overrides <title> on the product page"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </Field>
            <Field label="Meta Description" full>
              <textarea
                value={draft.meta_description}
                onChange={(e) => setDraft({ ...draft, meta_description: e.target.value })}
                rows={2}
                placeholder="Overrides the SEO description"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </Field>

            <Field label="Stock">
              <input
                type="number"
                min={0}
                value={draft.stock}
                onChange={(e) => setDraft({ ...draft, stock: e.target.value })}
                placeholder="Leave empty for digital"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </Field>
            <div className="flex flex-col justify-end gap-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.is_active}
                  onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                />
                Active (visible on shop)
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.is_featured}
                  onChange={(e) => setDraft({ ...draft, is_featured: e.target.checked })}
                />
                Featured (show on home page)
              </label>
              <label className="flex items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50/50 p-2.5 text-sm font-semibold text-slate-800">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={draft.is_online_book}
                  onChange={(e) => setDraft({ ...draft, is_online_book: e.target.checked })}
                />
                <span>
                  Online Book
                  <span className="mt-0.5 block text-[11px] font-medium text-slate-500">
                    Digital delivery — checkout skips address, email becomes mandatory.
                  </span>
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-5 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {draft.id ? "Save Changes" : "Create Product"}
          </button>
        </div>
      </div>

      {cropFile && (
        <ImageCropperDialog
          file={cropFile}
          aspect={3 / 4}
          cropShape="rect"
          onCancel={() => setCropFile(null)}
          onCropped={handleCropped}
          submitLabel="Upload"
        />
      )}
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">
        {label}
      </span>
      {children}
    </label>
  );
}

function SubcategoryBlock({
  title,
  items,
  selected,
  onToggle,
}: {
  title: string;
  items: CategoryRow[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">
        {title}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.length === 0 && (
          <span className="text-xs text-slate-400">No {title.toLowerCase()} yet</span>
        )}
        {items.map((c) => {
          const active = selected.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onToggle(c.id)}
              className={
                active
                  ? "rounded-full bg-indigo-600 px-3 py-1 text-xs font-bold text-white"
                  : "rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-indigo-400 hover:text-indigo-700"
              }
            >
              {c.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
