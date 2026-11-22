"""Shop-drawings engine → iCOOL Pricing platform.

Reads the BOQ the drawing build produced (boq.json rows: [#, description, unit, qty, rate, formula, notes]),
maps each line to a catalog key of the pricing platform, and pushes it with pr_api('import_boq').
Re-running after a drawing revision updates quantities and keeps every rate Ahmad already confirmed.

  python3 export_boq.py --ref BLCK-C7 --name "BLCK Specialty Coffee - HVAC" --client "BLCK" --site "..." [--pin 1234]
  python3 export_boq.py ... --json   # print the payload (for pushing through another channel)
"""
import argparse, json, os, re, sys, urllib.request

# (regex on description, catalog key, section) — first match wins
RULES = [
    (r"60,000 BTU|60k", "hvac.duct.midea.60k", "Equipment"),
    (r"48,000 BTU|48k", "hvac.duct.midea.48k", "Equipment"),
    (r"36,000 BTU|36k", "hvac.duct.midea.36k", "Equipment"),
    (r"24,000 BTU.*duct|duct.*24,000", "hvac.duct.midea.24k", "Equipment"),
    (r"18,000 BTU.*duct|duct.*18,000", "hvac.duct.midea.18k", "Equipment"),
    (r"wall split 12,000|split 12,000", "hvac.split.12k", "Equipment"),
    (r"wall split 18,000", "hvac.split.18k", "Equipment"),
    (r"wall split 24,000", "hvac.split.24k", "Equipment"),
    (r"Fresh-air inline fan", "hvac.faf.1200", "Equipment"),
    (r"extract fan", "hvac.exfan.inline", "Equipment"),
    (r"Galvanised duct", "hvac.duct.gi", "Ductwork"),
    (r"Duct insulation", "hvac.duct.ins25", "Ductwork"),
    (r"Duct supports", "hvac.duct.support", "Ductwork"),
    (r"Linear slot", "hvac.slot.2x25", "Air terminals"),
    (r"Square 4-way diffuser", "hvac.sd.600", "Air terminals"),
    (r"Return grille", "hvac.rg.filter", "Air terminals"),
    (r"Volume damper", "hvac.vd", "Ductwork"),
    (r"Backdraft damper", "hvac.bdd", "Ductwork"),
    (r"flexible duct", "hvac.flex.250", "Ductwork"),
    (r"Extract valves", "hvac.exvalve", "Air terminals"),
    (r"louvre", "hvac.louvre.500", "Air terminals"),
    (r"Cu pipe 3/8\" incl", "hvac.cu.3/8", "Refrigerant & drain"),
    (r"Cu pipe 3/4\"|Cu pipe 5/8\"", "hvac.cu.3/4", "Refrigerant & drain"),
    (r"Cu pipe 1/4\" \+ 3/8\"", "hvac.cu.pair.small", "Refrigerant & drain"),
    (r"Cu riser", "hvac.cu.riser", "Refrigerant & drain"),
    (r"Condensate", "hvac.condensate.32", "Refrigerant & drain"),
    (r"Access panels?", "hvac.access.600", "Builder's works"),
    (r"controllers?", "hvac.ctrl.cabling", "Electrical & controls"),
    (r"DB-HVAC", "hvac.db", "Electrical & controls"),
    (r"Testing, commissioning", "hvac.tab", "Testing"),
]


def lines_from_boq(path):
    rows = json.load(open(path))["rows"]
    out = []
    for r in rows:
        if not isinstance(r[0], int):
            continue  # totals / headers
        desc, unit, qty = r[1], r[2], r[3]
        key, sec = None, None
        for rx, k, s in RULES:
            if re.search(rx, desc, re.I):
                key, sec = k, s
                break
        q = qty if isinstance(qty, (int, float)) else None
        out.append({"key": key, "description": desc, "unit": unit, "qty": q,
                    "qty_note": None if q is not None else str(qty), "section": sec or "Other"})
    return out


def main():
    a = argparse.ArgumentParser()
    a.add_argument("--boq", default="boq.json")
    a.add_argument("--ref", required=True)
    a.add_argument("--name", required=True)
    a.add_argument("--client")
    a.add_argument("--site")
    a.add_argument("--trade", default="hvac")
    a.add_argument("--pin", default=os.environ.get("PR_PIN"))
    a.add_argument("--json", action="store_true")
    o = a.parse_args()
    payload = {"drawing_ref": o.ref, "name": o.name, "client": o.client, "site": o.site, "trade": o.trade,
               "lines": lines_from_boq(o.boq)}
    miss = [l["description"] for l in payload["lines"] if not l["key"]]
    if miss:
        print("no catalog key (priced as free lines):", *miss, sep="\n  ", file=sys.stderr)
    if o.json:
        print(json.dumps(payload, ensure_ascii=False))
        return
    cfg = {"url": "https://yjsaudrftboqnoqgfkfh.supabase.co", "key": os.environ["PR_ANON_KEY"]}

    def rpc(fn, body):
        req = urllib.request.Request(cfg["url"] + "/rest/v1/rpc/" + fn, data=json.dumps(body).encode(),
                                     headers={"apikey": cfg["key"], "Authorization": "Bearer " + cfg["key"],
                                              "Content-Type": "application/json"})
        return json.load(urllib.request.urlopen(req))
    tok = rpc("pr_login", {"p_pin": o.pin})
    if "token" not in tok:
        sys.exit(tok)
    res = rpc("pr_api", {"p_token": tok["token"], "p_action": "import_boq", "p": payload})
    print("project", res["project"]["id"], "lines", len(res["lines"]))


if __name__ == "__main__":
    main()
