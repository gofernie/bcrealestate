-- crm-v2: tasks per person (replaces single follow-up; crm_people.next_followup_at mirrors earliest open task)
create table if not exists crm_tasks (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null,
  person_key text not null,
  title text not null,
  due_on date,
  done_at timestamptz,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists crm_tasks_person on crm_tasks (site_id, person_key, done_at, due_on);
alter table crm_tasks enable row level security;

-- carry existing follow-ups over as tasks
insert into crm_tasks (site_id, person_key, title, due_on)
select p.site_id, p.person_key, coalesce(nullif(trim(p.followup_note), ''), 'Follow up'), p.next_followup_at
from crm_people p
where p.next_followup_at is not null
  and not exists (select 1 from crm_tasks t where t.site_id = p.site_id and t.person_key = p.person_key);