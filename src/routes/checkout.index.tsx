import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AlertTriangle, Lock, ShoppingBag } from "lucide-react";
import {
  useCart,
  cartSubtotal,
  calcShipping,
  hasPhysical,
  hasOnlineBook,
} from "@/lib/cart-store";
import { formatBDT, toBanglaNumber } from "@/lib/format";
import { productTypeLabel } from "@/lib/products";
import { BD_LOCATIONS, normalizeBanglaPhone } from "@/lib/bd-locations";
import { cn } from "@/lib/utils";
import { createOrder } from "@/lib/orders.functions";
import { computeFingerprint } from "@/lib/fingerprint";
import {
  queueIncompleteCapture,
  flushIncompleteCaptureNow,
  resetIncompleteCapture,
  stashSnapshotForReturn,
  clearStashedSnapshot,
} from "@/lib/incomplete-checkout-client";
import { useCoupon } from "@/lib/coupon-store";
import { CouponBlock } from "@/components/checkout/CouponBlock";


export const Route = createFileRoute("/checkout/")({
  head: () => ({
    meta: [
      { title: "চেকআউট — Polytechnic Tutorial Home" },
      { name: "description", content: "গেস্ট চেকআউট — সাইন আপ ছাড়াই অর্ডার।" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutPage,
});

const phoneSchema = z
  .string()
  .regex(/^01[3-9]\d{8}$/, "১১ ডিজিটের সঠিক নম্বর দিন (01[3-9]XXXXXXXX)");

function CheckoutPage() {
  const navigate = useNavigate();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const appliedCoupon = useCoupon((s) => s.applied);
  const clearCoupon = useCoupon((s) => s.clear);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    division: "",
    district: "",
    upazila: "",
    address: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  const isPhysical = hasPhysical(items);
  const isOnline = hasOnlineBook(items);
  const emailMandatory = isOnline; // online-only OR mixed → mandatory
  const subtotal = cartSubtotal(items);

  const divisions = BD_LOCATIONS;
  const districts = useMemo(
    () => divisions.find((d) => d.name === form.division)?.districts ?? [],
    [form.division, divisions],
  );
  const upazilas = useMemo(
    () => districts.find((d) => d.name === form.district)?.upazilas ?? [],
    [districts, form.district],
  );

  const shipping = useMemo(
    () => calcShipping(items, form.district),
    [items, form.district],
  );
  const total = subtotal + shipping;

  if (items.length === 0) {
    return (
      <div className="px-4 py-20 md:px-6">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto mb-6 grid size-20 place-items-center rounded-full bg-brand-soft text-brand">
            <ShoppingBag className="size-10" />
          </div>
          <h1 className="text-2xl font-bold">কার্ট খালি</h1>
          <p className="mt-2 text-muted-foreground">
            চেকআউট করতে হলে আগে কার্টে প্রোডাক্ট যোগ করুন।
          </p>
          <Link
            to="/shop"
            className="mt-6 inline-flex rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground hover:bg-brand/90"
          >
            শপে যান
          </Link>
        </div>
      </div>
    );
  }

  function update<K extends keyof typeof form>(field: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      let v = e.target.value;
      if (field === "phone") v = normalizeBanglaPhone(v).slice(0, 11);
      if (field === "email") v = v.replace(/[^\x20-\x7E]/g, "");
      setForm((f) => {
        const next = { ...f, [field]: v };
        if (field === "division") { next.district = ""; next.upazila = ""; }
        if (field === "district") { next.upazila = ""; }
        return next;
      });
      setErrors((prev) => {
        if (!prev[field]) return prev;
        const n = { ...prev };
        delete n[field];
        return n;
      });
    };
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (form.name.trim().length < 3) errs.name = "নাম সর্বনিম্ন ৩ অক্ষরের হতে হবে";
    const phoneCheck = phoneSchema.safeParse(form.phone);
    if (!phoneCheck.success) errs.phone = phoneCheck.error.issues[0].message;

    if (emailMandatory) {
      const em = z.string().trim().email().safeParse(form.email);
      if (!em.success) errs.email = "সঠিক ইমেইল দিন — ভুল হলে ই-বুকের এ্যাক্সেস পাবেন না";
    } else if (form.email.trim()) {
      const em = z.string().trim().email().safeParse(form.email);
      if (!em.success) errs.email = "সঠিক ইমেইল দিন";
    }

    if (isPhysical) {
      if (!form.division) errs.division = "বিভাগ সিলেক্ট করুন";
      if (!form.district) errs.district = "জেলা সিলেক্ট করুন";
      if (!form.upazila) errs.upazila = "উপজেলা/থানা সিলেক্ট করুন";
      if (form.address.trim().length < 5) errs.address = "গ্রাম / এরিয়া / বাসা / রোড লিখুন";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const createOrderFn = useServerFn(createOrder);

  // ---- Source attribution (utm / referrer) ----
  // Detect once on mount; sessionStorage persists it across the checkout flow.
  const sourceRef = useRef<{ source: "website" | "direct" | "manual" | "fb_utm" | "google" | "other"; detail: string }>({ source: "website", detail: "" });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const cached = sessionStorage.getItem("pt_order_source");
      if (cached) { sourceRef.current = JSON.parse(cached); return; }
      const params = new URLSearchParams(window.location.search);
      const utmSource = (params.get("utm_source") || "").toLowerCase();
      const utmMedium = params.get("utm_medium") || "";
      const utmCampaign = params.get("utm_campaign") || "";
      const ref = document.referrer || "";
      let source: typeof sourceRef.current.source = "website";
      let detail = "";
      if (utmSource) {
        if (/facebook|fb|meta|instagram|ig/.test(utmSource)) source = "fb_utm";
        else if (/google|adwords|gads|youtube/.test(utmSource)) source = "google";
        else source = "other";
        detail = [utmSource, utmMedium, utmCampaign].filter(Boolean).join(" · ");
      } else if (ref) {
        try {
          const host = new URL(ref).hostname.replace(/^www\./, "");
          if (/facebook|instagram|fb\.com|meta\./.test(host)) { source = "fb_utm"; detail = host; }
          else if (/google\./.test(host)) { source = "google"; detail = host; }
          else if (!host.includes(window.location.hostname)) { source = "other"; detail = host; }
        } catch {}
      } else {
        source = "direct";
      }
      sourceRef.current = { source, detail };
      sessionStorage.setItem("pt_order_source", JSON.stringify(sourceRef.current));
    } catch {}
  }, []);

  // ---- Incomplete checkout capture ----
  // Fire once the phone becomes a valid 11-digit BD number, and on subsequent form changes.
  const phoneValid = /^01[3-9]\d{8}$/.test(form.phone);
  useEffect(() => {
    if (!phoneValid || items.length === 0 || submittedRef.current) return;
    queueIncompleteCapture({
      customer: {
        name: form.name || "",
        phone: form.phone,
        email: form.email || "",
        division: form.division || "",
        district: form.district || "",
        upazila: form.upazila || "",
        address: form.address || "",
      },
      items: items.map((i) => ({
        productId: i.productId,
        title: i.title,
        unitPrice: i.price,
        quantity: i.quantity,
        image: i.image || "",
      })),
      totals: { subtotal, shipping, total },
    });
  }, [phoneValid, form, items, subtotal, shipping, total]);

  // Flush on tab close / navigation away.
  useEffect(() => {
    const onLeave = () => {
      if (!submittedRef.current && phoneValid) flushIncompleteCaptureNow();
    };
    window.addEventListener("pagehide", onLeave);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("pagehide", onLeave);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [phoneValid]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittedRef.current || submitting) return;
    if (!validate()) return;
    submittedRef.current = true;
    setSubmitting(true);

    // Stable idempotency key = SHA256(cart + customer + total)
    const idemPayload = JSON.stringify({
      c: form,
      i: items.map((i) => [i.productId, i.quantity, i.price, i.isOnlineBook ?? false]),
      t: total,
    });
    const idemKey = await sha256Hex(idemPayload);

    // Stash a snapshot so /checkout/return can record gateway cancel/fail/timeout outcomes
    // against the same signature row (no duplicates: DB unique + RPC upsert).
    stashSnapshotForReturn({
      customer: {
        name: form.name,
        phone: form.phone,
        email: form.email || "",
        division: form.division || "",
        district: form.district || "",
        upazila: form.upazila || "",
        address: form.address || "",
      },
      items: items.map((i) => ({
        productId: i.productId,
        title: i.title,
        unitPrice: i.price,
        quantity: i.quantity,
        image: i.image || "",
      })),
      totals: { subtotal, shipping, total },
      outcome: "pending",
    });

    try {
      const fingerprint = await computeFingerprint();
      const res = await createOrderFn({

        data: {
          idempotencyKey: idemKey,
          fingerprint,
          customer: {
            name: form.name,
            phone: form.phone,
            email: form.email || "",
            division: form.division || "",
            district: form.district || "",
            upazila: form.upazila || "",
            address: form.address || "",
          },
          items: items.map((i) => ({
            productId: i.productId,
            title: i.title,
            unitPrice: i.price,
            quantity: i.quantity,
            image: i.image || "",
            isBundle: !!i.isBundle,
            isOnlineBook: !!i.isOnlineBook,
            type: i.type,
          })),
          totals: { subtotal, shipping, total },
          source: sourceRef.current.source,
          sourceDetail: sourceRef.current.detail || "",
        },
      });
      const orderNo = res.orderNo;

      const snapshot = {
        orderNo,
        status: (res.status ?? "processing") as "processing",
        createdAt: Date.now(),
        idempotencyKey: idemKey,
        customer: { ...form },
        items: items.map((i) => ({
          productId: i.productId,
          title: i.title,
          type: i.type,
          isOnlineBook: i.isOnlineBook,
          price: i.price,
          quantity: i.quantity,
          image: i.image,
          coverEmoji: i.coverEmoji,
          coverColor: i.coverColor,
        })),
        subtotal,
        shipping,
        total,
        isPhysical,
      };
      try {
        sessionStorage.setItem(`order:${orderNo}`, JSON.stringify(snapshot));
        sessionStorage.setItem("order:last", orderNo);
      } catch {}
      resetIncompleteCapture();
      clearStashedSnapshot();
      clear();

      navigate({
        to: "/checkout/success",
        search: { order: orderNo, digital: isPhysical ? undefined : 1 },
      });
    } catch (err: any) {
      submittedRef.current = false;
      setSubmitting(false);
      const msg = String(err?.message || err || "");
      if (msg.startsWith("BLOCKED")) {
        setErrors({ _global: "এই ডিভাইস/ফোন/আইপি থেকে অর্ডার প্লেস করা যাবে না।" });
      } else {
        setErrors({ _global: "অর্ডার তৈরি করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।" });
      }
    }
  }

  return (
    <div className="px-4 py-8 md:px-6 md:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand">
            Secure Checkout
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight md:text-3xl">
            You're one step away from your books
          </h1>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">
            Fill in your details below — no account needed. Pay securely with bKash, Nagad, Rocket or card, and we'll take it from there.
          </p>
        </div>


        <form
          onSubmit={onSubmit}
          className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]"
        >
          <div className="space-y-5">
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-base font-extrabold">
                {isPhysical ? "Delivery Address" : "Your Details"}
              </h2>



              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="আপনার নাম" required error={errors.name} className="sm:col-span-2">
                  <input
                    type="text"
                    value={form.name}
                    onChange={update("name")}
                    className="input"
                  />
                </Field>
                <Field label="মোবাইল নম্বর" required error={errors.phone}>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={form.phone}
                    onChange={update("phone")}
                    placeholder="01XXXXXXXXX"
                    maxLength={11}
                    className="input font-inter"
                  />
                </Field>
                <Field
                  label={emailMandatory ? "ইমেইল" : "ইমেইল (ঐচ্ছিক)"}
                  required={emailMandatory}
                  error={errors.email}
                >
                  <input
                    type="email"
                    value={form.email}
                    onChange={update("email")}
                    placeholder="you@example.com"
                    className="input font-inter"
                  />
                </Field>

                {emailMandatory && (
                  <div className="sm:col-span-2 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-[11.5px] font-semibold text-amber-800">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <span>
                      সতর্কতাঃ ইমেইল ভুল দিলে অনলাইন / ই-বুকের এ্যাক্সেস পাবেন না।
                      ইমেইল সঠিকভাবে টাইপ করুন।
                    </span>
                  </div>
                )}

                {isPhysical && (
                  <>
                    <Field label="বিভাগ" required error={errors.division}>
                      <select value={form.division} onChange={update("division")} className="input">
                        <option value="">সিলেক্ট করুন…</option>
                        {divisions.map((d) => (
                          <option key={d.name} value={d.name}>{d.name}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="জেলা" required error={errors.district}>
                      <select
                        value={form.district}
                        onChange={update("district")}
                        disabled={!form.division}
                        className="input disabled:opacity-50"
                      >
                        <option value="">সিলেক্ট করুন…</option>
                        {districts.map((d) => (
                          <option key={d.name} value={d.name}>{d.name}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="উপজেলা / থানা" required error={errors.upazila} className="sm:col-span-2">
                      <select
                        value={form.upazila}
                        onChange={update("upazila")}
                        disabled={!form.district}
                        className="input disabled:opacity-50"
                      >
                        <option value="">সিলেক্ট করুন…</option>
                        {upazilas.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="গ্রাম / এরিয়া / বাসা / রোড" required error={errors.address} className="sm:col-span-2">
                      <textarea
                        value={form.address}
                        onChange={update("address")}
                        placeholder="বাসা/গ্রাম, রোড, ল্যান্ডমার্ক লিখুন"
                        className="input h-20 resize-none"
                      />
                    </Field>
                  </>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-base font-extrabold">পেমেন্ট পদ্ধতি</h2>
              <div className="mt-3 rounded-xl border border-brand/20 bg-brand-soft/40 p-3.5">
                <p className="text-sm font-bold text-brand">Paystation দিয়ে সিকিউর পেমেন্ট</p>
                <p className="mt-1 text-[11.5px] text-brand/80">
                  "অর্ডার কনফার্ম" বাটনে ক্লিক করলে Paystation পেজে বিকাশ / নগদ / রকেট / কার্ড দিয়ে
                  পেমেন্ট করতে পারবেন।
                </p>
              </div>
            </section>
          </div>

          <aside className="h-fit space-y-4 lg:sticky lg:top-24">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-base font-extrabold">অর্ডার সামারি</h2>

              <div className="mt-3 space-y-3 border-t border-border pt-3">
                {items.map((i) => (
                  <div key={i.productId} className="flex gap-3">
                    <div
                      className={cn(
                        "grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br text-xl",
                        !i.image && (i.coverColor ?? "from-slate-200 to-slate-400"),
                      )}
                    >
                      {i.image ? (
                        <img src={i.image} alt={i.title} className="h-full w-full object-cover" />
                      ) : (
                        i.coverEmoji ?? "📦"
                      )}
                    </div>
                    <div className="flex flex-1 flex-col text-sm">
                      <p className="line-clamp-2 font-bold leading-snug">{i.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {i.isOnlineBook ? "অনলাইন বুক" : productTypeLabel(i.type)} ×{" "}
                        <span className="font-inter tabular-nums">{toBanglaNumber(i.quantity)}</span>
                      </p>
                    </div>
                    <p className="text-sm font-bold tabular-nums">
                      {formatBDT(i.price * i.quantity)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">সাবটোটাল</span>
                  <span className="font-bold tabular-nums">{formatBDT(subtotal)}</span>
                </div>
                {isPhysical && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ডেলিভারি চার্জ</span>
                    <span className={cn("tabular-nums", !form.district && "text-xs text-muted-foreground")}>
                      {form.district ? formatBDT(shipping) : "জেলা দিলে দেখাবে"}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-3 flex justify-between border-t border-dashed border-border pt-3">
                <span className="text-base font-extrabold">সর্বমোট</span>
                <span className="text-xl font-extrabold tabular-nums">{formatBDT(total)}</span>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3.5 text-sm font-extrabold text-brand-foreground shadow-lg shadow-brand/20 transition-all hover:bg-brand/90 disabled:opacity-60"
              >
                {submitting ? "প্রসেস হচ্ছে..." : (<><Lock className="size-4" />অর্ডার কনফার্ম করুন</>)}
              </button>

              {errors._global && (
                <p className="mt-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-center text-[11.5px] font-bold text-destructive">
                  {errors._global}
                </p>
              )}

              <p className="mt-2.5 text-center text-[10.5px] text-muted-foreground">
                অর্ডার কনফার্ম করে আপনি আমাদের <a href="#" className="underline">শর্তাবলী</a> মেনে নিচ্ছেন।
              </p>
            </div>
          </aside>
        </form>
      </div>

      <style>{`
        .input {
          width: 100%;
          border-radius: 0.65rem;
          background: var(--color-surface);
          padding: 0.6rem 0.8rem;
          font-size: 0.875rem;
          font-weight: 600;
          outline: none;
          box-shadow: inset 0 0 0 1px var(--color-border);
          transition: box-shadow 0.15s;
        }
        .input:focus { box-shadow: inset 0 0 0 2px var(--color-brand); }
      `}</style>
    </div>
  );
}

async function sha256Hex(input: string): Promise<string> {
  try {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch {}
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0;
  return `f${(h >>> 0).toString(16)}`;
}

function Field({
  label, required, error, children, className,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-[12px] font-bold">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-[11px] font-semibold text-destructive">{error}</span>}
    </label>
  );
}
