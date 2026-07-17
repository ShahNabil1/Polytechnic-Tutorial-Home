import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ShoppingBag } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/sdash/shop")({
  validateSearch: (search) => searchSchema.parse(search),
  component: SdashShopPage,
});

function SdashShopPage() {
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
        setProducts((p as Product[]) ?? []);
        setCats((c as CategoryRow[]) ?? []);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
              বই, ই-বুক ও সাজেশন
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {type ? productTypeLabel(type as ProductType) : "সব প্রোডাক্ট"} —
              ফিল্টার করে খুঁজে বের করুন।
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm">
            <ShoppingBag className="size-4 text-slate-500" />
            <span className="font-medium text-slate-700">{filtered.length}</span>
            <span className="text-slate-500">প্রোডাক্ট</span>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <FilterRow label="প্রোডাক্ট টাইপ">
            <FilterChip active={!type} search={{ department, semester }}>
              সব ধরনের
            </FilterChip>
            {typeCats.map((c) => (
              <FilterChip
                key={c.id}
                active={type === c.slug}
                search={{ department, semester, type: c.slug as ProductType }}
              >
                {c.name}
              </FilterChip>
            ))}
          </FilterRow>

          <FilterRow label="ডিপার্টমেন্ট">
            <FilterChip active={!department} search={{ semester, type }}>
              সব বিভাগ
            </FilterChip>
            {deptCats.map((d) => (
              <FilterChip
                key={d.id}
                active={department === d.slug}
                search={{ department: d.slug, semester, type }}
              >
                {d.name}
              </FilterChip>
            ))}
          </FilterRow>

          <FilterRow label="সেমিস্টার">
            <FilterChip active={!semester} search={{ department, type }}>
              সব
            </FilterChip>
            {semCats.map((s) => (
              <FilterChip
                key={s.id}
                active={semester === Number(s.slug)}
                search={{ department, semester: Number(s.slug), type }}
              >
                {s.name}
              </FilterChip>
            ))}
          </FilterRow>
        </div>
      </div>

      {/* Products grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="mb-3 aspect-[3/4] w-full rounded-xl bg-slate-200" />
              <div className="h-4 w-3/4 rounded bg-slate-200" />
              <div className="mt-2 h-4 w-1/2 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
          <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-slate-100">
            <ShoppingBag className="size-6 text-slate-400" />
          </div>
          <p className="text-base font-semibold text-slate-900">কোনো ফলাফল পাওয়া যায়নি</p>
          <p className="mt-1 text-sm text-slate-500">
            অন্য ফিল্টার চেষ্টা করুন অথবা সব ফিল্টার ক্লিয়ার করুন।
          </p>
          <Link
            to="/sdash/shop"
            search={{}}
            className="mt-4 inline-block text-sm font-semibold text-brand hover:underline"
          >
            সব ফিল্টার ক্লিয়ার করুন
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function FilterChip({
  active,
  children,
  search,
}: {
  active?: boolean;
  children: React.ReactNode;
  search: Record<string, unknown>;
}) {
  return (
    <Link
      to="/sdash/shop"
      search={search}
      className={cn(
        "rounded-full px-3.5 py-1.5 text-sm font-medium transition-all",
        active
          ? "bg-slate-900 text-white shadow-sm"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200",
      )}
    >
      {children}
    </Link>
  );
}
