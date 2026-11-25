-- cma-v1: street address on cached sales, for comps that never passed through the active feed.
alter table public.sold_listings add column if not exists address text;
