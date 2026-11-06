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
  return Array.isArray(c) ? c.map((p) => p.text || "").join("") : c || "";
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
