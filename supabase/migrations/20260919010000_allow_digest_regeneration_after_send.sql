-- Preserve sent digest history while allowing one new working edition
-- for the same configuration and reporting period.

alter table public.digest_runs
  drop constraint if exists
  digest_runs_config_id_period_start_period_end_key;

drop index if exists
  public.digest_runs_config_id_period_start_period_end_key;

create unique index if not exists
  digest_runs_one_working_edition_per_period_idx
on public.digest_runs (
  config_id,
  period_start,
  period_end
)
where status <> 'sent';