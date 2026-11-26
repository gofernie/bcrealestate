-- crm: purchase price/month for market-since-purchase
alter table crm_people add column if not exists bought_price numeric, add column if not exists bought_month text, add column if not exists bought_type text;
