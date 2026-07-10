import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ProductCard } from "@/components/product-card";
import type { CategoryRow } from "@/lib/products.functions";
import { listPublicCategories, listPublicProducts } from "@/lib/products.functions";
import type { Product, ProductType } from "@/lib/products";
import { productTypeLabel } from "@/lib/products";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  department: z.string().optional(),
  semester: z.coerce.number().int().min(1).max(50).optional(),
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

function ShopPage() {
  const { department, semester, type } = Route.useSearch();
  const fetchProducts = useServerFn(listPublicProducts);
  const fetchCategories = useServerFn(listPublicCategories);

  const [products, setProducts] = useState<Product[]>([]);
  const [cats, setCats] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetchProducts({ data: undefined as never }),
      fetchCategories({ data: undefined as never }),
    ])
      .then(([p, c]) => {
        if (!mounted) return;
        setProducts(p ?? []);
        setCats(c ?? []);
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [fetchProducts, fetchCategories]);

  const typeCats = cats.filter((c) => c.kind === "product_type");
  const deptCats = cats.filter((c) => c.kind === "department");
  const semCats = cats.filter((c) => c.kind === "semester");

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (department && !p.departments.includes(department)) return false;
      if (semester && !p.semesters.includes(semester)) return false;
      if (type && p.type !== type) return false;
      return true;
    });
  }, [products, department, semester, type]);

  return (
    <div className="px-4 py-10 md:px-6 md:py-14">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">সকল বইসমূহ</h1>
          <p className="mt-2 font-semibold text-muted-foreground">
            {type ? productTypeLabel(type as ProductType) : "ফিজিক্যাল বই, ই-বুক এবং সুপার সাজেশন"} —
            আপনার প্রয়োজন অনুযায়ী ফিল্টার করুন।
          </p>
        </div>


        <div className="mb-8 space-y-5 rounded-2xl border border-border bg-card p-5">
          <FilterRow label="প্রোডাক্ট টাইপ">
            <FilterChip active={!type} to="/shop" search={{ department, semester }}>
              সব ধরনের
            </FilterChip>
            {typeCats.map((c) => (
              <FilterChip
                key={c.id}
                active={type === c.slug}
                to="/shop"
                search={{ department, semester, type: c.slug as ProductType }}
              >
                {c.name}
              </FilterChip>
            ))}
          </FilterRow>

          <FilterRow label="ডিপার্টমেন্ট">
            <FilterChip active={!department} to="/shop" search={{ semester, type }}>
              সব বিভাগ
            </FilterChip>
            {deptCats.map((d) => (
              <FilterChip
                key={d.id}
                active={department === d.slug}
                to="/shop"
                search={{ department: d.slug, semester, type }}
              >
                {d.name}
              </FilterChip>
            ))}
          </FilterRow>

          <FilterRow label="সেমিস্টার">
            <FilterChip active={!semester} to="/shop" search={{ department, type }}>
              সব
            </FilterChip>
            {semCats.map((s) => (
              <FilterChip
                key={s.id}
                active={semester === Number(s.slug)}
                to="/shop"
                search={{ department, semester: Number(s.slug), type }}
              >
                {s.name}
              </FilterChip>
            ))}
          </FilterRow>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="mb-4 aspect-[3/4] w-full rounded-xl bg-slate-200" />
                <div className="h-4 w-3/4 rounded bg-slate-200" />
                <div className="mt-2 h-4 w-1/2 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-16 text-center">
            <p className="text-lg font-extrabold">কোনো ফলাফল পাওয়া যায়নি</p>
            <p className="mt-2 text-sm font-medium text-muted-foreground">
              অন্য ফিল্টার চেষ্টা করুন অথবা সব ফিল্টার ক্লিয়ার করুন।
            </p>
            <Link
              to="/shop"
              search={{}}
              className="mt-4 inline-block text-sm font-bold text-brand hover:underline"
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

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
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
