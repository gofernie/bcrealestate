alter table public.agents
add column if not exists credentials text;

comment on column public.agents.credentials is
  'Professional credentials or designation displayed after the agent name.';