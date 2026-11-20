/* iCOOL Service Pro — diagnosis, library, cases (loaded after the main page script; uses window.ICOOL) */
(function () {
"use strict";
const I = () => window.ICOOL;
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const b64d = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/* ---------- vocabulary ---------- */
const DEVICES = {
  fridge: { ar: "براد / فريزر", sub: "منزلي وتجاري صغير", tone: "cold" },
  coldroom: { ar: "غرفة تبريد", sub: "تبريد وتجميد", tone: "cold" },
  ac: { ar: "مكيف", sub: "سبليت وإنفرتر", tone: "mid" },
  washer: { ar: "غسالة", sub: "أمامية وعلوية", tone: "heat" },
};
const SYM = {
  fridge: { not_cooling: "لا يبرد", weak_cooling: "تبريد ضعيف", freezer_ok_fridge_warm: "الفريزر يبرد والبراد لا", compressor_not_starting: "الكمبروسير لا يشتغل", compressor_clicks: "يطقطق ويفصل", runs_nonstop: "يشتغل بلا توقف", short_cycling: "يشتغل ويفصل بسرعة", ice_buildup: "تراكم جليد", water_leak: "تسريب ماء", noise: "صوت غير طبيعي", high_amps: "أمبير عالي", trips_breaker: "يفصّل القاطع", frost_on_suction: "ثلج على خط السحب", light_or_fan_issue: "الضو / المروحة" },
  coldroom: { high_temp: "الحرارة مرتفعة", ice_evaporator: "جليد على المبخر", short_cycling: "يشتغل ويفصل بسرعة", high_head_pressure: "ضغط طرد عالي", low_suction: "ضغط سحب منخفض", not_defrosting: "لا يعمل ديفروست", controller_alarm: "إنذار على الكنترولر", compressor_not_starting: "الكمبروسير لا يشتغل", water_leak: "تسريب ماء", door_issue: "باب / عازل", runs_nonstop: "يشتغل بلا توقف" },
  ac: { not_cooling: "لا يبرد", weak_cooling: "تبريد ضعيف", not_heating: "لا يدفّي", ice_on_coil: "ثلج على الوحدة", water_leak_indoor: "تنقيط من الداخلي", outdoor_not_running: "الخارجي لا يشتغل", error_code: "كود على الشاشة", noise: "صوت غير طبيعي", trips_breaker: "يفصّل القاطع", bad_smell: "رائحة", compressor_not_starting: "الكمبروسير لا يشتغل", remote_not_working: "الريموت لا يستجيب" },
  washer: { not_draining: "لا تصرّف", not_spinning: "لا تعصر", not_filling: "لا تسحب ماء", door_locked: "الباب مقفول", leaking: "تسرّب ماء", noisy_spin: "صوت عالي بالعصر", not_heating: "لا تسخّن", not_starting: "لا تشتغل", error_code: "كود على الشاشة", vibration: "اهتزاز", stops_midcycle: "تتوقف بنص البرنامج", smell: "رائحة" },
};
const OBS = {
  fridge: [["refrigerant", "الفريون", "R600a"], ["voltage", "الجهد V", "220"], ["amps", "الأمبير A", "0.8"], ["suction_bar", "ضغط السحب bar", ""], ["cabinet_c", "حرارة البراد °C", ""], ["ambient_c", "حرارة الغرفة °C", ""]],
  coldroom: [["refrigerant", "الفريون", "R404A"], ["voltage", "الجهد V", ""], ["amps", "الأمبير A", ""], ["suction_bar", "ضغط السحب bar", ""], ["discharge_bar", "ضغط الطرد bar", ""], ["room_c", "حرارة الغرفة °C", ""], ["ambient_c", "الحرارة الخارجية °C", ""]],
  ac: [["refrigerant", "الفريون", "R410A"], ["voltage", "الجهد V", ""], ["amps", "الأمبير A", ""], ["suction_bar", "ضغط السحب bar", ""], ["return_air_c", "هواء راجع °C", ""], ["supply_air_c", "هواء خارج °C", ""], ["ambient_c", "الحرارة الخارجية °C", ""]],
  washer: [["voltage", "الجهد V", ""], ["water_pressure", "ضغط الماء", "ضعيف/جيد"], ["program", "البرنامج / المرحلة", ""], ["age_years", "عمر الجهاز (سنة)", ""]],
};
/* extra symptoms (merged into SYM) */
Object.assign(SYM.fridge, { door_seal: "عازل الباب لا يسكّر", bad_smell: "رائحة", display_error: "كود / إنذار على الشاشة", ice_maker: "صانع الثلج / الماء", hot_sides: "جوانب البراد حامية جداً", freezer_warm: "الفريزر لا يجمّد", overcooling: "يجمّد في قسم البراد", oil_stain: "بقعة زيت على الأنابيب", after_power_cut: "توقف بعد انقطاع كهرباء" });
Object.assign(SYM.coldroom, { oil_leak: "تسريب زيت", noise: "صوت غير طبيعي", trips_breaker: "يفصّل القاطع", fan_not_running: "مروحة المبخر لا تدور", condenser_fan: "مروحة المكثف لا تدور", hp_trip: "يفصل على HP", lp_trip: "يفصل على LP", frost_on_suction: "ثلج على خط السحب" });
Object.assign(SYM.ac, { indoor_fan_not_running: "مروحة الداخلي لا تدور", outdoor_fan_not_running: "مروحة الخارجي لا تدور", stops_after_minutes: "يشتغل دقائق ويفصل", louver: "الريشة لا تتحرك", ice_on_pipes: "ثلج على الأنابيب", high_amps: "أمبير عالي", inverter_low_freq: "إنفرتر لا يرفع", oil_on_flare: "زيت على الفلير", after_install: "بعد تركيب جديد" });
Object.assign(SYM.washer, { door_wont_lock: "الباب لا يقفل", detergent_left: "يبقى مسحوق بالدرج", clothes_wet: "الثياب تبقى مبلولة", drum_not_turning: "الحلة لا تدور", burning_smell: "رائحة حريق", trips_breaker: "تفصّل القاطع", display_dead: "الشاشة مطفية", foam: "رغوة زائدة" });
const CAUSES = {
  fridge: ["ريليه / PTC تالف", "أوفرلود تالف", "مكثف بدء / تشغيل", "ملفات الكمبروسير (قصر / فتح / أرضي)", "كمبروسير ضعيف (صمامات)", "نقص فريون / تسريب", "انسداد كابيليري", "رطوبة بالدارة / فلتر مسدود", "ترموستات تالف", "سخان الديفروست", "حساس ديفروست / بايمتال", "تايمر أو بورد الديفروست", "مروحة المبخر", "مروحة المكثف", "مكثف (condenser) متسخ", "عازل الباب", "بورد الإنفرتر", "جهد منخفض / مشكلة كهرباء", "حساس حرارة NTC", "Damper تالف"],
  coldroom: ["نقص فريون / تسريب", "TXV / صمام التمدد", "فلتر مسدود", "مكثف متسخ / مروحة المكثف", "مروحة المبخر", "سخانات الديفروست", "كنترولر / حساس", "كونتاكتور", "حماية HP / LP", "كمبروسير ضعيف", "عزل / باب الغرفة", "حمل زائد / بضاعة ساخنة", "صولونويد", "زيت محبوس / عودة الزيت", "شحنة زائدة"],
  ac: ["نقص فريون / تسريب", "مكثف الكمبروسير", "مكثف مروحة الخارجي", "فلتر / مبخر متسخ", "كونتاكتور", "بورد الداخلي", "بورد الخارجي / IPM", "حساس حرارة NTC", "كمبروسير", "صمام 4 اتجاه", "EEV / صمام إلكتروني", "تصريف مسدود", "كابل الاتصال", "جهد منخفض / كهرباء", "مكثف خارجي متسخ", "شحنة زائدة", "موتور المروحة"],
  washer: ["مضخة التصريف", "فلتر المضخة مسدود", "صمام المياه", "حساس المستوى / بريسوستات", "قفل الباب", "فحمات الموتور", "الموتور / التاكو", "السير", "البيليات (رولمان) / الجوان", "السخان", "حساس NTC", "البورد", "خرطوم / جوان الباب", "اختلال توازن الحمولة", "الماصّات / السوست", "Hall sensor (Direct Drive)"],
};
const ONSET = ["فجأة", "تدريجياً خلال أيام", "بعد انقطاع / رجوع الكهرباء", "بعد تبديل اشتراك / مولد", "بعد تصليح سابق", "بعد نقل الجهاز", "بعد تركيب جديد", "بعد عاصفة / صاعقة", "متقطع (يجي ويروح)"];
const CHECKS = {
  fridge: ["قياس الجهد", "قياس الأمبير", "فحص ملفات الكمبروسير C-S-R", "فحص العزل (Megger)", "فحص الريليه / PTC", "فحص الأوفرلود", "فحص المكثف µF", "تركيب ساعة ضغط", "فحص التسريب", "فحص الترموستات", "فحص سخان الديفروست", "فحص حساس الديفروست", "فحص المراوح", "تنظيف المكثف"],
  coldroom: ["قياس الجهد", "قياس الأمبير", "ساعات الضغط (سحب وطرد)", "Superheat", "Subcooling", "فحص الكنترولر وإعداداته", "فحص سخانات الديفروست", "فحص المراوح", "فحص الكونتاكتور", "فحص التسريب", "تنظيف المكثف", "فحص الصولونويد"],
  ac: ["قياس الجهد", "قياس الأمبير", "ساعة الضغط", "فحص المكثفات µF", "فحص حساسات NTC", "تنظيف الفلاتر", "فحص التصريف", "فحص كابل الاتصال", "فحص التسريب", "قراءة كود العطل", "فحص مروحة الخارجي", "فحص الكونتاكتور"],
  washer: ["قياس الجهد", "فحص فلتر المضخة", "فحص المضخة", "فحص صمام المياه", "فحص حساس المستوى", "فحص قفل الباب", "فحص الموتور / الفحمات", "فحص السخان", "فحص NTC", "وضع الاختبار (Test mode)", "فحص السير", "فحص البيليات"],
};
const REFS = ["R600a", "R134a", "R290", "R22", "R404A", "R410A", "R32", "R407C", "R448A", "R449A", "R507A", "R12 (قديم)"];
const COLD_BRANDS = ["Copeland (Emerson)", "Danfoss / Maneurop", "Bitzer", "Tecumseh", "Embraco", "Secop", "Frascold", "Dorin", "L'Unite Hermetique", "Highly", "Kulthorn", "Refcomp", "Zanotti", "Daikin", "Mitsubishi", "Carrier"];
const COLD_UNITS = ["Condensing unit — hermetic reciprocating", "Condensing unit — scroll", "Condensing unit — semi-hermetic", "Monoblock (Plug-in)", "Split system", "Rack / multi-compressor", "Inverter condensing unit"];
const COLD_CTRL = ["Dixell XR (XR06/XR20/XR60…)", "Eliwell IC/ID (ID974, IC912…)", "Carel ir33 / easy", "Danfoss ERC / AK-CC", "Evco", "Pego", "Coolmate / TEC", "ميكانيكي (ترموستات + تايمر)"];

/* ---------- searchable dropdown (combobox) ---------- */
const CB = {};
const normA = (s) => String(s || "").toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[\s\-_./()·,،]/g, "");
// cfg: {id, label, items:[{v,l,s,g}], value (string|array), multi, free, ph, dir, onChange}
function cbHTML(cfg) {
  CB[cfg.id] = cfg;
  if (cfg.multi && !Array.isArray(cfg.value)) cfg.value = cfg.value ? [cfg.value] : [];
  const lab = (v) => { const it = cfg.items.find((x) => x.v === v); return it ? it.l : v; };
  return `<div class="field cb${cfg.multi ? " multi" : ""}" data-cb="${cfg.id}">
    ${cfg.label ? `<label for="cb-${cfg.id}">${cfg.label}</label>` : ""}
    ${cfg.multi ? `<div class="cb-sel">${cfg.value.map((v) => `<span class="cb-tag">${esc(lab(v))}<button type="button" data-cb-rm="${esc(v)}" aria-label="إزالة">×</button></span>`).join("")}</div>` : ""}
    <div class="cb-box"><input id="cb-${cfg.id}" class="cb-in" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="cbl-${cfg.id}" autocomplete="off"
      ${cfg.dir ? `dir="${cfg.dir}"` : ""} value="${cfg.multi ? "" : esc(cfg.value ? lab(cfg.value) : "")}" placeholder="${esc(cfg.ph || "اكتب للبحث أو اختر…")}">
      ${!cfg.multi && cfg.value ? `<button type="button" class="cb-x" aria-label="مسح">×</button>` : ""}<button type="button" class="cb-tg" tabindex="-1" aria-label="فتح القائمة">▾</button></div>
    <ul class="cb-list" id="cbl-${cfg.id}" role="listbox" hidden></ul></div>`;
}
function cbBind(root) {
  $$("[data-cb]", root).forEach((wrap) => {
    const cfg = CB[wrap.dataset.cb]; if (!cfg) return;
    const inp = $(".cb-in", wrap), list = $(".cb-list", wrap); let act = -1, shown = [];
    const set = (v) => {
      if (cfg.multi) { if (!cfg.value.includes(v)) cfg.value.push(v); inp.value = ""; drawSel(); }
      else { cfg.value = v; const it = cfg.items.find((x) => x.v === v); inp.value = it ? it.l : v; close(); }
      cfg.onChange && cfg.onChange(cfg.value, cfg);
    };
    const drawSel = () => { const s = $(".cb-sel", wrap); if (!s) return; const lab = (v) => (cfg.items.find((x) => x.v === v) || { l: v }).l;
      s.innerHTML = cfg.value.map((v) => `<span class="cb-tag">${esc(lab(v))}<button type="button" data-cb-rm="${esc(v)}" aria-label="إزالة">×</button></span>`).join("");
      $$("[data-cb-rm]", s).forEach((b) => b.addEventListener("click", () => { cfg.value = cfg.value.filter((x) => x !== b.dataset.cbRm); drawSel(); cfg.onChange && cfg.onChange(cfg.value, cfg); })); };
    const close = () => { list.hidden = true; inp.setAttribute("aria-expanded", "false"); act = -1; };
    const open = (all) => {
      const q = all ? "" : normA(inp.value);
      const toks = q ? [q] : [];
      const sel = cfg.multi ? cfg.value : [];
      shown = cfg.items.filter((x) => !sel.includes(x.v) && (!toks.length || toks.every((t) => normA(x.l + " " + (x.s || "") + " " + x.v + " " + (x.k || "")).includes(t)))).slice(0, 80);
      const raw = inp.value.trim();
      const exact = raw && cfg.items.some((x) => normA(x.l) === normA(raw) || normA(x.v) === normA(raw));
      let html = "", g = null;
      if (cfg.free && raw && !exact) html += `<li role="option" class="cb-opt free" data-i="-2"><b>استخدم: «${esc(raw)}»</b></li>`;
      shown.forEach((x, i) => { if (x.g && x.g !== g) { g = x.g; html += `<li class="cb-g" role="presentation">${esc(g)}</li>`; }
        html += `<li role="option" class="cb-opt" data-i="${i}" id="cbo-${cfg.id}-${i}"><span>${esc(x.l)}</span>${x.s ? `<small>${esc(x.s)}</small>` : ""}</li>`; });
      if (!html) html = `<li class="cb-empty">${cfg.free ? "اكتب القيمة كما هي" : "لا نتائج"}</li>`;
      list.innerHTML = html; list.hidden = false; inp.setAttribute("aria-expanded", "true"); act = -1;
      $$(".cb-opt", list).forEach((li) => li.addEventListener("mousedown", (e) => { e.preventDefault(); pick(+li.dataset.i); }));
    };
    const pick = (i) => { if (i === -2) set(inp.value.trim()); else if (shown[i]) set(shown[i].v); if (cfg.multi) open(true); };
    const mv = (d) => { const opts = $$(".cb-opt", list); if (!opts.length) return; act = (act + d + opts.length) % opts.length; opts.forEach((o, k) => o.classList.toggle("act", k === act)); opts[act].scrollIntoView({ block: "nearest" }); };
    inp.addEventListener("focus", () => open(!cfg.multi && !!cfg.value));
    inp.addEventListener("input", () => { if (!cfg.multi && cfg.free) { cfg.value = inp.value.trim(); cfg.onInput && cfg.onInput(cfg.value, cfg); } open(false); });
    inp.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); list.hidden ? open(true) : mv(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); mv(-1); }
      else if (e.key === "Enter") { e.preventDefault(); const o = $$(".cb-opt", list)[act] || $$(".cb-opt:not(.free)", list)[0] || $$(".cb-opt", list)[0]; if (o) pick(+o.dataset.i); else if (cfg.free && inp.value.trim()) set(inp.value.trim()); }
      else if (e.key === "Escape") close();
      else if (e.key === "Backspace" && cfg.multi && !inp.value && cfg.value.length) { cfg.value.pop(); drawSel(); cfg.onChange && cfg.onChange(cfg.value, cfg); }
    });
    inp.addEventListener("blur", () => setTimeout(() => { close(); if (!cfg.multi && !cfg.free) { const it = cfg.items.find((x) => x.v === cfg.value); inp.value = it ? it.l : ""; } }, 120));
    $(".cb-tg", wrap).addEventListener("click", () => { if (list.hidden) { inp.focus(); open(true); } else close(); });
    const x = $(".cb-x", wrap); if (x) x.addEventListener("click", () => { cfg.value = ""; inp.value = ""; x.remove(); cfg.onChange && cfg.onChange("", cfg); inp.focus(); });
    drawSel();
  });
}
const cbVal = (id) => (CB[id] ? CB[id].value : "");

const KIND = { procedure: "إجراء", troubleshooting: "تشخيص أعطال", installation: "تركيب", checklist: "قائمة فحص", reference: "مرجع" };
const icon = (d) => ({
  fridge: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="12" y="4" width="24" height="40" rx="4" fill="none" stroke="currentColor" stroke-width="3"/><path d="M12 18h24M17 10v4M17 24v8" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  coldroom: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 42V16l18-10 18 10v26z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><rect x="17" y="24" width="14" height="18" fill="none" stroke="currentColor" stroke-width="3"/><path d="M24 11v8M20.5 13l7 4M27.5 13l-7 4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  ac: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="4" y="10" width="40" height="16" rx="4" fill="none" stroke="currentColor" stroke-width="3"/><path d="M10 21h28M14 32c0 4-3 4-3 8M24 32c0 4-3 4-3 8M34 32c0 4-3 4-3 8" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"/></svg>',
  washer: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="8" y="4" width="32" height="40" rx="4" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="24" cy="27" r="10" fill="none" stroke="currentColor" stroke-width="3"/><path d="M14 11h6M32 11h2" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M18 28c3 2 9 2 12-2" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>',
  general: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M30 6a10 10 0 0 0-9 14L7 34a4 4 0 0 0 6 6l14-14a10 10 0 0 0 14-9l-6 6-6-2-2-6z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>',
}[d] || "");

/* ---------- state ---------- */
let KB = null, ready = false, TAB = "diag";
const F = { device: "", brand: "", series: "", checks: [], hyps: [], model: "", error_code: "", symptoms: new Set(), obs: {}, description: "", hypotheses: "", photo: null };
let CUR = null; // current case {id, result, research, archive, library, log, status}

async function loadKB() {
  if (KB) return KB;
  try {
    const r = await fetch("kb.enc", { cache: "no-cache" }); if (!r.ok) throw 0;
    const enc = await r.json();
    const k = await crypto.subtle.importKey("raw", b64d(I().DK), "AES-GCM", false, ["decrypt"]);
    const gz = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64d(enc.iv) }, k, b64d(enc.ct));
    const st = new Blob([gz]).stream().pipeThrough(new DecompressionStream("gzip"));
    KB = JSON.parse(await new Response(st).text());
  } catch (e) { KB = { guides: [], codes: [], models: [], ptables: null }; }
  return KB;
}
const guide = (id) => (KB && KB.guides || []).find((g) => g.id === id);
const sub = () => ({ code: I().CODE, device: I().DEV });
const ERR = { quota: "وصلت للحد اليومي لعمليات الذكاء الاصطناعي. حاول غداً.", denied: "انتهى اشتراكك أو تغيّر الكود. أعد الدخول.", ai_setup: "محرك التشخيص غير مفعّل بعد (مفتاح OpenAI). تواصل مع iCOOL.", ai_busy: "خدمة الذكاء الاصطناعي مشغولة الآن. أعد المحاولة بعد دقيقة.", parse: "لم نتمكن من قراءة رد المهندس. أعد المحاولة.", device: "اختر نوع الجهاز.", server: "خطأ في الخادم. أعد المحاولة." };
const errTxt = (j) => ERR[j && j.err] || "تعذّر الاتصال. تحقّق من الإنترنت.";

/* ---------- tabs ---------- */
function setTab(t) {
  TAB = t;
  $$(".svc-tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === t)));
  $("#cmp-ctrl").hidden = t !== "cmp"; $("#tab-cmp").hidden = t !== "cmp";
  ["diag", "lib", "cases", "acad"].forEach((x) => { const n = $("#tab-" + x); if (n) n.hidden = x !== t; });
  if (t === "acad" && window.ACAD) window.ACAD.render();
  if (t === "lib") renderLib(); if (t === "cases") renderCases(); if (t === "diag" && !CUR) renderWizard();
  try { localStorage.setItem("icool_tab", t); } catch (e) {}
  window.scrollTo({ top: 0 });
}

/* ================= DIAGNOSIS WIZARD ================= */
function pipelineHTML(state = {}) {
  const st = (k) => state[k] || "idle";
  const node = (k, t, s, ic) => `<div class="pl-node ${st(k)}"><span class="pl-ic">${ic}</span><b>${t}</b><small>${s}</small></div>`;
  return `<div class="pipeline" aria-label="مسار التشخيص">
    ${node("tech", "المعلم", "يفحص ويطرح الاحتمالات", "🧰")}<i class="pl-arrow"></i>
    ${node("eng", "مهندس الصيانة", "يراجع الحالة", "👷")}<i class="pl-arrow"></i>
    ${node("res", "البحث", "Manual · أرشيف · ويب", "🔎")}<i class="pl-arrow"></i>
    ${node("rev", "المراجعة", "رد بثقة + خطوات", "✅")}<i class="pl-arrow"></i>
    ${node("fb", "Feedback", "المنصة تتعلّم", "🧠")}
  </div>`;
}
function brandItems(d) {
  if (d === "coldroom") return COLD_BRANDS.map((b) => ({ v: b, l: b, g: "كمبروسيرات / وحدات" }));
  const cat = (KB && KB.brands || []).filter((x) => x.d === d);
  const nf = (b) => (KB.families || []).filter((f) => f.d === d && f.b === b).length;
  const seen = new Set(cat.map((x) => x.b));
  const extra = [...new Set([...(KB.codes || []).filter((x) => x.d === d).map((x) => x.b), ...(KB.models || []).filter((x) => x.d === d).map((x) => x.b)])].filter((b) => !seen.has(b));
  return [...cat.sort((x, z) => nf(z.b) - nf(x.b)).map((x) => ({ v: x.b, l: x.b, s: [x.country, nf(x.b) ? `${nf(x.b)} سلسلة` : ""].filter(Boolean).join(" · "), g: "الماركات في الكتالوج" })),
    ...extra.sort().map((b) => ({ v: b, l: b, g: "ماركات أخرى" }))];
}
const famKey = (f) => `${f.b}|${f.series}`;
function famOf(d, b, series) { return (KB && KB.families || []).find((f) => f.d === d && f.b === b && f.series === series); }
function famMatch(d, b, model) {
  const m = normA(model).toUpperCase(); if (m.length < 2) return null;
  let best = null, bl = 0;
  (KB.families || []).forEach((f) => { if (f.d !== d || (b && f.b.toLowerCase() !== b.toLowerCase())) return;
    (f.prefixes || []).forEach((p) => { const q = normA(p).toUpperCase().replace(/\*/g, ""); if (q.length >= 2 && m.startsWith(q) && q.length > bl) { best = f; bl = q.length; } }); });
  return best;
}
function familyCard(f) {
  if (!f) return "";
  const pill = (t) => t ? `<span class="pill">${esc(t)}</span>` : "";
  return `<div class="fam-card"><div class="fam-h"><b>${esc(f.b)} · ${esc(f.series)}</b>${f.years ? `<span class="stat">${esc(f.years)}</span>` : ""}</div>
    <div class="pills">${pill(f.type)}${pill(f.cap)}${f.inverter === true ? pill("Inverter") : f.inverter === false ? pill("On/Off") : ""}${pill(f.refrigerant)}${pill(f.compressor)}${pill(f.motor)}${(f.features || []).slice(0, 4).map(pill).join("")}</div>
    ${(f.prefixes || []).length ? `<div class="stat">أرقام الموديل تبدأ بـ: <span dir="ltr" class="mono">${esc(f.prefixes.join(" · "))}</span></div>` : ""}
    ${f.notes_ar ? `<p class="fam-note">🛠 ${esc(f.notes_ar)}</p>` : ""}
    <div class="bar">${f.manual_url ? `<a class="btn ghost sm" href="${esc(f.manual_url)}" target="_blank" rel="noopener noreferrer">📘 ${esc(f.manual_title || "Manual")}</a>` : ""}${f.src ? `<a class="stat" href="${esc(f.src)}" target="_blank" rel="noopener noreferrer">المصدر ↗</a>` : ""}</div></div>`;
}
function renderWizard() {
  const el = $("#tab-diag"); const d = F.device;
  let sec2 = "";
  if (d) {
    const fams = (KB.families || []).filter((f) => f.d === d && (!F.brand || f.b.toLowerCase() === F.brand.toLowerCase()));
    const famItems = fams.map((f) => ({ v: famKey(f), l: F.brand ? f.series : `${f.b} · ${f.series}`, s: [f.type, f.cap, f.refrigerant].filter(Boolean).join(" · "), k: (f.prefixes || []).join(" "), g: F.brand ? f.type : f.b }));
    const codeItems = (KB.codes || []).filter((x) => x.d === d && (!F.brand || x.b.toLowerCase() === F.brand.toLowerCase())).map((x) => ({ v: String(x.c).split(/[\/,]/)[0].trim(), l: `${x.c}`, s: `${F.brand ? "" : x.b + " · "}${x.t}`, k: x.m || "", g: F.brand ? (x.f || "").slice(0, 40) : x.b }));
    const bi = brandInfo(d, F.brand);
    sec2 = `<fieldset class="wz-sec"><legend><span class="n">2</span>بيانات الجهاز</legend>
      <div class="bar"><button class="btn sm" type="button" id="wz-plate">📷 صورة لوحة البيانات</button><span class="stat">تقرأ الشركة والموديل والفريون تلقائياً</span></div>
      <div class="mgrid" style="margin-top:10px">
        ${cbHTML({ id: "brand", label: d === "coldroom" ? "ماركة الكمبروسير / الوحدة" : "الشركة", items: brandItems(d), value: F.brand, free: true, dir: "ltr", ph: "LG, Samsung, Gree…", onChange: (v) => { readWizard(); F.brand = v; if (F.series && !famOf(d, v, F.series.split("|")[1])) F.series = ""; renderWizard(); setTimeout(() => { const n = $("#cb-series") || $("#wz-model"); n && n.focus(); }, 30); } })}
        ${d === "coldroom" ? cbHTML({ id: "unit", label: "نوع الوحدة", items: COLD_UNITS.map((x) => ({ v: x, l: x })), value: F.obs.unit_type || "", free: true, dir: "ltr" }) + cbHTML({ id: "ctrl", label: "الكنترولر", items: COLD_CTRL.map((x) => ({ v: x, l: x })), value: F.obs.controller || "", free: true, dir: "ltr" })
          : cbHTML({ id: "series", label: "السلسلة / عائلة الموديل", items: famItems, value: F.series, free: false, dir: "ltr", ph: fams.length ? `${fams.length} سلسلة — ابحث بالاسم أو بأول الموديل` : "اختر الشركة أولاً", onChange: (v) => { readWizard(); F.series = v; renderWizard(); } })}
        <div class="field"><label for="wz-model">رقم الموديل (من اللوحة)</label><input id="wz-model" value="${esc(F.model)}" dir="ltr" placeholder="${d === "coldroom" ? "مثل ZB38KQE, FH4524Z" : "مثل F4V5RYP0W, AR12TXHQ"}" autocapitalize="characters"><div class="stat" id="wz-model-hit"></div></div>
        ${cbHTML({ id: "err", label: "كود العطل على الشاشة (إن وُجد)", items: codeItems, value: F.error_code, free: true, dir: "ltr", ph: codeItems.length ? `${codeItems.length} كود — ابحث` : "E1, H6, 4E…", onChange: (v) => { F.error_code = v; codeHint(); }, onInput: () => codeHint() })}
      </div><div id="wz-code-hit"></div>
      <div id="wz-fam">${d !== "coldroom" && F.series ? familyCard(famOf(d, ...F.series.split("|"))) : ""}</div>
      ${bi && !F.series ? `<div class="fam-card soft">${bi.decode_ar ? `<div class="stat">🔢 ${esc(bi.decode_ar)}</div>` : ""}${(bi.common_faults_ar || []).length ? `<div class="stat">أعطال شائعة لـ ${esc(bi.b)}: ${esc(bi.common_faults_ar.slice(0, 4).join(" · "))}</div>` : ""}${bi.support_url ? `<a class="stat" href="${esc(bi.support_url)}" target="_blank" rel="noopener noreferrer">دعم ${esc(bi.b)} الرسمي ↗</a>` : ""}</div>` : ""}
    </fieldset>`;
  }
  const symItems = d ? Object.entries(SYM[d]).map(([k, v]) => ({ v: k, l: v })) : [];
  const obsFields = d ? OBS[d].filter(([k]) => !["refrigerant", "water_pressure", "program", "age_years"].includes(k)) : [];
  el.innerHTML = `
  <section class="svc-hero"><div><h2>تشخيص عطل بخبرة مهندس</h2><p>اختر من القوائم أو ابحث فيها. مهندس الصيانة يطابق حالتك مع الـ manual ومواصفات الموديل وإجراءات iCOOL وأرشيف الحالات المحلولة والإنترنت، ثم يعطيك خطوات تفاعلية بدرجة ثقة.</p></div>${pipelineHTML({ tech: "on" })}</section>
  <form id="wz" class="wz" autocomplete="off">
    <fieldset class="wz-sec"><legend><span class="n">1</span>نوع الجهاز</legend>
      <div class="dev-grid">${Object.entries(DEVICES).map(([k, v]) => `<button type="button" class="dev ${v.tone}" data-dev="${k}" aria-pressed="${d === k}">${icon(k)}<b>${v.ar}</b><small>${v.sub}</small></button>`).join("")}</div>
    </fieldset>
    ${d ? `${sec2}
    <fieldset class="wz-sec"><legend><span class="n">3</span>الأعراض</legend>
      ${cbHTML({ id: "sym", items: symItems, value: [...F.symptoms], multi: true, ph: "ابحث عن عرض… (مثلاً: لا يبرد، كود، تسريب)", onChange: (v) => { F.symptoms = new Set(v); } })}
      <div class="chips quick">${symItems.slice(0, 6).map((x) => `<button type="button" class="chip" data-qsym="${x.v}">${esc(x.l)}</button>`).join("")}</div>
      <div class="mgrid" style="margin-top:6px">
        ${cbHTML({ id: "onset", label: "متى بدأ العطل؟", items: ONSET.map((x) => ({ v: x, l: x })), value: F.obs.onset || "", free: true })}
        ${d === "washer" ? cbHTML({ id: "program", label: "المرحلة التي يتوقف فيها", items: ["التعبئة", "الغسيل", "التسخين", "الشطف", "التصريف", "العصر", "بداية البرنامج", "نهاية البرنامج", "كل البرامج"].map((x) => ({ v: x, l: x })), value: F.obs.program || "", free: true }) : ""}
        ${cbHTML({ id: "age", label: "عمر الجهاز", items: ["أقل من سنة (كفالة)", "1–3 سنوات", "3–7 سنوات", "7–12 سنة", "أكثر من 12 سنة"].map((x) => ({ v: x, l: x })), value: F.obs.age || "", free: true })}
      </div>
    </fieldset>
    <fieldset class="wz-sec"><legend><span class="n">4</span>ما فحصته وقِسته <small class="stat">(كلما زادت القياسات ارتفعت الثقة)</small></legend>
      ${cbHTML({ id: "checks", label: "الفحوصات التي قمت بها", items: CHECKS[d].map((x) => ({ v: x, l: x })), value: F.checks || [], multi: true, ph: "اختر ما فحصته…", onChange: (v) => { F.checks = v; } })}
      <div class="mgrid">
        ${d !== "washer" ? cbHTML({ id: "ref", label: "الفريون", items: REFS.map((x) => ({ v: x, l: x })), value: F.obs.refrigerant || "", free: true, dir: "ltr" }) : cbHTML({ id: "wp", label: "ضغط الماء", items: ["جيد", "ضعيف", "مقطوع", "خزان على السطح", "مضخة / ضغط عالي"].map((x) => ({ v: x, l: x })), value: F.obs.water_pressure || "", free: true })}
        ${obsFields.map(([k, l, ph]) => `<div class="field"><label for="ob-${k}">${l}</label><input id="ob-${k}" data-ob="${k}" value="${esc(F.obs[k] || "")}" dir="ltr" placeholder="${esc(ph)}" inputmode="decimal"></div>`).join("")}
      </div>
      <div class="field" style="margin-top:10px"><label for="wz-desc">وصف إضافي (اختياري)</label><textarea id="wz-desc" rows="2" placeholder="أي تفصيل لم تجده في القوائم">${esc(F.description)}</textarea></div>
    </fieldset>
    <fieldset class="wz-sec hyp"><legend><span class="n">5</span>احتمالاتك كمعلّم</legend>
      ${cbHTML({ id: "hyps", items: CAUSES[d].map((x) => ({ v: x, l: x })), value: F.hyps || [], multi: true, free: true, ph: "اختر احتمالاتك بالترتيب أو اكتب احتمالاً آخر…", onChange: (v) => { F.hyps = v; } })}
      <textarea id="wz-hyp" rows="2" placeholder="لماذا تعتقد ذلك؟ (اختياري)">${esc(F.hypotheses)}</textarea>
      <div class="stat">المهندس يراجع كل احتمال ويقول لك إذا كان صحيحاً ولماذا.</div>
      <div class="bar" style="margin-top:10px"><button class="btn ghost sm" type="button" id="wz-fault-photo">📎 صورة للعطل (اختياري)</button><span class="stat" id="wz-photo-st">${F.photo ? "✓ صورة مرفقة" : "مثل بورد محروق أو جليد على المبخر"}</span></div>
    </fieldset>
    <div class="wz-go"><button class="btn warn" type="submit" id="wz-submit">ابدأ التشخيص</button><span class="stat">يستغرق عادة 1–2 دقيقة</span></div>
    <div class="msg bad" id="wz-msg" hidden></div>` : `<p class="stat" style="text-align:center">اختر نوع الجهاز للمتابعة.</p>`}
  </form>
  <input type="file" id="wz-file-plate" accept="image/*" hidden><input type="file" id="wz-file-fault" accept="image/*" hidden>`;
  bindWizard();
}
function brandInfo(d, b) { return b ? (KB.brands || []).find((x) => x.d === d && x.b.toLowerCase() === b.toLowerCase()) : null; }
function readWizard() {
  const v = (id) => ($("#" + id) ? $("#" + id).value.trim() : "");
  if (!$("#wz-model")) return;
  F.brand = cbVal("brand") || ""; F.model = v("wz-model"); F.error_code = cbVal("err") || ""; F.description = v("wz-desc"); F.hypotheses = v("wz-hyp");
  F.series = F.device === "coldroom" ? "" : (cbVal("series") || "");
  F.symptoms = new Set(cbVal("sym") || []); F.checks = cbVal("checks") || []; F.hyps = cbVal("hyps") || [];
  const o = F.obs; o.onset = cbVal("onset") || ""; o.age = cbVal("age") || "";
  if (F.device === "washer") { o.water_pressure = cbVal("wp") || ""; o.program = cbVal("program") || ""; } else o.refrigerant = cbVal("ref") || "";
  if (F.device === "coldroom") { o.unit_type = cbVal("unit") || ""; o.controller = cbVal("ctrl") || ""; }
  $$("[data-ob]").forEach((i) => { o[i.dataset.ob] = i.value.trim(); });
}
function codeHint() {
  const box = $("#wz-code-hit"); if (!box || !KB) return;
  const n = (s) => String(s || "").toUpperCase().replace(/[\s\-./_]/g, "");
  const e = n(cbVal("err")); const b = (cbVal("brand") || "").toLowerCase();
  if (e.length < 1) { box.innerHTML = ""; return; }
  const hits = (KB.codes || []).filter((x) => x.d === F.device && String(x.c).toUpperCase().split(/[\/,]/).some((p) => n(p) === e)).sort((a, z) => (z.b.toLowerCase() === b) - (a.b.toLowerCase() === b)).slice(0, 3);
  box.innerHTML = hits.length ? `<div class="code-hit">${hits.map((x) => `<div><b class="mono">${esc(x.b)} ${esc(x.c)}</b> — ${esc(x.t)}${x.m ? `<div class="stat">${esc(x.m)}</div>` : ""}</div>`).join("")}<div class="stat">من أرشيف أكواد iCOOL. المهندس يتحقق منها حسب موديلك.</div></div>` : "";
}
function modelHint() {
  const inp = $("#wz-model"), out = $("#wz-model-hit"); if (!inp || !out || F.device === "coldroom") return;
  const f = famMatch(F.device, cbVal("brand"), inp.value);
  if (!f) { out.textContent = ""; return; }
  if (famKey(f) === cbVal("series")) { out.textContent = "✓ مطابق للسلسلة المختارة"; return; }
  out.innerHTML = `<button type="button" class="linkbtn" id="wz-use-fam">يطابق ${esc(f.b)} · ${esc(f.series)} — اعتمد</button>`;
  $("#wz-use-fam").addEventListener("click", () => { readWizard(); F.brand = f.b; F.series = famKey(f); renderWizard(); });
}
function bindWizard() {
  cbBind($("#tab-diag"));
  $$("[data-dev]").forEach((b) => b.addEventListener("click", () => { readWizard(); if (F.device !== b.dataset.dev) { F.symptoms.clear(); F.obs = {}; F.checks = []; F.hyps = []; F.series = ""; F.brand = ""; F.error_code = ""; } F.device = b.dataset.dev; renderWizard(); $("#wz .wz-sec:nth-of-type(2)") && $("#wz .wz-sec:nth-of-type(2)").scrollIntoView({ behavior: "smooth", block: "start" }); }));
  $$("[data-qsym]").forEach((b) => b.addEventListener("click", () => { readWizard(); F.symptoms.add(b.dataset.qsym); renderWizard(); }));
  codeHint();
  const mi = $("#wz-model"); if (mi) { mi.addEventListener("input", modelHint); modelHint(); }
  const pp = $("#wz-plate"); if (pp) pp.addEventListener("click", () => $("#wz-file-plate").click());
  const fp = $("#wz-fault-photo"); if (fp) fp.addEventListener("click", () => $("#wz-file-fault").click());
  $("#wz-file-plate").addEventListener("change", async (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) readPlate(f); });
  $("#wz-file-fault").addEventListener("change", async (e) => { const f = e.target.files[0]; e.target.value = ""; if (!f) return; try { F.photo = await I().shrink(f); $("#wz-photo-st").textContent = "✓ صورة مرفقة"; } catch (er) {} });
  const form = $("#wz"); form.addEventListener("submit", (e) => { e.preventDefault(); readWizard(); startCase(); });
  form.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.classList.contains("cb-in")) e.preventDefault(); });
}
async function readPlate(file) {
  readWizard();
  const st = $("#wz-plate"); st.disabled = true; st.textContent = "جارِ القراءة…";
  try {
    const img = await I().shrink(file);
    const j = await I().api("api/plate", { code: I().CODE, device: I().DEV, image: img, kind: "appliance" });
    if (!j.ok) { flash(errTxt(j), "bad"); return; }
    const p = j.plate || {};
    if (p.device && DEVICES[p.device] && !F.device) F.device = p.device;
    if (p.brand) F.brand = p.brand; if (p.model) F.model = p.model;
    if (p.refrigerant) F.obs.refrigerant = p.refrigerant;
    if (F.device && F.model) { const fm = famMatch(F.device, F.brand, F.model); if (fm) { F.brand = fm.b; F.series = famKey(fm); } }
    if (p.voltage && !F.obs.voltage) F.obs.voltage = String(p.voltage).replace(/[^\d.]/g, "").slice(0, 5);
    const extra = [p.charge && `شحنة الفريون حسب اللوحة: ${p.charge}`, p.rla && `RLA: ${p.rla}`, p.lra && `LRA: ${p.lra}`, p.power && `القدرة: ${p.power}`, p.capacity && `السعة: ${p.capacity}`].filter(Boolean).join(" · ");
    if (extra && !F.description.includes(extra)) F.description = (F.description ? F.description + "\n" : "") + extra;
    renderWizard(); flash("تمت قراءة لوحة البيانات ✓ راجع القيم.", "ok");
  } catch (e) { flash("تعذّر قراءة الصورة.", "bad"); }
  finally { const b = $("#wz-plate"); if (b) { b.disabled = false; b.textContent = "📷 صورة لوحة البيانات"; } }
}
function flash(t, c) { const m = $("#wz-msg"); if (!m) return; m.textContent = t; m.className = "msg " + c; m.hidden = false; }

/* ---------- running a case ---------- */
async function startCase() {
  if (!F.device) return flash(ERR.device, "bad");
  if (!F.symptoms.size && !F.error_code && F.description.length < 8) return flash("اختر عرضاً واحداً على الأقل من قائمة الأعراض أو كود العطل.", "bad");
  const fam = F.series ? famOf(F.device, ...F.series.split("|")) : null;
  const obs = Object.fromEntries(Object.entries(F.obs).filter(([, v]) => v));
  if (fam) { obs.series = `${fam.b} ${fam.series}`; obs.family_specs = [fam.type, fam.cap, fam.inverter === true ? "inverter" : fam.inverter === false ? "on/off" : "", fam.refrigerant, fam.compressor, fam.motor].filter(Boolean).join(" | "); if (fam.manual_url) obs.family_manual = fam.manual_url; if (fam.notes_ar) obs.family_note = fam.notes_ar; }
  if ((F.checks || []).length) obs.checks_done = F.checks.join("، ");
  const hyp = [(F.hyps || []).map((h, i) => `${i + 1}) ${h}`).join(" "), F.hypotheses].filter(Boolean).join(" — ");
  const c = { device: F.device, brand: F.brand, model: F.model || (fam ? fam.series : ""), error_code: F.error_code, symptoms: [...F.symptoms], observations: obs, description: F.description, hypotheses: hyp };
  const el = $("#tab-diag");
  el.innerHTML = `<section class="run"><h2>جارِ تشخيص الحالة</h2>${pipelineHTML({ tech: "done", eng: "on" })}
    <div class="run-log" id="run-log"><div class="rl on" id="rl-open"><span class="dot"></span><div><b>المهندس يستلم الحالة ويبحث في أرشيف المنصة والمكتبة…</b></div></div></div></section>`;
  const log = (id, cls, html) => { let n = $("#" + id); if (!n) { n = document.createElement("div"); n.id = id; $("#run-log").appendChild(n); } n.className = "rl " + cls; n.innerHTML = `<span class="dot"></span><div>${html}</div>`; };
  const pl = (s) => { const p = $(".run .pipeline"); if (p) p.outerHTML = pipelineHTML(s); };
  // 1) open
  let o = await I().api("api/diagnose", { stage: "open", ...sub(), case: c });
  if (!o.ok) return runFail(o);
  CUR = { id: o.id, archive: o.archive, manuals: o.manuals, library: o.library, log: [], status: "open", input: c };
  const ac = (o.archive && o.archive.cases) || [];
  log("rl-open", "done", `<b>أرشيف المنصة:</b> ${ac.length ? `${ac.length} حالة مشابهة محلولة سابقاً${o.archive.stats && o.archive.stats.length ? ` — الأكثر تكراراً: «${esc(o.archive.stats[0].cause)}» (${o.archive.stats[0].n})` : ""}` : "لا حالات مشابهة بعد — هذه الحالة ستُعلّم المنصة"}<br><b>مكتبة iCOOL:</b> ${(o.library.guides || []).map((g) => esc(g.title)).join(" · ") || "—"}${(o.library.codes || []).length ? `<br><b>أكواد مطابقة:</b> ${o.library.codes.map((x) => esc(x.b + " " + x.c)).join("، ")}` : ""}${(o.manuals || []).length ? `<br><b>كتيبات محفوظة:</b> ${o.manuals.length}` : ""}`);
  pl({ tech: "done", eng: "done", res: "on" });
  log("rl-res", "on", "<b>البحث في الـ manuals ومواقع الشركات والحالات المتكررة على الإنترنت…</b>");
  // 2) research
  let r = await I().api("api/diagnose", { stage: "research", ...sub(), id: CUR.id, photo: F.photo });
  if (!r.ok) return runFail(r);
  const R = r.research || {}; CUR.research = R;
  log("rl-res", "done", `<b>البحث:</b> ${(R.findings || []).length} دليل${R.code_meaning && R.code_meaning.text ? ` — معنى الكود: ${esc(R.code_meaning.text)}` : ""}${(R.manual_links || []).length ? `<br><b>كتيبات وُجدت:</b> ${R.manual_links.slice(0, 3).map((m) => `<a href="${esc(m.url)}" target="_blank" rel="noopener">${esc((m.title || m.url).slice(0, 50))}</a>`).join(" · ")}` : ""}`);
  pl({ tech: "done", eng: "done", res: "done", rev: "on" });
  log("rl-rev", "on", "<b>مهندس الصيانة يراجع احتمالاتك مع الأدلة والأرشيف ويبني الخطة…</b>");
  // 3) review
  let v = await I().api("api/diagnose", { stage: "review", ...sub(), id: CUR.id });
  if (!v.ok) return runFail(v);
  CUR.result = v.result;
  F.photo = null;
  renderResult();
}
function runFail(j) {
  if (j.err === "denied") { location.reload(); return; }
  const el = $("#tab-diag");
  const m = document.createElement("div"); m.className = "msg bad"; m.style.marginTop = "12px";
  m.innerHTML = `${esc(errTxt(j))}${CUR && CUR.id ? ` <button class="btn sm" type="button" id="run-retry">إعادة المحاولة</button>` : ""} <button class="btn ghost sm" type="button" id="run-back">رجوع للنموذج</button>`;
  el.appendChild(m);
  const rb = $("#run-retry"); if (rb) rb.addEventListener("click", () => resumeCase(CUR.id));
  $("#run-back").addEventListener("click", () => { CUR = null; renderWizard(); });
}
async function resumeCase(id) {
  const el = $("#tab-diag");
  el.innerHTML = `<section class="run"><h2>متابعة الحالة #${id}</h2>${pipelineHTML({ tech: "done", eng: "done", res: "on" })}<div class="run-log" id="run-log"><div class="rl on"><span class="dot"></span><div><b>استكمال البحث والمراجعة…</b></div></div></div></section>`;
  CUR = CUR && CUR.id === id ? CUR : { id, log: [], status: "open" };
  const r = await I().api("api/diagnose", { stage: "research", ...sub(), id }); if (!r.ok) return runFail(r);
  CUR.research = r.research;
  const v = await I().api("api/diagnose", { stage: "review", ...sub(), id }); if (!v.ok) return runFail(v);
  CUR.result = v.result; renderResult();
}

/* ---------- result + interactive steps ---------- */
function ring(p) {
  const c = p >= 75 ? "var(--ok)" : p >= 50 ? "var(--orange)" : "var(--bad)";
  return `<div class="ring" style="--p:${p};--c:${c}" role="img" aria-label="الثقة ${p}%"><span>${p}<small>%</small></span></div>`;
}
const VERD = { agree: ["موافق", "ok"], partial: ["جزئياً", "warn"], disagree: ["غير موافق", "bad"] };
function renderResult() {
  const R = CUR.result || {}, el = $("#tab-diag");
  const done = CUR.status !== "open";
  const causes = R.causes || [];
  const srcs = R.sources || [];
  el.innerHTML = `
  <section class="res">
    <div class="res-head">${ring(R.confidence || 0)}<div><div class="stat">الحالة #${CUR.id}${CUR.input ? ` · ${esc(DEVICES[CUR.input.device]?.ar || "")} ${esc(CUR.input.brand || "")} ${esc(CUR.input.model || "")}` : ""}</div><h2>${esc(R.headline || "نتيجة التشخيص")}</h2><p>${esc(R.summary || "")}</p><div class="stat">سبب درجة الثقة: ${esc(R.confidence_reason || "")}</div></div></div>
    ${pipelineHTML({ tech: "done", eng: "done", res: "done", rev: "done", fb: done ? "done" : "on" })}
    ${(R.missing_info || []).length ? `<div class="msg info"><b>لرفع الثقة قِس أيضاً:</b> ${R.missing_info.map(esc).join(" · ")}</div>` : ""}
    ${(R.technician_review || []).length ? `<h3 class="sec">مراجعة احتمالاتك</h3><div class="tr-list">${R.technician_review.map((t) => { const v = VERD[t.verdict] || ["—", "mute"]; return `<div class="tr"><span class="spill ${v[1]}">${v[0]}</span><div><b>${esc(t.hypothesis)}</b><div class="stat">${esc(t.reason)}</div></div></div>`; }).join("")}</div>` : ""}
    <h3 class="sec">الأسباب المرجّحة</h3>
    <div class="causes">${causes.map((c, i) => `<div class="cause"><div class="cause-top"><b>${esc(c.cause)}</b><span class="num">${Math.round(c.probability || 0)}%</span></div><div class="cbar"><i style="width:${Math.max(3, Math.min(100, c.probability || 0))}%"></i></div><div class="stat">${esc(c.why || "")}</div>${(c.evidence || []).length ? `<ul class="ev">${c.evidence.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}</div>`).join("")}</div>
    ${(R.safety || []).length ? `<div class="safety"><b>⚠️ السلامة</b><ul>${R.safety.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></div>` : ""}
    ${(R.pre_checks || []).length ? `<h3 class="sec">قبل البدء</h3>${checklist("pre", R.pre_checks)}` : ""}
    <h3 class="sec">خطوات الفحص التفاعلية</h3>
    <div id="stepper"></div>
    ${(R.parts || []).length ? `<h3 class="sec">القطع المحتملة</h3><div class="parts">${R.parts.map((p) => `<div class="part"><b>${esc(p.name)}</b><span class="stat">${esc(p.note || "")}</span></div>`).join("")}</div>` : ""}
    ${R.refrigerant_targets && (R.refrigerant_targets.values || []).length ? `<h3 class="sec">الفريون والضغوط المناسبة ${R.refrigerant_targets.refrigerant ? `<span class="pill ref">${esc(R.refrigerant_targets.refrigerant)}</span>` : ""}</h3><div class="specs" style="margin:0">${R.refrigerant_targets.values.map((v) => `<div class="spec"><span>${esc(v.label)}</span><b>${esc(v.value)}</b></div>`).join("")}</div>${R.refrigerant_targets.notes ? `<div class="stat" style="margin-top:6px">${esc(R.refrigerant_targets.notes)}</div>` : ""}` : ""}
    ${(R.post_checks || []).length ? `<h3 class="sec">بعد التصليح</h3>${checklist("post", R.post_checks)}` : ""}
    ${(R.related_guides || []).filter(guide).length ? `<h3 class="sec">من مكتبة iCOOL</h3><div class="glinks">${R.related_guides.filter(guide).map((id) => `<button class="btn ghost sm" type="button" data-guide="${esc(id)}">${esc(guide(id).title_ar)}</button>`).join("")}</div>` : ""}
    ${R.archive_note ? `<div class="note"><b>أرشيف المنصة:</b> ${esc(R.archive_note)}</div>` : ""}
    ${srcs.length ? `<h3 class="sec">المصادر</h3><ol class="src">${srcs.map((s) => `<li>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title || s.url)}</a>` : esc(s.title)} <span class="stat">${esc(s.type || "")}</span></li>`).join("")}</ol>` : ""}
    <div id="fb-box"></div>
    <div class="bar" style="margin-top:16px"><button class="btn ghost" type="button" id="new-case">+ حالة جديدة</button></div>
  </section>`;
  renderStepper(); renderFeedback();
  $("#new-case").addEventListener("click", () => { CUR = null; F.device = ""; F.brand = F.series = F.model = F.error_code = F.description = F.hypotheses = ""; F.symptoms.clear(); F.obs = {}; F.checks = []; F.hyps = []; renderWizard(); window.scrollTo({ top: 0 }); });
  $$("[data-guide]", el).forEach((b) => b.addEventListener("click", () => openGuide(b.dataset.guide)));
}
function checklist(k, items) {
  return `<div class="checks">${items.map((t, i) => `<label class="chk"><input type="checkbox" id="ck-${k}-${i}"><span>${esc(typeof t === "string" ? t : t.text_ar || "")}${t && t.expected_ar ? `<small class="stat"> — ${esc(t.expected_ar)}</small>` : ""}</span></label>`).join("")}</div>`;
}
/* stepper shared by cases and library guides: steps use either {title,action,measure{label,unit,min,max},expected,if_fail} or *_ar fields */
function stepView(s) {
  return { title: s.title || s.title_ar || "", action: s.action || s.action_ar || "", expected: s.expected || s.expected_ar || "", fail: s.if_fail || s.if_fail_ar || "",
    warn: s.warning_ar || s.warning || "", tip: s.tip_ar || s.tip || "", m: s.measure ? { label: s.measure.label || s.measure.label_ar || "", unit: s.measure.unit || "", min: s.measure.min, max: s.measure.max } : null };
}
function makeStepper(host, steps, logArr, onLog, opts = {}) {
  let i = Math.min(logArr.length, steps.length - 1); if (i < 0) i = 0;
  const draw = () => {
    const s = stepView(steps[i]), lg = logArr[i] || {};
    const range = s.m && (s.m.min != null || s.m.max != null) ? `${s.m.min != null ? s.m.min : "…"} – ${s.m.max != null ? s.m.max : "…"} ${esc(s.m.unit)}` : "";
    host.innerHTML = `<div class="stepper">
      <div class="st-dots">${steps.map((_, k) => `<button type="button" class="st-dot ${logArr[k] ? logArr[k].r : ""} ${k === i ? "cur" : ""}" data-go="${k}" aria-label="خطوة ${k + 1}">${k + 1}</button>`).join("")}</div>
      <div class="st-card"><div class="stat">خطوة ${i + 1} من ${steps.length}</div><h4>${esc(s.title)}</h4><p>${esc(s.action)}</p>
        ${s.warn ? `<div class="msg bad">⚠️ ${esc(s.warn)}</div>` : ""}
        ${s.m ? `<div class="st-measure"><label for="st-val">${esc(s.m.label)} ${range ? `<span class="stat">(السليم: <span dir="ltr">${range}</span>)</span>` : ""}</label><div class="bar"><input id="st-val" inputmode="decimal" dir="ltr" value="${esc(lg.v || "")}" placeholder="القيمة المقاسة"><span class="stat">${esc(s.m.unit)}</span><span id="st-eval"></span></div></div>` : ""}
        ${s.expected ? `<div class="st-exp"><b>النتيجة السليمة:</b> ${esc(s.expected)}</div>` : ""}
        <div class="st-fail" ${lg.r === "fail" ? "" : "hidden"}><b>إذا لم تكن سليمة:</b> ${esc(s.fail)}</div>
        ${s.tip ? `<div class="stat">💡 ${esc(s.tip)}</div>` : ""}
        <div class="bar st-act"><button class="btn sm st-ok" type="button" data-r="ok">${opts.learn ? "✓ فهمت / نفّذت" : "✓ سليمة"}</button>${opts.learn ? "" : `<button class="btn sm st-bad" type="button" data-r="fail">✗ غير سليمة</button>`}<button class="btn ghost sm" type="button" data-r="skip">تخطي</button>
          <span class="sp"></span>${i > 0 ? `<button class="btn ghost sm" type="button" data-nav="-1">السابق</button>` : ""}${i < steps.length - 1 ? `<button class="btn ghost sm" type="button" data-nav="1">التالي</button>` : ""}</div>
      </div></div>`;
    const inp = $("#st-val", host);
    const evalV = () => { if (!inp || !s.m) return null; const v = parseFloat(inp.value.replace(",", ".")); const out = $("#st-eval", host); if (!isFinite(v)) { out.textContent = ""; return null; }
      const ok = (s.m.min == null || v >= s.m.min) && (s.m.max == null || v <= s.m.max); out.className = "spill " + (ok ? "ok" : "bad"); out.textContent = ok ? "ضمن المدى" : "خارج المدى"; return ok; };
    if (inp) { inp.addEventListener("input", evalV); evalV(); }
    $$("[data-go]", host).forEach((b) => b.addEventListener("click", () => { i = +b.dataset.go; draw(); }));
    $$("[data-nav]", host).forEach((b) => b.addEventListener("click", () => { i = Math.max(0, Math.min(steps.length - 1, i + +b.dataset.nav)); draw(); }));
    $$("[data-r]", host).forEach((b) => b.addEventListener("click", () => {
      const r = b.dataset.r; logArr[i] = { id: steps[i].id || "s" + (i + 1), r, v: inp ? inp.value : "", t: new Date().toISOString() };
      onLog && onLog(logArr);
      if (r === "fail") { draw(); $(".st-fail", host).hidden = false; const box = document.createElement("div"); box.className = "bar"; box.style.marginTop = "8px";
        box.innerHTML = `<button class="btn sm warn" type="button" id="st-found">وجدت العطل ← سجّل النتيجة</button>${i < steps.length - 1 ? `<button class="btn ghost sm" type="button" id="st-cont">تابع الفحص</button>` : ""}`;
        $(".st-card", host).appendChild(box);
        $("#st-found", host).addEventListener("click", () => { const fb = $("#fb-box"); if (fb) { fb.scrollIntoView({ behavior: "smooth" }); const sel = $("#fb-cause"); if (sel && stepView(steps[i]).fail) { const o = [...sel.options].find((x) => x.value === "__other"); $("#fb-other").value = stepView(steps[i]).fail.slice(0, 200); sel.value = "__other"; $("#fb-other").hidden = false; } } });
        const ct = $("#st-cont", host); if (ct) ct.addEventListener("click", () => { i++; draw(); });
        return; }
      if (i < steps.length - 1) { i++; draw(); } else { draw(); const d = document.createElement("div"); d.className = "msg ok"; d.style.marginTop = "8px"; d.textContent = opts.learn ? "أنهيت خطوات الدرس ✓ انتقل إلى الاختبار بالأسفل." : "انتهت الخطوات. سجّل نتيجة التصليح بالأسفل لتتعلّم المنصة."; $(".st-card", host).appendChild(d); }
    }));
  };
  draw();
}
function renderStepper() {
  const steps = (CUR.result && CUR.result.steps) || [];
  const host = $("#stepper"); if (!steps.length) { host.innerHTML = '<div class="stat">لا توجد خطوات.</div>'; return; }
  let t = null;
  makeStepper(host, steps, CUR.log, (lg) => { clearTimeout(t); t = setTimeout(() => I().rpc("svc_case_step", { p_code: I().CODE, p_device: I().DEV, p_id: CUR.id, p_log: lg }).catch(() => {}), 600); });
}
function renderFeedback() {
  const box = $("#fb-box"), R = CUR.result || {};
  if (CUR.status !== "open") { box.innerHTML = `<div class="msg ok" style="margin-top:16px">${CUR.status === "resolved" ? "✓ تم الإصلاح" : "لم يُحل"}${CUR.actual_cause ? ` — السبب الفعلي: <b>${esc(CUR.actual_cause)}</b>` : ""}. شكراً، المنصة تعلّمت من هذه الحالة.</div>`; return; }
  box.innerHTML = `<form class="fb" id="fb-form" autocomplete="off"><h3 class="sec" style="margin-top:0">🧠 نتيجة التصليح (Feedback)</h3>
    <div class="stat">ملاحظتك تجعل المنصة أذكى: الحالات المشابهة القادمة ستستفيد من السبب الفعلي الذي وجدته.</div>
    <div class="bar fb-yn"><button type="button" class="chip" data-fixed="1" aria-pressed="false">✓ تم الإصلاح</button><button type="button" class="chip" data-fixed="0" aria-pressed="false">✗ لم يُحل</button></div>
    <div class="field"><label for="fb-cause">السبب الفعلي</label><select id="fb-cause"><option value="">— اختر —</option>${(R.causes || []).map((c) => `<option>${esc(c.cause)}</option>`).join("")}<option value="__other">سبب آخر…</option></select><input id="fb-other" placeholder="اكتب السبب الفعلي" hidden></div>
    <div class="field"><label for="fb-parts">القطع التي استُبدلت (افصل بفاصلة)</label><input id="fb-parts" placeholder="${esc((R.parts || []).map((p) => p.name).slice(0, 3).join("، "))}"></div>
    <div class="field"><label for="fb-fix">شو اللي حلّ المشكلة؟</label><textarea id="fb-fix" rows="2"></textarea></div>
    <div class="field"><label>تقييم مساعدة المنصة</label><div class="stars">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="star" data-star="${n}" aria-label="${n}">★</button>`).join("")}</div></div>
    <div class="field"><label for="fb-notes">ملاحظات للمهندس</label><textarea id="fb-notes" rows="2"></textarea></div>
    <button class="btn" type="submit" id="fb-send">إرسال النتيجة</button><div class="msg bad" id="fb-msg" hidden></div></form>`;
  let fixed = null, rating = 0;
  $$("[data-fixed]", box).forEach((b) => b.addEventListener("click", () => { fixed = b.dataset.fixed === "1"; $$("[data-fixed]", box).forEach((x) => x.setAttribute("aria-pressed", String(x === b))); }));
  $$("[data-star]", box).forEach((b) => b.addEventListener("click", () => { rating = +b.dataset.star; $$("[data-star]", box).forEach((x) => x.classList.toggle("on", +x.dataset.star <= rating)); }));
  $("#fb-cause").addEventListener("change", (e) => { $("#fb-other").hidden = e.target.value !== "__other"; });
  $("#fb-form").addEventListener("submit", async (e) => {
    e.preventDefault(); const m = $("#fb-msg");
    if (fixed === null) { m.textContent = "اختر: تم الإصلاح أو لم يُحل."; m.hidden = false; return; }
    const sel = $("#fb-cause").value, cause = sel === "__other" ? $("#fb-other").value.trim() : sel;
    if (fixed && !cause) { m.textContent = "اكتب السبب الفعلي ليتعلّم منه النظام."; m.hidden = false; return; }
    const fb = { fixed, actual_cause: cause, parts: $("#fb-parts").value.split(/[,،]/).map((x) => x.trim()).filter(Boolean), fix: $("#fb-fix").value.trim(), notes: $("#fb-notes").value.trim(), rating: rating || null, steps_done: CUR.log.filter(Boolean).length };
    $("#fb-send").disabled = true;
    try { const j = await I().rpc("svc_case_feedback", { p_code: I().CODE, p_device: I().DEV, p_id: CUR.id, p_fb: fb });
      if (!j.ok) throw 0; CUR.status = fixed ? "resolved" : "unresolved"; CUR.actual_cause = cause; renderFeedback(); const p = $(".res .pipeline"); if (p) p.outerHTML = pipelineHTML({ tech: "done", eng: "done", res: "done", rev: "done", fb: "done" });
    } catch (er) { m.textContent = "تعذّر الإرسال. أعد المحاولة."; m.hidden = false; $("#fb-send").disabled = false; }
  });
}

/* ================= MY CASES ================= */
async function renderCases() {
  const el = $("#tab-cases");
  el.innerHTML = `<h2 class="tab-h">حالاتي</h2><div class="busy"><svg class="loader" aria-hidden="true"><use href="#g-split"/></svg>جارِ التحميل…</div>`;
  let j; try { j = await I().rpc("svc_my_cases", { p_code: I().CODE, p_device: I().DEV, p_id: null }); } catch (e) { j = null; }
  if (!j || !j.ok) { el.innerHTML = `<h2 class="tab-h">حالاتي</h2><div class="msg bad">تعذّر التحميل.</div>`; return; }
  const ST = { open: ["مفتوحة", "warn"], resolved: ["تم الإصلاح", "ok"], unresolved: ["لم تُحل", "bad"] };
  el.innerHTML = `<h2 class="tab-h">حالاتي</h2>${j.cases.length ? `<div class="list">${j.cases.map((c) => `<button class="row case-row ${DEVICES[c.device]?.tone || ""}" type="button" data-case="${c.id}"><span><span class="m"><span class="dev-mini">${icon(c.device)}</span><span>${esc(c.brand || DEVICES[c.device]?.ar || "")} ${esc(c.model || "")}</span></span><br><span class="b">${esc(c.title || (c.symptoms || []).map((s) => SYM[c.device]?.[s] || s).join("، "))}</span></span><span class="stat">#${c.id} · ${new Date(c.created_at).toLocaleDateString("en-GB")}${c.confidence != null ? ` · ثقة ${c.confidence}%` : ""}</span><span class="pills"><span class="spill ${(ST[c.status] || ST.open)[1]}">${(ST[c.status] || ST.open)[0]}</span>${c.error_code ? `<span class="pill">${esc(c.error_code)}</span>` : ""}</span></button>`).join("")}</div>` : `<div class="empty"><span>لا توجد حالات بعد.</span><button class="btn" type="button" data-tabgo="diag">ابدأ أول تشخيص</button></div>`}`;
  $$("[data-case]", el).forEach((b) => b.addEventListener("click", () => openCase(+b.dataset.case)));
  $$("[data-tabgo]", el).forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tabgo)));
}
async function openCase(id) {
  const j = await I().rpc("svc_my_cases", { p_code: I().CODE, p_device: I().DEV, p_id: id }).catch(() => null);
  if (!j || !j.ok || !j.case) return;
  const c = j.case;
  CUR = { id: c.id, result: c.result, research: c.result && c.result.research, log: Array.isArray(c.steps_log) ? c.steps_log : [], status: c.status, actual_cause: c.actual_cause,
    input: { device: c.device, brand: c.brand, model: c.model } };
  setTab("diag");
  if (!c.result || !c.result.steps) { resumeCase(c.id); return; }
  renderResult();
}

/* ================= LIBRARY ================= */
let LIBF = { dev: "", q: "", sec: "guides" };
function renderLib() {
  const el = $("#tab-lib"); if (!KB) { el.innerHTML = '<div class="busy">جارِ التحميل…</div>'; loadKB().then(renderLib); return; }
  const secs = [["guides", "الإجراءات والأدلة"], ["models", "الموديلات والمواصفات"], ["pt", "الفريون والضغوط"], ["codes", "أكواد الأعطال"], ["manuals", "الكتيبات Manuals"]];
  el.innerHTML = `<h2 class="tab-h">مكتبة iCOOL الفنية</h2>
   <div class="seg">${secs.map(([k, t]) => `<button type="button" class="seg-b" data-sec="${k}" aria-pressed="${LIBF.sec === k}">${t}</button>`).join("")}</div>
   <div id="lib-body"></div>`;
  $$("[data-sec]", el).forEach((b) => b.addEventListener("click", () => { LIBF.sec = b.dataset.sec; renderLib(); }));
  ({ guides: libGuides, models: libModels, pt: libPT, codes: libCodes, manuals: libManuals })[LIBF.sec || "guides"]();
}
function devChips() {
  return `<div class="chips" style="margin-bottom:10px"><button type="button" class="chip" data-ldev="" aria-pressed="${!LIBF.dev}">الكل</button>${Object.entries(DEVICES).map(([k, v]) => `<button type="button" class="chip" data-ldev="${k}" aria-pressed="${LIBF.dev === k}">${v.ar}</button>`).join("")}<button type="button" class="chip" data-ldev="general" aria-pressed="${LIBF.dev === "general"}">عام</button></div>`;
}
function bindDevChips(fn) { $$("[data-ldev]").forEach((b) => b.addEventListener("click", () => { LIBF.dev = b.dataset.ldev; fn(); })); }
function libGuides() {
  const body = $("#lib-body"); const q = LIBF.q.toLowerCase();
  const gs = (KB.guides || []).filter((g) => (!LIBF.dev || g.domain === LIBF.dev) && (!q || `${g.title_ar} ${g.title_en} ${(g.tags_ar || []).join(" ")} ${g.summary_ar}`.toLowerCase().includes(q)));
  body.innerHTML = `${devChips()}<input id="lib-q" class="lib-q" type="search" placeholder="ابحث في الأدلة… مثال: كابيليري، فاكيوم، ديفروست" value="${esc(LIBF.q)}">
   <div class="gcards">${gs.map((g) => `<button type="button" class="gcard ${DEVICES[g.domain]?.tone || "gen"}" data-guide="${esc(g.id)}"><span class="gc-ic">${icon(g.domain)}</span><span class="gc-k">${KIND[g.kind] || g.kind}</span><b>${esc(g.title_ar)}</b><small>${esc((g.summary_ar || "").slice(0, 110))}</small><span class="gc-meta">${"●".repeat(g.difficulty || 1)}<span class="dim">${"●".repeat(5 - (g.difficulty || 1))}</span> · ${g.time_min ? `${g.time_min} د` : ""} · ${(g.steps || []).length} خطوة</span></button>`).join("") || '<div class="stat">لا توجد نتائج.</div>'}</div>`;
  bindDevChips(libGuides);
  const qi = $("#lib-q"); qi.addEventListener("input", () => { LIBF.q = qi.value; const pos = qi.selectionStart; libGuides(); const n = $("#lib-q"); n.focus(); n.setSelectionRange(pos, pos); });
  $$("[data-guide]", body).forEach((b) => b.addEventListener("click", () => openGuide(b.dataset.guide)));
}
function openGuide(id) {
  const g = guide(id); if (!g) return;
  const log = [];
  I().setSheet(`<div class="sheet-head"><div><div class="stat">${KIND[g.kind] || ""} · ${DEVICES[g.domain]?.ar || "عام"}${g.confidence === "medium" ? " · قيم تقريبية" : ""}</div><h2 class="t">${esc(g.title_ar)}</h2></div><button class="x" type="button" data-close aria-label="إغلاق">×</button></div>
    <p>${esc(g.summary_ar || "")}</p>
    <div class="bar">${(g.refrigerants || []).map((r) => `<span class="pill ref">${esc(r)}</span>`).join("")}${g.time_min ? `<span class="pill">${g.time_min} دقيقة</span>` : ""}<span class="pill">صعوبة ${g.difficulty || 1}/5</span></div>
    ${(g.safety_ar || []).length ? `<div class="safety"><b>⚠️ السلامة</b><ul>${g.safety_ar.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></div>` : ""}
    ${(g.tools || []).length ? `<h3 class="sec">العدّة</h3><div class="bar">${g.tools.map((t) => `<span class="pill">${esc(t)}</span>`).join("")}</div>` : ""}
    ${(g.pre_checks || []).length ? `<h3 class="sec">قبل البدء</h3>${checklist("gpre", g.pre_checks)}` : ""}
    <h3 class="sec">الخطوات</h3><div id="g-stepper"></div>
    ${(g.post_checks || []).length ? `<h3 class="sec">بعد الانتهاء</h3>${checklist("gpost", g.post_checks)}` : ""}
    ${(g.values || []).length ? `<h3 class="sec">قيم مرجعية</h3><div style="overflow-x:auto"><table class="caps-t"><tbody>${g.values.map((v) => `<tr><td>${esc(v.label_ar)}</td><td dir="ltr" style="text-align:left;font-weight:600">${esc(v.value)}</td><td class="stat">${esc(v.note_ar || "")}</td></tr>`).join("")}</tbody></table></div>` : ""}
    ${(g.common_mistakes_ar || []).length ? `<h3 class="sec">أخطاء شائعة</h3><ul class="ev">${g.common_mistakes_ar.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}
    ${(g.sources || []).length ? `<h3 class="sec">المصادر</h3><ol class="src">${g.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title || s.url)}</a></li>`).join("")}</ol>` : ""}`);
  if ((g.steps || []).length) makeStepper($("#g-stepper"), g.steps, log, null);
}
/* refrigerant P/T tools */
function satP(rows, t, dew) { // linear interpolation bar(g)
  for (let k = 0; k < rows.length - 1; k++) { const a = rows[k], b = rows[k + 1]; if (t >= a[0] && t <= b[0] && a[1] != null && b[1] != null) { const ia = dew ? 2 : 1; return a[ia] + (b[ia] - a[ia]) * (t - a[0]) / (b[0] - a[0]); } } return null;
}
function satT(rows, p, dew) {
  const ia = dew ? 2 : 1;
  for (let k = 0; k < rows.length - 1; k++) { const a = rows[k], b = rows[k + 1]; if (a[ia] == null || b[ia] == null) continue; if (p >= a[ia] && p <= b[ia]) return a[0] + (b[0] - a[0]) * (p - a[ia]) / (b[ia] - a[ia]); } return null;
}
let PTR = "R134a";
function libPT() {
  const body = $("#lib-body"), P = KB.ptables; if (!P) { body.innerHTML = '<div class="stat">غير متوفر.</div>'; return; }
  const R = P.refrigerants[PTR] || Object.values(P.refrigerants)[0]; const blend = R.blend && R.glide_k_at_0c > 1;
  body.innerHTML = `<div class="chips" style="margin-bottom:10px">${Object.keys(P.refrigerants).map((k) => `<button type="button" class="chip" data-ref="${k}" aria-pressed="${k === PTR}">${k}</button>`).join("")}</div>
   <div class="refcard"><div class="bar"><b class="mono" style="font-size:1.3rem">${PTR}</b><span class="spill ${/A3|A2L/.test(R.class) ? "bad" : "free"}">${esc(R.class)}</span><span class="pill">زيت ${esc(R.oil)}</span><span class="pill">GWP ${R.gwp}</span>${blend ? `<span class="pill">Glide ${R.glide_k_at_0c} K</span>` : ""}</div><div class="stat">${esc(R.use_ar)}</div></div>
   <div class="calc-grid">
    <div class="calc"><h4>من الحرارة إلى الضغط</h4><label for="pt-t">حرارة التشبع <b id="pt-tv">−10</b> °C</label><input type="range" id="pt-t" min="-40" max="60" step="1" value="-10"><div class="big" id="pt-p">—</div><div class="stat" id="pt-p2"></div></div>
    <div class="calc"><h4>حاسبة Superheat</h4><div class="mgrid"><div class="field"><label for="sh-p">ضغط السحب bar(g)</label><input id="sh-p" inputmode="decimal" dir="ltr"></div><div class="field"><label for="sh-t">حرارة خط السحب °C</label><input id="sh-t" inputmode="decimal" dir="ltr"></div></div><div class="big" id="sh-out">—</div><div class="stat" id="sh-note">${blend ? "للخلطات: Superheat يُحسب من حرارة الـ Dew." : ""}</div></div>
    <div class="calc"><h4>حاسبة Subcooling</h4><div class="mgrid"><div class="field"><label for="sc-p">ضغط الطرد/السائل bar(g)</label><input id="sc-p" inputmode="decimal" dir="ltr"></div><div class="field"><label for="sc-t">حرارة خط السائل °C</label><input id="sc-t" inputmode="decimal" dir="ltr"></div></div><div class="big" id="sc-out">—</div><div class="stat">${blend ? "للخلطات: Subcooling يُحسب من حرارة الـ Bubble." : ""}</div></div>
   </div>
   <h3 class="sec">جدول الضغط والحرارة — ${PTR} <span class="stat">bar(g)</span></h3>
   <div class="pt-wrap"><table class="caps-t pt"><thead><tr><th>°C</th><th>${blend ? "Bubble" : "الضغط"}</th>${blend ? "<th>Dew</th>" : ""}<th>psig</th></tr></thead><tbody>${R.rows.filter((r) => r[1] != null && r[0] % 4 === 0).map((r) => `<tr data-t="${r[0]}"><td dir="ltr">${r[0]}</td><td dir="ltr">${r[1].toFixed(2)}</td>${blend ? `<td dir="ltr">${r[2].toFixed(2)}</td>` : ""}<td dir="ltr">${((blend ? r[2] : r[1]) * 14.5038).toFixed(1)}</td></tr>`).join("")}</tbody></table></div>
   <div class="stat" style="margin-top:6px">محسوبة بمكتبة CoolProp (معادلات حالة مكافئة لـ NIST REFPROP). الضغط النسبي = المطلق − 1.013 bar.</div>`;
  $$("[data-ref]", body).forEach((b) => b.addEventListener("click", () => { PTR = b.dataset.ref; libPT(); }));
  const rows = R.rows, tI = $("#pt-t");
  const upd = () => { const t = +tI.value; $("#pt-tv").textContent = (t > 0 ? "+" : "") + t; const pb = satP(rows, t, false), pd = satP(rows, t, true);
    $("#pt-p").innerHTML = pb == null ? "—" : `<span dir="ltr">${(blend ? pd : pb).toFixed(2)} bar(g)</span>`; $("#pt-p2").innerHTML = pb == null ? "" : blend ? `<span dir="ltr">Bubble ${pb.toFixed(2)} · Dew ${pd.toFixed(2)} bar(g) · ${(pd * 14.5038).toFixed(1)} psig</span>` : `<span dir="ltr">${(pb * 14.5038).toFixed(1)} psig</span>`;
    $$(".pt tr[data-t]", body).forEach((tr) => tr.classList.toggle("on", Math.abs(+tr.dataset.t - t) < 2)); };
  tI.addEventListener("input", upd); upd();
  const num = (id) => parseFloat(($("#" + id).value || "").replace(",", "."));
  const sh = () => { const p = num("sh-p"), t = num("sh-t"); const ts = satT(rows, p, true); $("#sh-out").innerHTML = isFinite(p) && isFinite(t) && ts != null ? `<span dir="ltr">${(t - ts).toFixed(1)} K</span> <small class="stat">(التشبع <span dir="ltr">${ts.toFixed(1)} °C</span>)</small>` : "—"; };
  const sc = () => { const p = num("sc-p"), t = num("sc-t"); const ts = satT(rows, p, false); $("#sc-out").innerHTML = isFinite(p) && isFinite(t) && ts != null ? `<span dir="ltr">${(ts - t).toFixed(1)} K</span> <small class="stat">(التكثيف <span dir="ltr">${ts.toFixed(1)} °C</span>)</small>` : "—"; };
  ["sh-p", "sh-t"].forEach((id) => $("#" + id).addEventListener("input", sh)); ["sc-p", "sc-t"].forEach((id) => $("#" + id).addEventListener("input", sc));
}
function libCodes() {
  const body = $("#lib-body"); const n = (s) => String(s || "").toUpperCase().replace(/[\s\-./_]/g, ""); const q = n(LIBF.q);
  const dev = ["ac", "washer", "fridge"].includes(LIBF.dev) ? LIBF.dev : "";
  const list = (KB.codes || []).filter((x) => (!dev || x.d === dev) && (!q || n(x.c).includes(q) || n(x.b).includes(q) || n(x.t).includes(q))).slice(0, 80);
  body.innerHTML = `<div class="chips" style="margin-bottom:10px"><button type="button" class="chip" data-cdev="" aria-pressed="${!dev}">الكل</button><button type="button" class="chip" data-cdev="fridge" aria-pressed="${dev === "fridge"}">برادات</button><button type="button" class="chip" data-cdev="ac" aria-pressed="${dev === "ac"}">مكيفات</button><button type="button" class="chip" data-cdev="washer" aria-pressed="${dev === "washer"}">غسالات</button></div>
   <input id="lib-q" class="lib-q" type="search" placeholder="الكود أو الشركة… مثال: E1، H6، Gree" value="${esc(LIBF.q)}" dir="ltr">
   <div class="list">${list.map((x, k) => `<details class="codebox"><summary><b class="mono">${esc(x.c)}</b> <span class="stat">${esc(x.b)}${x.f ? " · " + esc(String(x.f).slice(0, 60)) : ""}</span><br>${esc(x.t)}</summary>
     ${x.m ? `<p class="stat">${esc(x.m)}</p>` : ""}${(x.causes || []).length ? `<b>الأسباب المحتملة</b><ul class="ev">${x.causes.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : ""}${(x.checks || []).length ? `<b>الفحوصات</b><ol class="ev">${x.checks.map((c) => `<li>${esc(c)}</li>`).join("")}</ol>` : ""}${(x.parts || []).length ? `<div class="bar">${x.parts.map((p) => `<span class="pill">${esc(p)}</span>`).join("")}</div>` : ""}${x.src ? `<div><a href="${esc(x.src)}" target="_blank" rel="noopener noreferrer">المصدر</a></div>` : ""}
     <button class="btn sm" type="button" data-diag-code="${k}" style="margin-top:8px">شخّص هذا العطل</button></details>`).join("") || '<div class="stat">لا توجد نتائج.</div>'}</div>`;
  $$("[data-cdev]", body).forEach((b) => b.addEventListener("click", () => { LIBF.dev = b.dataset.cdev; libCodes(); }));
  const qi = $("#lib-q"); qi.addEventListener("input", () => { LIBF.q = qi.value; const pos = qi.selectionStart; libCodes(); const nn = $("#lib-q"); nn.focus(); nn.setSelectionRange(pos, pos); });
  $$("[data-diag-code]", body).forEach((b) => b.addEventListener("click", () => { const x = list[+b.dataset.diagCode]; CUR = null; F.device = x.d; F.brand = x.b; F.series = ""; F.error_code = String(x.c).split(/[\/,]/)[0].trim(); F.symptoms = new Set(["error_code"].filter((k) => SYM[x.d][k])); setTab("diag"); }));
}
function libModels() {
  const body = $("#lib-body"); const dev = ["fridge", "ac", "washer"].includes(LIBF.dev) ? LIBF.dev : "fridge"; LIBF.dev = dev;
  const q = normA(LIBF.mq || ""), b = LIBF.mb || "";
  const all = (KB.families || []).filter((f) => f.d === dev);
  const list = all.filter((f) => (!b || f.b === b) && (!q || normA([f.b, f.series, (f.prefixes || []).join(" "), f.type, f.refrigerant, f.compressor, f.motor].join(" ")).includes(q)));
  const brands = [...new Set(all.map((f) => f.b))].sort();
  body.innerHTML = `<div class="chips" style="margin-bottom:10px">${["fridge", "ac", "washer"].map((k) => `<button type="button" class="chip" data-mdev="${k}" aria-pressed="${dev === k}">${DEVICES[k].ar}</button>`).join("")}</div>
   <div class="mgrid">${cbHTML({ id: "lmb", label: "الشركة", items: [{ v: "", l: "كل الشركات" }, ...brands.map((x) => ({ v: x, l: x, s: `${all.filter((f) => f.b === x).length} سلسلة` }))], value: b, dir: "ltr", onChange: (v) => { LIBF.mb = v; libModels(); } })}
   <div class="field"><label for="lib-mq">بحث</label><input id="lib-mq" class="lib-q" type="search" placeholder="السلسلة أو أول رقم الموديل أو الفريون…" value="${esc(LIBF.mq || "")}" dir="ltr"></div></div>
   <div class="stat" style="margin:6px 0">${list.length} سلسلة · مصدر كل سلسلة ورابط الـ manual داخل البطاقة</div>
   <div class="list">${list.slice(0, 60).map((f, k) => `<div>${familyCard(f)}<button class="btn sm" type="button" data-diag-fam="${k}" style="margin:-4px 0 10px">شخّص عطل لهذا الموديل</button></div>`).join("") || '<div class="stat">لا توجد نتائج.</div>'}</div>`;
  cbBind(body);
  $$("[data-mdev]", body).forEach((x) => x.addEventListener("click", () => { LIBF.dev = x.dataset.mdev; LIBF.mb = ""; libModels(); }));
  const qi = $("#lib-mq"); qi.addEventListener("input", () => { LIBF.mq = qi.value; const pos = qi.selectionStart; libModels(); const nn = $("#lib-mq"); nn.focus(); nn.setSelectionRange(pos, pos); });
  $$("[data-diag-fam]", body).forEach((x) => x.addEventListener("click", () => { const f = list[+x.dataset.diagFam]; CUR = null; F.device = f.d; F.brand = f.b; F.series = famKey(f); F.error_code = ""; F.symptoms = new Set(); F.obs = f.refrigerant ? { refrigerant: f.refrigerant } : {}; setTab("diag"); }));
}
async function libManuals() {
  const body = $("#lib-body");
  body.innerHTML = `${devChips()}<div class="busy"><svg class="loader" aria-hidden="true"><use href="#g-split"/></svg>جارِ التحميل…</div>`;
  bindDevChips(libManuals);
  const j = await I().rpc("svc_manuals", { p_code: I().CODE, p_device: I().DEV, p_dev: LIBF.dev === "general" ? "" : LIBF.dev, p_brand: "" }).catch(() => null);
  if (!j || !j.ok) { body.insertAdjacentHTML("beforeend", '<div class="msg bad">تعذّر التحميل.</div>'); return; }
  const by = {}; j.manuals.forEach((m) => { (by[m.brand || "—"] = by[m.brand || "—"] || []).push(m); });
  $(".busy", body).outerHTML = `<div class="stat" style="margin-bottom:8px">تُجمع الكتيبات تلقائياً من كل تشخيص، وتراجعها الإدارة. الحالات المحلولة التي تعلّمت منها المنصة: <b>${j.learned}</b></div>
    ${Object.keys(by).sort().map((b) => `<details class="codebox" open><summary><b>${esc(b)}</b> <span class="stat">(${by[b].length})</span></summary><ul class="src">${by[b].map((m) => `<li><a href="${esc(m.url)}" target="_blank" rel="noopener noreferrer">${esc(m.title)}</a> <span class="stat">${esc(m.model || "")} · ${esc(m.kind)}${m.verified ? " · ✓" : ""}</span></li>`).join("")}</ul></details>`).join("") || '<div class="stat">لا توجد كتيبات بعد. ستظهر هنا مع أول تشخيصات.</div>'}`;
}

/* ================= ADMIN: cases & manuals ================= */
async function adminCases(note) {
  const AP = I().AP;
  let j; try { j = await I().rpc("svc_admin", { p_pass: AP, p_action: "list", p_args: {} }); } catch (e) { j = null; }
  if (!j || !j.ok) { I().setSheet(`<div class="sheet-head"><h2 class="t">الحالات والتعلّم</h2><button class="x" type="button" data-back-adm>→</button></div><div class="msg bad">تعذّر التحميل.</div>`); bindAdm(); return; }
  const S = j.stats, ST = { open: ["مفتوحة", "warn"], resolved: ["تم الإصلاح", "ok"], unresolved: ["لم تُحل", "bad"] };
  I().setSheet(`<div class="adm"><div class="sheet-head"><h2 class="t">الحالات والتعلّم الذاتي</h2><button class="x" type="button" data-back-adm aria-label="رجوع">→</button></div>
   ${note ? `<div class="msg ${note.c}">${esc(note.t)}</div>` : ""}
   <div class="kpis"><div><b>${S.total}</b><span>حالة</span></div><div><b>${S.resolved}</b><span>تم إصلاحها</span></div><div><b>${S.unresolved}</b><span>لم تُحل</span></div><div><b>${S.open}</b><span>مفتوحة</span></div><div><b>${S.avg_rating ?? "—"}</b><span>تقييم</span></div><div><b>${S.verified}</b><span>مرجعية</span></div></div>
   <div class="stat">«حالة مرجعية» تعطي الحالة وزناً أكبر عند تشخيص الحالات المشابهة.</div>
   <div class="codes">${j.cases.map((c) => `<div class="xrow" data-cid="${c.id}"><div><b>#${c.id}</b> ${esc(DEVICES[c.device]?.ar || c.device)} · ${esc(c.brand)} ${esc(c.model)} ${c.error_code ? `<span class="pill">${esc(c.error_code)}</span>` : ""} <span class="spill ${(ST[c.status] || ST.open)[1]}">${(ST[c.status] || ST.open)[0]}</span>
     <div class="stat">${esc(c.tech || "")} · ${new Date(c.created_at).toLocaleDateString("en-GB")}${c.confidence != null ? ` · ثقة ${c.confidence}%` : ""}${c.rating ? ` · ★${c.rating}` : ""}</div>
     <div class="stat">توقّع المهندس: ${esc(c.top_cause || c.headline || "—")}</div>${c.actual_cause ? `<div class="stat">السبب الفعلي: <b>${esc(c.actual_cause)}</b>${(c.parts || []).length ? ` · قطع: ${esc(c.parts.join("، "))}` : ""}</div>` : ""}</div>
     <div class="bar"><button class="tog ${c.verified ? "on" : "off"}" type="button" data-ca="case_verify">${c.verified ? "مرجعية ✓" : "اجعلها مرجعية"}</button><button class="btn ghost sm" type="button" data-ca="case_delete">حذف</button></div></div>`).join("") || '<div class="stat">لا توجد حالات بعد.</div>'}</div>
   <h3 class="sec">الكتيبات (${j.manuals.length})</h3>
   <form class="bar" id="mn-add" autocomplete="off"><select id="mn-dev" style="width:auto"><option value="fridge">براد</option><option value="coldroom">غرفة تبريد</option><option value="ac">مكيف</option><option value="washer">غسالة</option></select><input id="mn-brand" placeholder="الشركة" style="flex:1 1 90px"><input id="mn-model" placeholder="الموديل" dir="ltr" style="flex:1 1 90px"><input id="mn-url" placeholder="https://…" dir="ltr" style="flex:2 1 160px"><input id="mn-title" placeholder="العنوان" style="flex:2 1 120px"><button class="btn sm" type="submit">+ إضافة</button></form>
   <div class="codes">${j.manuals.map((m) => `<div class="xrow" data-mid="${m.id}"><div><a href="${esc(m.url)}" target="_blank" rel="noopener noreferrer">${esc(m.title)}</a><div class="stat">${esc(DEVICES[m.device]?.ar || m.device)} · ${esc(m.brand)} ${esc(m.model)} · ${esc(m.kind)} · ${esc(m.added_by || "")}</div></div><div class="bar"><button class="tog ${m.verified ? "on" : "off"}" type="button" data-ma="manual_verify">${m.verified ? "موثّق" : "غير موثّق"}</button><button class="btn ghost sm" type="button" data-ma="manual_delete">حذف</button></div></div>`).join("")}</div></div>`);
  bindAdm();
  const act = async (a, args, t) => { try { const r = await I().rpc("svc_admin", { p_pass: AP, p_action: a, p_args: args }); adminCases(r.ok ? { t, c: "ok" } : { t: "تعذّر التنفيذ.", c: "bad" }); } catch (e) { adminCases({ t: "تعذّر الاتصال.", c: "bad" }); } };
  $$("[data-ca]").forEach((b) => b.addEventListener("click", () => { const id = +b.closest("[data-cid]").dataset.cid; if (b.dataset.ca === "case_delete" && !b.dataset.sure) { b.dataset.sure = 1; b.textContent = "تأكيد الحذف"; return; } act(b.dataset.ca, { id }, "تم."); }));
  $$("[data-ma]").forEach((b) => b.addEventListener("click", () => { const id = +b.closest("[data-mid]").dataset.mid; if (b.dataset.ma === "manual_delete" && !b.dataset.sure) { b.dataset.sure = 1; b.textContent = "تأكيد الحذف"; return; } act(b.dataset.ma, { id }, "تم."); }));
  $("#mn-add").addEventListener("submit", (e) => { e.preventDefault(); const url = $("#mn-url").value.trim(); if (!/^https?:\/\//.test(url)) return; act("manual_add", { device: $("#mn-dev").value, brand: $("#mn-brand").value.trim(), model: $("#mn-model").value.trim(), url, title: $("#mn-title").value.trim(), kind: "service" }, "تمت إضافة الكتيب."); });
}
function bindAdm() { $$("[data-back-adm]").forEach((b) => b.addEventListener("click", () => I().adminPanel())); }

/* ================= init ================= */
async function init() {
  if (ready) return; ready = true;
  $$(".svc-tab").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));
  await loadKB();
  let t = "diag"; try { t = localStorage.getItem("icool_tab") || "diag"; } catch (e) {}
  setTab(["diag", "lib", "cmp", "cases", "acad"].includes(t) ? t : "diag");
}
window.SVC = { init, adminCases, openGuide, setTab, makeStepper, loadKB, cbHTML, cbBind, esc, icon, DEVICES, get KB() { return KB; } };
if (window.ICOOL && window.ICOOL.loggedIn) init(); else document.addEventListener("icool:login", init);
})();
