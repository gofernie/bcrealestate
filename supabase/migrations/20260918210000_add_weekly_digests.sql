create extension if not exists pgcrypto;

create table if not exists public.digest_configs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,

  name text not null default 'Weekly market update',
  city_slug text not null,
  market_name text,
  market_cities text[] not null default '{}',

  send_mode text not null default 'manual'
    check (send_mode in ('manual', 'approval', 'automatic')),

  send_day smallint not null default 1
    check (send_day between 0 and 6),

  send_hour_utc smallint not null default 16
    check (send_hour_utc between 0 and 23),

  subject_template text not null default
    '{{market}} weekly real estate update',

  intro_text text,
  max_listings smallint not null default 6
    check (max_listings between 1 and 20),

  active boolean not null default true,

  last_generated_at timestamptz,
  last_sent_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists digest_configs_site_id_idx
  on public.digest_configs(site_id);

create index if not exists digest_configs_schedule_idx
  on public.digest_configs(active, send_mode, send_day, send_hour_utc);


create table if not exists public.digest_subscribers (
  id uuid primary key default gen_random_uuid(),
  config_id uuid not null
    references public.digest_configs(id) on delete cascade,

  name text,
  email text not null,
  status text not null default 'subscribed'
    check (status in ('subscribed', 'unsubscribed', 'bounced')),

  consent_source text not null default 'agent_added',
  consent_at timestamptz not null default now(),

  unsubscribe_token uuid not null default gen_random_uuid(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(config_id, email),
  unique(unsubscribe_token)
);

create index if not exists digest_subscribers_config_status_idx
  on public.digest_subscribers(config_id, status);


create table if not exists public.digest_runs (
  id uuid primary key default gen_random_uuid(),

  config_id uuid not null
    references public.digest_configs(id) on delete cascade,

  site_id uuid not null
    references public.sites(id) on delete cascade,

  period_start date not null,
  period_end date not null,

  status text not null default 'draft'
    check (
      status in (
        'draft',
        'ready',
        'sending',
        'sent',
        'failed',
        'cancelled'
      )
    ),

  subject text not null,
  intro_text text,

  payload jsonb not null default '{}'::jsonb,
  preview_html text,

  generated_at timestamptz not null default now(),
  approved_at timestamptz,
  sent_at timestamptz,
  error_message text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(config_id, period_start, period_end)
);

create index if not exists digest_runs_config_created_idx
  on public.digest_runs(config_id, created_at desc);

create index if not exists digest_runs_status_idx
  on public.digest_runs(status);


create table if not exists public.digest_deliveries (
  id uuid primary key default gen_random_uuid(),

  run_id uuid not null
    references public.digest_runs(id) on delete cascade,

  subscriber_id uuid
    references public.digest_subscribers(id) on delete set null,

  email text not null,

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'sent',
        'failed',
        'bounced',
        'unsubscribed'
      )
    ),

  resend_email_id text,
  error_message text,

  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(run_id, email)
);

create index if not exists digest_deliveries_run_status_idx
  on public.digest_deliveries(run_id, status);


alter table public.digest_configs enable row level security;
alter table public.digest_subscribers enable row level security;
alter table public.digest_runs enable row level security;
alter table public.digest_deliveries enable row level security;

comment on table public.digest_configs is
  'Agent-controlled weekly digest definitions and delivery schedules.';

comment on table public.digest_subscribers is
  'Consent-aware recipients for an individual digest.';

comment on table public.digest_runs is
  'Immutable weekly digest editions, previews and sending state.';

comment on table public.digest_deliveries is
  'Per-recipient delivery results for each digest edition.';
