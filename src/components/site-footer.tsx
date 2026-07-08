import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/60 bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-4 md:px-6">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-lg bg-brand text-brand-foreground">
              <span className="font-inter text-sm font-bold">PE</span>
            </div>
            <span className="text-lg font-semibold">পলিটেকনিক এডু</span>
          </div>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            বাংলাদেশের ডিপ্লোমা ইন ইঞ্জিনিয়ারিং ছাত্র-ছাত্রীদের জন্য পাঠ্যবই,
            ই-বুক এবং পরীক্ষার সুপার সাজেশনের একটি নির্ভরযোগ্য প্ল্যাটফর্ম।
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold">শপ</h4>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            <li>
              <Link to="/shop" className="hover:text-foreground">
                সকল বই
              </Link>
            </li>
            <li>
              <Link
                to="/shop"
                search={{ type: "suggestion" }}
                className="hover:text-foreground"
              >
                সুপার সাজেশন
              </Link>
            </li>
            <li>
              <Link
                to="/shop"
                search={{ type: "ebook" }}
                className="hover:text-foreground"
              >
                ই-বুক
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold">সহায়তা</h4>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            <li>
              <Link to="/about" className="hover:text-foreground">
                আমাদের সম্পর্কে
              </Link>
            </li>
            <li>
              <a href="#" className="hover:text-foreground">
                যোগাযোগ
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-foreground">
                শর্তাবলী
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-muted-foreground md:flex-row md:px-6">
          <p>© ২০২৬ পলিটেকনিক এডু। সর্বস্বত্ব সংরক্ষিত।</p>
          <p className="font-inter">Made with care in Bangladesh 🇧🇩</p>
        </div>
      </div>
    </footer>
  );
}
