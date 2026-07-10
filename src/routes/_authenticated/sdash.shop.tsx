import { createFileRoute, Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sdash/shop")({
  component: MyShopPage,
});

function MyShopPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">আমার শপ</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          অর্ডার হিস্ট্রি, ই-বুক ও ডাউনলোডেবল কনটেন্ট।
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-secondary">
          <ShoppingBag className="size-6 text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold">এখনো কোনো অর্ডার নেই</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          শপ থেকে বই ও সাজেশন অর্ডার করলে এখানে দেখতে পাবেন।
        </p>
        <Link
          to="/shop"
          className="mt-5 inline-flex items-center justify-center rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand/90"
        >
          শপে যান
        </Link>
      </div>
    </div>
  );
}
