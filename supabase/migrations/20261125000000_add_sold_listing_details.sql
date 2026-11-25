-- cma-v1: home details on cached sales so the agent CMA can adjust for beds, age and lot.
alter table public.sold_listings
  add column if not exists beds numeric,
  add column if not exists baths numeric,
  add column if not exists year_built integer,
  add column if not exists lot_size_sqft numeric;
