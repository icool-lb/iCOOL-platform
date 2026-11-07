// Searches the web for a compressor model that is not in the platform, returns its specs with sources,
// and adds it to the shared database (marked unverified until the admin confirms it).
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
    const { code, model, brand, plate } = req.body || {};
    const m = String(model || "").trim().slice(0, 60);
    const b = String(brand || "").trim().slice(0, 60);
    if (m.replace(/[\s\-./_]/g, "").length < 3) return send(res, 400, { ok: false, err: "model" });
    const q = await rpc("cmp_ai", { p_code: code, p_kind: "lookup" }, req);
    if (!q.ok) return send(res, 403, q);
    const found = await searchText(req, prompt(b, m, plate), {
      model: "anthropic/claude-sonnet-5",
      models: ["openai/gpt-6-astra", "google/gemini-3.6-flash"],
      messages: [{ role: "user", content: prompt(b, m, plate) }],
      tools: [{ type: "vercel:perplexity_search", config: { query: `${b} ${m} compressor datasheet cooling capacity refrigerant`.trim(), max_results: 8 } }],
      tool_choice: "required",
      max_tokens: 1800,
      temperature: 0,
    });
    const r = parseJSON(found.text);
    if (!r) return send(res, 502, { ok: false, err: "parse" });
    const s = r.spec || {};
    const useful = r.found && (s.capacities?.length || s.hp || s.refrigerant || s.displacement_cc);
    let saved = null;
    if (useful) {
      const named = (Array.isArray(r.sources) ? r.sources : []).filter((x) => x && /^https?:\/\//.test(x.url || ""));
      const seen = new Set();
      const sources = [...named, ...found.sources].filter((x) => !seen.has(x.url) && seen.add(x.url)).slice(0, 6);
      saved = await rpc("cmp_extra_add", {
        p_code: code,
        p_row: { brand: r.brand || b, model: r.model || m, spec: s, sources, origin: plate ? "plate+web" : "web" },
      }, req);
      r.sources = sources;
    }
    return send(res, 200, { ok: true, result: r, saved, left: q.left });
  } catch (e) {
    console.error("lookup", e);
    const msg = String(e.message || e);
    if (/customer_verification_required|credit card|402|ai_key/i.test(msg))
      return send(res, 503, { ok: false, err: "ai_setup" });
    if (/ai_busy/.test(msg)) return send(res, 429, { ok: false, err: "ai_busy" });
    return send(res, 500, { ok: false, err: "server", detail: msg.slice(0, 300) });
  }
}
