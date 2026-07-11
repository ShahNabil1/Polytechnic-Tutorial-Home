import { useEffect, useMemo, useRef, useState } from "react";
import { confirm as confirmDialog } from "@/components/ui/confirm-dialog";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Pencil, X, Upload, ImageIcon, Package } from "lucide-react";
import { ImageCropperDialog } from "@/components/account/ImageCropperDialog";
import { uploadFileToR2 } from "@/lib/upload-client";
import type { Product, ProductImage } from "@/lib/products";
import { formatBDT } from "@/lib/format";
import {
  listAdminBundles,
  upsertBundle,
  deleteBundle,
  type Bundle,
} from "@/lib/bundles.functions";

type BundleItemDraft = { product_id: string; quantity: number };

type BundleDraft = {
  id?: string;
  slug: string;
  sku: string;
  title: string;
  subtitle: string;
  description: string;
  price: string;
  compare_price: string;
  images: ProductImage[];
  og_image_url: string;
  meta_title: string;
  meta_description: string;
  is_active: boolean;
  is_featured: boolean;
  items: BundleItemDraft[];
};

const EMPTY: BundleDraft = {
  slug: "",
  sku: "",
  title: "",
  subtitle: "",
  description: "",
  price: "0",
  compare_price: "",
  images: [],
  og_image_url: "",
  meta_title: "",
  meta_description: "",
  is_active: true,
  is_featured: false,
  items: [],
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

export function AdminBundlesManager({ products }: { products: Product[] }) {
  const list = useServerFn(listAdminBundles);
  const upsert = useServerFn(upsertBundle);
  const remove = useServerFn(deleteBundle);

  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<BundleDraft>(EMPTY);

  async function refresh() {
    setLoading(true);
    try {
      const b = await list({ data: undefined as never });
      setBundles(b ?? []);
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
    setDraft(EMPTY);
    setEditorOpen(true);
  }

  function openEdit(b: Bundle) {
    setDraft({
      id: b.id,
      slug: b.slug,
      sku: b.sku,
      title: b.title,
      subtitle: b.subtitle ?? "",
      description: b.description,
      price: String(b.price ?? 0),
      compare_price: b.originalPrice != null ? String(b.originalPrice) : "",
      images: b.images ?? [],
      og_image_url: b.ogImage ?? "",
      meta_title: b.metaTitle ?? "",
      meta_description: b.metaDescription ?? "",
      is_active: b.isActive,
      is_featured: b.isFeatured,
      items: b.items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
    });
    setEditorOpen(true);
  }

  async function save() {
    const priceNum = Number(draft.price);
    if (!draft.title.trim() || !draft.slug.trim()) {
      toast.error("Title and slug are required");
      return;
    }
    if (draft.items.length < 2) {
      toast.error("Select at least 2 products for the bundle");
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
          images: draft.images,
          og_image_url: draft.og_image_url || null,
          meta_title: draft.meta_title.trim() || null,
          meta_description: draft.meta_description.trim() || null,
          is_active: draft.is_active,
          is_featured: draft.is_featured,
          items: draft.items,
        },
      });
      toast.success(draft.id ? "Bundle updated" : "Bundle created");
      setEditorOpen(false);
      await refresh();
    } catch (e) {
      toast.error("Save failed: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function removeBundle(b: Bundle) {
    if (!(await confirmDialog({ variant: "danger", description: `Delete bundle "${b.title}"?` }))) return;
    try {
      await remove({ data: { id: b.id } });
      toast.success("Deleted");
      await refresh();
    } catch (e) {
      toast.error("Delete failed: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-slate-800"
        >
          <Plus className="size-4" /> Add Bundle
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : bundles.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <div className="grid size-14 place-items-center rounded-2xl bg-slate-100">
              <Package className="size-6 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No bundles yet</p>
            <p className="max-w-sm text-xs font-medium text-slate-500">
              Create your first special bundle to sell 2+ products together at a discount.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                <th className="px-4 py-3">Bundle</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bundles.map((b) => {
                const cover = b.ogImage || b.images?.[0]?.url;
                return (
                  <tr key={b.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                          {cover ? (
                            <img src={cover} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-slate-400">
                              <Package className="size-5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-900">{b.title}</div>
                          <div className="truncate text-xs font-mono text-slate-500">{b.sku}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{b.items.length}</td>
                    <td className="px-4 py-3 font-semibold tabular-nums">
                      {formatBDT(b.price)}
                      {b.originalPrice && b.originalPrice > b.price && (
                        <span className="ml-1 text-[10px] text-slate-400 line-through">
                          {formatBDT(b.originalPrice)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          b.isActive
                            ? "rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700"
                            : "rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700"
                        }
                      >
                        {b.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEdit(b)}
                          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => removeBundle(b)}
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
        <BundleEditor
          draft={draft}
          setDraft={setDraft}
          products={products}
          onClose={() => setEditorOpen(false)}
          onSave={save}
        />
      )}
    </div>
  );
}

function BundleEditor({
  draft,
  setDraft,
  products,
  onClose,
  onSave,
}: {
  draft: BundleDraft;
  setDraft: (d: BundleDraft) => void;
  products: Product[];
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");

  const selectedIds = useMemo(() => new Set(draft.items.map((i) => i.product_id)), [draft.items]);

  const availableProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => p.isActive !== false)
      .filter((p) => !selectedIds.has(p.id))
      .filter((p) =>
        !q ? true : p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q),
      )
      .slice(0, 15);
  }, [products, selectedIds, search]);

  const itemsWithProduct = draft.items.map((it) => {
    const p = products.find((x) => x.id === it.product_id);
    return { it, p };
  });

  const itemsSum = itemsWithProduct.reduce(
    (s, { it, p }) => s + (p ? p.price * it.quantity : 0),
    0,
  );
  const priceNum = Number(draft.price) || 0;
  const savings = itemsSum > priceNum ? itemsSum - priceNum : 0;

  function addItem(productId: string) {
    setDraft({ ...draft, items: [...draft.items, { product_id: productId, quantity: 1 }] });
    setSearch("");
  }
  function removeItem(productId: string) {
    setDraft({ ...draft, items: draft.items.filter((i) => i.product_id !== productId) });
  }
  function setQty(productId: string, qty: number) {
    setDraft({
      ...draft,
      items: draft.items.map((i) =>
        i.product_id === productId ? { ...i, quantity: Math.max(1, qty) } : i,
      ),
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
      const file = new File([blob], `bundle-${Date.now()}.jpg`, { type: "image/jpeg" });
      const { url, key } = await uploadFileToR2(file, {
        folder: "uploads",
        compress: { maxSizeMB: 0.8, maxWidthOrHeight: 1600, useWebWorker: true },
      });
      const next = [...draft.images, { url, key }];
      setDraft({ ...draft, images: next, og_image_url: draft.og_image_url || url });
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
            {draft.id ? "Edit Bundle" : "Create Bundle"}
          </h2>
          <button onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100">
            <X className="size-4" />
          </button>
        </div>

        <div className="max-h-[75vh] space-y-5 overflow-y-auto p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bundle Title" full>
              <input
                value={draft.title}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraft({ ...draft, title: v, slug: draft.id ? draft.slug : slugify(v) });
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="e.g. 2nd Semester Complete Combo"
              />
            </Field>
            <Field label="Slug" full>
              <input
                value={draft.slug}
                onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
                placeholder="2nd-semester-complete-combo"
              />
            </Field>
            <Field label="SKU" full>
              <input
                value={draft.sku}
                onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
                placeholder="Leave empty to auto-generate (PTH-BDL-XXXXXXXX)"
              />
            </Field>
            <Field label="Subtitle" full>
              <input
                value={draft.subtitle}
                onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Optional — small line under the title"
              />
            </Field>
            <Field label="Bundle Price (BDT)">
              <input
                type="number"
                min={0}
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Compare Price (BDT)">
              <input
                type="number"
                min={0}
                value={draft.compare_price}
                onChange={(e) => setDraft({ ...draft, compare_price: e.target.value })}
                placeholder={itemsSum > 0 ? String(itemsSum) : "Total-if-bought-separately"}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>

          {/* Products picker */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">
              Products in this bundle ({draft.items.length})
            </p>
            {draft.items.length === 0 ? (
              <p className="text-xs text-slate-500">Add at least 2 products.</p>
            ) : (
              <ul className="mb-3 space-y-2">
                {itemsWithProduct.map(({ it, p }) => (
                  <li
                    key={it.product_id}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2"
                  >
                    <div className="size-10 shrink-0 overflow-hidden rounded bg-slate-100">
                      {p?.ogImage || p?.images?.[0]?.url ? (
                        <img
                          src={p.ogImage || p.images[0]?.url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-slate-400">
                          <ImageIcon className="size-4" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {p?.title ?? "(deleted product)"}
                      </p>
                      <p className="text-xs text-slate-500 tabular-nums">
                        {p ? formatBDT(p.price) : "—"} · {p?.type ?? ""}
                      </p>
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={it.quantity}
                      onChange={(e) => setQty(it.product_id, Number(e.target.value))}
                      className="w-16 rounded border border-slate-300 px-2 py-1 text-center text-sm"
                    />
                    <button
                      onClick={() => removeItem(it.product_id)}
                      className="rounded p-1 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {itemsSum > 0 && (
              <div className="mb-3 flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs">
                <span className="font-semibold text-slate-600">
                  Sum if bought separately: {formatBDT(itemsSum)}
                </span>
                {savings > 0 && (
                  <span className="font-bold text-emerald-700">
                    Bundle saves {formatBDT(savings)}
                  </span>
                )}
              </div>
            )}

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products to add…"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            {search && (
              <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                {availableProducts.length === 0 ? (
                  <p className="p-3 text-xs text-slate-500">No matching products.</p>
                ) : (
                  availableProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addItem(p.id)}
                      className="flex w-full items-center gap-3 border-b border-slate-100 p-2 text-left last:border-0 hover:bg-indigo-50"
                    >
                      <div className="size-9 shrink-0 overflow-hidden rounded bg-slate-100">
                        {p.ogImage || p.images?.[0]?.url ? (
                          <img
                            src={p.ogImage || p.images[0]?.url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{p.title}</p>
                        <p className="text-xs text-slate-500">
                          {formatBDT(p.price)} · {p.type}
                        </p>
                      </div>
                      <Plus className="size-4 text-indigo-600" />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <Field label="Description" full>
            <textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              rows={4}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Bundle Images (max 5)" full>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {draft.images.map((img) => {
                const isOg = draft.og_image_url === img.url;
                return (
                  <div
                    key={img.url}
                    className="group relative aspect-[3/4] overflow-hidden rounded-lg border border-slate-200"
                  >
                    <img src={img.url} alt="" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => setDraft({ ...draft, og_image_url: img.url })}
                        className={
                          isOg
                            ? "rounded bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white"
                            : "rounded bg-white/90 px-2 py-0.5 text-[10px] font-bold text-slate-800"
                        }
                      >
                        OG
                      </button>
                      <button
                        type="button"
                        onClick={() => removeImage(img.url)}
                        className="rounded bg-white/90 p-1 text-red-700"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {draft.images.length < 5 && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="grid aspect-[3/4] place-items-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 hover:border-indigo-400 hover:text-indigo-700 disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-4" />}
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
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Meta Title" full>
              <input
                value={draft.meta_title}
                onChange={(e) => setDraft({ ...draft, meta_title: e.target.value })}
                placeholder="Custom SEO title for /bundle/<slug>"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Meta Description" full>
              <textarea
                value={draft.meta_description}
                onChange={(e) => setDraft({ ...draft, meta_description: e.target.value })}
                rows={2}
                placeholder="Custom SEO description — used for search, OG and Twitter cards"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={draft.is_active}
                onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
              />
              Active (visible on shop & sitemap)
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={draft.is_featured}
                onChange={(e) => setDraft({ ...draft, is_featured: e.target.checked })}
              />
              Featured
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-5 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {draft.id ? "Save Changes" : "Create Bundle"}
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
