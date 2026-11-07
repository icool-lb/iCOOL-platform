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

// ---------- AI providers ----------
// Order: OpenAI (OPENAI_API_KEY) → Google Gemini (GEMINI_API_KEY) → Vercel AI Gateway.
// Every attempt has its own timeout and the whole chain stops before the function's time limit.
const list = (v, d) => (v || d).split(",").map((s) => s.trim()).filter(Boolean);
const OPENAI_MODELS = list(process.env.OPENAI_MODEL, "gpt-5-mini,gpt-4.1-mini");
const GEMINI_MODELS = list(process.env.GEMINI_MODEL, "gemini-2.5-flash,gemini-flash-latest,gemini-2.5-flash-lite");
const BUDGET_MS = 80_000; // vercel.json maxDuration is 90 s
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

class AIError extends Error { constructor(kind, msg) { super(`${kind}: ${msg}`); this.kind = kind; } }

async function call(url, headers, body, ms) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(ms) });
  const text = await r.text();
  return { status: r.status, ok: r.ok, text };
}

// Runs one provider over its models. Returns a value or throws AIError(kind) with kind key|busy|fail.
async function runModels(name, models, deadline, perCallMs, attemptFn) {
  let last = "", busy = false;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const left = deadline - Date.now();
      if (left < 6000) throw new AIError(busy ? "busy" : "fail", `${name}: out of time ${last}`);
      try {
        const r = await attemptFn(model, Math.min(perCallMs, left - 2000));
        if (r.ok) return r.value;
        last = `${name} ${model} ${r.status}: ${r.text.slice(0, 220)}`;
        console.warn(last);
        if (r.status === 401 || ((r.status === 400 || r.status === 403) && /api[ _-]?key|PERMISSION_DENIED|invalid_api_key/i.test(r.text)))
          throw new AIError("key", last);
        if ([429, 500, 502, 503, 504].includes(r.status)) {
          busy = true;
          if (/insufficient_quota|billing/i.test(r.text)) break;
          if (attempt === 0) { await wait(1000); continue; }
        }
      } catch (e) {
        if (e instanceof AIError) throw e;
        last = `${name} ${model}: ${e.name === "TimeoutError" ? "timeout" : e.message}`;
        console.warn(last); busy = true;
      }
      break;
    }
  }
  throw new AIError(busy ? "busy" : "fail", last);
}

// --- OpenAI (Responses API) ---
function openaiText(j) {
  let text = "", sources = [];
  for (const item of j.output || []) {
    if (item.type !== "message") continue;
    for (const c of item.content || []) {
      if (c.type === "output_text") {
        text += c.text || "";
        for (const a of c.annotations || []) if (a.type === "url_citation" && a.url) sources.push({ title: a.title || a.url, url: a.url });
      }
    }
  }
  return { text, sources };
}
function openai(input, { search = false, json = false } = {}, deadline) {
  return runModels("openai", OPENAI_MODELS, deadline, search ? 60_000 : 35_000, async (model, ms) => {
    const body = { model, input };
    if (/^(gpt-5|o\d)/.test(model)) body.reasoning = { effort: "low" };
    if (search) body.tools = [{ type: "web_search" }];
    if (json && !search) body.text = { format: { type: "json_object" } };
    const r = await call("https://api.openai.com/v1/responses", { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body, ms);
    return r.ok ? { ok: true, value: openaiText(JSON.parse(r.text)) } : r;
  });
}

// --- Google Gemini ---
const partsText = (j) => (j.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || "").join("");
function gemini(body, deadline, perCallMs) {
  return runModels("gemini", GEMINI_MODELS, deadline, perCallMs, async (model, ms) => {
    const r = await call(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      { "x-goog-api-key": process.env.GEMINI_API_KEY }, body, ms);
    return r.ok ? { ok: true, value: JSON.parse(r.text) } : r;
  });
}

// Tries providers in order; key problems and busy/failed providers fall through to the next one.
async function chain(steps) {
  const deadline = Date.now() + BUDGET_MS;
  let lastErr = null, sawBusy = false, sawKey = false;
  for (const step of steps) {
    try { return await step(deadline); }
    catch (e) {
      lastErr = e;
      if (e.kind === "busy") sawBusy = true;
      if (e.kind === "key") sawKey = true;
      console.warn("provider failed:", String(e.message).slice(0, 200));
    }
  }
  if (sawBusy) throw new Error("ai_busy: " + String(lastErr?.message).slice(0, 200));
  if (sawKey) throw new Error("ai_key: " + String(lastErr?.message).slice(0, 200));
  throw lastErr || new Error("no AI provider configured");
}

// Read an image (data URL). Returns the model's text.
export async function visionText(req, prompt, dataUrl, gatewayBody) {
  const m = dataUrl.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
  if (!m) throw new Error("bad image");
  const steps = [];
  if (process.env.OPENAI_API_KEY) steps.push(async (dl) => (await openai([{ role: "user", content: [
    { type: "input_text", text: prompt }, { type: "input_image", image_url: dataUrl, detail: "high" }] }], { json: true }, dl)).text);
  if (process.env.GEMINI_API_KEY) steps.push(async (dl) => partsText(await gemini({
    contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: m[1], data: m[2] } }] }],
    generationConfig: { temperature: 0, responseMimeType: "application/json" } }, dl, 30_000)));
  if (!steps.length) steps.push(() => chat(req, gatewayBody));
  return chain(steps);
}

// Answer with web search. Returns { text, sources: [{title,url}] }.
export async function searchText(req, prompt, gatewayBody) {
  const steps = [];
  if (process.env.OPENAI_API_KEY) steps.push((dl) => openai(prompt, { search: true }, dl));
  if (process.env.GEMINI_API_KEY) steps.push(async (dl) => {
    const j = await gemini({ contents: [{ role: "user", parts: [{ text: prompt }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0 } }, dl, 45_000);
    const chunks = j.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    return { text: partsText(j), sources: chunks.map((c) => c.web).filter((w) => w && w.uri).map((w) => ({ title: w.title || w.uri, url: w.uri })) };
  });
  if (!steps.length) steps.push(async () => ({ text: await chat(req, gatewayBody), sources: [] }));
  return chain(steps);
}
