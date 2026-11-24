# iCOOL Daily Report

Field app for iCOOL crews: daily task schedule linked to customer sites, end-of-day work reports with mandatory photos, goods/fuel only with invoice photo + source, foreman daily sheet (paper photo or phone entry), maintenance plans, and each worker's account.

- Static site (Vercel, root `daily-report/`). No build step.
- Backend: Supabase project `icool-concept`, schema `dr` (see `sql/`). Browser holds only a session token; all access is through `public.dr_api`.
- Link with منصة يوميات iCOOL: the platform page calls `dr.platform_sync()` through Ahmad's Supabase connector — pushes worker balances + attendance, pulls closed daily logs.

- Customers and sites (24/11/2026): `dr.customers` is the person/company (name stays fixed); `dr.sites` holds each place (label, area, GPS, Deye system, platform name). Tasks, reports, expenses and plans carry `site_id`. See `sql/003_sites.sql`.
- Site sheets (24/11/2026, `sql/005_site_sheets.sql`): workers press «وصلت» / «طلعت» (server time + phone GPS, not editable by them; distance to the site kept), fill one sheet per site per day (work + photos, goods received/used/left and where, missing customer info, expenses/payments with invoice photos) or photograph the printed form. The boss's «الورقة الموحّدة» merges all site sheets and visits of a day, prints, and can fill the foreman's daylog (which syncs to منصة يوميات iCOOL).
