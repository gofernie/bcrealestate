create table if not exists crm_email_events (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null,
  provider_id text,
  kind text not null check (kind in ('open','click','reply')),
  email text,
  subject text,
  link text,
  body text,
  created_at timestamptz not null default now()
);
create index if not exists crm_email_events_site_email_idx on crm_email_events(site_id, email);
create index if not exists session_messages_provider_idx on session_messages(provider_id);
alter table crm_email_events enable row level security;
alter table crm_plans add column if not exists pause_on_reply boolean not null default false;
update crm_plans set pause_on_reply = true where name in ('New buyer lead', 'Quiet buyer');