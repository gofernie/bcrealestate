create table if not exists crm_checklist (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null,
  person_key text not null,
  kind text not null check (kind in ('buyer','seller')),
  item text not null,
  position int not null default 0,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists crm_checklist_person_idx on crm_checklist(site_id, person_key);
alter table crm_checklist enable row level security;