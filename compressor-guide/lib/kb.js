// Encrypted knowledge base (kb.enc, AES-256-GCM + gzip, same data key as the compressor data) and retrieval.
import { createDecipheriv } from "node:crypto";
import { gunzipSync } from "node:zlib";

let cache = null;
export async function loadKB(req, dkB64) {
  if (cache) return cache;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const r = await fetch(`https://${host}/kb.enc`);
  if (!r.ok) throw new Error("kb fetch " + r.status);
  const enc = await r.json();
  const key = Buffer.from(dkB64, "base64"), iv = Buffer.from(enc.iv, "base64"), all = Buffer.from(enc.ct, "base64");
  const d = createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(all.subarray(all.length - 16));
  const gz = Buffer.concat([d.update(all.subarray(0, all.length - 16)), d.final()]);
  cache = JSON.parse(gunzipSync(gz).toString("utf8"));
  return cache;
}

const norm = (s) => String(s || "").toUpperCase().replace(/[\s\-./_\\]/g, "");
const words = (s) => String(s || "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2);

// Picks the library guides, fault codes and refrigerant data relevant to a case.
export function retrieve(kb, c) {
  const dev = c.device, sym = new Set(c.symptoms || []);
  const text = new Set(words(`${c.description} ${c.hypotheses} ${c.error_code}`));
  const guides = (kb.guides || []).filter((g) => g.domain === dev || (g.domain === "general" && dev !== "washer"))
    .map((g) => {
      let s = 0;
      for (const k of g.symptoms || []) if (sym.has(k)) s += 3;
      if (g.kind === "troubleshooting") s += 1;
      for (const w of words(`${g.title_ar} ${g.title_en} ${(g.tags_ar || []).join(" ")}`)) if (text.has(w)) s += 1;
      return { g, s };
    }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 4).map((x) => x.g);
  const err = norm(c.error_code), brand = String(c.brand || "").toLowerCase();
  const codes = err ? (kb.codes || []).filter((x) => x.d === dev && norm(x.c).split(/[\/,]/).some((p) => p && (p === err || norm(x.c).includes(err))))
    .sort((a, b) => (String(b.b).toLowerCase() === brand) - (String(a.b).toLowerCase() === brand)).slice(0, 6) : [];
  const ref = String((c.observations || {}).refrigerant || "").toUpperCase().replace(/\s/g, "").replace(/^R(134|600)A$/, "R$1a");
  const pt = kb.ptables && kb.ptables.refrigerants && kb.ptables.refrigerants[ref];
  const ptRows = pt ? pt.rows.filter((r) => [-30, -24, -10, 0, 4, 8, 40, 46, 50, 54].includes(r[0])) : null;
  return { guides, codes, ref: pt ? { name: ref, class: pt.class, oil: pt.oil, rows: ptRows } : null };
}

// Compact text for the AI prompt.
export function kbText(ret) {
  const out = [];
  for (const g of ret.guides) {
    out.push(`## [${g.id}] ${g.title_ar} (${g.kind}, ثقة ${g.confidence})`);
    if (g.pre_checks?.length) out.push("فحوصات قبل: " + g.pre_checks.map((p) => p.text_ar).join(" | ").slice(0, 600));
    for (const s of (g.steps || []).slice(0, 14))
      out.push(`- ${s.title_ar}: ${s.action_ar}${s.measure ? ` [${s.measure.label_ar} ${s.measure.min ?? ""}–${s.measure.max ?? ""} ${s.measure.unit}]` : ""} → سليم: ${s.expected_ar} / عطل: ${s.if_fail_ar}`.slice(0, 420));
    if (g.values?.length) out.push("قيم مرجعية: " + g.values.map((v) => `${v.label_ar}=${v.value}`).join("; ").slice(0, 500));
  }
  if (ret.codes.length) {
    out.push("## أكواد أعطال مطابقة من أرشيف iCOOL");
    for (const x of ret.codes) out.push(`- ${x.b} ${x.c}: ${x.t}. أسباب: ${(x.causes || []).join("، ")}. فحوصات: ${(x.checks || []).join("، ")}. مصدر: ${x.src || "-"}`.slice(0, 600));
  }
  if (ret.ref) out.push(`## ${ret.ref.name} (${ret.ref.class}, زيت ${ret.ref.oil}) ضغط تشبع bar(g) [°C, bubble, dew]: ${JSON.stringify(ret.ref.rows)}`);
  return out.join("\n").slice(0, 14000);
}
