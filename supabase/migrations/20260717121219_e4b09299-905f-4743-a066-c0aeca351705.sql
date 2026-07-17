
-- CMS: site settings, homepage content, static pages, per-page SEO

-- 1) site_settings (singleton via id='global')
CREATE TABLE public.site_settings (
  id text PRIMARY KEY DEFAULT 'global',
  brand jsonb NOT NULL DEFAULT '{}'::jsonb,
  contact jsonb NOT NULL DEFAULT '{}'::jsonb,
  socials jsonb NOT NULL DEFAULT '{}'::jsonb,
  footer jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_settings public read" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "site_settings admin write" ON public.site_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_permission(auth.uid(), 'manage_users'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_permission(auth.uid(), 'manage_users'));

-- 2) homepage_content (singleton via id='global')
CREATE TABLE public.homepage_content (
  id text PRIMARY KEY DEFAULT 'global',
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.homepage_content TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.homepage_content TO authenticated;
GRANT ALL ON public.homepage_content TO service_role;
ALTER TABLE public.homepage_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "homepage_content public read" ON public.homepage_content FOR SELECT USING (true);
CREATE POLICY "homepage_content admin write" ON public.homepage_content FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_permission(auth.uid(), 'manage_users'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_permission(auth.uid(), 'manage_users'));

-- 3) static_pages (about, terms-of-service, privacy-policy, ...)
CREATE TABLE public.static_pages (
  slug text PRIMARY KEY,
  title text NOT NULL DEFAULT '',
  eyebrow text NOT NULL DEFAULT '',
  body_markdown text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.static_pages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.static_pages TO authenticated;
GRANT ALL ON public.static_pages TO service_role;
ALTER TABLE public.static_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "static_pages public read" ON public.static_pages FOR SELECT USING (true);
CREATE POLICY "static_pages admin write" ON public.static_pages FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_permission(auth.uid(), 'manage_users'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_permission(auth.uid(), 'manage_users'));

-- 4) page_seo (per public path)
CREATE TABLE public.page_seo (
  path text PRIMARY KEY,
  meta_title text NOT NULL DEFAULT '',
  meta_description text NOT NULL DEFAULT '',
  og_image_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.page_seo TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_seo TO authenticated;
GRANT ALL ON public.page_seo TO service_role;
ALTER TABLE public.page_seo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "page_seo public read" ON public.page_seo FOR SELECT USING (true);
CREATE POLICY "page_seo admin write" ON public.page_seo FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_permission(auth.uid(), 'manage_users'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_permission(auth.uid(), 'manage_users'));

-- updated_at triggers
CREATE TRIGGER site_settings_updated_at BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER homepage_content_updated_at BEFORE UPDATE ON public.homepage_content FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER static_pages_updated_at BEFORE UPDATE ON public.static_pages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER page_seo_updated_at BEFORE UPDATE ON public.page_seo FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed singletons with current content
INSERT INTO public.site_settings (id, brand, contact, socials, footer) VALUES (
  'global',
  jsonb_build_object(
    'name', 'Polytechnic Tutorial Home',
    'tagline', 'Knowledge · Wisdom · Humanity',
    'shortDescription', 'ডিপ্লোমা ইন ইঞ্জিনিয়ারিং শিক্ষার্থীদের জন্য ভিডিও কোর্স, লাইভ ক্লাস, বই এবং সুপার সাজেশন — এক প্ল্যাটফর্মে।'
  ),
  jsonb_build_object(
    'address', 'Bogura, Bangladesh',
    'email', 'support@polytechnictutorial.com',
    'phone', ''
  ),
  jsonb_build_object(
    'facebook', '',
    'instagram', '',
    'whatsapp', ''
  ),
  jsonb_build_object(
    'copyright', '© ২০২৬ Polytechnic Tutorial Home। সর্বস্বত্ব সংরক্ষিত।',
    'madeWith', 'Made with care in Bangladesh 🇧🇩',
    'developerName', 'Shahriar Nabil',
    'developerUrl', 'https://www.shahnabil.com/',
    'shopHeading', 'শপ',
    'supportHeading', 'সহায়তা',
    'contactHeading', 'যোগাযোগ'
  )
);

INSERT INTO public.homepage_content (id, content) VALUES ('global', jsonb_build_object(
  'hero', jsonb_build_object(
    'eyebrowLeft', 'VOL. 01',
    'eyebrowRight', 'Polytechnic Editorial · 2026',
    'titleLine1', 'ডিপ্লোমা ইঞ্জিনিয়ারিং',
    'titleLine2Prefix', 'প্রস্তুতির',
    'titleHighlight', 'সম্পূর্ণ',
    'titleLine2Suffix', 'প্ল্যাটফর্ম।',
    'subtitle', 'অভিজ্ঞ পলিটেকনিক শিক্ষকদের ভিডিও লেকচার, লাইভ ক্লাস, নোটস, মডেল টেস্ট এবং সুপার সাজেশন — এক জায়গায়, একটি সাবস্ক্রিপশনে।',
    'ctaPrimaryLabel', 'এনরোল করুন',
    'ctaPrimaryHref', '/courses',
    'ctaSecondaryLabel', 'কোর্স দেখুন',
    'ctaSecondaryHref', '#courses',
    'socialProof', jsonb_build_object(
      'count', '১২,০০০+ শিক্ষার্থী',
      'caption', 'এখনই শেখা শুরু করেছেন',
      'rating', '৪.৯ / ৫ · রিভিউ'
    ),
    'featuredCard', jsonb_build_object(
      'eyebrow', 'Featured Course',
      'liveLabel', 'Live',
      'titleLine1', 'কম্পিউটার ৬ষ্ঠ পর্ব',
      'titleLine2', 'সম্পূর্ণ সিলেবাস',
      'features', jsonb_build_array('১,৫০০+ ভিডিও লেসন', 'সপ্তাহে ২০+ লাইভ ক্লাস', 'নোটস, মডেল টেস্ট, সাজেশন'),
      'priceLabel', 'শুরু থেকে',
      'price', '৳ ৯৯৯',
      'priceSuffix', '/সেমিস্টার',
      'ctaHref', '/courses',
      'badge', '★ ৯০%+ কমন',
      'floatingTitle', 'নতুন কোর্স',
      'floatingSubtitle', 'প্রতি সপ্তাহে আপডেট'
    )
  ),
  'stats', jsonb_build_array(
    jsonb_build_object('value', '১২,০০০+', 'label', 'সক্রিয় শিক্ষার্থী'),
    jsonb_build_object('value', '১,৫০০+', 'label', 'ভিডিও লেসন'),
    jsonb_build_object('value', '২০+', 'label', 'লাইভ ক্লাস / সপ্তাহ'),
    jsonb_build_object('value', '৯০%', 'label', 'গড় কমন সাজেশন')
  ),
  'courses', jsonb_build_object(
    'index', '01',
    'eyebrow', 'কোর্স · Editorial',
    'titleLine1', 'বিভাগ অনুযায়ী',
    'titleHighlight', 'কমপ্লিট',
    'titleLine2Suffix', 'কোর্স।',
    'description', 'প্রতিটি ডিপার্টমেন্টের ১ম থেকে ৮ম পর্ব পর্যন্ত সম্পূর্ণ সিলেবাস — বোর্ড প্রশ্নের ধরন অনুযায়ী সাজানো।',
    'ctaLabel', 'সব কোর্স দেখুন',
    'ctaHref', '/courses',
    'emptyLabel', 'শীঘ্রই নতুন কোর্স যুক্ত হচ্ছে।'
  ),
  'shop', jsonb_build_object(
    'index', '02',
    'eyebrow', 'Shop · অনলাইন অর্ডার',
    'titleLine1', 'বই, ই-বুক ও',
    'titleLine2Prefix', 'সুপার',
    'titleHighlight', 'সাজেশন',
    'titleLine2Suffix', '।',
    'description', 'কোর্সের পাশাপাশি প্রয়োজনীয় প্রিন্টেড বই, ডিজিটাল ই-বুক ও পরীক্ষার সুপার সাজেশন — ঘরে বসেই অর্ডার, দ্রুত ডেলিভারি।',
    'ctaLabel', 'সব প্রোডাক্ট দেখুন',
    'ctaHref', '/shop'
  ),
  'about', jsonb_build_object(
    'index', '03',
    'eyebrow', 'আমাদের সম্পর্কে',
    'titleLine1', 'পলিটেকনিক শিক্ষার্থীদের',
    'titleLine2Prefix', 'কথা ভেবেই',
    'titleHighlight', 'তৈরি',
    'titleLine2Suffix', '।',
    'paragraph1', 'Polytechnic Tutorial Home একটি ফোকাসড এডুকেশন প্ল্যাটফর্ম, যেখানে শুধুমাত্র বাংলাদেশের ডিপ্লোমা ইন ইঞ্জিনিয়ারিং শিক্ষার্থীদের জন্য কনটেন্ট তৈরি করা হয়। বিএসসি বা এইচএসসির জেনেরিক কোর্স নয় — আপনার সিলেবাস, আপনার বোর্ড প্রশ্নের ধরন অনুযায়ী সাজানো।',
    'paragraph2', 'লক্ষ্য একটাই — প্রতিটা শিক্ষার্থী যেন সহজে, স্পষ্ট করে বুঝতে পারে এবং পরীক্ষায় ভালো করতে পারে।',
    'badge', 'Bogura · Est. 2024',
    'features', jsonb_build_array(
      jsonb_build_object('title', 'অভিজ্ঞ শিক্ষক', 'description', 'নামকরা পলিটেকনিকের ১০+ বছর অভিজ্ঞ শিক্ষকদের সরাসরি লেকচার।', 'icon', 'award'),
      jsonb_build_object('title', 'স্ট্রাকচার্ড ভিডিও', 'description', 'চ্যাপ্টার ভিত্তিক সাজানো লেসন — ঠিক যেভাবে ক্লাসে পড়ানো হয়।', 'icon', 'play'),
      jsonb_build_object('title', 'লাইভ ইন্টার‍্যাকশন', 'description', 'সপ্তাহে ২০+ লাইভ ক্লাস, প্রশ্ন-উত্তর ও ডাউট সেশন।', 'icon', 'users')
    )
  ),
  'testimonials', jsonb_build_object(
    'index', '04',
    'eyebrow', 'শিক্ষার্থীদের অভিজ্ঞতা',
    'titleLine1', 'যা বলছেন আমাদের',
    'titleHighlight', 'শিক্ষার্থীরা',
    'titleLine2Suffix', '।',
    'items', jsonb_build_array(
      jsonb_build_object('name', 'রাকিবুল হাসান', 'role', 'কম্পিউটার, ৬ষ্ঠ পর্ব', 'text', 'ভিডিও লেকচারগুলো এত সহজ করে বোঝানো — বই খুলে বসতেই ইচ্ছা করে। সাজেশনও কমন এসেছে ৯০%+।'),
      jsonb_build_object('name', 'তানজিনা আক্তার', 'role', 'সিভিল, ৪র্থ পর্ব', 'text', 'লাইভ ক্লাসে সরাসরি প্রশ্ন করা যায়, এটাই সবচেয়ে বড় প্লাস। রেজাল্ট আগের চেয়ে অনেক ভালো এসেছে।'),
      jsonb_build_object('name', 'মেহেদী হাসান', 'role', 'ইলেকট্রিক্যাল, ৮ম পর্ব', 'text', 'নোটস আর মডেল টেস্ট মিলিয়ে পুরো সিলেবাস কভার হয়ে যায়। ফাইনালের আগে দারুণ কাজে দিয়েছে।')
    )
  ),
  'faq', jsonb_build_object(
    'index', '05',
    'eyebrow', 'FAQ',
    'titleLine1', 'সাধারণ',
    'titleHighlight', 'জিজ্ঞাসা',
    'titleLine2Suffix', '।',
    'description', 'আরও প্রশ্ন থাকলে সরাসরি আমাদের সাথে যোগাযোগ করুন।',
    'items', jsonb_build_array(
      jsonb_build_object('q', 'কোর্স কতদিন অ্যাক্সেস করা যাবে?', 'a', 'প্রিমিয়াম প্ল্যানে এনরোল করলে পুরো সেমিস্টার জুড়ে সব ভিডিও, নোটস ও লাইভ ক্লাসে আনলিমিটেড অ্যাক্সেস পাবেন।'),
      jsonb_build_object('q', 'পেমেন্ট কীভাবে করব?', 'a', 'বিকাশ, নগদ, রকেট এবং ডেবিট/ক্রেডিট কার্ড — সবগুলো অপশন আছে। পেমেন্ট সাথে সাথেই কোর্স আনলক হয়ে যাবে।'),
      jsonb_build_object('q', 'ভিডিও কি ডাউনলোড করা যাবে?', 'a', 'সিকিউরিটির কারণে ভিডিও ডাউনলোড করা যাবে না, কিন্তু যতবার খুশি স্ট্রিম করে দেখতে পারবেন। নোটস ও পিডিএফ ডাউনলোড করা যাবে।'),
      jsonb_build_object('q', 'বই অর্ডার করলে কতদিনে পাব?', 'a', 'ঢাকার ভেতরে ১-২ দিন, ঢাকার বাইরে ২-৩ কর্মদিবসের মধ্যে পৌঁছে যাবে।'),
      jsonb_build_object('q', 'কোনো অ্যাকাউন্ট ছাড়াই কি কিনতে পারব?', 'a', 'শপ থেকে বই বা সাজেশন কিনতে অ্যাকাউন্ট লাগবে না — গেস্ট চেকআউটে সরাসরি অর্ডার করা যাবে।')
    )
  ),
  'finalCta', jsonb_build_object(
    'badge', 'প্রথম ৫টি লেসন ফ্রি',
    'titleLine1', 'আজই শুরু করুন',
    'titleLine2Prefix', 'আপনার',
    'titleHighlight', 'প্রস্তুতি',
    'titleLine2Suffix', '।',
    'description', 'কোনো কার্ড লাগবে না — এখনই সাইন আপ করে বিনামূল্যে লেসন দেখা শুরু করুন।',
    'ctaPrimaryLabel', 'এনরোল করুন',
    'ctaPrimaryHref', '/courses',
    'ctaSecondaryLabel', 'শপ দেখুন',
    'ctaSecondaryHref', '/shop'
  )
));

-- Seed static pages
INSERT INTO public.static_pages (slug, title, eyebrow, body_markdown) VALUES
('about', 'আমাদের সম্পর্কে', 'About', E'Polytechnic Tutorial Home বাংলাদেশের ডিপ্লোমা ইন ইঞ্জিনিয়ারিং ছাত্র-ছাত্রীদের জন্য তৈরি একটি নির্ভরযোগ্য অনলাইন শিক্ষা ও ই-কমার্স প্ল্যাটফর্ম। আমাদের লক্ষ্য হলো — মানসম্মত পাঠ্যবই, ই-বুক এবং পরীক্ষার সুপার সাজেশন সহজেই ছাত্র-ছাত্রীদের হাতে পৌঁছে দেওয়া।\n\n## আমাদের লক্ষ্য\n\nপ্রতিটি ডিপ্লোমা শিক্ষার্থীর সফলতা নিশ্চিত করা।\n\n## মানসম্মত কন্টেন্ট\n\nঅভিজ্ঞ শিক্ষকদের যাচাইকৃত বই ও সাজেশন।\n\n## কমিউনিটি\n\n১০,০০০+ শিক্ষার্থীর ভরসার প্ল্যাটফর্ম।'),
('terms-of-service', 'Terms of Service', 'Legal', E'শর্তাবলী — Polytechnic Tutorial Home\n\nএই পেজটি Polytechnic Tutorial Home কর্তৃক রক্ষণাবেক্ষণ করা হয়। এখানে বর্ণিত শর্তাবলী আমাদের প্ল্যাটফর্ম এবং সেবাসমূহ ব্যবহারের সাধারণ নিয়ম নির্ধারণ করে।\n\n## ১. শর্তাবলী গ্রহণ\n\nPolytechnic Tutorial Home-র ওয়েবসাইট বা মোবাইল-সংস্করণে প্রবেশ এবং ব্যবহার করার মাধ্যমে আপনি এই শর্তাবলী মেনে চলতে সম্মত হন।\n\n## ২. সেবার বিবরণ\n\nPolytechnic Tutorial Home বাংলাদেশের ডিপ্লোমা ইন ইঞ্জিনিয়ারিং শিক্ষার্থীদের জন্য অনলাইন কোর্স, ভিডিও লেকচার, বই, ই-বুক, সুপার সাজেশন এবং সম্পর্কিত শিক্ষা সামগ্রী প্রদান করে।\n\n## ৩. অ্যাকাউন্ট এবং নিরাপত্তা\n\nআপনি আপনার অ্যাকাউন্টের তথ্য সঠিক এবং হালনাগাদ রাখার দায়িত্ব বহন করেন।\n\n## ৪. ক্রয় এবং পেমেন্ট\n\nআমাদের শপ থেকে পণ্য বা কোর্স কিনলে প্রদর্শিত মূল্য এবং পেমেন্ট-পদ্ধতি প্রযোজ্য হবে।\n\n## ৫. বুদ্ধিবৃত্তিক সম্পত্তি\n\nপ্ল্যাটফর্মে থাকা সব কন্টেন্ট Polytechnic Tutorial Home বা তার লাইসেন্সদাতাদের সম্পত্তি।\n\n## ৬. যোগাযোগ\n\nএই শর্তাবলী নিয়ে প্রশ্ন থাকলে আমাদের সাথে যোগাযোগ করুন: support@polytechnictutorial.com'),
('privacy-policy', 'Privacy Policy', 'Privacy', E'গোপনীয়তা নীতিমালা — Polytechnic Tutorial Home\n\nএই পেজটি Polytechnic Tutorial Home কর্তৃক রক্ষণাবেক্ষণ করা হয়। এখানে বর্ণিত নীতিমালা আমাদের প্ল্যাটফর্ম ব্যবহারের সময় আমরা কীভাবে আপনার তথ্য সংগ্রহ, ব্যবহার এবং রক্ষা করি সেটি ব্যাখ্যা করে।\n\n## ১. আমরা কী তথ্য সংগ্রহ করি\n\nঅ্যাকাউন্ট তথ্য, Google OAuth ডেটা, ক্রয় তথ্য এবং ব্যবহার ডেটা।\n\n## ২. তথ্য কীভাবে ব্যবহার হয়\n\nআমরা আপনার তথ্য ব্যবহার করি — অ্যাকাউন্ট পরিচালনা, কোর্স ও পণ্য সরবরাহ, কেনাকাটা নিশ্চিতকরণ, কাস্টমার সাপোর্ট এবং প্ল্যাটফর্ম উন্নতির জন্য।\n\n## ৩. তথ্য শেয়ারিং\n\nআমরা আপনার ব্যক্তিগত তথ্য শুধুমাত্র পেমেন্ট গেটওয়ে, কুরিয়ার সেবা এবং আইনি প্রয়োজনে শেয়ার করি।\n\n## ৪. যোগাযোগ\n\nগোপনীয়তা সংক্রান্ত যেকোনো প্রশ্নের জন্য: support@polytechnictutorial.com');

-- Seed page SEO for known public routes
INSERT INTO public.page_seo (path, meta_title, meta_description) VALUES
('/', 'Polytechnic Tutorial Home — ডিপ্লোমা প্রস্তুতির সম্পূর্ণ প্ল্যাটফর্ম', 'ডিপ্লোমা ইন ইঞ্জিনিয়ারিং শিক্ষার্থীদের জন্য ভিডিও কোর্স, লাইভ ক্লাস, বই ও সুপার সাজেশন — এক প্ল্যাটফর্মে।'),
('/about', 'আমাদের সম্পর্কে — Polytechnic Tutorial Home', 'Polytechnic Tutorial Home বাংলাদেশের ডিপ্লোমা ছাত্র-ছাত্রীদের জন্য একটি ভরসাযোগ্য শিক্ষা প্ল্যাটফর্ম।'),
('/shop', 'সকল বই ও সাজেশন — Polytechnic Tutorial Home', 'ডিপার্টমেন্ট, সেমিস্টার এবং প্রোডাক্ট টাইপ অনুযায়ী পলিটেকনিকের বই, ই-বুক ও সুপার সাজেশন খুঁজুন।'),
('/courses', 'সকল কোর্স — Polytechnic Tutorial Home', 'ডিপার্টমেন্ট ও সেমিস্টার অনুযায়ী সম্পূর্ণ কোর্স তালিকা।'),
('/terms-of-service', 'Terms of Service — Polytechnic Tutorial Home', 'Polytechnic Tutorial Home-র সেবা ব্যবহারের শর্তাবলী।'),
('/privacy-policy', 'Privacy Policy — Polytechnic Tutorial Home', 'Polytechnic Tutorial Home-র ব্যবহারকারী তথ্যের গোপনীয়তা নীতিমালা।');
