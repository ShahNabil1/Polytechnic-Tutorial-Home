import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bookmark, Trash2, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  listCrmSegments,
  saveCrmSegment,
  deleteCrmSegment,
  type CrmSegmentRow,
} from "@/lib/crm-bulk.functions";

type Kind = "customers" | "signed" | "guests" | "incomplete";

export function CrmSegmentBar({
  kind,
  search,
  onApply,
}: {
  kind: Kind;
  search: string;
  onApply: (search: string) => void;
}) {
  const listFn = useServerFn(listCrmSegments);
  const saveFn = useServerFn(saveCrmSegment);
  const delFn = useServerFn(deleteCrmSegment);

  const [segments, setSegments] = useState<CrmSegmentRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    refresh();
    setSelected(null);
  }, [kind]);

  async function refresh() {
    try {
      const rows = await listFn({ data: { kind } });
      setSegments(rows as CrmSegmentRow[]);
    } catch {
      /* noop */
    }
  }

  async function handleSave() {
    if (!newName.trim()) return toast.error("Name required");
    setSaving(true);
    try {
      await saveFn({
        data: {
          name: newName.trim(),
          kind,
          filter: { search: search || undefined },
        },
      });
      toast.success("Segment saved");
      setNewName("");
      setShowSave(false);
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this saved segment?")) return;
    try {
      await delFn({ data: { id } });
      if (selected === id) setSelected(null);
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <Bookmark className="size-3.5" /> Segments:
      </span>
      {segments.length === 0 ? (
        <span className="text-xs text-muted-foreground">none saved</span>
      ) : (
        segments.map((s) => (
          <span
            key={s.id}
            className={`group inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs cursor-pointer transition-colors ${
              selected === s.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background hover:border-primary/40"
            }`}
          >
            <button
              onClick={() => {
                setSelected(s.id);
                onApply(s.filter?.search ?? "");
              }}
            >
              {s.name}
            </button>
            <button
              onClick={() => handleDelete(s.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              title="Delete segment"
            >
              <Trash2 className="size-3 text-destructive" />
            </button>
          </span>
        ))
      )}
      <div className="ml-auto flex items-center gap-1.5">
        {showSave ? (
          <>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Segment name"
              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              Save
            </button>
            <button
              onClick={() => {
                setShowSave(false);
                setNewName("");
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setShowSave(true)}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs hover:border-primary/40"
          >
            <Save className="size-3" /> Save current
          </button>
        )}
      </div>
    </div>
  );
}
