alter table public.agents
add column if not exists legal_name text;

alter table public.agents
add column if not exists brokerage_logo_url text;

comment on column public.agents.legal_name is
  'Legal person or corporation operating the agent website.';

comment on column public.agents.brokerage_logo_url is
  'Public URL for the brokerage-approved logo displayed for compliance.';