import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getSiteSettings, saveSiteSettings } from "@/lib/cms.functions";
import { DEFAULT_SITE_SETTINGS, type SiteSettings } from "@/lib/cms-types";
import { Field, PageHeader, SaveButton, SectionCard, TextArea, TextInput } from "./FormPrimitives";

export function SiteSettingsEditor() {
  const load = useServerFn(getSiteSettings);
  const save = useServerFn(saveSiteSettings);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["admin", "cms", "site"],
    queryFn: () => load(undefined as never),
    staleTime: 10 * 60_000,
  });

  const [s, setS] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  useEffect(() => {
    if (data) setS(data as SiteSettings);
  }, [data]);

  const mutation = useMutation({
    mutationFn: (payload: SiteSettings) => save({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "cms", "site"] });
      qc.invalidateQueries({ queryKey: ["site-settings"] });
      toast.success("সাইট সেটিংস সেভ হয়েছে");
    },
    onError: (e: any) => toast.error(e?.message || "সেভ করা যায়নি"),
  });

  const upd = <K extends keyof SiteSettings>(key: K, val: SiteSettings[K]) => setS((p) => ({ ...p, [key]: val }));
  const onSave = () => mutation.mutate(s);
  const saving = mutation.isPending;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Settings"
        title="Site Settings"
        description="ব্র্যান্ড নাম, যোগাযোগের তথ্য, সোশ্যাল লিংক এবং ফুটার কন্টেন্ট এখান থেকে পরিবর্তন করুন।"
        action={<SaveButton saving={saving} onClick={onSave} />}
      />

      <SectionCard title="Brand" description="সাইটের নাম ও ট্যাগলাইন।">
        <Field label="Brand name">
          <TextInput value={s.brand.name} onChange={(e) => upd("brand", { ...s.brand, name: e.target.value })} />
        </Field>
        <Field label="Tagline">
          <TextInput value={s.brand.tagline} onChange={(e) => upd("brand", { ...s.brand, tagline: e.target.value })} />
        </Field>
        <Field label="Short description" hint="ফুটার এবং SEO ডিফল্টে ব্যবহৃত হয়।">
          <TextArea rows={3} value={s.brand.shortDescription} onChange={(e) => upd("brand", { ...s.brand, shortDescription: e.target.value })} />
        </Field>
      </SectionCard>

      <SectionCard title="Contact" description="ফুটার ও যোগাযোগ পেজে দেখানো হবে।">
        <Field label="Address">
          <TextInput value={s.contact.address} onChange={(e) => upd("contact", { ...s.contact, address: e.target.value })} />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Email">
            <TextInput type="email" value={s.contact.email} onChange={(e) => upd("contact", { ...s.contact, email: e.target.value })} />
          </Field>
          <Field label="Phone">
            <TextInput value={s.contact.phone} onChange={(e) => upd("contact", { ...s.contact, phone: e.target.value })} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Social links" description="সম্পূর্ণ URL দিন (https:// সহ)। খালি রাখলে আইকন লুকিয়ে থাকবে।">
        <Field label="Facebook URL">
          <TextInput placeholder="https://facebook.com/…" value={s.socials.facebook} onChange={(e) => upd("socials", { ...s.socials, facebook: e.target.value })} />
        </Field>
        <Field label="Instagram URL">
          <TextInput placeholder="https://instagram.com/…" value={s.socials.instagram} onChange={(e) => upd("socials", { ...s.socials, instagram: e.target.value })} />
        </Field>
        <Field label="WhatsApp URL" hint="উদাহরণ: https://wa.me/8801XXXXXXXXX">
          <TextInput placeholder="https://wa.me/…" value={s.socials.whatsapp} onChange={(e) => upd("socials", { ...s.socials, whatsapp: e.target.value })} />
        </Field>
      </SectionCard>

      <SectionCard title="Footer">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Shop heading">
            <TextInput value={s.footer.shopHeading} onChange={(e) => upd("footer", { ...s.footer, shopHeading: e.target.value })} />
          </Field>
          <Field label="Support heading">
            <TextInput value={s.footer.supportHeading} onChange={(e) => upd("footer", { ...s.footer, supportHeading: e.target.value })} />
          </Field>
          <Field label="Contact heading">
            <TextInput value={s.footer.contactHeading} onChange={(e) => upd("footer", { ...s.footer, contactHeading: e.target.value })} />
          </Field>
        </div>
        <Field label="Copyright">
          <TextInput value={s.footer.copyright} onChange={(e) => upd("footer", { ...s.footer, copyright: e.target.value })} />
        </Field>
      </SectionCard>

      <div className="flex justify-end">
        <SaveButton saving={saving} onClick={onSave} />
      </div>
    </div>
  );
}
