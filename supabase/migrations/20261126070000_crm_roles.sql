-- crm-roles v1: buyer/seller flags beside stage. null = automatic (seller if listing_mls set, buyer if they browsed/enquired), true/false = set by the agent
alter table crm_people add column if not exists is_buyer boolean;
alter table crm_people add column if not exists is_seller boolean;