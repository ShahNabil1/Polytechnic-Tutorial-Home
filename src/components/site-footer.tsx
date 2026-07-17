import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import logoAsset from "@/assets/pth-logo.jpg.asset.json";
import { getSiteSettings } from "@/lib/cms.functions";
import { DEFAULT_SITE_SETTINGS, type SiteSettings } from "@/lib/cms-types";
import { Mail, MapPin, Phone } from "lucide-react";

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M13.397 20.997v-8.196h2.765l.411-3.209h-3.176V7.548c0-.926.258-1.56 1.587-1.56h1.684V3.127A22.68 22.68 0 0 0 14.201 3c-2.444 0-4.122 1.492-4.122 4.231v2.361H7.332v3.209h2.753v8.196h3.312z" />
    </svg>
  );
}
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.332.014 7.052.072 2.695.272.273 2.69.073 7.052.014 8.332 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.332 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.668-.072-4.948-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  );
}
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.517 5.26l.242.383-1.001 3.652 3.731-.994zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
    </svg>
  );
}

export function SiteFooter() {
  const fetchSettings = useServerFn(getSiteSettings);
  const [s, setS] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  useEffect(() => {
    fetchSettings(undefined as never)
      .then((res) => res && setS(res as SiteSettings))
      .catch(() => {});
  }, [fetchSettings]);

  const socials: Array<{ url: string; label: string; Icon: (p: { className?: string }) => React.ReactElement }> = [];
  if (s.socials.facebook) socials.push({ url: s.socials.facebook, label: "Facebook", Icon: FacebookIcon });
  if (s.socials.instagram) socials.push({ url: s.socials.instagram, label: "Instagram", Icon: InstagramIcon });
  if (s.socials.whatsapp) socials.push({ url: s.socials.whatsapp, label: "WhatsApp", Icon: WhatsAppIcon });

  return (
    <footer className="mt-24 border-t border-border/70 bg-surface">
      <div className="h-[2px] w-full bg-gold-gradient opacity-80" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:grid-cols-12 md:px-6">
        <div className="md:col-span-5">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img src={logoAsset.url} alt={s.brand.name} className="size-11 rounded-full ring-1 ring-border" />
              <span className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full bg-gold ring-2 ring-surface" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-display text-base font-bold tracking-tight">{s.brand.name}</span>
              <span className="eyebrow">
                <span className="text-gold">◆</span> {s.contact.address}
              </span>
            </div>
          </div>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
            {s.brand.shortDescription}
          </p>

          {socials.length > 0 && (
            <div className="mt-6 flex items-center gap-2">
              {socials.map(({ url, label, Icon }) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="grid size-10 place-items-center rounded-full border border-border bg-background/60 text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:bg-brand hover:text-brand-foreground"
                >
                  <Icon className="size-4" />
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="md:col-span-3">
          <h4 className="eyebrow">{s.footer.shopHeading}</h4>
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
          <h4 className="eyebrow">{s.footer.supportHeading}</h4>
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

          {(s.contact.address || s.contact.email || s.contact.phone) && (
            <>
              <h4 className="eyebrow mt-8">{s.footer.contactHeading}</h4>
              <ul className="mt-5 space-y-3 text-sm">
                {s.contact.address && (
                  <li className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-gold" />
                    <span>{s.contact.address}</span>
                  </li>
                )}
                {s.contact.email && (
                  <li className="flex items-start gap-2 text-muted-foreground">
                    <Mail className="mt-0.5 size-4 shrink-0 text-gold" />
                    <a href={`mailto:${s.contact.email}`} className="hover:text-foreground">
                      {s.contact.email}
                    </a>
                  </li>
                )}
                {s.contact.phone && (
                  <li className="flex items-start gap-2 text-muted-foreground">
                    <Phone className="mt-0.5 size-4 shrink-0 text-gold" />
                    <a href={`tel:${s.contact.phone}`} className="hover:text-foreground">
                      {s.contact.phone}
                    </a>
                  </li>
                )}
              </ul>
            </>
          )}
        </div>
      </div>
      <div className="border-t border-border/70">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-muted-foreground md:flex-row md:px-6">
          <p className="flex items-center gap-2">
            <span>{s.footer.copyright}</span>
          </p>
          <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 font-inter tracking-wide">
            <span>{s.footer.madeWith}</span>
            {s.footer.developerName && (
              <>
                <span className="hidden text-border/80 md:inline">·</span>
                <span className="hidden md:inline">Developed by</span>
                <a
                  href={s.footer.developerUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-foreground transition-colors hover:text-gold"
                >
                  {s.footer.developerName}
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                    <path d="M7 7h10v10" />
                    <path d="M7 17 17 7" />
                  </svg>
                </a>
              </>
            )}
          </p>
        </div>
      </div>
    </footer>
  );
}
