# iCOOL Daily Report

Field app for iCOOL crews: daily task schedule linked to customer sites, end-of-day work reports with mandatory photos, goods/fuel only with invoice photo + source, foreman daily sheet (paper photo or phone entry), maintenance plans, and each worker's account.

- Static site (Vercel, root `daily-report/`). No build step.
- Backend: Supabase project `icool-concept`, schema `dr` (see `sql/`). Browser holds only a session token; all access is through `public.dr_api`.
- Link with منصة يوميات iCOOL: the platform page calls `dr.platform_sync()` through Ahmad's Supabase connector — pushes worker balances + attendance, pulls closed daily logs.

- Customers and sites (24/11/2026): `dr.customers` is the person/company (name stays fixed); `dr.sites` holds each place (label, area, GPS, Deye system, platform name). Tasks, reports, expenses and plans carry `site_id`. See `sql/003_sites.sql`.
- Site sheets (24/11/2026, `sql/005_site_sheets.sql`): workers press «وصلت» / «طلعت» (server time + phone GPS, not editable by them; distance to the site kept), fill one sheet per site per day (work + photos, goods received/used/left and where, missing customer info, expenses/payments with invoice photos) or photograph the printed form. The boss's «الورقة الموحّدة» merges all site sheets and visits of a day, prints, and can fill the foreman's daylog (which syncs to منصة يوميات iCOOL).
- Handwriting reading (24/11/2026, `sql/007_read_queue.sql`): done inside منصة يوميات iCOOL itself, the way it reads Maher's sheets (Claude via the artifact `sample` capability, Supabase via Ahmad's connector, no API key). Sheet photos are also stored as base64 (`dr.photo_data`); «🔍 اقرا الورقة» queues a request (`dr.read_queue`); while the platform is open it checks the queue every minute (`drRead()`), reads with its own prompt (daily sheets) or the site-sheet prompt from `reader/prompts.js` + its foreman lessons and dictionary, and writes the result back; the app polls and fills the form for review.
- Stock (`sql/006_stock.sql`): ledger per place (الفان، رابيد الفورمان، رابيد المحل، البيك أب، المحل / المستودع). Counts (جردة) set the balance; loads/unloads and closed site sheets (received into / used from / left in a vehicle) move it.
