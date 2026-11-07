// Shared helpers for the compressor guide API: Supabase RPC + Vercel AI Gateway.
export const SB_URL = "https://yjsaudrftboqnoqgfkfh.supabase.co";
export const SB_KEY = "sb_publishable_u4zv15AT8tkQ0a0Z9MIzWw_36F-prCN";

export async function rpc(fn, args, req) {
  const headers = { apikey: SB_KEY, "Content-Type": "application/json" };
  const ip = req && (req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  if (ip) headers["x-forwarded-for"] = ip;
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers, body: JSON.stringify(args) });
  if (!r.ok) throw new Error(`db ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

function gatewayToken(req) {
  return process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || req.headers["x-vercel-oidc-token"];
}

export async function chat(req, body) {
  const r = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${gatewayToken(req)}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`gateway ${r.status}: ${text.slice(0, 400)}`);
  const j = JSON.parse(text);
  const c = j.choices?.[0]?.message?.content;
  return Array.isArray(c) ? c.filter((p) => !p.thought).map((p) => p.text || "").join("") : c || "";
}

export function parseJSON(s) {
  const m = String(s).match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

export function send(res, status, obj) {
  res.status(status).setHeader("Cache-Control", "no-store");
  res.json(obj);
}

// ---------- Google Gemini (used when GEMINI_API_KEY is set in Vercel) ----------
const GEMINI_MODELS = (process.env.GEMINI_MODEL || "gemini-flash-latest,gemini-2.5-flash").split(",").map((s) => s.trim()).filter(Boolean);
export const useGemini = () => !!process.env.GEMINI_API_KEY;

async function gemini(body) {
  let last;
  for (const model of GEMINI_MODELS) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    if (r.ok) return JSON.parse(text);
    last = new Error(`gemini ${model} ${r.status}: ${text.slice(0, 300)}`);
    if (r.status === 400 && /API key|API_KEY/i.test(text)) throw new Error("gemini_key: " + text.slice(0, 200));
    if (r.status === 429) throw new Error("gemini_quota: " + text.slice(0, 200));
    if (r.status !== 404) throw last; // only fall through to the next model when this one does not exist
  }
  throw last;
}
const partsText = (j) => (j.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || "").join("");

// Read text from an image (data URL). Returns raw model text.
export async function visionText(req, prompt, dataUrl, gatewayBody) {
  if (!useGemini()) return chat(req, gatewayBody);
  const m = dataUrl.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
  if (!m) throw new Error("bad image");
  const j = await gemini({
    contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: m[1], data: m[2] } }] }],
    generationConfig: { temperature: 0, responseMimeType: "application/json" },
  });
  return partsText(j);
}

// Answer with web search. Returns { text, sources: [{title,url}] }.
export async function searchText(req, prompt, gatewayBody) {
  if (!useGemini()) return { text: await chat(req, gatewayBody), sources: [] };
  const j = await gemini({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0 },
  });
  const chunks = j.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const sources = chunks.map((c) => c.web).filter((w) => w && w.uri).map((w) => ({ title: w.title || w.uri, url: w.uri }));
  return { text: partsText(j), sources };
}
