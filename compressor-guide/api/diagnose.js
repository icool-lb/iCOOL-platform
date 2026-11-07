// iCOOL Service Pro diagnosis engine.
// stage=open     → subscriber + quota check, store the case, return archive matches (self-learning) and library hits
// stage=research → the engineer's research desk: manuals, manufacturer procedures, recurring failures (OpenAI + web search)
// stage=review   → the senior engineer reviews technician hypotheses + evidence + archive + library and builds the plan
import { rpc, openaiRun, parseJSON, send } from "../lib/ai.js";
import { loadKB, retrieve, kbText } from "../lib/kb.js";

const DEV_AR = { fridge: "براد / فريزر منزلي أو تجاري صغير", coldroom: "غرفة تبريد / تجميد", ac: "مكيف", washer: "غسالة" };

function caseText(c) {
  const obs = Object.entries(c.observations || {}).filter(([, v]) => v !== "" && v != null).map(([k, v]) => `${k}=${v}`).join(", ");
  return [
    `الجهاز: ${DEV_AR[c.device] || c.device}`,
    `الشركة: ${c.brand || "غير معروف"} — الموديل: ${c.model || "غير معروف"}`,
    c.error_code ? `كود العطل على الشاشة: ${c.error_code}` : "",
    c.symptoms?.length ? `الأعراض (مفاتيح): ${c.symptoms.join(", ")}` : "",
    c.description ? `وصف المعلم: ${c.description}` : "",
    obs ? `قياسات/ملاحظات المعلم: ${obs}` : "",
    c.hypotheses ? `احتمالات العطل حسب المعلم: ${c.hypotheses}` : "احتمالات المعلم: لم يحدد",
  ].filter(Boolean).join("\n");
}

function archiveText(a) {
  if (!a || !a.cases?.length) return "لا توجد حالات مطابقة محلولة في أرشيف المنصة بعد.";
  const st = (a.stats || []).map((s) => `${s.cause} (${s.n})`).join("، ");
  return [`إحصاء الأسباب الفعلية في الحالات المشابهة: ${st || "-"}`,
    ...a.cases.map((x) => `- حالة #${x.id} ${x.brand} ${x.model} ${x.error_code || ""} [${(x.symptoms || []).join(",")}] → ${x.status === "resolved" ? "تم الإصلاح" : "لم يُحل"}: السبب الفعلي "${x.actual_cause || "-"}"؛ القطع: ${(x.parts || []).join("، ") || "-"}؛ الحل: ${x.fix || "-"}${x.verified ? " (حالة مرجعية موثّقة)" : ""} [تطابق ${x.score}]`)].join("\n");
}

const RESEARCH_SYS = `أنت مكتب الأبحاث لدى مهندس الصيانة الأول في شركة iCOOL (لبنان). معلّم ميداني رفع حالة عطل.
مهمتك جمع الأدلة فقط، بلا تشخيص نهائي. استخدم البحث في الإنترنت للعثور على:
1) معنى كود العطل الرسمي لهذه الشركة/عائلة الموديل (manual أو موقع الشركة).
2) دليل الصيانة (service manual) أو إجراء الشركة لهذا العطل، ومواصفات الموديل (نوع الضاغط، الفريون، الكمية) إن وُجدت.
3) الأعطال المتكررة المعروفة لهذا الموديل/العائلة (TSB، منتديات فنيين موثوقة، مواقع قطع غيار).
لا تخترع أرقاماً أو أكواداً. اكتب النتائج بالعربية مع إبقاء المصطلحات التقنية بالإنجليزية.
أعد JSON فقط بهذا الشكل:
{"code_meaning":{"text":"","source_url":""} أو null,
 "model_info":{"type":"","refrigerant":"","charge":"","compressor":"","notes":""} أو null,
 "findings":[{"finding":"","supports":"اسم السبب المحتمل باختصار","strength":"strong|medium|weak","source_title":"","source_url":"","source_type":"manual|manufacturer|parts|forum|training|other"}],
 "manual_links":[{"title":"","url":"","kind":"service|installation|user|parts|error-codes","model":""}],
 "notes":""}`;

const REVIEW_SYS = `أنت مهندس الصيانة الأول (خبير) في شركة iCOOL في لبنان، خبرة 20 سنة في التبريد المنزلي والتجاري وغرف التبريد والمكيفات والغسالات.
تراجع حالة رفعها معلّم ميداني. أمامك: تقرير المعلم واحتمالاته، أدلة البحث (manuals ومواقع الشركات والحالات المتكررة)، أرشيف المنصة للحالات المحلولة سابقاً ونتائجها الفعلية، ومقتطفات من إجراءات iCOOL المعتمدة.
المطلوب:
- راجع كل احتمال طرحه المعلم: موافق / جزئياً / غير موافق، مع السبب.
- رتّب الأسباب الأرجح باحتمالات (مجموعها ≤ 100) مع الدليل لكل سبب. أعطِ وزناً كبيراً لأرشيف المنصة إذا تكرر نفس السبب الفعلي.
- ابنِ خطة فحص تفاعلية: من الأرخص/الأسرع/الأكثر أماناً إلى الأغلى. كل خطوة قابلة للتنفيذ في الموقع، فيها قياس واضح (إن أمكن) مع المدى السليم، وما معنى الفشل وماذا يفعل المعلم.
- لا تحكم على كمبروسير أو PCB بالتلف قبل الفحوصات الأساسية (الجهد، الريليه/PTC، الأوفرلود، المكثف، الملفات، العزل).
- السلامة إلزامية: الفريونات القابلة للاشتعال (R600a, R290, R32)، تفريغ المكثفات، الكهرباء، الضغط.
- حدد الفحوصات قبل وبعد التصليح، والقطع المحتملة، وقيم الفريون/الضغوط المناسبة إن كان العطل في دارة التبريد.
- الثقة (0-100): عالية فقط إذا اتفقت الأدلة الرسمية + الأرشيف + الأعراض. إذا كانت المعلومات ناقصة اذكر ما يجب على المعلم قياسه لرفع الثقة.
- لا تخترع قيماً خاصة بموديل؛ إن لم تُعرف قل "حسب الـ manual/لوحة الجهاز".
- اكتب بالعربية الواضحة والمختصرة مع المصطلحات الفنية بالإنجليزية. خاطب المعلم مباشرة.
أعد JSON فقط بهذا الشكل:
{"headline":"جملة واحدة: التشخيص الأرجح",
 "summary":"2-4 جمل",
 "confidence":0,
 "confidence_reason":"",
 "missing_info":["قياس أو معلومة ترفع الثقة"],
 "technician_review":[{"hypothesis":"","verdict":"agree|partial|disagree","reason":""}],
 "causes":[{"cause":"","probability":0,"why":"","evidence":[""],"source_refs":[0]}],
 "safety":[""],
 "pre_checks":[""],
 "steps":[{"id":"s1","title":"","action":"","measure":{"label":"","unit":"","min":null,"max":null} أو null,"expected":"","if_fail":"","cause_ref":0}],
 "parts":[{"name":"","note":""}],
 "refrigerant_targets":{"refrigerant":"","values":[{"label":"","value":""}],"notes":""} أو null,
 "post_checks":[""],
 "related_guides":["guide-id من المكتبة"],
 "sources":[{"title":"","url":"","type":"manual|manufacturer|archive|library|forum|other"}],
 "archive_note":"ماذا قال أرشيف المنصة"}`;

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { ok: false, err: "method" });
  const { stage, code, device, id, photo } = req.body || {};
  try {
    if (stage === "open") {
      const c = req.body.case || {};
      const o = await rpc("svc_case_open", { p_code: code, p_device: String(device || ""), p_case: c }, req);
      if (!o.ok) return send(res, 403, o);
      let lib = { guides: [], codes: [] };
      try {
        const ctx = await rpc("svc_case_ctx", { p_code: code, p_device: String(device || ""), p_id: o.id }, req);
        const kb = await loadKB(req, ctx.dk);
        const r = retrieve(kb, { ...c, symptoms: c.symptoms || [] });
        lib = { guides: r.guides.map((g) => ({ id: g.id, title: g.title_ar, kind: g.kind })), codes: r.codes.map((x) => ({ b: x.b, c: x.c, t: x.t })) };
      } catch (e) { console.warn("kb", e.message); }
      return send(res, 200, { ok: true, id: o.id, left: o.left, archive: o.archive, manuals: o.manuals, library: lib });
    }

    const ctx = await rpc("svc_case_ctx", { p_code: code, p_device: String(device || ""), p_id: Number(id) }, req);
    if (!ctx.ok) return send(res, 403, ctx);
    const c = ctx.case;
    let lib = "";
    try { lib = kbText(retrieve(await loadKB(req, ctx.dk), c)); } catch (e) { console.warn("kb", e.message); }

    if (stage === "research") {
      if (c.result && c.result.research) return send(res, 200, { ok: true, research: c.result.research, cached: true });
      const content = [{ type: "input_text", text: `${RESEARCH_SYS}\n\n### الحالة\n${caseText(c)}` }];
      if (typeof photo === "string" && photo.startsWith("data:image/") && photo.length < 4_000_000)
        content.push({ type: "input_image", image_url: photo, detail: "high" });
      const out = await openaiRun([{ role: "user", content }], { search: true, perCallMs: 75_000, budgetMs: 85_000 });
      const r = parseJSON(out.text) || { findings: [], notes: out.text.slice(0, 1500) };
      const seen = new Set((r.findings || []).map((f) => f.source_url));
      r.web_sources = (out.sources || []).filter((s) => !seen.has(s.url)).slice(0, 8);
      await rpc("svc_case_save", { p_code: code, p_device: String(device || ""), p_id: c.id, p_key: "research", p_val: r }, req);
      return send(res, 200, { ok: true, research: r });
    }

    if (stage === "review") {
      const research = (c.result && c.result.research) || {};
      const prompt = `${REVIEW_SYS}

### تقرير المعلم
${caseText(c)}

### أدلة البحث (manuals / مواقع الشركات / حالات متكررة)
${JSON.stringify(research).slice(0, 9000)}

### أرشيف منصة iCOOL (حالات محلولة سابقاً — تعلّم ذاتي)
${archiveText(ctx.archive)}

### كتيبات محفوظة في المنصة لهذه الشركة
${(ctx.manuals || []).map((m) => `- ${m.title} ${m.url}`).join("\n") || "لا يوجد"}

### مكتبة إجراءات iCOOL المعتمدة (مقتطفات)
${lib || "لا يوجد"}`;
      const out = await openaiRun([{ role: "user", content: [{ type: "input_text", text: prompt }] }], { json: true, perCallMs: 80_000, budgetMs: 85_000, effort: "medium" });
      const r = parseJSON(out.text);
      if (!r || !Array.isArray(r.steps)) return send(res, 502, { ok: false, err: "parse" });
      r.confidence = Math.max(0, Math.min(100, Math.round(Number(r.confidence) || 0)));
      r.steps = r.steps.slice(0, 20).map((s, i) => ({ ...s, id: s.id || `s${i + 1}` }));
      const manuals = [...(research.manual_links || [])].filter((m) => m && /^https?:\/\//.test(m.url || "")).slice(0, 8);
      await rpc("svc_case_result", { p_code: code, p_device: String(device || ""), p_id: c.id, p_result: r, p_conf: r.confidence, p_manuals: manuals }, req);
      return send(res, 200, { ok: true, result: r });
    }
    return send(res, 400, { ok: false, err: "stage" });
  } catch (e) {
    console.error("diagnose", stage, e);
    const msg = String(e.message || e);
    if (/ai_key/i.test(msg)) return send(res, 503, { ok: false, err: "ai_setup" });
    if (/ai_busy/.test(msg)) return send(res, 429, { ok: false, err: "ai_busy" });
    return send(res, 500, { ok: false, err: "server", detail: msg.slice(0, 300) });
  }
}
