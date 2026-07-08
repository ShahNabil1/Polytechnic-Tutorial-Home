import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { Lock, ShoppingBag } from "lucide-react";
import {
  useCart,
  cartSubtotal,
  calcShipping,
  hasPhysical,
} from "@/lib/cart-store";
import { formatBDT, toBanglaNumber } from "@/lib/format";
import { productTypeLabel } from "@/lib/products";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "চেকআউট — Polytechnic Tutorial Home" },
      { name: "description", content: "গেস্ট চেকআউট — সাইন আপ ছাড়াই অর্ডার।" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutPage,
});

const physicalSchema = z.object({
  name: z.string().trim().min(2, "নাম দিন").max(80),
  phone: z
    .string()
    .trim()
    .regex(/^01[0-9]{9}$/, "সঠিক মোবাইল নম্বর দিন (11 digit)"),
  email: z.string().trim().email("সঠিক ইমেইল দিন").optional().or(z.literal("")),
  address: z.string().trim().min(10, "সম্পূর্ণ ঠিকানা দিন").max(300),
  city: z.string().trim().min(2, "জেলা / শহর দিন").max(60),
});

const digitalSchema = z.object({
  name: z.string().trim().min(2, "নাম দিন").max(80),
  phone: z
    .string()
    .trim()
    .regex(/^01[0-9]{9}$/, "সঠিক মোবাইল নম্বর দিন (11 digit)"),
  email: z.string().trim().email("সঠিক ইমেইল দিন"),
});

function CheckoutPage() {
  const navigate = useNavigate();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const isPhysical = hasPhysical(items);
  const subtotal = cartSubtotal(items);
  const shipping = useMemo(
    () => calcShipping(items, form.city),
    [items, form.city],
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

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
      setErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const schema = isPhysical ? physicalSchema : digitalSchema;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        const key = String(i.path[0]);
        if (!errs[key]) errs[key] = i.message;
      });
      setErrors(errs);
      return;
    }

    setSubmitting(true);
    // Mock payment redirect — will be wired to Paystation once keys are added.
    await new Promise((r) => setTimeout(r, 900));

    const orderNo = `PE-${Date.now().toString().slice(-8)}`;
    clear();
    navigate({
      to: "/checkout/success",
      search: {
        order: orderNo,
        digital: isPhysical ? undefined : 1,
      },
    });
  }

  return (
    <div className="px-4 py-10 md:px-6 md:py-14">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          গেস্ট চেকআউট
        </h1>
        <p className="mt-1 text-muted-foreground">
          কোনো অ্যাকাউন্ট খোলার প্রয়োজন নেই — নিচের তথ্য দিয়ে সরাসরি অর্ডার
          করুন।
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]"
        >
          <div className="space-y-6">
            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-lg font-bold">
                {isPhysical ? "ডেলিভারি ঠিকানা" : "আপনার তথ্য"}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {isPhysical
                  ? "কুরিয়ার আপনার এই ঠিকানায় বই পৌঁছে দেবে।"
                  : "পেমেন্টের পর ডাউনলোড লিংক এই ইমেইলে পাঠানো হবে।"}
              </p>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field
                  label="আপনার নাম"
                  required
                  error={errors.name}
                  className="md:col-span-2"
                >
                  <input
                    type="text"
                    value={form.name}
                    onChange={update("name")}
                    placeholder="যেমনঃ মোঃ রাকিব হাসান"
                    className="input"
                  />
                </Field>
                <Field
                  label="মোবাইল নম্বর"
                  required
                  error={errors.phone}
                >
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={update("phone")}
                    placeholder="01XXXXXXXXX"
                    className="input font-inter"
                  />
                </Field>
                <Field
                  label={
                    isPhysical ? "ইমেইল (ঐচ্ছিক)" : "ইমেইল"
                  }
                  required={!isPhysical}
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
                {isPhysical && (
                  <>
                    <Field
                      label="জেলা / শহর"
                      required
                      error={errors.city}
                    >
                      <input
                        type="text"
                        value={form.city}
                        onChange={update("city")}
                        placeholder="যেমনঃ ঢাকা"
                        className="input"
                      />
                    </Field>
                    <div className="md:col-span-2">
                      <Field
                        label="পূর্ণ ঠিকানা"
                        required
                        error={errors.address}
                      >
                        <textarea
                          value={form.address}
                          onChange={update("address")}
                          placeholder="বাসা / রোড / থানা / ল্যান্ডমার্ক"
                          className="input h-24 resize-none"
                        />
                      </Field>
                    </div>
                  </>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-lg font-bold">পেমেন্ট পদ্ধতি</h2>
              <div className="mt-4 rounded-xl border border-brand/20 bg-brand-soft/40 p-4">
                <p className="text-sm font-semibold text-brand">
                  Paystation দিয়ে সিকিউর পেমেন্ট
                </p>
                <p className="mt-1 text-xs text-brand/80">
                  "অর্ডার কনফার্ম" বাটনে ক্লিক করলে আপনাকে Paystation পেজে
                  নিয়ে যাওয়া হবে যেখানে বিকাশ / নগদ / রকেট / কার্ড দিয়ে
                  পেমেন্ট করতে পারবেন।
                </p>
              </div>
            </section>
          </div>

          <aside className="h-fit space-y-4 lg:sticky lg:top-24">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-lg font-bold">অর্ডার সামারি</h2>

              <div className="mt-4 space-y-3 border-t border-border pt-4">
                {items.map((i) => (
                  <div key={i.productId} className="flex gap-3">
                    <div
                      className={cn(
                        "grid size-12 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-xl",
                        i.coverColor,
                      )}
                    >
                      {i.coverEmoji}
                    </div>
                    <div className="flex flex-1 flex-col text-sm">
                      <p className="line-clamp-1 font-medium">{i.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {productTypeLabel(i.type)} ×{" "}
                        <span className="font-inter tabular-nums">
                          {toBanglaNumber(i.quantity)}
                        </span>
                      </p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums">
                      {formatBDT(i.price * i.quantity)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">সাবটোটাল</span>
                  <span className="font-semibold tabular-nums">
                    {formatBDT(subtotal)}
                  </span>
                </div>
                {isPhysical && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      ডেলিভারি চার্জ
                    </span>
                    <span
                      className={cn(
                        "tabular-nums",
                        !form.city && "text-xs text-muted-foreground",
                      )}
                    >
                      {form.city
                        ? formatBDT(shipping)
                        : "শহর দিলে দেখাবে"}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex justify-between border-t border-dashed border-border pt-4">
                <span className="text-base font-semibold">সর্বমোট</span>
                <span className="text-xl font-bold tabular-nums">
                  {formatBDT(total)}
                </span>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-6 py-4 text-sm font-semibold text-brand-foreground shadow-lg shadow-brand/20 transition-all hover:bg-brand/90 disabled:opacity-60"
              >
                {submitting ? (
                  "প্রসেস হচ্ছে..."
                ) : (
                  <>
                    <Lock className="size-4" />
                    অর্ডার কনফার্ম করুন
                  </>
                )}
              </button>

              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                অর্ডার কনফার্ম করে আপনি আমাদের{" "}
                <a href="#" className="underline">
                  শর্তাবলী
                </a>{" "}
                মেনে নিচ্ছেন।
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
          padding: 0.75rem 0.9rem;
          font-size: 0.9rem;
          outline: none;
          box-shadow: inset 0 0 0 1px var(--color-border);
          transition: box-shadow 0.15s;
        }
        .input:focus {
          box-shadow: inset 0 0 0 2px var(--color-brand);
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </span>
      {children}
      {error && (
        <span className="mt-1 block text-xs text-destructive">{error}</span>
      )}
    </label>
  );
}
