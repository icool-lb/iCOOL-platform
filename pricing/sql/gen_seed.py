"""Generate 003_seed.sql: standard catalog (all trades) + MIDEA CAC wholesale costs + sync function.
Rates are supply+install USD before VAT. est_rate = engineering estimate until a supplier cost or a
confirmed rate exists; the app labels them «تقدير»."""
import json

def q(v):
    if v is None:
        return "null"
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"

# key, trade, name, name_ar, unit, cost_usd, cost_note, install_usd, est_rate, cost_ids
CAT = [
  # ---------- HVAC ----------
  ("hvac.duct.midea.60k", "hvac", "MIDEA duct dual inverter 60,000 BTU/h (MTI, R32)", "دكت ميديا 60000 إنفرتر", "set", None, None, 300, None, ["midea-cac:MTI-60"]),
  ("hvac.duct.midea.48k", "hvac", "MIDEA duct dual inverter 48,000 BTU/h (MTI, R32)", "دكت ميديا 48000 إنفرتر", "set", None, None, 280, None, ["midea-cac:MTI-48"]),
  ("hvac.duct.midea.36k", "hvac", "MIDEA duct dual inverter 36,000 BTU/h (MTI, R32)", "دكت ميديا 36000 إنفرتر", "set", None, None, 250, None, ["midea-cac:MTI-36"]),
  ("hvac.duct.midea.24k", "hvac", "MIDEA duct inverter 24,000 BTU/h", "دكت ميديا 24000", "set", 1278, "سعر شراء شغل مصطفى ناصر", 160, None, []),
  ("hvac.duct.midea.18k", "hvac", "MIDEA duct inverter 18,000 BTU/h", "دكت ميديا 18000", "set", 1050, "سعر شراء شغل مصطفى ناصر", 160, None, []),
  ("hvac.split.12k", "hvac", "Wall split inverter 12,000 BTU/h", "سبليت جداري 12000 إنفرتر", "set", None, None, 0, 470, []),
  ("hvac.split.18k", "hvac", "Wall split inverter 18,000 BTU/h", "سبليت جداري 18000 إنفرتر", "set", None, None, 0, 640, []),
  ("hvac.split.24k", "hvac", "Wall split inverter 24,000 BTU/h", "سبليت جداري 24000 إنفرتر", "set", None, None, 0, 820, []),
  ("hvac.faf.1200", "hvac", "Fresh-air inline fan 1200 m3/h @200 Pa + G4/F7 filter box", "مروحة هوا نضيف 1200 م³/س + فلتر", "no", None, None, 0, 1150, []),
  ("hvac.exfan.inline", "hvac", "Inline extract fan Ø160-200 + backdraft", "شفاط inline", "no", None, None, 0, 280, []),
  ("hvac.duct.gi", "hvac", "Galvanised duct 0.6 mm incl. fittings, plenums, sealant", "دكت مغلفن 0.6 مع القطع", "m²", None, None, 0, 30, []),
  ("hvac.duct.ins25", "hvac", "Duct insulation 25 mm fibreglass + FSK", "عزل دكت 25 ملم", "m²", None, None, 0, 12, []),
  ("hvac.duct.support", "hvac", "Duct supports M8 rod + trapeze", "تعليق دكت", "set", None, None, 0, 8, []),
  ("hvac.slot.2x25", "hvac", "Linear slot diffuser 2x25 mm with insulated plenum", "سلوت خطي مع بلينيوم", "m", None, None, 0, 85, []),
  ("hvac.sd.600", "hvac", "Square 4-way diffuser 600x600 with plenum, OBD", "دفيوزر مربع 60×60 مع بلينيوم", "no", None, None, 0, 75, []),
  ("hvac.rg.filter", "hvac", "Return grille with filter frame", "غريل راجع مع فلتر", "no", None, None, 0, 60, []),
  ("hvac.vd", "hvac", "Volume damper with locking quadrant", "دامبر تحكم", "no", None, None, 0, 35, []),
  ("hvac.bdd", "hvac", "Backdraft damper", "دامبر عكسي", "no", None, None, 0, 40, []),
  ("hvac.flex.250", "hvac", "Insulated flexible duct Ø250", "فليكس معزول 250", "m", None, None, 0, 12, []),
  ("hvac.exvalve", "hvac", "Extract valves Ø125/Ø160 + round duct", "فالفات شفط مع قسطل", "lot", None, None, 0, 180, []),
  ("hvac.louvre.500", "hvac", "Aluminium weather louvre 500x500 + bird screen", "لوفر ألمنيوم 50×50", "no", None, None, 0, 150, []),
  ("hvac.cu.1/4", "hvac", "Cu pipe 1/4\" incl. insulation, installed", "نحاس 1/4 مع عزل", "m", None, None, 0, 9, []),
  ("hvac.cu.3/8", "hvac", "Cu pipe 3/8\" incl. insulation, installed", "نحاس 3/8 مع عزل", "m", None, None, 0, 12, []),
  ("hvac.cu.1/2", "hvac", "Cu pipe 1/2\" incl. insulation, installed", "نحاس 1/2 مع عزل", "m", None, None, 0, 15, []),
  ("hvac.cu.5/8", "hvac", "Cu pipe 5/8\" incl. insulation, installed", "نحاس 5/8 مع عزل", "m", None, None, 0, 18, []),
  ("hvac.cu.3/4", "hvac", "Cu pipe 3/4\" incl. insulation, installed", "نحاس 3/4 مع عزل", "m", None, None, 0, 20, []),
  ("hvac.cu.pair.small", "hvac", "Cu pair 1/4\" + 3/8\" incl. insulation (split)", "نحاس سبليت 1/4+3/8", "m", None, None, 0, 18, []),
  ("hvac.cu.pair.mid", "hvac", "Cu pair 1/4\" + 1/2\" incl. insulation (split)", "نحاس سبليت 1/4+1/2", "m", None, None, 0, 22, []),
  ("hvac.cu.riser", "hvac", "Cu riser to ODU area + ODU brackets", "رايزر نحاس + كتائف", "m", None, None, 0, None, []),
  ("hvac.condensate.32", "hvac", "Condensate PVC Ø32 incl. traps, insulation", "تصريف PVC 32 مع عزل", "m", None, None, 0, 8, []),
  ("hvac.access.600", "hvac", "Access panel 600x600 / 450x450", "فتحة صيانة", "no", None, None, 0, 45, []),
  ("hvac.ctrl.cabling", "hvac", "Controller cabling + timer (controllers with units)", "تمديد كونترولر", "set", None, None, 0, 40, []),
  ("hvac.db", "hvac", "DB-HVAC + breakers + isolators + power cabling", "تابلو تكييف مع التمديد", "lot", None, None, 0, 650, []),
  ("hvac.tab", "hvac", "Testing, commissioning, air balancing & TAB report", "فحص وتشغيل وموازنة", "lot", None, None, 0, 400, []),
  # ---------- SOLAR ----------
  ("solar.panel.longi.w", "solar", "PV module LONGi/JA mono (per Wp)", "لوح شمسي (للواط)", "Wp", None, None, 0, 0.22, []),
  ("solar.inv.deye.12k", "solar", "Deye hybrid inverter 12 kW 3Ph", "إنفرتر دي 12 ك.و هايبرد", "no", None, None, 0, None, []),
  ("solar.inv.deye.8k", "solar", "Deye hybrid inverter 8 kW 1Ph", "إنفرتر دي 8 ك.و هايبرد", "no", None, None, 0, None, []),
  ("solar.bat.lfp.kwh", "solar", "LiFePO4 battery (per kWh)", "بطارية ليثيوم (للكيلوواط ساعة)", "kWh", None, None, 0, None, []),
  ("solar.mount.alu", "solar", "Aluminium mounting structure (per panel)", "قاعدة ألمنيوم للوح", "no", None, None, 0, 28, []),
  ("solar.mount.steel", "solar", "Steel structure galvanised (per kg)", "هيكل حديد مغلفن (للكيلو)", "kg", None, None, 0, 3.2, []),
  ("solar.dc.cable6", "solar", "PV DC cable 6 mm² (red/black)", "كابل DC 6 ملم", "m", None, None, 0, 1.6, []),
  ("solar.mc4", "solar", "MC4 connector pair", "وصلة MC4", "pair", None, None, 0, 2.5, []),
  ("solar.dc.combiner", "solar", "DC combiner box with fuses + SPD", "علبة DC مع فيوزات وحماية", "no", None, None, 0, 120, []),
  ("solar.ac.panel", "solar", "AC distribution / changeover panel EDL-GEN-INV", "تابلو AC تحويل كهرباء/مولد/إنفرتر", "no", None, None, 0, 350, []),
  ("solar.earth", "solar", "Earthing: rods + cable + bar", "أرث كامل", "lot", None, None, 0, 150, []),
  ("solar.install.kwp", "solar", "Installation & commissioning (per kWp)", "تركيب وتشغيل (للكيلوواط)", "kWp", None, None, 0, 60, []),
  # ---------- ELECTRICAL ----------
  ("elec.cable.nym3x2.5", "elec", "Cable NYM 3x2.5 installed", "كابل 3×2.5 مع التمديد", "m", None, None, 0.6, None, ["abu-rayya-liban-cables:NYM 3X2.50"]),
  ("elec.cable.nym3x4", "elec", "Cable NYM 3x4 installed", "كابل 3×4 مع التمديد", "m", None, None, 0.7, None, ["abu-rayya-liban-cables:NYM 3X4.00"]),
  ("elec.cable.nym3x6", "elec", "Cable NYM 3x6 installed", "كابل 3×6 مع التمديد", "m", None, None, 0.8, None, ["abu-rayya-liban-cables:NYM 3X6.00"]),
  ("elec.cable.nym4x6", "elec", "Cable NYM 4x6 installed", "كابل 4×6 مع التمديد", "m", None, None, 0.9, None, ["abu-rayya-liban-cables:NYM 4X6.00"]),
  ("elec.cable.nym4x16", "elec", "Cable NYM 4x16 installed", "كابل 4×16 مع التمديد", "m", None, None, 1.5, None, ["abu-rayya-liban-cables:NYM 4X16/mt"]),
  ("elec.mcb.1p", "elec", "MCB 1P 6-32A installed", "قاطع 1P", "no", None, None, 3, 9, []),
  ("elec.mcb.2p", "elec", "MCB 2P C16-C63 installed", "قاطع 2P", "no", None, None, 3, None, ["abu-rayya:6120219R0"]),
  ("elec.mcb.3p", "elec", "MCB 3P C16-C63 installed", "قاطع 3P", "no", None, None, 4, None, ["abu-rayya:6130056R0"]),
  ("elec.db.24", "elec", "Distribution board 24 ways surface", "تابلو 24 خط ظاهر", "no", None, None, 25, None, ["abu-rayya:1057100024000"]),
  ("elec.db.36", "elec", "Distribution board 36 ways surface", "تابلو 36 خط ظاهر", "no", None, None, 30, None, ["abu-rayya:1057100036000"]),
  ("elec.cabletray.100", "elec", "Cable tray 50x100 + cover, installed", "كيبل تراي 10 سم مع غطا", "m", None, None, 4, 14, []),
  ("elec.point.socket", "elec", "Socket outlet point (conduit + wiring + device)", "نقطة بريز كاملة", "pt", None, None, 0, 28, []),
  ("elec.point.light", "elec", "Lighting point (conduit + wiring + switch)", "نقطة إنارة كاملة", "pt", None, None, 0, 24, []),
  ("elec.earth.rod", "elec", "Earth rod 1.5 m + clamp, installed", "قضيب أرث مع الركور", "no", None, None, 8, None, ["abu-rayya:MK-14*1.5M"]),
  ("elec.spd.ac", "elec", "AC surge protector", "حماية صواعق AC", "no", None, None, 5, None, ["abu-rayya:100655"]),
  ("elec.ats.63", "elec", "ATS 2x63A automatic changeover", "محوّل أوتوماتيك 63A", "no", None, None, 15, None, ["abu-rayya:102929"]),
  # ---------- PLUMBING ----------
  ("plumb.ppr.25", "plumb", "PPR pipe 25 mm PN20 incl. fittings, installed", "قسطل PPR 25 مع القطع", "m", None, None, 0, 6, []),
  ("plumb.ppr.32", "plumb", "PPR pipe 32 mm PN20 incl. fittings, installed", "قسطل PPR 32 مع القطع", "m", None, None, 0, 8, []),
  ("plumb.pvc.110", "plumb", "PVC drain 110 mm incl. fittings, installed", "قسطل صرف 110 مع القطع", "m", None, None, 0, 9, []),
  ("plumb.pvc.50", "plumb", "PVC drain 50 mm incl. fittings, installed", "قسطل صرف 50 مع القطع", "m", None, None, 0, 5, []),
  ("plumb.point", "plumb", "Sanitary point (supply + drain)", "نقطة صحية كاملة", "pt", None, None, 0, 45, []),
  ("plumb.pump.booster", "plumb", "Booster pump set with pressure tank", "طرمبة ضغط مع خزان", "set", None, None, 0, 420, []),
  ("plumb.heater.80", "plumb", "Electric water heater 80 L installed", "سخان كهربا 80 ليتر", "no", None, None, 0, 210, []),
  # ---------- HEATING ----------
  ("heat.radiator.section", "heat", "Aluminium radiator (per section) installed", "رديتير ألمنيوم (للشفرة)", "sec", None, None, 0, 14, []),
  ("heat.boiler.30kw", "heat", "Boiler 30 kW with burner, installed", "شوديار 30 ك.و مع حراق", "set", None, None, 0, 1650, []),
  ("heat.pipe.ppr", "heat", "Heating PPR/PEX pipe incl. insulation", "قسطل تدفئة مع عزل", "m", None, None, 0, 9, []),
  ("heat.collector", "heat", "Manifold / collector with valves", "كولكتور مع محابس", "set", None, None, 0, 140, []),
  ("heat.pump.circ", "heat", "Circulation pump (Wilo/DAB) installed", "مضخة دوران", "no", None, None, 0, 230, []),
  ("heat.flue", "heat", "Flue pipe stainless (per m)", "دخان ستانلس", "m", None, None, 0, 45, []),
  # ---------- MEP GENERAL ----------
  ("mep.prelim", "mep", "Preliminaries, transport & site set-up", "تجهيز ونقل", "lot", None, None, 0, None, []),
  ("mep.shopdwg", "mep", "Shop drawings & as-built", "خرائط تنفيذية وAs-built", "lot", None, None, 0, None, []),
  ("mep.coring", "mep", "Core drilling / wall openings", "تفريغ وفتحات", "no", None, None, 0, 25, []),
]

COSTS = [
  # id, supplier, supplier_name, code, item, unit, net, source, ref, date
  ("midea-cac:MTI-60", "midea-cac", "MIDEA CAC Wholesale", "MTI-60", "MIDEA duct dual inverter 60k R32", "set", 2436, "wholesale", "MIDEA CAC wholesale list", "2026-11-21"),
  ("midea-cac:MTI-36", "midea-cac", "MIDEA CAC Wholesale", "MTI-36", "MIDEA duct dual inverter 36k R32", "set", 1477, "wholesale", "MIDEA CAC wholesale list", "2026-11-21"),
]

out = ["-- generated by gen_seed.py", ""]
out.append("create or replace function pr.sync_costs(p jsonb) returns jsonb\nlanguage plpgsql security definer set search_path = '' as $$\n"
           "declare x jsonb; n int := 0;\nbegin\n"
           "  -- p = {items:[{id, supplier, supplier_name, code, item, unit, net_usd, list_usd, discount_pct, last_date, source, ref}]}\n"
           "  for x in select * from jsonb_array_elements(p -> 'items') loop\n"
           "    insert into pr.costs(id, supplier, supplier_name, code, item, unit, net_usd, list_usd, discount_pct, last_date, source, ref, synced_at)\n"
           "    values (x->>'id', x->>'supplier', x->>'supplier_name', x->>'code', x->>'item', x->>'unit', nullif(x->>'net_usd','')::numeric,\n"
           "            nullif(x->>'list_usd','')::numeric, nullif(x->>'discount_pct','')::numeric, nullif(x->>'last_date','')::date, x->>'source', x->>'ref', now())\n"
           "    on conflict (id) do update set supplier_name = excluded.supplier_name, item = excluded.item, unit = excluded.unit,\n"
           "      net_usd = excluded.net_usd, list_usd = excluded.list_usd, discount_pct = excluded.discount_pct,\n"
           "      last_date = excluded.last_date, source = excluded.source, ref = excluded.ref, synced_at = now();\n"
           "    n := n + 1;\n  end loop;\n"
           "  perform pr.refresh_line(id) from pr.lines where status = 'suggested';\n"
           "  return jsonb_build_object('ok', true, 'n', n);\nend $$;\n")
for c in COSTS:
    out.append("insert into pr.costs(id, supplier, supplier_name, code, item, unit, net_usd, source, ref, last_date) values (%s) on conflict (id) do update set net_usd = excluded.net_usd, last_date = excluded.last_date;"
               % ", ".join(q(v) for v in c))
out.append("")
for (key, trade, name, ar, unit, cost, cnote, inst, est, ids) in CAT:
    arr = "array[" + ",".join(q(i) for i in ids) + "]::text[]" if ids else "'{}'::text[]"
    out.append("insert into pr.catalog(key, trade, name, name_ar, unit, cost_ids, cost_usd, cost_note, install_usd, est_rate, note) values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) on conflict (key) do nothing;"
               % (q(key), q(trade), q(name), q(ar), q(unit), arr, q(cost), q(cnote), q(inst), q(est), q("تقدير" if est is not None else None)))
open("003_seed.sql", "w").write("\n".join(out) + "\n")
print(len(CAT), "catalog items")
