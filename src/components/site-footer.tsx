import { Link } from "@tanstack/react-router";
import logoAsset from "@/assets/pth-logo.jpg.asset.json";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/70 bg-surface">
      <div className="h-[2px] w-full bg-gold-gradient opacity-80" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:grid-cols-12 md:px-6">
        <div className="md:col-span-5">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img src={logoAsset.url} alt="Polytechnic Tutorial Home" className="size-11 rounded-full ring-1 ring-border" />
              <span className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full bg-gold ring-2 ring-surface" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-display text-base font-bold tracking-tight">Polytechnic Tutorial Home</span>
              <span className="eyebrow"><span className="text-gold">◆</span> Bogura, Bangladesh</span>
            </div>
          </div>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
            ডিপ্লোমা ইন ইঞ্জিনিয়ারিং শিক্ষার্থীদের জন্য ভিডিও কোর্স, লাইভ ক্লাস,
            বই এবং সুপার সাজেশন — এক প্ল্যাটফর্মে।
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            <span className="size-1.5 rounded-full bg-brand" />
            EST. 2024 · VOL. 01
          </div>
        </div>

        <div className="md:col-span-3">
          <h4 className="eyebrow">শপ</h4>
          <ul className="mt-5 space-y-3 text-sm">
            <li>
              <Link to="/shop" className="text-muted-foreground transition-colors hover:text-foreground hover:gold-underline">
                সকল বই
              </Link>
            </li>
            <li>
              <Link
                to="/shop"
                search={{ type: "suggestion" }}
                className="text-muted-foreground transition-colors hover:text-foreground hover:gold-underline"
              >
                সুপার সাজেশন
              </Link>
            </li>
            <li>
              <Link
                to="/shop"
                search={{ type: "ebook" }}
                className="text-muted-foreground transition-colors hover:text-foreground hover:gold-underline"
              >
                ই-বুক
              </Link>
            </li>
          </ul>
        </div>

        <div className="md:col-span-4">
          <h4 className="eyebrow">সহায়তা</h4>
          <ul className="mt-5 space-y-3 text-sm">
            <li>
              <Link to="/about" className="text-muted-foreground transition-colors hover:text-foreground hover:gold-underline">
                আমাদের সম্পর্কে
              </Link>
            </li>
            <li>
              <Link to="/terms-of-service" className="text-muted-foreground transition-colors hover:text-foreground hover:gold-underline">
                শর্তাবলী
              </Link>
            </li>
            <li>
              <Link to="/privacy-policy" className="text-muted-foreground transition-colors hover:text-foreground hover:gold-underline">
                গোপনীয়তা নীতি
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/70">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-muted-foreground md:flex-row md:px-6">
          <p className="flex items-center gap-2">
            <span>© ২০২৬ Polytechnic Tutorial Home।</span>
            <span className="text-gold">◆</span>
            <span>সর্বস্বত্ব সংরক্ষিত।</span>
          </p>
          <p className="font-inter tracking-wide">Made with care in Bangladesh 🇧🇩</p>
        </div>
      </div>
    </footer>
  );
}
