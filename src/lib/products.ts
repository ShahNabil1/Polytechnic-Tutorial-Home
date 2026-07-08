export type ProductType = "physical" | "ebook" | "suggestion";

export type Department =
  | "computer"
  | "civil"
  | "electrical"
  | "mechanical"
  | "electronics";

export type Semester = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface Product {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  description: string;
  type: ProductType;
  price: number;
  originalPrice?: number;
  coverColor: string; // gradient class for placeholder
  coverEmoji: string;
  departments: Department[];
  semesters: Semester[];
  stock?: number;
  featured?: boolean;
}

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

export const PRODUCTS: Product[] = [
  {
    id: "p1",
    slug: "data-structure-algorithm",
    title: "ডেটা স্ট্রাকচার ও অ্যালগরিদম",
    subtitle: "কম্পিউটার প্রযুক্তি | ৫ম সেমিস্টার",
    description:
      "পলিটেকনিক ৫ম সেমিস্টারের জন্য পূর্ণাঙ্গ ডেটা স্ট্রাকচার ও অ্যালগরিদম বই। প্রতিটি অধ্যায় বাংলায় সহজ ভাষায় ব্যাখ্যা করা, বোর্ড প্রশ্নের সমাধান, এবং প্র্যাকটিস প্রব্লেম সেট সংযুক্ত।",
    type: "physical",
    price: 450,
    originalPrice: 550,
    coverColor: "from-emerald-500 to-teal-700",
    coverEmoji: "💻",
    departments: ["computer"],
    semesters: [5],
    stock: 42,
    featured: true,
  },
  {
    id: "p2",
    slug: "engineering-math-3-suggestion",
    title: "ইঞ্জিনিয়ারিং ম্যাথমেটিক্স-৩",
    subtitle: "সুপার সাজেশন | সব বিভাগ",
    description:
      "চূড়ান্ত পরীক্ষার আগে অভিজ্ঞ শিক্ষকদের যাচাইকৃত ১০০% কমন সাজেশন। PDF ফরম্যাটে পেমেন্টের পরপরই ডাউনলোড লিংক ইমেইলে পাঠানো হবে।",
    type: "suggestion",
    price: 120,
    coverColor: "from-amber-400 to-orange-600",
    coverEmoji: "📐",
    departments: ["computer", "civil", "electrical", "mechanical", "electronics"],
    semesters: [3],
    featured: true,
  },
  {
    id: "p3",
    slug: "circuit-theory-1",
    title: "সার্কিট থিওরি-১",
    subtitle: "ইলেকট্রিক্যাল প্রযুক্তি | ২য় সেমিস্টার",
    description:
      "সার্কিট এনালাইসিসের মৌলিক ধারণা, KCL, KVL, Thevenin, Norton থিওরেম — সবকিছুর ধাপে ধাপে বাংলা ব্যাখ্যা সহ ই-বুক। ইনস্ট্যান্ট ডাউনলোড।",
    type: "ebook",
    price: 280,
    coverColor: "from-sky-500 to-blue-700",
    coverEmoji: "⚡",
    departments: ["electrical", "electronics"],
    semesters: [2],
    featured: true,
  },
  {
    id: "p4",
    slug: "engineering-materials",
    title: "ইঞ্জিনিয়ারিং ম্যাটেরিয়ালস",
    subtitle: "সিভিল প্রযুক্তি | ৪র্থ সেমিস্টার",
    description:
      "কনক্রিট, স্টিল, কাঠ, বিটুমিনসহ সকল ইঞ্জিনিয়ারিং উপাদানের বৈশিষ্ট্য, পরীক্ষা পদ্ধতি এবং ব্যবহারিক প্রয়োগ নিয়ে বিস্তারিত পাঠ্যপুস্তক।",
    type: "physical",
    price: 390,
    coverColor: "from-stone-500 to-stone-800",
    coverEmoji: "🏗️",
    departments: ["civil"],
    semesters: [4],
    stock: 18,
    featured: true,
  },
  {
    id: "p5",
    slug: "operating-system-suggestion",
    title: "অপারেটিং সিস্টেম সুপার সাজেশন",
    subtitle: "কম্পিউটার | ৬ষ্ঠ সেমিস্টার",
    description:
      "বোর্ড ফাইনাল পরীক্ষার জন্য প্রশ্ন প্যাটার্ন বিশ্লেষণ এবং সবচেয়ে গুরুত্বপূর্ণ প্রশ্নের সমাধান। PDF।",
    type: "suggestion",
    price: 99,
    coverColor: "from-purple-500 to-indigo-700",
    coverEmoji: "🖥️",
    departments: ["computer"],
    semesters: [6],
  },
  {
    id: "p6",
    slug: "thermodynamics-basics",
    title: "থার্মোডাইনামিক্সের মূলনীতি",
    subtitle: "মেকানিক্যাল প্রযুক্তি | ৩য় সেমিস্টার",
    description:
      "তাপগতিবিদ্যার সূত্র, চক্র, এনথালপি — সব কিছুর ধারণা পরিষ্কার করার জন্য উদাহরণ ভিত্তিক বই।",
    type: "physical",
    price: 420,
    coverColor: "from-red-500 to-rose-700",
    coverEmoji: "🔥",
    departments: ["mechanical"],
    semesters: [3],
    stock: 25,
  },
  {
    id: "p7",
    slug: "basic-electronics-ebook",
    title: "বেসিক ইলেকট্রনিক্স",
    subtitle: "ইলেকট্রনিক্স | ১ম সেমিস্টার",
    description:
      "সেমিকন্ডাক্টর, ডায়োড, ট্রানজিস্টর — বাংলায় সহজ ভাষায় ই-বুক। ফোন/ট্যাব/কম্পিউটার সবখানে পড়া যাবে।",
    type: "ebook",
    price: 180,
    coverColor: "from-cyan-500 to-teal-700",
    coverEmoji: "🔌",
    departments: ["electronics", "electrical"],
    semesters: [1],
  },
  {
    id: "p8",
    slug: "bangla-non-tech",
    title: "বাংলা (নন-টেক)",
    subtitle: "সব বিভাগ | ১ম সেমিস্টার",
    description:
      "১ম সেমিস্টারের বাংলা সাবজেক্টের পূর্ণাঙ্গ পাঠ্যপুস্তক, সব ডিপার্টমেন্টের ছাত্র-ছাত্রীদের জন্য।",
    type: "physical",
    price: 220,
    coverColor: "from-yellow-500 to-amber-700",
    coverEmoji: "📚",
    departments: ["computer", "civil", "electrical", "mechanical", "electronics"],
    semesters: [1],
    stock: 60,
  },
];

export function getProducts() {
  return PRODUCTS;
}

export function getProductBySlug(slug: string) {
  return PRODUCTS.find((p) => p.slug === slug);
}

export function getFeaturedProducts() {
  return PRODUCTS.filter((p) => p.featured);
}
