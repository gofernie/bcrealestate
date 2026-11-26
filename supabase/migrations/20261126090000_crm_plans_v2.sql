-- crm-plans v2: express consent date + stop-on-closed per plan
alter table crm_people add column if not exists consent_express_on date;
alter table crm_plans add column if not exists stop_when_closed boolean not null default false;
update crm_plans set stop_when_closed = true where name in ('New buyer lead', 'Quiet buyer');