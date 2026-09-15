alter table public.listing_rows
add column if not exists realtor_ca_url text;

comment on column public.listing_rows.realtor_ca_url is
  'Original REALTOR.ca listing URL supplied by the REALTOR.ca DDF feed.';