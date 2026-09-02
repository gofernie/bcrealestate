alter table public.listing_rows
add column if not exists year_built integer;

comment on column public.listing_rows.year_built is
'Construction year supplied by Repliers/MLS. Null when not supplied.';