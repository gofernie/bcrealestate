-- crm-v3b/v4: spouse birthday, manual contacts, partner links (already applied in Supabase SQL editor)
alter table crm_people add column if not exists spouse_birthday date;
alter table crm_people
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists partner_key text,
  add column if not exists manual boolean not null default false;