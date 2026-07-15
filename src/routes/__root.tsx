import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";


import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Toaster } from "@/components/ui/sonner";
import { BlocklistGate } from "@/components/BlocklistGate";
import { ConfirmDialogHost } from "@/components/ui/confirm-dialog";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-inter text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">পেজটি খুঁজে পাওয়া যায়নি</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          আপনি যে পেজটি খুঁজছেন সেটি সরানো হয়েছে বা কখনোই ছিল না।
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand/90"
          >
            হোমে ফিরুন
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          কিছু একটা সমস্যা হয়েছে
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          পেজটি লোড করা যায়নি। আবার চেষ্টা করুন অথবা হোমে ফিরে যান।
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand/90"
          >
            আবার চেষ্টা করুন
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-5 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
          >
            হোমে ফিরুন
          </a>
        </div>
      </div>
    </div>
  );
}

const SITE_TITLE = "Polytechnic Tutorial Home — ডিপ্লোমা প্রস্তুতির সম্পূর্ণ প্ল্যাটফর্ম";
const SITE_DESC =
  "ডিপ্লোমা ইন ইঞ্জিনিয়ারিং শিক্ষার্থীদের জন্য ভিডিও কোর্স, লাইভ ক্লাস, বই ও সুপার সাজেশন — এক প্ল্যাটফর্মে।";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: SITE_TITLE },
      { name: "description", content: SITE_DESC },
      { name: "author", content: "Polytechnic Tutorial Home" },
      { property: "og:title", content: SITE_TITLE },
      { property: "og:description", content: SITE_DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Polytechnic Tutorial Home" },
      { property: "og:title", content: "Polytechnic Tutorial Home" },
      { name: "twitter:title", content: "Polytechnic Tutorial Home" },
      { name: "description", content: "ডিপ্লোমা ইন ইঞ্জিনিয়ারিং শিক্ষার্থীদের জন্য ভিডিও কোর্স, লাইভ ক্লাস, নোটস, বই ও সুপার সাজেশন — এক জায়গায়।" },
      { property: "og:description", content: "ডিপ্লোমা ইন ইঞ্জিনিয়ারিং শিক্ষার্থীদের জন্য ভিডিও কোর্স, লাইভ ক্লাস, নোটস, বই ও সুপার সাজেশন — এক জায়গায়।" },
      { name: "twitter:description", content: "ডিপ্লোমা ইন ইঞ্জিনিয়ারিং শিক্ষার্থীদের জন্য ভিডিও কোর্স, লাইভ ক্লাস, নোটস, বই ও সুপার সাজেশন — এক জায়গায়।" },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/VWFSLSNllWZ0zMNEwHCP3VGh25x2/social-images/social-1783508986579-d168f6cd-d4f9-40de-9f8d-2a664b397285.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/VWFSLSNllWZ0zMNEwHCP3VGh25x2/social-images/social-1783508986579-d168f6cd-d4f9-40de-9f8d-2a664b397285.webp" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "preconnect", href: "https://cdn.jsdelivr.net", crossOrigin: "anonymous" },
      {
        rel: "preload",
        as: "font",
        type: "font/woff2",
        href: "https://cdn.jsdelivr.net/gh/maateen/bangla-web-fonts/fonts/solaiman-lipi/solaimanlipi-normal-v1.0.woff2",
        crossOrigin: "anonymous",
      },
      {
        rel: "preload",
        as: "font",
        type: "font/woff2",
        href: "https://cdn.jsdelivr.net/gh/maateen/bangla-web-fonts/fonts/solaiman-lipi/solaimanlipi-bold-v1.0.woff2",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://cdn.jsdelivr.net/gh/maateen/bangla-web-fonts/fonts/solaiman-lipi/font.css",
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="bn">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hideFooter =
    pathname === "/sdash" ||
    pathname.startsWith("/sdash/") ||
    pathname === "/shop" ||
    pathname.startsWith("/shop/") ||
    pathname.startsWith("/product/") ||
    pathname === "/cart" ||
    pathname.startsWith("/checkout");
  const isInternalApp =
    pathname === "/workspace" ||
    pathname.startsWith("/workspace/") ||
    pathname === "/instructor" ||
    pathname.startsWith("/instructor/");

  if (isInternalApp) {
    return (
      <QueryClientProvider client={queryClient}>
        <BlocklistGate>
          <Outlet />
        </BlocklistGate>
        <Toaster richColors position="top-center" />
        <ConfirmDialogHost />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BlocklistGate>
        <div className="flex min-h-screen flex-col">
          <SiteHeader />
          <main className="flex-1">
            <Outlet />
          </main>
          {!hideFooter && <SiteFooter />}
        </div>
      </BlocklistGate>
      <Toaster richColors position="top-center" />
      <ConfirmDialogHost />
    </QueryClientProvider>
  );
}

