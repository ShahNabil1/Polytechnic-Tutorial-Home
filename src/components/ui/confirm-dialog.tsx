import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { AlertTriangle, HelpCircle, Info, ShieldAlert } from "lucide-react";

// ---------- Types ----------
export type ConfirmVariant = "default" | "danger" | "warning" | "info";

export interface ConfirmOptions {
  title?: string;
  description?: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  /** Optional icon override; falls back to variant default. */
  icon?: React.ReactNode;
}

export interface PromptOptions extends ConfirmOptions {
  /** Placeholder for the input. */
  placeholder?: string;
  /** Initial value. */
  defaultValue?: string;
  /** Minimum length required to enable confirm (default 3). */
  minLength?: number;
  /** Maximum length allowed (default 500). */
  maxLength?: number;
  /** Optional label above the input. */
  inputLabel?: string;
  /** Use multi-line textarea instead of input. */
  multiline?: boolean;
}

interface ConfirmState extends PromptOptions {
  open: boolean;
  mode?: "confirm" | "prompt";
  resolver?: (v: boolean | string | null) => void;
}

// ---------- Store (external, framework-agnostic) ----------
const listeners = new Set<() => void>();
let state: ConfirmState = { open: false };

function setState(next: ConfirmState) {
  state = next;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function getSnapshot() {
  return state;
}

/**
 * Global promise-based confirm. Usage:
 *   if (!(await confirm({ title: "Delete?", variant: "danger" }))) return;
 */
export function confirm(options: ConfirmOptions = {}): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (state.resolver) state.resolver(false);
    setState({
      ...options,
      open: true,
      mode: "confirm",
      resolver: (v) => resolve(Boolean(v)),
    });
  });
}

/**
 * Global promise-based prompt. Resolves the trimmed input string on confirm,
 * or `null` when the user cancels/closes the dialog.
 */
export function promptText(options: PromptOptions = {}): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    if (state.resolver) state.resolver(false);
    setState({
      ...options,
      open: true,
      mode: "prompt",
      resolver: (v) => resolve(typeof v === "string" ? v : null),
    });
  });
}

function close(result: boolean | string | null) {
  const r = state.resolver;
  setState({ ...state, open: false, resolver: undefined });
  r?.(result);
}

// ---------- Host component (mount once at the app root) ----------
const VARIANT_MAP: Record<
  ConfirmVariant,
  { icon: React.ReactNode; ring: string; iconWrap: string; confirmBtn: string }
> = {
  default: {
    icon: <HelpCircle className="size-5" />,
    ring: "ring-slate-200",
    iconWrap: "bg-slate-100 text-slate-700",
    confirmBtn: "bg-slate-900 hover:bg-slate-800 text-white",
  },
  danger: {
    icon: <ShieldAlert className="size-5" />,
    ring: "ring-rose-200",
    iconWrap: "bg-rose-100 text-rose-600",
    confirmBtn: "bg-rose-600 hover:bg-rose-700 text-white",
  },
  warning: {
    icon: <AlertTriangle className="size-5" />,
    ring: "ring-amber-200",
    iconWrap: "bg-amber-100 text-amber-700",
    confirmBtn: "bg-amber-600 hover:bg-amber-700 text-white",
  },
  info: {
    icon: <Info className="size-5" />,
    ring: "ring-sky-200",
    iconWrap: "bg-sky-100 text-sky-700",
    confirmBtn: "bg-sky-600 hover:bg-sky-700 text-white",
  },
};

export function ConfirmDialogHost() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const variant = s.variant ?? "default";
  const v = VARIANT_MAP[variant];

  return (
    <AlertDialog
      open={s.open}
      onOpenChange={(open) => {
        if (!open) close(false);
      }}
    >
      <AlertDialogContent className="max-w-md rounded-2xl border-0 p-0 shadow-2xl">
        <div className="p-6">
          <AlertDialogHeader>
            <div className="mb-3 flex items-center gap-3">
              <div
                className={cn(
                  "grid size-10 place-items-center rounded-full ring-4",
                  v.iconWrap,
                  v.ring,
                )}
              >
                {s.icon ?? v.icon}
              </div>
              <AlertDialogTitle className="text-base font-extrabold text-slate-900">
                {s.title ?? "Are you sure?"}
              </AlertDialogTitle>
            </div>
            {s.description !== undefined && (
              <AlertDialogDescription className="text-sm leading-relaxed text-slate-600">
                {s.description}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-5 gap-2 sm:gap-2">
            <AlertDialogCancel
              onClick={() => close(false)}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              {s.cancelLabel ?? "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => close(true)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-bold shadow-sm",
                v.confirmBtn,
              )}
            >
              {s.confirmLabel ?? "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
