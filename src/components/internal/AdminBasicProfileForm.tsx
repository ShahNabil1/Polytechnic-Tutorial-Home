import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Lock, Pencil, Upload, User as UserIcon, X } from "lucide-react";
import { adminUpdateTargetBasicProfile } from "@/lib/admin-users.functions";
import { uploadFileToR2 } from "@/lib/upload-client";
import { toEnglishText } from "@/lib/input-filter";
import { ImageCropperDialog } from "@/components/account/ImageCropperDialog";
import { SEMESTER_OPTIONS, DEPARTMENT_OPTIONS } from "@/lib/profile";
import { cn } from "@/lib/utils";

export type StudentFieldsInitial = {
  institute_name: string | null;
  department_name: string | null;
  current_semester: string | null;
  board_roll: string | null;
  registration_no: string | null;
};

type Props = {
  userId: string;
  initialFullName: string | null;
  initialAvatarUrl: string | null;
  studentFields?: StudentFieldsInitial | null;
  onSaved?: (patch: { full_name: string | null; avatar_url: string | null }) => void;
};

export function AdminBasicProfileForm({
  userId,
  initialFullName,
  initialAvatarUrl,
  studentFields,
  onSaved,
}: Props) {
  const save = useServerFn(adminUpdateTargetBasicProfile);
  const showStudent = !!studentFields;

  const [fullName, setFullName] = useState(initialFullName ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl ?? "");
  const [savedName, setSavedName] = useState(initialFullName ?? "");
  const [savedAvatar, setSavedAvatar] = useState(initialAvatarUrl ?? "");
  const [institute, setInstitute] = useState(studentFields?.institute_name ?? "");
  const [dept, setDept] = useState(studentFields?.department_name ?? "");
  const [semester, setSemester] = useState(studentFields?.current_semester ?? "");
  const [boardRoll, setBoardRoll] = useState(studentFields?.board_roll ?? "");
  const [regNo, setRegNo] = useState(studentFields?.registration_no ?? "");
  const [savedStudent, setSavedStudent] = useState<StudentFieldsInitial>({
    institute_name: studentFields?.institute_name ?? null,
    department_name: studentFields?.department_name ?? null,
    current_semester: studentFields?.current_semester ?? null,
    board_roll: studentFields?.board_roll ?? null,
    registration_no: studentFields?.registration_no ?? null,
  });
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pct, setPct] = useState(0);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFullName(initialFullName ?? "");
    setSavedName(initialFullName ?? "");
    setAvatarUrl(initialAvatarUrl ?? "");
    setSavedAvatar(initialAvatarUrl ?? "");
    if (studentFields) {
      setInstitute(studentFields.institute_name ?? "");
      setDept(studentFields.department_name ?? "");
      setSemester(studentFields.current_semester ?? "");
      setBoardRoll(studentFields.board_roll ?? "");
      setRegNo(studentFields.registration_no ?? "");
      setSavedStudent({
        institute_name: studentFields.institute_name ?? null,
        department_name: studentFields.department_name ?? null,
        current_semester: studentFields.current_semester ?? null,
        board_roll: studentFields.board_roll ?? null,
        registration_no: studentFields.registration_no ?? null,
      });
    }
  }, [initialFullName, initialAvatarUrl, studentFields]);


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
    setPct(0);
    try {
      const cropped = new File([blob], `avatar-${Date.now()}.jpg`, { type: "image/jpeg" });
      const { url } = await uploadFileToR2(cropped, {
        folder: "avatars",
        onProgress: (p) => setPct(p),
      });
      setAvatarUrl(url);
      toast.success("Photo uploaded", { description: "Click Save Changes to apply." });
    } catch (err) {
      toast.error("Upload failed", {
        description: err instanceof Error ? err.message : "unknown",
      });
    } finally {
      setUploading(false);
      setPct(0);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const nextName = fullName.trim();
      const nextAvatar = avatarUrl.trim();
      const studentPayload = showStudent
        ? {
            institute_name: institute.trim() || null,
            department_name: dept.trim() || null,
            current_semester: semester.trim() || null,
            board_roll: boardRoll.trim() || null,
            registration_no: regNo.trim() || null,
          }
        : {};
      await save({
        data: {
          user_id: userId,
          full_name: nextName || null,
          avatar_url: nextAvatar || null,
          ...studentPayload,
        },
      });
      setSavedName(nextName);
      setSavedAvatar(nextAvatar);
      setFullName(nextName);
      setAvatarUrl(nextAvatar);
      if (showStudent) {
        setSavedStudent({
          institute_name: studentPayload.institute_name ?? null,
          department_name: studentPayload.department_name ?? null,
          current_semester: studentPayload.current_semester ?? null,
          board_roll: studentPayload.board_roll ?? null,
          registration_no: studentPayload.registration_no ?? null,
        });
      }
      setEditMode(false);
      toast.success("Profile updated", {
        description: "Changes are reflected in the user's profile.",
      });
      onSaved?.({ full_name: nextName || null, avatar_url: nextAvatar || null });
    } catch (err) {
      toast.error("Save failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  }


  const locked = !editMode;

  return (
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
          <button
            type="button"
            onClick={() => {
              setFullName(savedName);
              setAvatarUrl(savedAvatar);
              if (showStudent) {
                setInstitute(savedStudent.institute_name ?? "");
                setDept(savedStudent.department_name ?? "");
                setSemester(savedStudent.current_semester ?? "");
                setBoardRoll(savedStudent.board_roll ?? "");
                setRegNo(savedStudent.registration_no ?? "");
              }
              setEditMode(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <X className="size-3.5" /> Cancel
          </button>
        )}
      </div>

      <div className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        {avatarUrl ? (
          <img
            src={avatarUrl}
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
            {fullName || "(no name)"}
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
                {uploading ? `Uploading... ${pct}%` : "Change Photo"}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl("")}
                  className="text-xs font-semibold text-slate-500 hover:text-red-600"
                >
                  Remove
                </button>
              )}
            </div>
          )}
          {!locked && uploading && (
            <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>
      </div>

      <form
        onSubmit={handleSave}
        className={cn("grid gap-4 sm:grid-cols-2", locked && "opacity-90")}
      >
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
            Full Name
          </span>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(toEnglishText(e.target.value))}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600"
            placeholder="Full name"
            disabled={locked}
          />
        </label>
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
    </section>
  );
}
