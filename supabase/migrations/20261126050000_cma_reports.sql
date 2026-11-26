-- crm: shareable CMA report snapshots linked from seller emails
create table if not exists cma_reports (
  id uuid primary key default gen_random_uuid(),
  site_id uuid,
  mls text,
  person_key text,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists cma_reports_mls on cma_reports (site_id, mls, created_at desc);
alter table cma_reports enable row level security;