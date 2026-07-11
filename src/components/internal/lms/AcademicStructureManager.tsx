import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  listAcademicTaxonomy,
  upsertAcademicTaxonomy,
  deleteAcademicTaxonomy,
} from "@/lib/lms.functions";
import type { AcademicCategory, AcademicKind } from "@/lib/lms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { confirm } from "@/components/ui/confirm-dialog";

type Draft = {
  id?: string;
  kind: AcademicKind;
  slug: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  dirty?: boolean;
};

export function AcademicStructureManager() {
  const listFn = useServerFn(listAcademicTaxonomy);
  const upsertFn = useServerFn(upsertAcademicTaxonomy);
  const deleteFn = useServerFn(deleteAcademicTaxonomy);

  const [rows, setRows] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Draft | null>(null);

  async function refetch() {
    setLoading(true);
    try {
      const data = (await listFn(undefined as never)) as AcademicCategory[];
      setRows(data.map((r) => ({ ...r })));
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refetch();
  }, []);

  function addRow(kind: AcademicKind) {
    setRows((prev) => [
      { kind, slug: "", name: "", sort_order: prev.filter((r) => r.kind === kind).length, is_active: true, dirty: true },
      ...prev,
    ]);
  }

  function updateRow(idx: number, patch: Partial<Draft>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch, dirty: true } : r)));
  }

  async function saveRow(idx: number) {
    const row = rows[idx];
    if (!row.name.trim() || !row.slug.trim()) {
      toast.error("Name and slug are required");
      return;
    }
    setSaving(row.id ?? `new-${idx}`);
    try {
      const res = (await upsertFn({
        data: {
          id: row.id,
          patch: {
            kind: row.kind,
            slug: row.slug.trim(),
            name: row.name.trim(),
            sort_order: row.sort_order,
            is_active: row.is_active,
          },
        },
      } as never)) as { id: string };
      setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, id: res.id, dirty: false } : r)));
      toast.success("Saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSaving(null);
    }
  }

  async function doDelete(row: Draft) {
    if (!row.id) {
      setRows((prev) => prev.filter((r) => r !== row));
      return;
    }
    try {
      await deleteFn({ data: { id: row.id } } as never);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      toast.success("Deleted");
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed");
    }
  }

  const renderKind = (kind: AcademicKind) => {
    const list = rows
      .map((r, idx) => ({ r, idx }))
      .filter(({ r }) => r.kind === kind)
      .sort((a, b) => a.r.sort_order - b.r.sort_order);
    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <p className="text-sm text-slate-600">
            {kind === "department" ? "Manage academic departments." : "Manage semesters."}
          </p>
          <Button size="sm" onClick={() => addRow(kind)}>
            <Plus className="w-4 h-4 mr-1" /> Add {kind}
          </Button>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Name</th>
                <th className="text-left px-3 py-2 font-medium w-40">Slug</th>
                <th className="text-left px-3 py-2 font-medium w-20">Order</th>
                <th className="text-left px-3 py-2 font-medium w-24">Active</th>
                <th className="text-right px-3 py-2 font-medium w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-slate-500">
                    No {kind}s yet.
                  </td>
                </tr>
              )}
              {list.map(({ r, idx }) => (
                <tr key={r.id ?? `new-${idx}`} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <Input
                      value={r.name}
                      onChange={(e) => updateRow(idx, { name: e.target.value })}
                      placeholder="e.g. Computer"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={r.slug}
                      onChange={(e) => updateRow(idx, { slug: e.target.value.toLowerCase() })}
                      placeholder="slug"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      value={r.sort_order}
                      onChange={(e) => updateRow(idx, { sort_order: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Switch
                      checked={r.is_active}
                      onCheckedChange={(v) => updateRow(idx, { is_active: v })}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => saveRow(idx)}
                      disabled={saving === (r.id ?? `new-${idx}`) || !r.dirty}
                    >
                      {saving === (r.id ?? `new-${idx}`) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        if (
                          await confirm({
                            title: `Delete ${r.name || "entry"}?`,
                            description: "This will remove the entry. Subjects linked to it lose the association.",
                            variant: "danger",
                            confirmLabel: "Delete",
                          })
                        ) {
                          doDelete(r);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">Academic Structure</h1>
        <p className="mt-1 text-sm text-slate-500">Departments and semesters used across LMS and shop.</p>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <Tabs defaultValue="department">
          <TabsList>
            <TabsTrigger value="department">Departments</TabsTrigger>
            <TabsTrigger value="semester">Semesters</TabsTrigger>
          </TabsList>
          <TabsContent value="department" className="mt-4">{renderKind("department")}</TabsContent>
          <TabsContent value="semester" className="mt-4">{renderKind("semester")}</TabsContent>
        </Tabs>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title={`Delete ${confirmDelete?.name || "entry"}?`}
        description="This will remove the entry. Subjects linked to it will lose the association."
        confirmText="Delete"
        onConfirm={async () => {
          if (confirmDelete) await doDelete(confirmDelete);
          setConfirmDelete(null);
        }}
      />
    </div>
  );
}
