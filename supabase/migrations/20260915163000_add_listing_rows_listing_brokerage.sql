alter table public.listing_rows
add column if not exists listing_brokerage text;

comment on column public.listing_rows.listing_brokerage is
  'Brokerage representing the individual listing, supplied by the listing feed.';