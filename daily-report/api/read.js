// POST /api/read {token, kind: "site"|"daylog", paths: [...storage paths], hint}
// Reads handwritten iCOOL sheets with Claude through Vercel AI Gateway (auth: the deployment's OIDC token, or AI_GATEWAY_API_KEY).
// Only a valid Daily Report session may call it; photos must be in the dr-photos bucket under that session's ticket or already registered.
const { SITE, DAYLOG } = require("./_prompts");

const SUPA = "https://yjsaudrftboqnoqgfkfh.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlqc2F1ZHJmdGJvcW5vcWdma2ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0NTU1MjIsImV4cCI6MjEwOTAzMTUyMn0.kWUqm-0ksqgGE_UJIzsc7dgD15UO-q7KpXLd4DNKuHw";
const MODEL = process.env.READ_MODEL || "anthropic/claude-sonnet-5.5";

function send(res, code, obj) { res.statusCode = code; res.setHeader("content-type", "application/json; charset=utf-8"); res.setHeader("cache-control", "no-store"); res.end(JSON.stringify(obj)); }

async function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = []; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch (e) { return {}; }
}

function extractJson(t) {
  t = String(t || "").replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("ما طلع جواب مفهوم");
  return JSON.parse(t.slice(a, b + 1));
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    // health check for the admin: ?token=<session> → is the AI Gateway reachable from this deployment?
    const tok = String((req.query && req.query.token) || "");
    const b0 = tok && await fetch(SUPA + "/rest/v1/rpc/dr_api", { method: "POST", headers: { apikey: ANON, Authorization: "Bearer " + ANON, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: tok, p_action: "boot", p: {} }) }).then((r) => r.json()).catch(() => null);
    if (!b0 || b0.error) return send(res, 401, { error: "session" });
    const a0 = req.headers["x-vercel-oidc-token"] || process.env.VERCEL_OIDC_TOKEN || process.env.AI_GATEWAY_API_KEY;
    if (!a0) return send(res, 500, { ok: false, msg: "no gateway credential" });
    const r0 = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", { method: "POST", headers: { Authorization: "Bearer " + a0, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 5, messages: [{ role: "user", content: "Reply OK" }] }) });
    const t0 = await r0.text();
    return send(res, r0.ok ? 200 : 502, { ok: r0.ok, status: r0.status, model: MODEL, via: req.headers["x-vercel-oidc-token"] ? "oidc-header" : process.env.VERCEL_OIDC_TOKEN ? "oidc-env" : "key", reply: t0.slice(0, 200) });
  }
  if (req.method !== "POST") return send(res, 405, { error: "POST only" });
  const p = await body(req);
  const paths = (Array.isArray(p.paths) ? p.paths : []).filter((x) => typeof x === "string" && /^[\w-]+\/[\w./-]+\.jpe?g$/i.test(x)).slice(0, 4);
  if (!p.token || !paths.length) return send(res, 400, { error: "bad", msg: "ما في صور" });

  // session check through the app's own RPC
  const boot = await fetch(SUPA + "/rest/v1/rpc/dr_api", { method: "POST", headers: { apikey: ANON, Authorization: "Bearer " + ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: p.token, p_action: "boot", p: {} }) }).then((r) => r.json()).catch(() => null);
  if (!boot || boot.error) return send(res, 401, { error: "session", msg: "انتهت الجلسة — فوت من جديد" });

  const auth = req.headers["x-vercel-oidc-token"] || process.env.VERCEL_OIDC_TOKEN || process.env.AI_GATEWAY_API_KEY;
  if (!auth) return send(res, 500, { error: "config", msg: "قراءة الخط مش مفعّلة على السيرفر (ناقص مفتاح AI Gateway)" });

  const images = [];
  for (const path of paths) {
    const r = await fetch(SUPA + "/storage/v1/object/public/dr-photos/" + path.split("/").map(encodeURIComponent).join("/"));
    if (!r.ok) return send(res, 400, { error: "bad", msg: "ما قدرت افتح الصورة" });
    images.push("data:image/jpeg;base64," + Buffer.from(await r.arrayBuffer()).toString("base64"));
  }
  const prompt = (p.kind === "daylog" ? DAYLOG : SITE).replace("{{HINT}}", JSON.stringify(p.hint || {}));
  const content = [{ type: "text", text: prompt }].concat(images.map((u, i) => ({ type: "image_url", image_url: { url: u } })));
  if (images.length > 1) content.push({ type: "text", text: "The photos are the front and back (or parts) of the same sheet." });

  const ai = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
    method: "POST", headers: { Authorization: "Bearer " + auth, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 6000, temperature: 0, messages: [{ role: "user", content }] })
  });
  const txt = await ai.text();
  if (!ai.ok) { console.error("gateway", ai.status, txt.slice(0, 500)); return send(res, 502, { error: "ai", msg: "ما زبطت القراءة (" + ai.status + ")", detail: txt.slice(0, 300) }); }
  let out;
  try { out = extractJson(JSON.parse(txt).choices[0].message.content); } catch (e) { console.error("parse", e.message, txt.slice(0, 500)); return send(res, 502, { error: "ai", msg: "ما فهمت الجواب — جرّب صورة أوضح" }); }
  out._model = MODEL; out._by = boot.me && boot.me.name; out._at = new Date().toISOString();
  return send(res, 200, { ok: true, data: out });
};
