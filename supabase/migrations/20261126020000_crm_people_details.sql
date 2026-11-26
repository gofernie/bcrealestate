-- crm-v3: contact details on crm_people
alter table crm_people
  add column if not exists address text,
  add column if not exists birthday date,
  add column if not exists spouse_name text,
  add column if not exists spouse_phone text,
  add column if not exists spouse_email text;