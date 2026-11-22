# iCOOL Pricing — منصة التسعير

Static site (Vercel, root `pricing/`). Backend: Supabase project `icool-concept`, schema `pr` (see `sql/`). The browser holds only a session token; all access is through `public.pr_api`.

How a rate is suggested (per BOQ line):
1. last confirmed rate for the same catalog item (within `history_days`)
2. supplier cost (pr.costs, linked via catalog.cost_ids) × (1 + trade markup) + install
3. catalog manual cost × markup + install
4. catalog estimate (`est_rate`, shown as «تقدير»)

Links:
- **Supplier prices**: منصة يوميات iCOOL pushes `pricelists/*` and `prices/*` into `pr.costs` through `pr.sync_costs` (PRLINK block, every 30 min while open).
- **Shop drawings**: `export_boq.py` maps the drawing BOQ to catalog keys and calls `pr_api('import_boq')`; re-running keeps confirmed rates and updates quantities.
- Confirmed rates are logged in `pr.rates` and become the first suggestion next time.
