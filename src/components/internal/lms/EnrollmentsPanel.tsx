import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, UserPlus, X, Users } from "lucide-react";
import { toast } from "sonner";
import { listCourseEnrollments, grantEnrollment, revokeEnrollment } from "@/lib/lms.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { format } from "date-fns";

type Props = { courseId: string };

export function EnrollmentsPanel({ courseId }: Props) {
  const listFn = useServerFn(listCourseEnrollments);
  const grantFn = useServerFn(grantEnrollment);
  const revokeFn = useServerFn(revokeEnrollment);

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [expires, setExpires] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function refetch() {
    setLoading(true);
    try {
      const data = (await listFn({ data: { course_id: courseId } } as never)) as any[];
      setRows(data);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load enrollments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refetch();
  }, [courseId]);

  async function handleGrant() {
    if (!email.trim()) {
      toast.error("Email required");
      return;
    }
    setSaving(true);
    try {
      await grantFn({
        data: {
          course_id: courseId,
          email: email.trim(),
          expires_at: expires || null,
          note: note || null,
        },
      } as never);
      toast.success("Enrollment granted");
      setOpen(false);
      setEmail("");
      setExpires("");
      setNote("");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to grant");
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm("Revoke this enrollment?")) return;
    try {
      await revokeFn({ data: { id } } as never);
      toast.success("Revoked");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-slate-500" />
          <h3 className="font-semibold text-slate-900">Enrolled students ({rows.length})</h3>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <UserPlus className="w-4 h-4 mr-1" /> Grant access
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-slate-500 text-center py-6">No enrollments yet.</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between py-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-900 truncate">
                  {r.user_full_name || r.user_email || r.user_id}
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {r.user_email} · granted {format(new Date(r.granted_at), "MMM d, yyyy")}
                  {r.expires_at && ` · expires ${format(new Date(r.expires_at), "MMM d, yyyy")}`}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleRevoke(r.id)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant course access</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Student email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@example.com"
              />
            </div>
            <div>
              <Label>Expires at (optional)</Label>
              <Input
                type="datetime-local"
                value={expires}
                onChange={(e) => setExpires(e.target.value)}
              />
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleGrant} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Grant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
