-- crm-plans v1: email plans (drips)
create table if not exists crm_plans (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists crm_plan_steps (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references crm_plans(id) on delete cascade,
  position int not null default 0,
  day_offset int not null default 0,
  subject text not null,
  body text not null,
  mode text not null default 'review' check (mode in ('review','auto'))
);
create index if not exists crm_plan_steps_plan_idx on crm_plan_steps(plan_id, position);
create table if not exists crm_plan_enrollments (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null,
  person_key text not null,
  plan_id uuid not null references crm_plans(id) on delete cascade,
  started_on date not null default current_date,
  next_step int not null default 0,
  status text not null default 'active' check (status in ('active','paused','stopped','done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crm_plan_enrollments_person_idx on crm_plan_enrollments(site_id, person_key);
create index if not exists crm_plan_enrollments_status_idx on crm_plan_enrollments(status);
create table if not exists crm_drip_sends (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null,
  enrollment_id uuid references crm_plan_enrollments(id) on delete cascade,
  person_key text not null,
  step_position int,
  subject text not null,
  body text not null,
  status text not null default 'ready' check (status in ('ready','sent','skipped','failed')),
  error text,
  task_id uuid,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists crm_drip_sends_person_idx on crm_drip_sends(site_id, person_key, status);
alter table crm_people add column if not exists email_optout boolean not null default false;
alter table crm_plans enable row level security;
alter table crm_plan_steps enable row level security;
alter table crm_plan_enrollments enable row level security;
alter table crm_drip_sends enable row level security;