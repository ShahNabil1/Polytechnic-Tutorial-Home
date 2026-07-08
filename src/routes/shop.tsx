import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { z } from "zod";
import { ProductCard } from "@/components/product-card";
import {
  DEPARTMENTS,
  PRODUCTS,
  SEMESTERS,
  productTypeLabel,
  type Department,
  type ProductType,
  type Semester,
} from "@/lib/products";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  department: z
    .enum(["computer", "civil", "electrical", "mechanical", "electronics"])
    .optional(),
  semester: z.coerce.number().int().min(1).max(8).optional(),
  type: z.enum(["physical", "ebook", "suggestion"]).optional(),
});

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "সকল বই ও সাজেশন — Polytechnic Tutorial Home" },
      {
        name: "description",
        content:
          "ডিপার্টমেন্ট, সেমিস্টার এবং প্রোডাক্ট টাইপ অনুযায়ী পলিটেকনিকের বই, ই-বুক ও সুপার সাজেশন খুঁজুন।",
      },
    ],
  }),
  validateSearch: (search) => searchSchema.parse(search),
  component: ShopPage,
});

const TYPE_OPTIONS: { id: ProductType | undefined; label: string }[] = [
  { id: undefined, label: "সব ধরনের" },
  { id: "physical", label: "ফিজিক্যাল বই" },
  { id: "ebook", label: "ই-বুক" },
  { id: "suggestion", label: "সুপার সাজেশন" },
];

function ShopPage() {
  const { department, semester, type } = Route.useSearch();

  const filtered = useMemo(() => {
    return PRODUCTS.filter((p) => {
      if (department && !p.departments.includes(department as Department))
        return false;
      if (semester && !p.semesters.includes(semester as Semester)) return false;
      if (type && p.type !== type) return false;
      return true;
    });
  }, [department, semester, type]);

  return (
    <div className="px-4 py-10 md:px-6 md:py-14">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            সকল বইসমূহ
          </h1>
          <p className="mt-2 text-muted-foreground">
            {type
              ? productTypeLabel(type as ProductType)
              : "ফিজিক্যাল বই, ই-বুক এবং সুপার সাজেশন"}
            — আপনার প্রয়োজন অনুযায়ী ফিল্টার করুন।
          </p>
        </div>

        {/* Filters */}
        <div className="mb-8 space-y-5 rounded-2xl border border-border bg-card p-5">
          <FilterRow label="প্রোডাক্ট টাইপ">
            {TYPE_OPTIONS.map((opt) => (
              <FilterChip
                key={opt.label}
                active={type === opt.id}
                to="/shop"
                search={{ department, semester, type: opt.id }}
              >
                {opt.label}
              </FilterChip>
            ))}
          </FilterRow>

          <FilterRow label="ডিপার্টমেন্ট">
            <FilterChip
              active={!department}
              to="/shop"
              search={{ semester, type }}
            >
              সব বিভাগ
            </FilterChip>
            {DEPARTMENTS.map((d) => (
              <FilterChip
                key={d.id}
                active={department === d.id}
                to="/shop"
                search={{ department: d.id, semester, type }}
              >
                {d.name}
              </FilterChip>
            ))}
          </FilterRow>

          <FilterRow label="সেমিস্টার">
            <FilterChip
              active={!semester}
              to="/shop"
              search={{ department, type }}
            >
              সব
            </FilterChip>
            {SEMESTERS.map((s) => (
              <FilterChip
                key={s.id}
                active={semester === s.id}
                to="/shop"
                search={{ department, semester: s.id, type }}
              >
                {s.name}
              </FilterChip>
            ))}
          </FilterRow>
        </div>

        {/* Results */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-16 text-center">
            <p className="text-lg font-semibold">কোনো ফলাফল পাওয়া যায়নি</p>
            <p className="mt-2 text-sm text-muted-foreground">
              অন্য ফিল্টার চেষ্টা করুন অথবা সব ফিল্টার ক্লিয়ার করুন।
            </p>
            <Link
              to="/shop"
              search={{}}
              className="mt-4 inline-block text-sm font-semibold text-brand hover:underline"
            >
              সব ফিল্টার ক্লিয়ার করুন
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function FilterChip({
  active,
  children,
  to,
  search,
}: {
  active?: boolean;
  children: React.ReactNode;
  to: string;
  search: Record<string, unknown>;
}) {
  return (
    <Link
      to={to}
      search={search}
      className={cn(
        "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
        active
          ? "bg-foreground text-background"
          : "bg-secondary text-secondary-foreground hover:bg-secondary/70",
      )}
    >
      {children}
    </Link>
  );
}
