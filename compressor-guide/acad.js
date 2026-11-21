/* iCOOL Academy — courses, lessons, quizzes, certificates (uses window.ICOOL + window.SVC) */
(function () {
"use strict";
const I = () => window.ICOOL, S = () => window.SVC;
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const PASS = 70;
const DOM_AR = { general: "عام", fridge: "برادات", coldroom: "غرف تبريد", ac: "مكيفات", washer: "غسالات" };
let ST = null; // {name, progress:[], certs:[]}
let VIEW = { v: "home" };

const courses = () => ((S().KB && S().KB.courses) || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
const course = (id) => courses().find((c) => c.id === id);
const prog = (lid) => (ST && ST.progress || []).find((p) => p.lesson === lid);
const cert = (cid) => (ST && ST.certs || []).find((c) => c.course === cid);
const done = (c) => c.lessons.filter((l) => prog(l.id) && prog(l.id).passed).length;
const logoSrc = () => { const im = document.querySelector(".logo-plate img"); return im ? im.src : ""; };
const host = () => $("#tab-acad");

async function loadState() {
  const j = await I().rpc("acad_state", { p_code: I().CODE, p_device: I().DEV }).catch(() => null);
  ST = j && j.ok ? j : { name: "", progress: [], certs: [] };
}

async function render() {
  const el = host(); if (!el) return;
  if (!S().KB) { el.innerHTML = '<div class="busy">جارِ التحميل…</div>'; await S().loadKB(); }
  if (!ST) { el.innerHTML = '<div class="busy">جارِ تحميل تقدّمك…</div>'; await loadState(); }
  if (!courses().length) { el.innerHTML = '<div class="empty"><span>الأكاديمية قيد التحضير.</span></div>'; return; }
  ({ home: home, course: courseView, lesson: lessonView, cert: certView })[VIEW.v]();
  window.scrollTo({ top: 0 });
}
const go = (v) => { VIEW = v; render(); };

/* ---------- home ---------- */
function ringPct(p) { const r = 22, c = 2 * Math.PI * r; return `<svg class="ac-ring" viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="${r}" fill="none" stroke="var(--sunk)" stroke-width="6"/><circle cx="28" cy="28" r="${r}" fill="none" stroke="url(#acg)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(c * p / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 28 28)"/><defs><linearGradient id="acg"><stop offset="0" stop-color="var(--blue)"/><stop offset="1" stop-color="var(--orange)"/></linearGradient></defs><text x="28" y="32" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor">${p}%</text></svg>`; }
function home() {
  const cs = courses(); const totL = cs.reduce((a, c) => a + c.lessons.length, 0), doneL = cs.reduce((a, c) => a + done(c), 0);
  const pct = totL ? Math.round(doneL * 100 / totL) : 0; const nCert = cs.filter((c) => cert(c.id)).length; const big = cert("all");
  host().innerHTML = `<section class="ac-hero"><div><h2>🎓 أكاديمية iCOOL</h2><p>دورات عملية بخطوات تفاعلية واختبارات. أنهِ دروس كل دورة بنجاح (${PASS}% أو أكثر) لتحصل على شهادة iCOOL للدورة، وأنهِ كل الدورات لتحصل على شهادة <b>فني iCOOL معتمد</b>.</p>
      <div class="bar">${big ? `<button class="btn warn sm" type="button" data-cert="all">🏅 شهادتك الشاملة</button>` : nCert === cs.length ? `<button class="btn warn sm" type="button" data-claim="all">🏅 استلم شهادة فني iCOOL معتمد</button>` : `<span class="stat">الشهادات: ${nCert} / ${cs.length} دورات</span>`}</div></div>
      <div class="ac-stat">${ringPct(pct)}<small>${doneL} / ${totL} درس</small></div></section>
    <div class="ac-grid">${cs.map((c) => { const d = done(c), n = c.lessons.length, ce = cert(c.id); return `<button type="button" class="ac-card ${c.domain}" data-course="${esc(c.id)}">
      <span class="ac-ic">${S().icon(c.domain === "general" ? "general" : c.domain)}</span>
      <span class="ac-meta"><span class="pill">${esc(c.level || "")}</span><span class="pill">${esc(DOM_AR[c.domain] || "")}</span>${c.hours ? `<span class="pill">${c.hours} س</span>` : ""}</span>
      <b>${esc(c.title_ar)}</b><small>${esc(c.desc_ar || "")}</small>
      <span class="ac-bar"><i style="width:${n ? d * 100 / n : 0}%"></i></span>
      <span class="stat">${ce ? "🏅 حاصل على الشهادة" : `${d} / ${n} درس`}</span></button>`; }).join("")}</div>`;
  $$("[data-course]").forEach((b) => b.addEventListener("click", () => go({ v: "course", c: b.dataset.course })));
  bindCertBtns();
}

/* ---------- course ---------- */
function courseView() {
  const c = course(VIEW.c); if (!c) return go({ v: "home" });
  const d = done(c), n = c.lessons.length, ce = cert(c.id);
  const nextL = c.lessons.find((l) => !(prog(l.id) && prog(l.id).passed));
  host().innerHTML = `<button class="btn ghost sm" type="button" data-back>→ كل الدورات</button>
    <section class="ac-head ${c.domain}"><div><div class="stat">${esc(c.level || "")} · ${esc(DOM_AR[c.domain] || "")} · ${n} دروس</div><h2>${esc(c.title_ar)}</h2><p>${esc(c.desc_ar || "")}</p>
      <div class="ac-bar"><i style="width:${n ? d * 100 / n : 0}%"></i></div><div class="bar" style="margin-top:8px">
      ${ce ? `<button class="btn warn sm" type="button" data-cert="${esc(c.id)}">🏅 عرض الشهادة</button>` : d === n ? `<button class="btn warn sm" type="button" data-claim="${esc(c.id)}">🏅 استلم شهادة الدورة</button>` : nextL ? `<button class="btn sm" type="button" data-lesson="${esc(nextL.id)}">${d ? "تابع" : "ابدأ"}: ${esc(nextL.title_ar)}</button>` : ""}</div></div></section>
    <ol class="ac-lessons">${c.lessons.map((l, i) => { const p = prog(l.id); return `<li><button type="button" class="ac-l ${p && p.passed ? "ok" : p ? "try" : ""}" data-lesson="${esc(l.id)}">
      <span class="ac-n">${p && p.passed ? "✓" : i + 1}</span><span><b>${esc(l.title_ar)}</b><small class="stat">${l.minutes ? l.minutes + " دقيقة · " : ""}${(l.quiz || []).length} أسئلة${p ? ` · أفضل نتيجة ${p.score}/${p.total}` : ""}</small></span></button></li>`; }).join("")}</ol>`;
  $("[data-back]").addEventListener("click", () => go({ v: "home" }));
  $$("[data-lesson]").forEach((b) => b.addEventListener("click", () => go({ v: "lesson", c: c.id, l: b.dataset.lesson })));
  bindCertBtns();
}

/* ---------- lesson: slides → practice → steps → quiz ---------- */
const VIZ_OK = () => !!(window.ACV && Object.keys(window.ACV.W).length);
function vizBlock(v) { return `<figure class="ac-viz" data-viz='${esc(JSON.stringify({ w: v.w, p: v.p || {} }))}'>${v.title ? `<figcaption class="ac-viz-t">${esc(v.title)}</figcaption>` : ""}<div class="ac-viz-h"></div>${v.cap ? `<div class="acv-cap">${esc(v.cap)}</div>` : ""}</figure>`; }
function mountViz(root) {
  $$(".ac-viz", root).forEach((f) => { if (f.dataset.done) return; f.dataset.done = "1";
    let spec; try { spec = JSON.parse(f.dataset.viz); } catch (e) { f.remove(); return; }
    if (!window.ACV || !window.ACV.render($(".ac-viz-h", f), spec, { kb: S().KB })) f.remove(); });
}
function lessonView() {
  const c = course(VIEW.c); const idx = c ? c.lessons.findIndex((l) => l.id === VIEW.l) : -1; if (idx < 0) return go({ v: "home" });
  const l = c.lessons[idx], p = prog(l.id), nx = c.lessons[idx + 1];
  const vis = (l.visuals || []).filter((v) => !VIZ_OK() || window.ACV.W[v.w]);
  const body = l.body_ar || [];
  // slides: one per paragraph, with the visuals placed at that paragraph; then key points
  const slides = body.map((t, i) => ({ t, v: vis.filter((v) => (v.at == null ? 0 : v.at) === i) }));
  const practice = vis.filter((v) => v.at === "practice" || (typeof v.at === "number" && v.at >= body.length));
  const list = (t, arr, cls) => (arr || []).length ? `<div class="ac-box ${cls}"><b>${t}</b><ul>${arr.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : "";
  const guides = (l.guide_refs || []).map((id) => (S().KB.guides || []).find((g) => g.id === id)).filter(Boolean);
  const secs = [["learn", "📖 الشرح"], ...(practice.length ? [["practice", "🧪 جرّب بنفسك"]] : []), ...((l.steps || []).length ? [["steps", "🛠 خطوات عملية"]] : []), ["quiz", "📝 الاختبار"]];
  host().innerHTML = `<button class="btn ghost sm" type="button" data-back>→ ${esc(c.title_ar)}</button>
    <article class="ac-lesson"><div class="stat">الدرس ${idx + 1} من ${c.lessons.length}${l.minutes ? ` · ${l.minutes} دقيقة` : ""}${p && p.passed ? " · ✓ ناجح" : ""}</div><h2>${esc(l.title_ar)}</h2>
      <nav class="ac-secs" role="tablist">${secs.map(([k, t], i) => `<button type="button" role="tab" class="ac-sec" data-sec="${k}" aria-selected="${i === 0}">${t}</button>`).join("")}</nav>
      <section class="ac-pane" data-pane="learn">
        <div class="ac-deck">${slides.map((sl, i) => `<div class="ac-slide" data-i="${i}" ${i ? "hidden" : ""}><p class="ac-lead">${esc(sl.t)}</p>${sl.v.map(vizBlock).join("")}</div>`).join("")}
          <div class="ac-slide" data-i="${slides.length}" ${slides.length ? "hidden" : ""}>${list("🔑 نقاط يجب حفظها", l.key_points, "key")}<div class="ac-two">${list("🧰 العدّة", l.tools, "tools")}${list("⚠️ السلامة", l.safety, "safe")}</div>${list("❌ أخطاء شائعة عند المعلمين", l.mistakes, "bad")}
            ${guides.length ? `<div class="ac-box"><b>📚 أدلة مرتبطة في المكتبة</b><div class="bar">${guides.map((g) => `<button class="btn ghost sm" type="button" data-guide="${esc(g.id)}">${esc(g.title_ar)}</button>`).join("")}</div></div>` : ""}</div></div>
        <div class="ac-dnav"><button class="btn ghost sm" type="button" data-sl="-1">→ السابق</button><span class="ac-dots">${[...slides, 1].map((_, i) => `<i data-d="${i}" class="${i ? "" : "on"}"></i>`).join("")}</span><button class="btn sm" type="button" data-sl="1">التالي ←</button></div>
      </section>
      ${practice.length ? `<section class="ac-pane" data-pane="practice" hidden><p class="stat">جرّب بيدك: حرّك، اضغط، واختر — هكذا تتثبّت المعلومة.</p>${practice.map(vizBlock).join("")}<div class="bar"><button class="btn sm" type="button" data-goto="${secs[2] ? secs[2][0] : "quiz"}">التالي ←</button></div></section>` : ""}
      ${(l.steps || []).length ? `<section class="ac-pane" data-pane="steps" hidden><div id="ac-steps"></div><div class="bar" style="margin-top:10px"><button class="btn sm" type="button" data-goto="quiz">إلى الاختبار ←</button></div></section>` : ""}
      <section class="ac-pane" data-pane="quiz" hidden><div id="ac-quiz"></div><div id="ac-after"></div></section>
      <div class="bar ac-nav">${idx > 0 ? `<button class="btn ghost sm" type="button" data-lesson="${esc(c.lessons[idx - 1].id)}">→ الدرس السابق</button>` : ""}<span class="sp"></span>${nx ? `<button class="btn ghost sm" type="button" data-lesson="${esc(nx.id)}">الدرس التالي ←</button>` : ""}</div>
    </article>`;
  const art = $(".ac-lesson");
  $("[data-back]").addEventListener("click", () => go({ v: "course", c: c.id }));
  $$("[data-lesson]", art).forEach((b) => b.addEventListener("click", () => go({ v: "lesson", c: c.id, l: b.dataset.lesson })));
  $$("[data-guide]", art).forEach((b) => b.addEventListener("click", () => { S().setTab("lib"); setTimeout(() => S().openGuide(b.dataset.guide), 50); }));
  // sections
  let stepsMade = false, quizMade = false;
  const show = (k) => { $$(".ac-sec", art).forEach((b) => b.setAttribute("aria-selected", b.dataset.sec === k)); $$(".ac-pane", art).forEach((x) => { x.hidden = x.dataset.pane !== k; });
    const pane = $(`[data-pane="${k}"]`, art); mountViz(pane);
    if (k === "steps" && !stepsMade) { stepsMade = true; S().makeStepper($("#ac-steps"), l.steps, [], null, { learn: true }); }
    if (k === "quiz" && !quizMade) { quizMade = true; quiz(c, l, nx); }
    $(".ac-secs", art).scrollIntoView({ behavior: "smooth", block: "start" }); };
  $$(".ac-sec", art).forEach((b) => b.addEventListener("click", () => show(b.dataset.sec)));
  $$("[data-goto]", art).forEach((b) => b.addEventListener("click", () => show(b.dataset.goto)));
  // slides
  let cur = 0; const n = slides.length + 1;
  const deck = $(".ac-deck", art);
  const slide = (i) => { cur = Math.max(0, Math.min(n - 1, i));
    $$(".ac-slide", deck).forEach((x) => { x.hidden = +x.dataset.i !== cur; });
    $$(".ac-dots i", art).forEach((d) => d.classList.toggle("on", +d.dataset.d <= cur));
    $('[data-sl="-1"]', art).disabled = cur === 0;
    const nb = $('[data-sl="1"]', art); nb.textContent = cur === n - 1 ? (secs[1] ? `${secs[1][1]} ←` : "التالي ←") : "التالي ←";
    mountViz($(`.ac-slide[data-i="${cur}"]`, deck)); };
  $('[data-sl="-1"]', art).addEventListener("click", () => { slide(cur - 1); deck.scrollIntoView({ behavior: "smooth", block: "nearest" }); });
  $('[data-sl="1"]', art).addEventListener("click", () => { if (cur === n - 1) { show(secs[1][0]); return; } slide(cur + 1); $(".ac-secs", art).scrollIntoView({ behavior: "smooth", block: "start" }); });
  let x0 = null; deck.addEventListener("touchstart", (e) => { if (e.target.closest(".ac-viz")) { x0 = null; return; } x0 = e.touches[0].clientX; }, { passive: true });
  deck.addEventListener("touchend", (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 60) slide(cur + (dx > 0 ? 1 : -1)); x0 = null; });
  slide(0);
}

function quiz(c, l, nx) {
  const qs = l.quiz || [], box = $("#ac-quiz"); let i = 0, sc = 0;
  if (!qs.length) { box.innerHTML = '<p class="stat">لا يوجد اختبار لهذا الدرس.</p>'; return; }
  const draw = () => {
    const q = qs[i];
    box.innerHTML = `<div class="ac-qbar"><span>سؤال ${i + 1} من ${qs.length}</span><span class="ac-bar"><i style="width:${i * 100 / qs.length}%"></i></span><span>✓ ${sc}</span></div>
      <div class="ac-q1"><p class="ac-qq">${esc(q.q)}</p>${q.options.map((o, k) => `<button type="button" class="ac-ans" data-k="${k}"><span class="ac-ak">${"أبجد"[k] || k + 1}</span><span>${esc(o)}</span></button>`).join("")}
      <div class="ac-why" hidden></div><div class="bar"><button class="btn sm" type="button" id="ac-qnext" hidden>${i + 1 < qs.length ? "السؤال التالي ←" : "النتيجة ←"}</button></div></div>`;
    $$(".ac-ans", box).forEach((b) => b.addEventListener("click", () => {
      if (box.dataset.locked === "1") return; box.dataset.locked = "1";
      const k = +b.dataset.k, ok = k === q.a; if (ok) sc++;
      $$(".ac-ans", box).forEach((x) => { const kk = +x.dataset.k; x.disabled = true; x.classList.toggle("right", kk === q.a); x.classList.toggle("wrong", kk === k && !ok); });
      const w = $(".ac-why", box); w.hidden = false; w.className = "ac-why " + (ok ? "ok" : "bad"); w.innerHTML = `<b>${ok ? "✓ صحيح" : "✗ ليس هذا"}</b> — ${esc(q.why || "")}`;
      const nb = $("#ac-qnext"); nb.hidden = false; nb.focus();
      nb.addEventListener("click", () => { box.dataset.locked = ""; i++; if (i < qs.length) draw(); else finish(); });
    }));
  };
  const finish = async () => {
    const pass = sc * 100 >= qs.length * PASS;
    box.innerHTML = `<div class="ac-res ${pass ? "ok" : "bad"}"><div class="ac-res-n">${sc} / ${qs.length}</div><div>${Math.round(sc * 100 / qs.length)}% — ${pass ? "🎉 نجحت" : "لم تنجح بعد (المطلوب " + PASS + "%)"}</div><div class="stat" id="ac-qmsg">جارِ الحفظ…</div></div>`;
    const j = await I().rpc("acad_submit", { p_code: I().CODE, p_device: I().DEV, p_course: c.id, p_lesson: l.id, p_score: sc, p_total: qs.length }).catch(() => null);
    $("#ac-qmsg").textContent = j && j.ok ? "تم حفظ النتيجة" : "تعذّر حفظ النتيجة (تحقّق من الإنترنت).";
    await loadState();
    const fin = done(c) === c.lessons.length && !cert(c.id);
    $("#ac-after").innerHTML = `<div class="bar" style="justify-content:center;margin-top:10px">${pass && nx ? `<button class="btn sm" type="button" data-lesson="${esc(nx.id)}">الدرس التالي ←</button>` : ""}${fin ? `<button class="btn warn sm" type="button" data-claim="${esc(c.id)}">🏅 استلم شهادة الدورة</button>` : ""}<button class="btn ghost sm" type="button" data-retry>${pass ? "أعد الاختبار" : "إعادة الاختبار"}</button>${!pass ? `<button class="btn ghost sm" type="button" data-relearn>راجع الشرح</button>` : ""}</div>`;
    $$("#ac-after [data-lesson]").forEach((b) => b.addEventListener("click", () => go({ v: "lesson", c: c.id, l: b.dataset.lesson })));
    $("#ac-after [data-retry]").addEventListener("click", () => { $("#ac-after").innerHTML = ""; i = 0; sc = 0; draw(); });
    const rl = $("#ac-after [data-relearn]"); if (rl) rl.addEventListener("click", () => $('.ac-sec[data-sec="learn"]').click());
    bindCertBtns();
  };
  draw();
}

/* ---------- certificates ---------- */
function bindCertBtns() {
  $$("[data-cert]").forEach((b) => b.addEventListener("click", () => go({ v: "cert", c: b.dataset.cert })));
  $$("[data-claim]").forEach((b) => b.addEventListener("click", () => claim(b.dataset.claim)));
}
function claim(cid) {
  I().setSheet(`<h3>🏅 إصدار الشهادة</h3><p class="stat">اكتب اسمك الكامل كما تريده أن يظهر على الشهادة. لا يمكن تغييره لاحقاً.</p>
    <form id="cl-f" autocomplete="off"><div class="field"><label for="cl-n">الاسم الكامل</label><input id="cl-n" value="${esc(ST && ST.name || "")}" required minlength="3"></div>
    <div class="bar"><button class="btn warn" type="submit">إصدار</button><button class="btn ghost" type="button" id="cl-x">إلغاء</button></div><div class="msg bad" id="cl-m" hidden></div></form>`);
  $("#cl-x").addEventListener("click", () => I().closeSheet());
  $("#cl-f").addEventListener("submit", async (e) => {
    e.preventDefault(); const m = $("#cl-m");
    const j = await I().rpc("acad_cert", { p_code: I().CODE, p_device: I().DEV, p_course: cid, p_name: $("#cl-n").value.trim() }).catch(() => null);
    if (!j || !j.ok) { m.textContent = j && j.err === "incomplete" ? `لم تكتمل الدروس بعد (${j.got} / ${j.need}).` : j && j.err === "name" ? "اكتب الاسم الكامل." : "تعذّر إصدار الشهادة."; m.hidden = false; return; }
    I().closeSheet(); await loadState(); go({ v: "cert", c: cid });
  });
}
function certHTML(ce) {
  const url = `${location.origin}${location.pathname}?cert=${encodeURIComponent(ce.serial)}`;
  const dt = new Date(ce.issued_at).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  return `<div class="cert" id="cert-card"><div class="cert-in">
    <div class="cert-top"><img src="${logoSrc()}" alt="iCOOL"><span>iCOOL ACADEMY</span></div>
    <div class="cert-k">شهادة إتمام</div><div class="cert-en">Certificate of Completion</div>
    <p class="cert-l">تشهد أكاديمية iCOOL بأن</p><div class="cert-name">${esc(ce.name)}</div>
    <p class="cert-l">أتمّ بنجاح متطلبات</p><div class="cert-title">${esc(ce.title)}</div>
    <div class="cert-row"><div><small>التاريخ</small><b dir="ltr">${dt}</b></div>${ce.score != null ? `<div><small>المعدل</small><b dir="ltr">${ce.score}%</b></div>` : ""}<div><small>الرقم التسلسلي</small><b class="mono">${esc(ce.serial)}</b></div></div>
    <div class="cert-ver">للتحقق: <span dir="ltr">${esc(url)}</span></div></div></div>`;
}
function certView() {
  const ce = cert(VIEW.c); if (!ce) return go({ v: "home" });
  const url = `${location.origin}${location.pathname}?cert=${encodeURIComponent(ce.serial)}`;
  const msg = `شهادة iCOOL Academy — ${ce.title}\n${ce.name}\nللتحقق: ${url}`;
  host().innerHTML = `<button class="btn ghost sm" type="button" data-back>→ الأكاديمية</button>${certHTML(ce)}
    <div class="bar" style="justify-content:center;margin-top:12px"><button class="btn" type="button" id="ce-print">🖨 طباعة / حفظ PDF</button><a class="btn ghost" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener noreferrer">مشاركة على واتساب</a></div>`;
  $("[data-back]").addEventListener("click", () => go({ v: "home" }));
  $("#ce-print").addEventListener("click", () => { document.body.classList.add("printing-cert"); window.print(); setTimeout(() => document.body.classList.remove("printing-cert"), 500); });
}

/* public verification: ?cert=SERIAL (works without a subscription) */
async function verify() {
  const s = new URLSearchParams(location.search).get("cert"); if (!s) return;
  const j = await I().rpc("acad_verify", { p_serial: s }).catch(() => null);
  const d = document.createElement("div"); d.className = "cert-verify";
  d.innerHTML = j && j.ok ? `<div class="msg ${j.revoked ? "bad" : "ok"}">${j.revoked ? "⚠️ هذه الشهادة ملغاة." : "✓ شهادة صحيحة صادرة عن أكاديمية iCOOL"}</div>${certHTML(j)}<div class="bar" style="justify-content:center"><button class="btn ghost" type="button" id="cv-x">إغلاق</button></div>`
    : `<div class="msg bad">لا توجد شهادة بهذا الرقم: <span class="mono">${esc(s)}</span></div><div class="bar" style="justify-content:center"><button class="btn ghost" type="button" id="cv-x">إغلاق</button></div>`;
  document.body.appendChild(d);
  $("#cv-x").addEventListener("click", () => { d.remove(); history.replaceState(null, "", location.pathname); });
}

window.ACAD = { render: () => { if (VIEW.v === "lesson" && !host().innerHTML) VIEW = { v: "home" }; render(); }, reset: () => { ST = null; VIEW = { v: "home" }; } };
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", verify); else verify();
})();
