// Admin-only web search for a compressor model's specs (OpenAI + web search).
// Returns the result for the admin to review; nothing is saved here — the admin saves through the model form.
import { rpc, searchText, parseJSON, send } from "../lib/ai.js";

function prompt(brand, model, plate) {
  return `Find the technical data of this refrigeration/AC compressor using web search.
Compressor: brand "${brand || "unknown"}", model "${model}".${plate ? `\nNameplate data already read: ${JSON.stringify(plate).slice(0, 600)}` : ""}

Rules:
- Use only values you actually found in the search results (manufacturer datasheets/catalogs preferred, then distributors). Never invent numbers.
- Cooling capacity in WATTS at an evaporating temperature. Convert BTU/h (÷3.412) or kcal/h (÷0.86) to W. Prefer ASHRAE points: LBP −23.3 °C, MBP −6.7 °C, HBP/AC +7.2 °C; if the source uses CECOMAF/EN12900 (−25 °C, −10 °C, +5 °C) keep its temperature and set "standard" accordingly.
- If the exact model is not found, set "found": false (you may mention the closest family in notes_ar).

Return ONLY this JSON, no prose:
{
 "found": true/false,
 "brand": "manufacturer",
 "model": "exact model",
 "spec": {
  "type": "reciprocating / rotary / scroll / inverter",
  "hp": "e.g. 1/4 or 1.5",
  "refrigerant": "e.g. R134a",
  "application": "LBP / MBP / HBP / AC / L/MBP …",
  "voltage": "e.g. 220-240V 50Hz 1ph",
  "hz": "50 / 60 / 50/60",
  "rla": number or null, "lra": number or null,
  "watts_input": number or null,
  "displacement_cc": number or null,
  "rpm": number or null,
  "capacities": [{"evap_c": number, "watts": number, "standard": "ASHRAE / CECOMAF / EN12900"}],
  "oil_cc": number or null,
  "run_cap_uf": "value or null", "start_cap_uf": "value or null",
  "confidence": "high / medium / low",
  "notes_ar": "one or two short sentences in Arabic for a refrigeration technician (equivalents, cautions)"
 },
 "sources": [{"title": "page title", "url": "https://..."}]
}`;
}


export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { ok: false, err: "method" });
  try {
    const { pass, model, brand, plate } = req.body || {};
    const m = String(model || "").trim().slice(0, 60);
    const b = String(brand || "").trim().slice(0, 60);
    if (m.replace(/[\s\-./_]/g, "").length < 3) return send(res, 400, { ok: false, err: "model" });
    const auth = await rpc("cmp_admin", { p_pass: String(pass || ""), p_action: "list", p_args: {} }, req);
    if (!auth.ok) return send(res, 403, { ok: false, err: auth.err === "locked" ? "locked" : "denied" });
    const found = await searchText(req, prompt(b, m, plate), null, { providers: ["openai"] });
    const r = parseJSON(found.text);
    if (!r) return send(res, 502, { ok: false, err: "parse" });
    const named = (Array.isArray(r.sources) ? r.sources : []).filter((x) => x && /^https?:\/\//.test(x.url || ""));
    const seen = new Set();
    r.sources = [...named, ...found.sources].filter((x) => !seen.has(x.url) && seen.add(x.url)).slice(0, 6);
    return send(res, 200, { ok: true, result: r });
  } catch (e) {
    console.error("admin-lookup", e);
    const msg = String(e.message || e);
    if (/ai_key/i.test(msg)) return send(res, 503, { ok: false, err: "ai_setup" });
    if (/ai_busy/.test(msg)) return send(res, 429, { ok: false, err: "ai_busy" });
    return send(res, 500, { ok: false, err: "server", detail: msg.slice(0, 300) });
  }
}
