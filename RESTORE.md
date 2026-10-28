# Restoring bc.realestate

Milestone tagged `milestone-2026-10-28`: market pages, weekly type-page copy, footer links, filter counts and exact beds.

## Where everything lives
- **Code:** GitHub (this repo). Netlify builds from the main branch on every push.
- **Hosting, domains, scheduled jobs:** Netlify (bc.realestate, fernie.homes and other agent domains). The scheduled jobs are in netlify/functions and are deployed with the code.
- **Data:** Supabase (listing_rows, market_monthly_stats, intent_pages, area_boundaries, sites, shortlists...).
- **Secrets:** .env (not in git). Keep a copy in your password manager. Netlify holds the same values under Site settings > Environment variables.

## Settings the site needs (.env and Netlify)
- PUBLIC_SUPABASE_URL
- PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- REPLIERS_API_KEY
- REPLIERS_BASE_URL
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_FROM_NUMBER
- PUBLIC_SITE_URL
- AGENT_PHONE_NUMBER
- CRON_SECRET
- PUBLIC_GOOGLE_MAPS_API_KEY
- ANTHROPIC_API_KEY
- GOOGLE_MAPS_API_KEY
- RESEND_API_KEY
- AGENT_EMAIL
- CRON_REPORT_EMAIL
- PHOTOROOM_API_KEY
- PUBLIC_JAWG_ACCESS_TOKEN
- NEWS_ADMIN_PHONE
- NEWS_SMS_FROM

## Fresh computer
1. Install Node.js and Git.
2. `git clone <this repo>` then `npm install`
3. Recreate `.env` from your password manager.
4. `npm run dev`, then open http://localhost:4321/fernie/homes
5. To go back to this exact version: `git checkout milestone-2026-10-28`

## Rebuildable vs. irreplaceable data
- Rebuildable: active listings come back from Repliers on the next sync.
- Hard to replace: hand-imported Matrix history (market_monthly_stats source mls_grid_export), page copy (intent_pages), area outlines (area_boundaries), shortlists and saved searches. Re-import Matrix with: `npx tsx src/scripts/import-matrix-stats.ts <city> "<csv>"`