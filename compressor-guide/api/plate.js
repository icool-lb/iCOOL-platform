// Reads a compressor nameplate photo and returns the printed data as JSON.
import { rpc, visionText, parseJSON, send } from "../lib/ai.js";

const PROMPT = `You are reading the nameplate (rating label) of a refrigeration / air-conditioning compressor from a photo.
Return ONLY a JSON object, no prose, with exactly these keys (use null when a value is not printed or not legible; never guess):
{
 "brand": "manufacturer as printed (e.g. Embraco, Tecumseh, Danfoss, Secop, LG, Samsung, GMCC, Highly, Copeland, Kulthorn, Donper, Panasonic)",
 "model": "the compressor MODEL number exactly as printed, keeping letters and digits",
 "candidates": ["every other code on the label that could be the model or a variant (BOM, type, part no.), most likely first"],
 "refrigerant": "e.g. R134a, R600a, R290, R22, R404A, R410A",
 "voltage": "as printed, e.g. 220-240V",
 "hz": "e.g. 50 or 50/60",
 "phase": "1 or 3",
 "rla": "rated load amps as printed",
 "lra": "locked rotor amps as printed",
 "hp": "horsepower if printed",
 "application": "LBP / MBP / HBP / AC if printed",
 "other": "any other useful printed info, short",
 "legible": true or false (false if the photo is not a compressor nameplate or too blurry)
}`;

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { ok: false, err: "method" });
  try {
    const { code, image } = req.body || {};
    if (typeof image !== "string" || !image.startsWith("data:image/") || image.length > 6_000_000)
      return send(res, 400, { ok: false, err: "image" });
    const q = await rpc("cmp_ai", { p_code: code, p_kind: "plate" }, req);
    if (!q.ok) return send(res, 403, q);
    const out = await visionText(req, PROMPT, image, {
      model: "anthropic/claude-sonnet-5",
      models: ["google/gemini-3.6-flash", "openai/gpt-6-astra"],
      messages: [{ role: "user", content: [{ type: "text", text: PROMPT }, { type: "image_url", image_url: { url: image } }] }],
      max_tokens: 900,
      temperature: 0,
    });
    const plate = parseJSON(out);
    if (!plate) return send(res, 502, { ok: false, err: "parse" });
    return send(res, 200, { ok: true, plate, left: q.left });
  } catch (e) {
    console.error("plate", e);
    const msg = String(e.message || e);
    if (/customer_verification_required|credit card|insufficient|402|gemini_key/i.test(msg))
      return send(res, 503, { ok: false, err: "ai_setup" });
    if (/gemini_quota/.test(msg)) return send(res, 429, { ok: false, err: "ai_busy" });
    return send(res, 500, { ok: false, err: "server", detail: msg.slice(0, 300) });
  }
}
