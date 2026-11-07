# iCOOL Daily Report

Field app for iCOOL crews: daily task schedule linked to customer sites, end-of-day work reports with mandatory photos, goods/fuel only with invoice photo + source, foreman daily sheet (paper photo or phone entry), maintenance plans, and each worker's account.

- Static site (Vercel, root `daily-report/`). No build step.
- Backend: Supabase project `icool-concept`, schema `dr` (see `sql/`). Browser holds only a session token; all access is through `public.dr_api`.
- Link with منصة يوميات iCOOL: the platform page calls `dr.platform_sync()` through Ahmad's Supabase connector — pushes worker balances + attendance, pulls closed daily logs.
