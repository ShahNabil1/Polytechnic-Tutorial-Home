import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Pencil, Check, X, Tags } from "lucide-react";
import {
import { confirm as confirmDialog } from "@/components/ui/confirm-dialog";
  listAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  type CategoryRow,
} from "@/lib/products.functions";

const KIND_LABELS: Record<CategoryRow["kind"], string> = {
  product_type: "Product Types",
  department: "Departments",
  semester: "Semesters",
};

const KIND_HINTS: Record<CategoryRow["kind"], string> = {
  product_type: "Main product classification (Physical Book, E-Book, Super Suggestion).",
  department: "Engineering departments used to categorise products.",
  semester: "Semester numbers used to categorise products.",
};

export function AdminCategoriesManager() {
  const list = useServerFn(listAllCategories);
  const create = useServerFn(createCategory);
  const update = useServerFn(updateCategory);
  const remove = useServerFn(deleteCategory);

  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ name: string; slug: string }>({ name: "", slug: "" });
  const [adding, setAdding] = useState<CategoryRow["kind"] | null>(null);
  const [addDraft, setAddDraft] = useState<{ name: string; slug: string }>({ name: "", slug: "" });
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const data = await list({ data: undefined as never });
      setRows(data ?? []);
    } catch (e) {
      toast.error("Failed to load: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  async function submitAdd(kind: CategoryRow["kind"]) {
    if (!addDraft.name.trim() || !addDraft.slug.trim()) {
      toast.error("Slug and name are required");
      return;
    }
    setBusy(true);
    try {
      await create({
        data: {
          kind,
          slug: addDraft.slug.trim().toLowerCase(),
          name: addDraft.name.trim(),
          sort_order: (rows.filter((r) => r.kind === kind).length || 0) + 1,
          is_active: true,
        },
      });
      toast.success("Category created");
      setAdding(null);
      setAddDraft({ name: "", slug: "" });
      await refresh();
    } catch (e) {
      toast.error("Create failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function submitEdit(row: CategoryRow) {
    setBusy(true);
    try {
      await update({
        data: {
          id: row.id,
          patch: { slug: editDraft.slug.trim().toLowerCase(), name: editDraft.name.trim() },
        },
      });
      toast.success("Category updated");
      setEditingId(null);
      await refresh();
    } catch (e) {
      toast.error("Update failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(row: CategoryRow) {
    setBusy(true);
    try {
      await update({ data: { id: row.id, patch: { is_active: !row.is_active } } });
      await refresh();
    } catch (e) {
      toast.error("Update failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function removeRow(row: CategoryRow) {
    if (!(await confirmDialog({ variant: "danger", description: `Delete "${row.name}"? Products using it will need to be re-tagged.` }))) return;
    setBusy(true);
    try {
      await remove({ data: { id: row.id } });
      toast.success("Deleted");
      await refresh();
    } catch (e) {
      toast.error("Delete failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  const grouped = (["product_type", "department", "semester"] as const).map((k) => ({
    kind: k,
    items: rows.filter((r) => r.kind === k),
  }));

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600">
          E-Commerce
        </p>
        <h1 className="mt-1 font-display text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
          Product Categories
        </h1>
        <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500">
          Product Type, Department and Semester are the three main category groups. All entries below
          become sub-categories that products in the shop can be tagged with and filtered by.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ kind, items }) => (
            <section
              key={kind}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-slate-900">
                    <Tags className="size-4 text-indigo-600" /> {KIND_LABELS[kind]}
                    <span className="text-sm font-medium text-slate-400">({items.length})</span>
                  </h2>
                  <p className="mt-1 text-xs font-medium text-slate-500">{KIND_HINTS[kind]}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAdding(kind);
                    setAddDraft({ name: "", slug: "" });
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
                >
                  <Plus className="size-3.5" /> Add sub-category
                </button>
              </div>

              {adding === kind && (
                <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-indigo-200 bg-indigo-50/50 p-3">
                  <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Slug
                    <input
                      value={addDraft.slug}
                      onChange={(e) => setAddDraft((d) => ({ ...d, slug: e.target.value }))}
                      placeholder={kind === "semester" ? "9" : "civil"}
                      className="w-32 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal normal-case text-slate-900"
                    />
                  </label>
                  <label className="flex flex-1 flex-col gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Display name
                    <input
                      value={addDraft.name}
                      onChange={(e) => setAddDraft((d) => ({ ...d, name: e.target.value }))}
                      placeholder="Shown to customers"
                      className="min-w-[200px] rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal normal-case text-slate-900"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => submitAdd(kind)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    <Check className="size-3.5" /> Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdding(null)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <X className="size-3.5" /> Cancel
                  </button>
                </div>
              )}

              {items.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-300 p-4 text-center text-xs font-medium text-slate-500">
                  No sub-categories yet.
                </div>
              ) : (
                <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                  {items.map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      {editingId === row.id ? (
                        <div className="flex flex-1 flex-wrap items-center gap-2">
                          <input
                            value={editDraft.slug}
                            onChange={(e) => setEditDraft((d) => ({ ...d, slug: e.target.value }))}
                            className="w-32 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                          />
                          <input
                            value={editDraft.name}
                            onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                            className="min-w-[180px] flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                          />
                          <button
                            type="button"
                            onClick={() => submitEdit(row)}
                            disabled={busy}
                            className="rounded-md bg-emerald-600 px-2 py-1.5 text-xs font-bold text-white hover:bg-emerald-500"
                          >
                            <Check className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-md border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                                {row.slug}
                              </span>
                              <span className="text-sm font-semibold text-slate-900">
                                {row.name}
                              </span>
                              {!row.is_active && (
                                <span className="rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                  Inactive
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleActive(row)}
                              disabled={busy}
                              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              {row.is_active ? "Disable" : "Enable"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(row.id);
                                setEditDraft({ name: row.name, slug: row.slug });
                              }}
                              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeRow(row)}
                              disabled={busy}
                              className="rounded-md border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 hover:bg-red-100"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
