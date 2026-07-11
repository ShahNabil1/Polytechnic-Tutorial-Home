// Shared product types + presentation helpers. Data lives in Supabase; see products.functions.ts.

export type ProductType = "physical" | "ebook" | "suggestion";

export type Department =
  | "computer"
  | "civil"
  | "electrical"
  | "mechanical"
  | "electronics";

export type Semester = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const DEPARTMENTS: { id: Department; name: string }[] = [
  { id: "computer", name: "কম্পিউটার" },
  { id: "civil", name: "সিভিল" },
  { id: "electrical", name: "ইলেকট্রিক্যাল" },
  { id: "mechanical", name: "মেকানিক্যাল" },
  { id: "electronics", name: "ইলেকট্রনিক্স" },
];

export const SEMESTERS: { id: Semester; name: string }[] = [
  { id: 1, name: "১ম সেমিস্টার" },
  { id: 2, name: "২য় সেমিস্টার" },
  { id: 3, name: "৩য় সেমিস্টার" },
  { id: 4, name: "৪র্থ সেমিস্টার" },
  { id: 5, name: "৫ম সেমিস্টার" },
  { id: 6, name: "৬ষ্ঠ সেমিস্টার" },
  { id: 7, name: "৭ম সেমিস্টার" },
  { id: 8, name: "৮ম সেমিস্টার" },
];

export const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  physical: "ফিজিক্যাল বই",
  ebook: "ই-বুক",
  suggestion: "সুপার সাজেশন",
};

export function productTypeLabel(type: ProductType | string): string {
  return PRODUCT_TYPE_LABEL[type as ProductType] ?? type;
}

export type ProductImage = { url: string; key?: string };

export interface Product {
  id: string;
  slug: string;
  sku?: string | null;
  title: string;
  subtitle?: string | null;
  description: string;
  type: ProductType;
  price: number;
  originalPrice?: number | null;
  images: ProductImage[];
  ogImage?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  departments: string[]; // slugs
  semesters: number[];
  stock?: number | null;
  featured?: boolean;
  isActive?: boolean;
  isOnlineBook?: boolean;
  ebookFileUrl?: string | null;
  // Legacy fields kept optional so cart items persisted before DB migration still render.
  coverColor?: string;
  coverEmoji?: string;
}
