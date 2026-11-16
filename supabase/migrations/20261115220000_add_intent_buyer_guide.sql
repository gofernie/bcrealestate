alter table public.intent_pages
  add column if not exists buyer_guide_heading text,
  add column if not exists buyer_guide_copy text;