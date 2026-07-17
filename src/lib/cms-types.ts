// CMS shared types and defaults. Used as fallbacks and as the shape reference
// for the workspace admin UI. Data is stored in Supabase (site_settings,
// homepage_content, static_pages, page_seo) but any field missing from the DB
// row falls back to the defaults here so the site never renders empty.

export type SiteSettings = {
  brand: {
    name: string;
    tagline: string;
    shortDescription: string;
  };
  contact: {
    address: string;
    email: string;
    phone: string;
  };
  socials: {
    facebook: string;
    instagram: string;
    whatsapp: string;
  };
  footer: {
    copyright: string;
    madeWith: string;
    developerName: string;
    developerUrl: string;
    shopHeading: string;
    supportHeading: string;
    contactHeading: string;
  };
};

export type HomepageContent = {
  hero: {
    eyebrowLeft: string;
    eyebrowRight: string;
    titleLine1: string;
    titleLine2Prefix: string;
    titleHighlight: string;
    titleLine2Suffix: string;
    subtitle: string;
    ctaPrimaryLabel: string;
    ctaPrimaryHref: string;
    ctaSecondaryLabel: string;
    ctaSecondaryHref: string;
    socialProof: { count: string; caption: string; rating: string };
    featuredCard: {
      eyebrow: string;
      liveLabel: string;
      titleLine1: string;
      titleLine2: string;
      features: string[];
      priceLabel: string;
      price: string;
      priceSuffix: string;
      ctaHref: string;
      badge: string;
      floatingTitle: string;
      floatingSubtitle: string;
    };
  };
  stats: Array<{ value: string; label: string }>;
  courses: {
    index: string;
    eyebrow: string;
    titleLine1: string;
    titleHighlight: string;
    titleLine2Suffix: string;
    description: string;
    ctaLabel: string;
    ctaHref: string;
    emptyLabel: string;
  };
  shop: {
    index: string;
    eyebrow: string;
    titleLine1: string;
    titleLine2Prefix: string;
    titleHighlight: string;
    titleLine2Suffix: string;
    description: string;
    ctaLabel: string;
    ctaHref: string;
  };
  about: {
    index: string;
    eyebrow: string;
    titleLine1: string;
    titleLine2Prefix: string;
    titleHighlight: string;
    titleLine2Suffix: string;
    paragraph1: string;
    paragraph2: string;
    badge: string;
    features: Array<{ title: string; description: string; icon: string }>;
  };
  testimonials: {
    index: string;
    eyebrow: string;
    titleLine1: string;
    titleHighlight: string;
    titleLine2Suffix: string;
    items: Array<{ name: string; role: string; text: string }>;
  };
  faq: {
    index: string;
    eyebrow: string;
    titleLine1: string;
    titleHighlight: string;
    titleLine2Suffix: string;
    description: string;
    items: Array<{ q: string; a: string }>;
  };
  finalCta: {
    badge: string;
    titleLine1: string;
    titleLine2Prefix: string;
    titleHighlight: string;
    titleLine2Suffix: string;
    description: string;
    ctaPrimaryLabel: string;
    ctaPrimaryHref: string;
    ctaSecondaryLabel: string;
    ctaSecondaryHref: string;
  };
};

export type StaticPage = {
  slug: string;
  title: string;
  eyebrow: string;
  body_markdown: string;
};

export type PageSeo = {
  path: string;
  meta_title: string;
  meta_description: string;
  og_image_url: string | null;
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  brand: {
    name: "Polytechnic Tutorial Home",
    tagline: "Knowledge · Wisdom · Humanity",
    shortDescription:
      "ডিপ্লোমা ইন ইঞ্জিনিয়ারিং শিক্ষার্থীদের জন্য ভিডিও কোর্স, লাইভ ক্লাস, বই এবং সুপার সাজেশন — এক প্ল্যাটফর্মে।",
  },
  contact: {
    address: "Bogura, Bangladesh",
    email: "support@polytechnictutorial.com",
    phone: "",
  },
  socials: { facebook: "", instagram: "", whatsapp: "" },
  footer: {
    copyright: "© ২০২৬ Polytechnic Tutorial Home। সর্বস্বত্ব সংরক্ষিত।",
    madeWith: "Made with care in Bangladesh 🇧🇩",
    developerName: "Shahriar Nabil",
    developerUrl: "https://www.shahnabil.com/",
    shopHeading: "শপ",
    supportHeading: "সহায়তা",
    contactHeading: "যোগাযোগ",
  },
};

export const DEFAULT_HOMEPAGE_CONTENT: HomepageContent = {
  hero: {
    eyebrowLeft: "VOL. 01",
    eyebrowRight: "Polytechnic Editorial · 2026",
    titleLine1: "ডিপ্লোমা ইঞ্জিনিয়ারিং",
    titleLine2Prefix: "প্রস্তুতির",
    titleHighlight: "সম্পূর্ণ",
    titleLine2Suffix: "প্ল্যাটফর্ম।",
    subtitle:
      "অভিজ্ঞ পলিটেকনিক শিক্ষকদের ভিডিও লেকচার, লাইভ ক্লাস, নোটস, মডেল টেস্ট এবং সুপার সাজেশন — এক জায়গায়, একটি সাবস্ক্রিপশনে।",
    ctaPrimaryLabel: "এনরোল করুন",
    ctaPrimaryHref: "/courses",
    ctaSecondaryLabel: "কোর্স দেখুন",
    ctaSecondaryHref: "#courses",
    socialProof: {
      count: "১২,০০০+ শিক্ষার্থী",
      caption: "এখনই শেখা শুরু করেছেন",
      rating: "৪.৯ / ৫ · রিভিউ",
    },
    featuredCard: {
      eyebrow: "Featured Course",
      liveLabel: "Live",
      titleLine1: "কম্পিউটার ৬ষ্ঠ পর্ব",
      titleLine2: "সম্পূর্ণ সিলেবাস",
      features: ["১,৫০০+ ভিডিও লেসন", "সপ্তাহে ২০+ লাইভ ক্লাস", "নোটস, মডেল টেস্ট, সাজেশন"],
      priceLabel: "শুরু থেকে",
      price: "৳ ৯৯৯",
      priceSuffix: "/সেমিস্টার",
      ctaHref: "/courses",
      badge: "★ ৯০%+ কমন",
      floatingTitle: "নতুন কোর্স",
      floatingSubtitle: "প্রতি সপ্তাহে আপডেট",
    },
  },
  stats: [
    { value: "১২,০০০+", label: "সক্রিয় শিক্ষার্থী" },
    { value: "১,৫০০+", label: "ভিডিও লেসন" },
    { value: "২০+", label: "লাইভ ক্লাস / সপ্তাহ" },
    { value: "৯০%", label: "গড় কমন সাজেশন" },
  ],
  courses: {
    index: "01",
    eyebrow: "কোর্স · Editorial",
    titleLine1: "বিভাগ অনুযায়ী",
    titleHighlight: "কমপ্লিট",
    titleLine2Suffix: "কোর্স।",
    description:
      "প্রতিটি ডিপার্টমেন্টের ১ম থেকে ৮ম পর্ব পর্যন্ত সম্পূর্ণ সিলেবাস — বোর্ড প্রশ্নের ধরন অনুযায়ী সাজানো।",
    ctaLabel: "সব কোর্স দেখুন",
    ctaHref: "/courses",
    emptyLabel: "শীঘ্রই নতুন কোর্স যুক্ত হচ্ছে।",
  },
  shop: {
    index: "02",
    eyebrow: "Shop · অনলাইন অর্ডার",
    titleLine1: "বই, ই-বুক ও",
    titleLine2Prefix: "সুপার",
    titleHighlight: "সাজেশন",
    titleLine2Suffix: "।",
    description:
      "কোর্সের পাশাপাশি প্রয়োজনীয় প্রিন্টেড বই, ডিজিটাল ই-বুক ও পরীক্ষার সুপার সাজেশন — ঘরে বসেই অর্ডার, দ্রুত ডেলিভারি।",
    ctaLabel: "সব প্রোডাক্ট দেখুন",
    ctaHref: "/shop",
  },
  about: {
    index: "03",
    eyebrow: "আমাদের সম্পর্কে",
    titleLine1: "পলিটেকনিক শিক্ষার্থীদের",
    titleLine2Prefix: "কথা ভেবেই",
    titleHighlight: "তৈরি",
    titleLine2Suffix: "।",
    paragraph1:
      "Polytechnic Tutorial Home একটি ফোকাসড এডুকেশন প্ল্যাটফর্ম, যেখানে শুধুমাত্র বাংলাদেশের ডিপ্লোমা ইন ইঞ্জিনিয়ারিং শিক্ষার্থীদের জন্য কনটেন্ট তৈরি করা হয়। বিএসসি বা এইচএসসির জেনেরিক কোর্স নয় — আপনার সিলেবাস, আপনার বোর্ড প্রশ্নের ধরন অনুযায়ী সাজানো।",
    paragraph2:
      "লক্ষ্য একটাই — প্রতিটা শিক্ষার্থী যেন সহজে, স্পষ্ট করে বুঝতে পারে এবং পরীক্ষায় ভালো করতে পারে।",
    badge: "Bogura · Est. 2024",
    features: [
      { title: "অভিজ্ঞ শিক্ষক", description: "নামকরা পলিটেকনিকের ১০+ বছর অভিজ্ঞ শিক্ষকদের সরাসরি লেকচার।", icon: "award" },
      { title: "স্ট্রাকচার্ড ভিডিও", description: "চ্যাপ্টার ভিত্তিক সাজানো লেসন — ঠিক যেভাবে ক্লাসে পড়ানো হয়।", icon: "play" },
      { title: "লাইভ ইন্টার‍্যাকশন", description: "সপ্তাহে ২০+ লাইভ ক্লাস, প্রশ্ন-উত্তর ও ডাউট সেশন।", icon: "users" },
    ],
  },
  testimonials: {
    index: "04",
    eyebrow: "শিক্ষার্থীদের অভিজ্ঞতা",
    titleLine1: "যা বলছেন আমাদের",
    titleHighlight: "শিক্ষার্থীরা",
    titleLine2Suffix: "।",
    items: [
      { name: "রাকিবুল হাসান", role: "কম্পিউটার, ৬ষ্ঠ পর্ব", text: "ভিডিও লেকচারগুলো এত সহজ করে বোঝানো — বই খুলে বসতেই ইচ্ছা করে। সাজেশনও কমন এসেছে ৯০%+।" },
      { name: "তানজিনা আক্তার", role: "সিভিল, ৪র্থ পর্ব", text: "লাইভ ক্লাসে সরাসরি প্রশ্ন করা যায়, এটাই সবচেয়ে বড় প্লাস। রেজাল্ট আগের চেয়ে অনেক ভালো এসেছে।" },
      { name: "মেহেদী হাসান", role: "ইলেকট্রিক্যাল, ৮ম পর্ব", text: "নোটস আর মডেল টেস্ট মিলিয়ে পুরো সিলেবাস কভার হয়ে যায়। ফাইনালের আগে দারুণ কাজে দিয়েছে।" },
    ],
  },
  faq: {
    index: "05",
    eyebrow: "FAQ",
    titleLine1: "সাধারণ",
    titleHighlight: "জিজ্ঞাসা",
    titleLine2Suffix: "।",
    description: "আরও প্রশ্ন থাকলে সরাসরি আমাদের সাথে যোগাযোগ করুন।",
    items: [
      { q: "কোর্স কতদিন অ্যাক্সেস করা যাবে?", a: "প্রিমিয়াম প্ল্যানে এনরোল করলে পুরো সেমিস্টার জুড়ে সব ভিডিও, নোটস ও লাইভ ক্লাসে আনলিমিটেড অ্যাক্সেস পাবেন।" },
      { q: "পেমেন্ট কীভাবে করব?", a: "বিকাশ, নগদ, রকেট এবং ডেবিট/ক্রেডিট কার্ড — সবগুলো অপশন আছে। পেমেন্ট সাথে সাথেই কোর্স আনলক হয়ে যাবে।" },
      { q: "ভিডিও কি ডাউনলোড করা যাবে?", a: "সিকিউরিটির কারণে ভিডিও ডাউনলোড করা যাবে না, কিন্তু যতবার খুশি স্ট্রিম করে দেখতে পারবেন। নোটস ও পিডিএফ ডাউনলোড করা যাবে।" },
      { q: "বই অর্ডার করলে কতদিনে পাব?", a: "ঢাকার ভেতরে ১-২ দিন, ঢাকার বাইরে ২-৩ কর্মদিবসের মধ্যে পৌঁছে যাবে।" },
      { q: "কোনো অ্যাকাউন্ট ছাড়াই কি কিনতে পারব?", a: "শপ থেকে বই বা সাজেশন কিনতে অ্যাকাউন্ট লাগবে না — গেস্ট চেকআউটে সরাসরি অর্ডার করা যাবে।" },
    ],
  },
  finalCta: {
    badge: "প্রথম ৫টি লেসন ফ্রি",
    titleLine1: "আজই শুরু করুন",
    titleLine2Prefix: "আপনার",
    titleHighlight: "প্রস্তুতি",
    titleLine2Suffix: "।",
    description: "কোনো কার্ড লাগবে না — এখনই সাইন আপ করে বিনামূল্যে লেসন দেখা শুরু করুন।",
    ctaPrimaryLabel: "এনরোল করুন",
    ctaPrimaryHref: "/courses",
    ctaSecondaryLabel: "শপ দেখুন",
    ctaSecondaryHref: "/shop",
  },
};

// Deep-merge helper: takes a partial DB row and fills in missing fields from defaults.
export function mergeWithDefaults<T>(defaults: T, incoming: unknown): T {
  if (incoming === null || incoming === undefined) return defaults;
  if (Array.isArray(defaults)) {
    return (Array.isArray(incoming) && incoming.length > 0 ? incoming : defaults) as T;
  }
  if (typeof defaults === "object" && defaults !== null && typeof incoming === "object") {
    const out: Record<string, unknown> = { ...(defaults as Record<string, unknown>) };
    for (const k of Object.keys(defaults as Record<string, unknown>)) {
      const dv = (defaults as Record<string, unknown>)[k];
      const iv = (incoming as Record<string, unknown>)[k];
      if (iv === undefined) continue;
      out[k] = mergeWithDefaults(dv as never, iv);
    }
    return out as T;
  }
  return (incoming as T) ?? defaults;
}

// Known editable pages exposed in the SEO manager
export const KNOWN_SEO_PATHS: Array<{ path: string; label: string }> = [
  { path: "/", label: "হোমপেইজ" },
  { path: "/about", label: "আমাদের সম্পর্কে" },
  { path: "/shop", label: "শপ" },
  { path: "/courses", label: "কোর্স তালিকা" },
  { path: "/terms-of-service", label: "Terms of Service" },
  { path: "/privacy-policy", label: "Privacy Policy" },
];

export const EDITABLE_STATIC_PAGES: Array<{ slug: string; label: string; route: string }> = [
  { slug: "about", label: "আমাদের সম্পর্কে", route: "/about" },
  { slug: "terms-of-service", label: "Terms of Service", route: "/terms-of-service" },
  { slug: "privacy-policy", label: "Privacy Policy", route: "/privacy-policy" },
];
