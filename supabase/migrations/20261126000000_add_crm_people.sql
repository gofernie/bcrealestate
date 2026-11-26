-- crm-v1: per-site contact record (stage, follow-up) and notes, keyed by e:<email> or p:<last 10 phone digits>
create table if not exists crm_people (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null,
  person_key text not null,
  display_name text,
  stage text not null default 'new',
  next_followup_at date,
  followup_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, person_key)
);

create table if not exists crm_notes (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null,
  person_key text not null,
  body text not null,
  kind text not null default 'note',
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists crm_notes_person on crm_notes (site_id, person_key, created_at desc);

alter table crm_people enable row level security;
alter table crm_notes enable row level security;
