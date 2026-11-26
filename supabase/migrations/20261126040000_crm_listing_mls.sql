-- crm: seller's own listing
alter table crm_people add column if not exists listing_mls text;
