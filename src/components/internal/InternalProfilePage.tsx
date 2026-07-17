import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  User as UserIcon,
  Upload,
  Pencil,
  Lock,
  CheckCircle2,
  X,
} from "lucide-react";
import { PasskeysCard } from "@/components/account/PasskeysCard";
import { LinkedAccountsCard } from "@/components/account/LinkedAccountsCard";
import { PasswordCard } from "@/components/account/PasswordCard";
import { SessionsCard } from "@/components/account/SessionsCard";
import { ReauthDialogHost } from "@/components/account/ReauthDialog";
import { ImageCropperDialog } from "@/components/account/ImageCropperDialog";
import { RoleProfileFieldsEN } from "@/components/internal/RoleProfileFieldsEN";
import { MfaCardEN } from "@/components/internal/MfaCardEN";

import { uploadFileToR2 } from "@/lib/upload-client";
import { toEnglishText } from "@/lib/input-filter";
import type { ProfileRow } from "@/lib/profile";
import type { AppRole } from "@/lib/roles.functions";
import { cn } from "@/lib/utils";
import { visibleEmail } from "@/lib/synthetic-email";

type FormState = {
  full_name: string;
  avatar_url: string;
};

const EMPTY_FORM: FormState = { full_name: "", avatar_url: "" };

const ROLE_LABEL: Record<AppRole, string> = {
  student: "Student",
  employee: "Employee",
  instructor: "Instructor",
  super_admin: "Super Admin",
};

export function InternalProfilePage({ role }: { role: AppRole }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const saveProfile = useServerFn(updateMyProfile);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [savedForm, setSavedForm] = useState<FormState>(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const profileQuery = useQuery({
    queryKey: ["me", "profile"],
    queryFn: () => fetchProfile(undefined as never) as Promise<ProfileRow | null>,
    enabled: !!user,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  });
  const loading = profileQuery.isLoading;
  const loadError = profileQuery.error ? (profileQuery.error as Error).message : null;

  useEffect(() => {
    const data = profileQuery.data;
    if (!data) {
      if (profileQuery.isSuccess && !data) setEditMode(true);
      return;
    }
    const next: FormState = {
      full_name: data.full_name ?? "",
      avatar_url: data.avatar_url ?? "",
    };
    setForm(next);
    setSavedForm(next);
    setEditMode(!data.full_name);
  }, [profileQuery.data, profileQuery.isSuccess]);

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, string | null>) =>
      saveProfile({ data: payload } as never),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me", "profile"] });
      toast.success("Profile saved");
    },
    onError: (err: unknown) => {
      toast.error("Failed to save: " + (err instanceof Error ? err.message : "unknown"));
    },
  });
  const saving = saveMutation.isPending;

  const isComplete = useMemo(() => !!form.full_name.trim(), [form]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed");
      return;
    }
    setPickedFile(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleCropped(blob: Blob) {
    setPickedFile(null);
    setUploading(true);
    setUploadPct(0);
    try {
      const croppedFile = new File([blob], `avatar-${Date.now()}.jpg`, { type: "image/jpeg" });
      const { url } = await uploadFileToR2(croppedFile, {
        folder: "avatars",
        onProgress: (p) => setUploadPct(p),
      });
      updateField("avatar_url", url);
      toast.success("Photo uploaded");
    } catch (err) {
      toast.error("Upload failed: " + (err instanceof Error ? err.message : "unknown"));
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const nextForm: FormState = {
      full_name: form.full_name.trim(),
      avatar_url: form.avatar_url.trim(),
    };
    const payload: Record<string, string | null> = {
      full_name: nextForm.full_name || null,
      avatar_url: nextForm.avatar_url || null,
    };
    try {
      await saveMutation.mutateAsync(payload);
      setForm(nextForm);
      setSavedForm(nextForm);
      if (isComplete) setEditMode(false);
    } catch {
      /* handled in onError */
    }
  }

  function handleCancelEdit() {
    setForm(savedForm);
    setEditMode(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 p-6 text-sm font-medium text-red-700">
        Failed to load profile: {loadError}
      </div>
    );
  }

  const locked = !editMode;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">
          Profile &amp; Security
        </h1>
        <p className="mt-1 text-sm font-medium text-slate-500">
          Manage your personal information, sign-in methods and active sessions.{" "}
          <span className="font-semibold text-slate-700">({ROLE_LABEL[role]})</span>
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-base font-bold tracking-tight">
            <UserIcon className="size-4 text-indigo-600" />
            Personal Information
            {locked && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                <Lock className="size-3" /> Locked
              </span>
            )}
          </h2>
          {locked ? (
            <button
              type="button"
              onClick={() => setEditMode(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
            >
              <Pencil className="size-3.5" /> Edit
            </button>
          ) : (
            isComplete && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <X className="size-3.5" /> Cancel
              </button>
            )
          )}
        </div>

        <div className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          {form.avatar_url ? (
            <img
              src={form.avatar_url}
              alt=""
              className="size-24 rounded-full object-cover ring-2 ring-indigo-500/30"
            />
          ) : (
            <div className="grid size-24 place-items-center rounded-full bg-slate-100">
              <UserIcon className="size-9 text-slate-400" />
            </div>
          )}
          <div className="flex-1">
            <div className="font-display text-lg font-bold tracking-tight text-slate-900">
              {form.full_name || "Add your name"}
            </div>
            <div className="text-xs font-medium text-slate-500">
              {user?.phone || visibleEmail(user?.email) || user?.id}
            </div>
            {!locked && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFilePick}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-60"
                >
                  {uploading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Upload className="size-3.5" />
                  )}
                  {uploading ? `Uploading... ${uploadPct}%` : "Change Photo"}
                </button>
                {form.avatar_url && (
                  <button
                    type="button"
                    onClick={() => updateField("avatar_url", "")}
                    className="text-xs font-semibold text-slate-500 hover:text-red-600"
                  >
                    Remove
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <form
          onSubmit={handleSaveProfile}
          className={cn("grid gap-4 sm:grid-cols-2", locked && "opacity-90")}
        >
          <Field label="Full Name *">
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => updateField("full_name", toEnglishText(e.target.value))}
              className={inputClass}
              placeholder="Your full name"
              required
              disabled={locked}
            />
          </Field>

          {!locked && (
            <div className="sm:col-span-2 flex items-center gap-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                Save Changes
              </button>
            </div>
          )}
        </form>
      </section>

      <RoleProfileFieldsEN role={role} />

      <LinkedAccountsCard />
      <PasswordCard />
      <PasskeysCard />
      {role !== "instructor" && <MfaCardEN />}
      <SessionsCard />
      <ReauthDialogHost />

      {pickedFile && (
        <ImageCropperDialog
          file={pickedFile}
          aspect={1}
          cropShape="round"
          onCancel={() => setPickedFile(null)}
          onCropped={handleCropped}
          submitLabel="Upload"
        />
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
