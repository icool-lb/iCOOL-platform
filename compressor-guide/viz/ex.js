/* iCOOL Academy — group "ex": interactive exercises, calculators and simulators.
   Widgets: order, match, tree, reveal, calc, circuit, timeline, torque, controller */
(function () {
  "use strict";
  const A = window.ACV; if (!A) return;
  const esc = A.esc, S = A.svgEl;
  const uid = () => Math.random().toString(36).slice(2, 8);
  const reduce = () => { try { return A.reduce(); } catch (e) { return false; } };

  /* ---------- small DOM helpers ---------- */
  function h(tag, cls, html, attrs) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function btn(label, cls, onClick, aria) {
    const b = h("button", "acv-ex-btn" + (cls ? " " + cls : ""), label, { type: "button" });
    if (aria) b.setAttribute("aria-label", aria);
    if (onClick) b.addEventListener("click", onClick);
    return b;
  }
  function head(host, title, sub) {
    const d = h("div", "acv-ex-head");
    d.innerHTML = `<div class="acv-ex-title">${esc(title)}</div>` + (sub ? `<div class="acv-ex-sub">${sub}</div>` : "");
    host.appendChild(d);
    return d;
  }
  function infoBox(host) { const d = h("div", "acv-ex-info", null, { "aria-live": "polite" }); host.appendChild(d); return d; }
  function setTone(el, tone) {
    ["ok", "bad", "warn", "blue"].forEach((t) => el.classList.toggle("acv-ex-t-" + t, t === tone));
  }
  function keyAct(el, fn, label) {
    el.setAttribute("role", "button"); el.setAttribute("tabindex", "0");
    if (label) el.setAttribute("aria-label", label);
    el.addEventListener("click", fn);
    el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(e); } });
  }
  function shuffle(a) { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }
  function range(n) { return Array.from({ length: n }, (_, i) => i); }
  const fmt = (x, d = 1) => (isFinite(x) ? Number(x).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: 0 }) : "—");
  const num = (s) => `<bdi class="acv-ex-num" dir="ltr">${s}</bdi>`;
  const isAr = (s) => /[؀-ۿ]/.test(s);
  function T(parent, x, y, str, attrs = {}) {
    const t = S("text", Object.assign({ x, y }, attrs), parent);
    t.setAttribute("direction", isAr(str) ? "rtl" : "ltr");
    t.textContent = str;
    return t;
  }
  const alive = (host) => host.isConnected;

  /* ================================================================
     1) ORDER — رتّب الخطوات
     ================================================================ */
  const ORDER_FRIDGE = {
    title: "رتّب خطوات تبديل كباس البراد",
    items: [
      "تأكيد التشخيص: قياس الملفات والعزل",
      "سحب الفريون بجهاز recovery (لا يُطلق في الهواء)",
      "فك الكباس القديم والـ filter drier",
      "تركيب الكباس الجديد و filter drier جديد",
      "اللحام مع تمرير نيتروجين خفيف داخل الأنابيب",
      "اختبار ضغط بالنيتروجين وفحص التسريب",
      "تفريغ (Vacuum) حتى 500 microns أو أقل، واختبار الثبات",
      "شحن الفريون بالوزن حسب لوحة الجهاز",
      "تشغيل وقياس التيار وحرارة البراد والفريزر",
    ],
    explain: [
      "لا تبدّل كباساً سليماً: C-S + C-R = R-S، والعزل للأرض ≥ 2 MΩ.",
      "قانوناً وأماناً — خاصة مع R600a القابل للاشتعال (A3): تهوية ولا شرر.",
      "الـ filter drier القديم مشبع رطوبة ويجب تبديله دائماً.",
      "نفس نوع الفريون والقدرة (LBP/MBP) والجهد.",
      "النيتروجين يمنع تكوّن الأكسيد (القشور) داخل الأنبوب.",
      "يكشف التسريب قبل أن تخسر وقت الـ vacuum والفريون.",
      "≤ 500 microns ثم أغلق وراقب: يجب أن يبقى تحت 1000 microns.",
      "البرادات حساسة للشحنة: بالغرام على الميزان وليس بالضغط.",
      "قارن التيار مع اللوحة وراقب الصقيع على كامل الـ evaporator.",
    ],
  };
  const ORDER_AC = {
    title: "رتّب خطوات تركيب مكيّف Split",
    items: [
      "تثبيت لوح الوحدة الداخلية على الـ level",
      "ثقب الجدار بميل خفيف نحو الخارج",
      "تمديد الأنابيب والكابل والـ drain",
      "عمل الـ flare وشدّ الـ nuts بعزم الـ torque الصحيح",
      "اختبار ضغط بالنيتروجين حسب الـ manual",
      "تفريغ (Vacuum) حتى 500 microns أو أقل، واختبار الثبات",
      "فتح الـ service valves وفحص الوصلات",
      "التشغيل وقياس الضغط والتيار وحرارة الهواء",
    ],
    explain: [
      "ميل الـ level يحدد تصريف الماء داخل الوحدة.",
      "الميل للخارج يمنع رجوع الماء إلى الحائط.",
      "الـ drain دائماً بميل نزولاً بدون ارتفاعات (siphon).",
      "1/4\" = 14–18 و 3/8\" = 33–42 N·m — الشد الزائد يشقق الـ flare.",
      "نيتروجين جاف فقط، وليس أكسجين أو هواء مضغوط.",
      "الرطوبة والهواء يقتلان الزيت والكباس، خاصة POE.",
      "افتح الـ liquid ثم الـ gas بالمفتاح السداسي كاملاً.",
      "لا تحكم على الشحنة إلا بعد 10–15 دقيقة تشغيل.",
    ],
  };

  A.register("order", {
    title: "رتّب الخطوات",
    params: "title: string, items: string[] (بالترتيب الصحيح), explain?: string[] (سبب كل خطوة)",
    demo: [ORDER_FRIDGE, ORDER_AC],
    render(host, p) {
      const src = p.items && p.items.length ? p : ORDER_FRIDGE;
      const items = src.items, explain = src.explain || [], n = items.length;
      head(host, src.title || p.title || "رتّب الخطوات", "اضغط بطاقة ثم اضغط المكان الذي تريد نقلها إليه — أو استعمل الأسهم. ثم اضغط «تحقق».");
      let order = range(n);
      const reshuffle = () => { let t = 0; do { order = shuffle(range(n)); } while (n > 2 && ++t < 20 && order.some((v, i) => v === i) && order.filter((v, i) => v === i).length > n / 3); };
      reshuffle();
      let sel = -1, checked = false, moved = -1;
      const list = h("ol", "acv-ex-olist"); host.appendChild(list);
      const bar = h("div", "acv-ex-bar"); host.appendChild(bar);
      const out = infoBox(host);
      const msg = (html, tone) => { out.innerHTML = html; setTone(out, tone); };
      msg("رتّب البطاقات من أول خطوة (1) إلى آخر خطوة.", "blue");

      function move(from, to) {
        if (from === to || to < 0 || to >= n) return;
        const [it] = order.splice(from, 1); order.splice(to, 0, it);
        moved = to; checked = false; sel = -1; draw();
        const f = list.querySelector(`[data-pos="${to}"] .acv-ex-omain`); if (f) f.focus({ preventScroll: true });
      }
      function draw() {
        list.innerHTML = "";
        order.forEach((it, pos) => {
          const ok = it === pos;
          const li = h("li", "acv-ex-ocard" + (sel === pos ? " acv-ex-sel" : "") + (checked ? (ok ? " acv-ex-okc" : " acv-ex-badc") : "") + (moved === pos && !reduce() ? " acv-ex-moved" : ""), null, { "data-pos": pos });
          const main = h("button", "acv-ex-omain", `<span class="acv-ex-onum">${pos + 1}</span><span class="acv-ex-otxt">${esc(items[it])}${checked ? `<span class="acv-ex-owhy">${ok ? "✓ " : `✗ مكانها الصحيح: ${num(it + 1)} — `}${esc(explain[it] || "")}</span>` : ""}</span>`, { type: "button", "aria-pressed": sel === pos ? "true" : "false", "aria-label": `الخطوة في المكان ${pos + 1}: ${items[it]}` });
          main.addEventListener("click", () => {
            if (sel === -1) { sel = pos; draw(); const f = list.querySelector(`[data-pos="${pos}"] .acv-ex-omain`); if (f) f.focus({ preventScroll: true }); msg("الآن اضغط المكان الذي تريد نقل البطاقة إليه.", "blue"); }
            else if (sel === pos) { sel = -1; draw(); }
            else move(sel, pos);
          });
          const ctl = h("span", "acv-ex-octl");
          const up = btn("▲", "acv-ex-ico", () => move(pos, pos - 1), "إلى الأعلى"); up.disabled = pos === 0;
          const dn = btn("▼", "acv-ex-ico", () => move(pos, pos + 1), "إلى الأسفل"); dn.disabled = pos === n - 1;
          ctl.append(up, dn);
          li.append(main, ctl); list.appendChild(li);
        });
        moved = -1;
      }
      bar.append(
        btn("تحقق", "acv-ex-pri", () => {
          checked = true; sel = -1; draw();
          const good = order.filter((v, i) => v === i).length;
          if (good === n) msg(`ممتاز! كل الخطوات (${num(n)}) في مكانها الصحيح.`, "ok");
          else msg(`${num(good + " / " + n)} في المكان الصحيح. البطاقات الحمراء تحتاج نقل — اقرأ السبب تحت كل بطاقة.`, good >= n / 2 ? "warn" : "bad");
        }),
        btn("اعرض الحل", "", () => { order = range(n); checked = true; sel = -1; draw(); msg("هذا هو الترتيب الصحيح مع سبب كل خطوة.", "ok"); }),
        btn("خلط من جديد", "", () => { reshuffle(); checked = false; sel = -1; draw(); msg("رتّب البطاقات من أول خطوة (1) إلى آخر خطوة.", "blue"); })
      );
      draw();
    },
  });

  /* ================================================================
     2) MATCH — صِل المصطلح بمعناه
     ================================================================ */
  const MATCH_FRIDGE = {
    title: "صِل القطعة بوظيفتها — دورة البراد",
    pairs: [
      ["Capillary", "أنبوب رفيع يخفّض الضغط ويحدد كمية الفريون الداخلة للـ evaporator"],
      ["Filter drier", "يمتص الرطوبة ويمسك الشوائب قبل الـ capillary"],
      ["PTC", "يوصل ملف الـ start لحظة الإقلاع ثم تسخن فترتفع مقاومته ويفصله"],
      ["Overload (OLP)", "يفصل الكباس عند ارتفاع التيار أو حرارة جسم الكباس"],
      ["Bimetal", "ينهي الـ defrost عندما يذوب الثلج وترتفع حرارة الـ evaporator"],
      ["Defrost timer", "يبدّل كل عدة ساعات بين التبريد والـ defrost"],
    ],
  };
  const MATCH_AC = {
    title: "صِل المصطلح بمعناه — المكيّف",
    pairs: [
      ["Run capacitor", "يُستبدل إذا نقصت سعته أكثر من 10% عن المكتوب (التسامح ±5%)"],
      ["NTC", "حساس حرارة تنخفض مقاومته كلما ارتفعت الحرارة"],
      ["IPM", "وحدة القدرة في بورد الـ inverter التي تقود الكباس"],
      ["Pressure switch", "يفصل الدورة عند ضغط عالٍ أو منخفض غير طبيعي"],
      ["TXV", "صمام تمدد يضبط كمية الفريون حسب الـ superheat"],
    ],
  };
  A.register("match", {
    title: "صِل المصطلح بمعناه",
    params: "title?: string, pairs: [[term, meaning], ...]",
    demo: [MATCH_FRIDGE, MATCH_AC],
    render(host, p) {
      const src = p.pairs && p.pairs.length ? p : MATCH_FRIDGE;
      const pairs = src.pairs, n = pairs.length;
      head(host, src.title || p.title || "صِل المصطلح بمعناه", "اضغط مصطلحاً ثم اضغط المعنى المناسب له (أو العكس).");
      const terms = h("div", "acv-ex-mterms", null, { role: "group", "aria-label": "المصطلحات" });
      const means = h("div", "acv-ex-mmeans", null, { role: "group", "aria-label": "المعاني" });
      host.append(terms, means);
      const bar = h("div", "acv-ex-bar"); host.appendChild(bar);
      const out = infoBox(host);
      let tOrder, mOrder, selT, selM, done, mistakes, colorOf;
      function reset() { tOrder = shuffle(range(n)); mOrder = shuffle(range(n)); selT = -1; selM = -1; done = new Set(); mistakes = 0; colorOf = {}; draw(); out.innerHTML = "اختر مصطلحاً للبدء."; setTone(out, "blue"); }
      function tryPair() {
        if (selT < 0 || selM < 0) return;
        if (selT === selM) {
          colorOf[selT] = done.size % 5; done.add(selT);
          out.innerHTML = `✓ <b dir="ltr">${esc(pairs[selT][0])}</b>: ${esc(pairs[selT][1])}`; setTone(out, "ok");
          const a = selT; selT = selM = -1; draw();
          if (done.size === n) { out.innerHTML = `أحسنت! أنهيت كل الأزواج${mistakes ? ` مع ${num(mistakes)} ${mistakes === 1 ? "خطأ" : "أخطاء"}` : " بدون أي خطأ"}.`; setTone(out, mistakes ? "warn" : "ok"); }
          void a;
        } else {
          mistakes++;
          const tb = terms.querySelector(`[data-i="${selT}"]`), mb = means.querySelector(`[data-i="${selM}"]`);
          [tb, mb].forEach((b) => b && b.classList.add("acv-ex-wrong"));
          out.innerHTML = `✗ ليس هذا. <b dir="ltr">${esc(pairs[selT][0])}</b> لا يعني هذا — جرّب مرة أخرى.`; setTone(out, "bad");
          selT = selM = -1;
          setTimeout(() => draw(), reduce() ? 300 : 550);
        }
      }
      function draw() {
        terms.innerHTML = ""; means.innerHTML = "";
        tOrder.forEach((i) => {
          const d = done.has(i);
          const b = h("button", "acv-ex-mterm" + (selT === i ? " acv-ex-sel" : "") + (d ? " acv-ex-done acv-ex-c" + colorOf[i] : ""), `${d ? `<span class="acv-ex-mbadge">${[...done].indexOf(i) + 1}</span>` : ""}<span dir="auto">${esc(pairs[i][0])}</span>`, { type: "button", "data-i": i, "aria-pressed": selT === i ? "true" : "false" });
          b.disabled = d;
          b.addEventListener("click", () => { selT = selT === i ? -1 : i; if (selM < 0) { draw(); out.innerHTML = `اخترت <b dir="ltr">${esc(pairs[i][0])}</b> — الآن اضغط معناه.`; setTone(out, "blue"); } else tryPair(); });
          terms.appendChild(b);
        });
        mOrder.forEach((i) => {
          const d = done.has(i);
          const b = h("button", "acv-ex-mmean" + (selM === i ? " acv-ex-sel" : "") + (d ? " acv-ex-done acv-ex-c" + colorOf[i] : ""), `${d ? `<span class="acv-ex-mbadge">${[...done].indexOf(i) + 1}</span><b dir="auto" class="acv-ex-mlink">${esc(pairs[i][0])}</b>` : ""}<span dir="auto">${esc(pairs[i][1])}</span>`, { type: "button", "data-i": i, "aria-pressed": selM === i ? "true" : "false" });
          b.disabled = d;
          b.addEventListener("click", () => { selM = selM === i ? -1 : i; if (selT < 0) { draw(); out.innerHTML = "الآن اضغط المصطلح المناسب لهذا المعنى."; setTone(out, "blue"); } else tryPair(); });
          means.appendChild(b);
        });
      }
      bar.append(btn("ابدأ من جديد", "", reset));
      reset();
    },
  });

  /* ================================================================
     3) TREE — شجرة تشخيص
     ================================================================ */
  const TREE_FRIDGE = {
    title: "براد No-Frost لا يبرّد — تشخيص خطوة بخطوة",
    start: "q1",
    nodes: {
      q1: { q: "هل الكباس (Compressor) يعمل؟ (صوت واهتزاز خفيف، وخط الـ discharge يسخن)", options: [{ t: "لا يعمل أبداً (صامت)", next: "q2" }, { t: "يطنّ ثم يفصل بـ click", next: "e_start" }, { t: "نعم يعمل", next: "q5" }] },
      q2: { q: "قِس الجهد على مدخل الكباس (قبل الـ OLP): هل يوجد 230V؟", options: [{ t: "نعم يوجد 230V", next: "q3" }, { t: "لا يوجد جهد", next: "q4" }] },
      q3: { q: "افصل الكهرباء وقِس الملفات بين C و S و R، ثم العزل للأرض (Megger).", options: [{ t: "C-S + C-R = R-S والعزل ≥ 2 MΩ", next: "e_olp" }, { t: "ملف مفتوح (OL) أو عزل ضعيف للأرض", next: "e_comp" }] },
      q4: { q: "أدِر الـ defrost timer يدوياً ببطء حتى تسمع click. هل اشتغل الكباس؟", options: [{ t: "نعم اشتغل (كان عالقاً على defrost)", next: "q6" }, { t: "لا شيء تغيّر", next: "e_thermo" }] },
      q5: { q: "افتح غطاء الـ evaporator في الفريزر. كيف يبدو الصقيع؟", options: [{ t: "ثلج كثيف يغطي الـ evaporator كله", next: "q6" }, { t: "صقيع على أول لفّات فقط", next: "e_low" }, { t: "لا صقيع، والـ evaporator غير بارد", next: "q7" }, { t: "صقيع خفيف موزّع (طبيعي)", next: "q8" }] },
      q6: { q: "الـ evaporator مثلّج = الـ defrost لا يعمل. قِس (والجهاز مفصول) استمرارية الـ heater والـ bimetal وهو ما زال بارداً.", options: [{ t: "الـ heater مفتوح (OL)", next: "e_heater" }, { t: "الـ bimetal مفتوح رغم أنه بارد", next: "e_bimetal" }, { t: "كلاهما سليم", next: "e_timer" }] },
      q7: { q: "المس خط الـ discharge وأول الـ condenser: هل هما ساخنان؟", options: [{ t: "نعم ساخنان", next: "e_block" }, { t: "لا، شبه باردين", next: "e_pump" }] },
      q8: { q: "هل مروحة الـ evaporator تدور والهواء يصل لقسم البراد؟", options: [{ t: "المروحة لا تدور", next: "e_fan" }, { t: "تدور لكن الهواء لا يصل للبراد", next: "e_damper" }, { t: "تدور والهواء جيد", next: "e_cond" }] },
      e_start: { end: true, tone: "bad", verdict: "الكباس لا يقلع (مشكلة إقلاع)", action: "افحص الـ PTC (بارداً: بضعة Ω إلى عشرات Ω حسب النوع) والـ OLP وجهد الشبكة أثناء الإقلاع. إذا كانت كلها سليمة والتيار عالٍ جداً ثم يفصل: الكباس معلّق (stuck)." },
      e_olp: { end: true, tone: "warn", verdict: "الملفات سليمة — المشكلة غالباً في الـ OLP أو الـ PTC أو التوصيل", action: "قِس الـ OLP وهو بارد (يجب أن يكون موصولاً)، وافحص الـ PTC والـ terminals. بدّل القطعة التالفة بنفس المواصفات." },
      e_comp: { end: true, tone: "bad", verdict: "الكباس تالف (ملف مفتوح أو تسريب للأرض)", action: "تبديل الكباس: recovery، تبديل الـ filter drier، لحام مع نيتروجين، اختبار ضغط، vacuum ≤ 500 microns، ثم شحن بالوزن حسب لوحة الجهاز." },
      e_thermo: { end: true, tone: "warn", verdict: "لا يصل جهد من الـ thermostat / البورد", action: "في وضع التبريد يجب أن يكون الـ thermostat (أو relay البورد) موصولاً. افحص الأسلاك والـ connectors، وبدّل الـ thermostat إذا كان مفتوحاً." },
      e_low: { end: true, tone: "bad", verdict: "نقص فريون (تسريب) أو انسداد جزئي", action: "لا تشحن مباشرة: ابحث عن التسريب وأصلحه، بدّل الـ filter drier، اختبار نيتروجين، vacuum ≤ 500 microns، ثم شحن بالوزن." },
      e_heater: { end: true, tone: "bad", verdict: "الـ defrost heater محروق", action: "بدّله بنفس القدرة (قِس R واحسب P = V²/R). ذوّب الثلج كاملاً قبل إعادة التشغيل." },
      e_bimetal: { end: true, tone: "bad", verdict: "الـ bimetal (defrost thermostat) تالف", action: "يجب أن يكون موصولاً وهو بارد (تحت الصفر) ويفصل عند ارتفاع الحرارة (تقريباً +5 إلى +15°C). بدّله وثبّته في نفس مكانه على الأنبوب." },
      e_timer: { end: true, tone: "warn", verdict: "الـ defrost timer (أو البورد) لا يدخل في الـ defrost", action: "قِس محرك الـ timer (موصول، عادة عدة kΩ) وأدره يدوياً لوضع defrost: إذا سخن الـ heater فالـ timer هو التالف — بدّله." },
      e_block: { end: true, tone: "bad", verdict: "انسداد في الـ capillary أو الـ filter drier", action: "ضغط الـ suction في vacuum والـ condenser ساخن في أوله فقط. بدّل الـ filter drier، نظّف أو بدّل الـ capillary، ثم vacuum وشحن بالوزن." },
      e_pump: { end: true, tone: "bad", verdict: "لا ضغط: فقد كامل للفريون أو صمامات الكباس تالفة", action: "ركّب ساعة على الـ process tube. ضغط صفر = تسريب كامل، ابحث عنه وأصلحه. فريون موجود والكباس لا يرفع الضغط = كباس ضعيف." },
      e_fan: { end: true, tone: "warn", verdict: "مروحة الـ evaporator متوقفة", action: "افحص الـ door switch (يفصل المروحة عند فتح الباب)، الجهد على المروحة، وملف المحرك. تأكد أن الثلج لا يمسك الشفرة." },
      e_damper: { end: true, tone: "warn", verdict: "مسار الهواء إلى البراد مسدود", action: "افحص الـ damper (يدوي أو motorized) ومجرى الهواء من الثلج. تسرّب من الـ door gasket يسبب ثلجاً في المجرى." },
      e_cond: { end: true, tone: "ok", verdict: "الدورة سليمة غالباً — افحص التهوية والاستعمال", action: "نظّف الـ condenser وتأكد من مروحته، افحص الـ door gasket، ولا تحمّل البراد بأطعمة ساخنة. أعطِ الجهاز 24 ساعة ثم أعد القياس." },
    },
  };
  const TREE_AC = {
    title: "مكيّف Split لا يبرّد",
    start: "a1",
    nodes: {
      a1: { q: "هل الوحدة الخارجية (Compressor + fan) تعمل؟", options: [{ t: "لا تعمل", next: "a2" }, { t: "تعمل", next: "a3" }] },
      a2: { q: "هل يوجد كود خطأ على الشاشة أو LED يرمش على البورد؟", options: [{ t: "نعم يوجد كود", next: "e_code" }, { t: "لا يوجد", next: "a4" }] },
      a4: { q: "هل يصل 230V (L-N) للوحدة الخارجية عند طلب التبريد؟", options: [{ t: "لا يصل", next: "e_wire" }, { t: "يصل", next: "e_cap" }] },
      a3: { q: "قِس ضغط الـ suction والتيار بعد 10–15 دقيقة تشغيل:", options: [{ t: "ضغط منخفض وتيار منخفض", next: "e_leak" }, { t: "ضغط عالٍ وتيار عالٍ", next: "e_hot" }, { t: "ضغط وتيار طبيعيان", next: "e_air" }] },
      e_code: { end: true, tone: "warn", verdict: "الجهاز يشخّص نفسه", action: "اقرأ معنى الكود من الـ service manual (حساسات NTC، اتصال indoor/outdoor، IPM، حماية ضغط...) واتبع خطوات الفحص الخاصة به." },
      e_wire: { end: true, tone: "warn", verdict: "مشكلة تغذية: قاطع، أسلاك أو relay البورد الداخلي", action: "افحص القاطع والـ terminals وكابل الوصل، ثم خرج relay الوحدة الداخلية." },
      e_cap: { end: true, tone: "bad", verdict: "الجهد يصل والكباس لا يعمل (non-inverter)", action: "قِس الـ run capacitor: التسامح ±5% — بدّله إذا نقص أكثر من 10%. ثم الـ contactor وملفات الكباس والعزل (≥ 2 MΩ)." },
      e_leak: { end: true, tone: "bad", verdict: "نقص فريون — تسريب", action: "ابحث عن التسريب (الـ flares أولاً). أصلح، اختبار نيتروجين، vacuum ≤ 500 microns، ثم شحن بالوزن حسب اللوحة + الطول الزائد." },
      e_hot: { end: true, tone: "warn", verdict: "تبادل حراري ضعيف في الخارج", action: "نظّف الـ condenser، افحص مروحة الوحدة الخارجية والـ capacitor الخاص بها، وتأكد من عدم رجوع الهواء الساخن (مكان مغلق)." },
      e_air: { end: true, tone: "ok", verdict: "الدورة سليمة — المشكلة في الهواء الداخلي أو الحمل", action: "نظّف الـ filters والـ evaporator، افحص سرعة المروحة الداخلية، وتأكد أن قدرة المكيّف مناسبة لمساحة الغرفة." },
    },
  };
  A.register("tree", {
    title: "شجرة تشخيص",
    params: "title?, start: id, nodes: {id: {q, options:[{t, next}]} | {end:true, verdict, action, tone:'ok|bad|warn'}}",
    demo: [TREE_FRIDGE, TREE_AC],
    render(host, p) {
      const src = p.nodes && p.start ? p : TREE_FRIDGE;
      const nodes = src.nodes;
      head(host, src.title || p.title || "شجرة تشخيص", "أجب عن كل سؤال حسب ما تقيسه على الجهاز.");
      const crumbs = h("div", "acv-ex-crumbs", null, { "aria-label": "مسار الأجوبة" });
      const card = h("div", "acv-ex-tcard", null, { "aria-live": "polite" });
      const bar = h("div", "acv-ex-bar");
      host.append(crumbs, card, bar);
      let path = []; // [{id, choice}]
      let cur = src.start;
      function go(id) { cur = id; draw(); const f = card.querySelector("button, .acv-ex-tq"); if (f && f.focus) f.focus({ preventScroll: true }); }
      function draw() {
        crumbs.innerHTML = "";
        path.forEach((s, i) => {
          const b = h("button", "acv-ex-crumb", `<span class="acv-ex-cn">${i + 1}</span>${esc(s.choice)}`, { type: "button", "aria-label": `ارجع إلى السؤال ${i + 1}` });
          b.addEventListener("click", () => { path = path.slice(0, i); go(s.id); });
          crumbs.appendChild(b);
        });
        crumbs.hidden = !path.length;
        const nd = nodes[cur];
        card.innerHTML = "";
        if (!nd) { card.textContent = "عقدة غير معروفة."; return; }
        if (nd.end) {
          const tone = nd.tone || "warn";
          card.className = "acv-ex-tcard acv-ex-tend acv-ex-t-" + tone;
          const icon = { ok: "✓", bad: "✗", warn: "!" }[tone] || "!";
          card.innerHTML = `<div class="acv-ex-tverd"><span class="acv-ex-tico">${icon}</span><span>${esc(nd.verdict)}</span></div><div class="acv-ex-tact"><b>الإجراء:</b> ${esc(nd.action || "")}</div>`;
        } else {
          card.className = "acv-ex-tcard";
          card.appendChild(h("div", "acv-ex-tstep", `سؤال ${num(path.length + 1)}`));
          card.appendChild(h("div", "acv-ex-tq", esc(nd.q), { tabindex: "-1" }));
          const opts = h("div", "acv-ex-topts");
          (nd.options || []).forEach((o) => opts.appendChild(btn(esc(o.t), "acv-ex-topt", () => { path.push({ id: cur, choice: o.t }); go(o.next); })));
          card.appendChild(opts);
        }
        back.disabled = !path.length;
      }
      const back = btn("رجوع خطوة", "", () => { const s = path.pop(); if (s) go(s.id); });
      bar.append(back, btn("ابدأ من جديد", "", () => { path = []; go(src.start); }));
      draw();
    },
  });

  /* ================================================================
     4) REVEAL — اضغط لتكشف
     ================================================================ */
  const REVEAL_FRIDGE = {
    title: "عَرَض ← السبب المرجّح (البراد)",
    cards: [
      ["صقيع على أول لفّات الـ evaporator فقط", "نقص فريون أو انسداد جزئي — ابحث عن التسريب قبل أي شحن."],
      ["الكباس يطنّ ثم يفصل بـ click كل دقيقة", "مشكلة إقلاع: PTC أو OLP أو جهد ضعيف أو كباس معلّق."],
      ["الفريزر يبرد والبراد دافئ (No-Frost)", "غالباً الـ evaporator مثلّج (defrost)، أو المروحة أو الـ damper."],
      ["الـ condenser ساخن جداً والكباس يفصل", "اتساخ الـ condenser أو تهوية سيئة أو مروحة الـ condenser متوقفة."],
      ["ماء تحت درج الخضار", "فتحة التصريف مسدودة أو متجمّدة — نظّفها بماء دافئ."],
      ["قراءة الـ vacuum تعود للصعود بسرعة", "تسريب أو رطوبة في الدورة — لا تشحن قبل أن تثبت تحت 1000 microns."],
    ],
  };
  const REVEAL_WASHER = {
    title: "أعطال الغسالة — اضغط لتكشف",
    cards: [
      ["الغسالة لا تصرّف الماء", "فلتر المضخة مسدود (نظّفه أولاً) أو الـ drain pump تالفة."],
      ["اهتزاز قوي في الـ spin", "حمل غير متوازن، أو براغي النقل لم تُفك، أو الـ shock absorbers ضعيفة."],
      ["الماء لا يسخن", "الـ heater أو الـ NTC: قِس مقاومة الـ heater واحسب P = V²/R."],
      ["الباب لا يفتح بعد انتهاء البرنامج", "الـ door lock ينتظر تفريغ الماء أو انخفاض الحرارة — انتظر 1–2 دقيقة."],
    ],
  };
  A.register("reveal", {
    title: "اضغط لتكشف",
    params: "title?, cards: [[front, back], ...]",
    demo: [REVEAL_FRIDGE, REVEAL_WASHER],
    render(host, p) {
      const src = p.cards && p.cards.length ? p : REVEAL_FRIDGE;
      const cards = src.cards;
      head(host, src.title || p.title || "اضغط لتكشف", "فكّر بالجواب أولاً، ثم اضغط البطاقة لتقلبها.");
      const grid = h("div", "acv-ex-rgrid"); host.appendChild(grid);
      const bar = h("div", "acv-ex-bar"); host.appendChild(bar);
      const cnt = h("span", "acv-ex-rcount");
      const open = new Set();
      const upd = () => { cnt.innerHTML = `كشفت ${num(open.size + " / " + cards.length)}`; };
      const els = cards.map((c, i) => {
        const b = h("button", "acv-ex-rcard" + (reduce() ? " acv-ex-nomo" : ""), `<span class="acv-ex-rin"><span class="acv-ex-rface acv-ex-rfront"><span class="acv-ex-rq">؟</span>${esc(c[0])}</span><span class="acv-ex-rface acv-ex-rback">${esc(c[1])}</span></span>`, { type: "button", "aria-pressed": "false", "aria-label": c[0] });
        b.addEventListener("click", () => { const on = !open.has(i); on ? open.add(i) : open.delete(i); b.classList.toggle("acv-ex-flip", on); b.setAttribute("aria-pressed", on); b.setAttribute("aria-label", on ? c[1] : c[0]); upd(); });
        grid.appendChild(b); return b;
      });
      const setAll = (on) => { els.forEach((b, i) => { on ? open.add(i) : open.delete(i); b.classList.toggle("acv-ex-flip", on); b.setAttribute("aria-pressed", on); b.setAttribute("aria-label", cards[i][on ? 1 : 0]); }); upd(); };
      bar.append(btn("اكشف الكل", "", () => setAll(true)), btn("أخفِ الكل", "", () => setAll(false)), cnt);
      upd();
    },
  });

  /* ================================================================
     5) CALC — حاسبات
     ================================================================ */
  const R = (x, d) => Math.round(x * Math.pow(10, d)) / Math.pow(10, d);
  const CALC = {
    capillary: {
      title: "تبديل قطر الـ Capillary", sub: "الطول المكافئ عند تغيير القطر الداخلي (تقريبي).",
      fields: [
        { k: "d1", l: "القطر الداخلي الأصلي", u: "mm", v: 0.7, step: 0.01, min: 0.3, max: 2.5 },
        { k: "L1", l: "الطول الأصلي", u: "m", v: 3, step: 0.1, min: 0.3, max: 10 },
        { k: "d2", l: "القطر الداخلي المتوفر", u: "mm", v: 0.8, step: 0.01, min: 0.3, max: 2.5 },
      ],
      calc(v) {
        const r = Math.pow(v.d2 / v.d1, 4.6), L2 = v.L1 * r, warns = [];
        if (r > 1.6 || r < 0.6) warns.push("الفرق بين القطرين كبير — الأفضل استعمال قطر أقرب للأصلي.");
        if (L2 < 1.5) warns.push("الطول الناتج قصير جداً — تبريد غير مستقر وخطر رجوع سائل للكباس.");
        if (L2 > 6) warns.push("الطول الناتج طويل جداً — صعب التركيب وقد ينقص التدفق.");
        return { main: ["الطول الجديد المكافئ ≈", fmt(L2, 2), "m"], rows: [["نسبة الطول (d₂/d₁)^4.6", "× " + fmt(r, 2)], ["القطر الأكبر ⇐", "طول أكبر لنفس المقاومة"]], warns, tone: warns.length ? "warn" : "ok",
          note: "معادلة تقريبية لنفس الفريون والظروف. الأفضل دائماً نفس القطر والطول الأصلي، وتأكد بعد التشغيل من الضغط وتوزّع الصقيع والتيار." };
      },
    },
    extra_charge: {
      title: "شحنة إضافية للأنابيب الطويلة (Split)", sub: "الكمية = (الطول الفعلي − الطول المشحون مسبقاً) × غرام/متر.",
      fields: [
        { k: "size", l: "قطر خط السائل (liquid line)", type: "seg", v: "q", opts: [["q", '1/4"'], ["t", '3/8"'], ["c", "يدوي"]], set: (v) => { if (v.size === "q") v.gpm = 20; if (v.size === "t") v.gpm = 40; } },
        { k: "pre", l: "الطول المشحون مسبقاً (من الـ manual)", u: "m", v: 5, step: 0.5, min: 0, max: 30 },
        { k: "len", l: "الطول الفعلي للأنابيب", u: "m", v: 9, step: 0.5, min: 0, max: 60 },
        { k: "gpm", l: "الشحنة لكل متر", u: "g/m", v: 20, step: 1, min: 5, max: 80 },
      ],
      calc(v) {
        const ex = Math.max(0, v.len - v.pre) * v.gpm, warns = [];
        if (v.len < v.pre) warns.push("الطول أقل من المشحون مسبقاً: لا تضف شيئاً (بعض الشركات لا تطلب سحب فريون — راجع الـ manual).");
        if (v.len > 25) warns.push("تأكد من الطول الأقصى وفرق الارتفاع المسموح في الـ manual.");
        return { main: ["أضف تقريباً", fmt(ex, 0), "g"], rows: [["الطول الزائد", fmt(Math.max(0, v.len - v.pre), 1) + " m"], ["القيم الشائعة 1/4\"", "≈ 12–20 g/m (R410A / R32)"], ["القيم الشائعة 3/8\"", "≈ 40–50 g/m"]], warns, tone: "blue",
          note: "القيمة الدقيقة لكل متر «حسب الدليل» (مكتوبة على لوحة الوحدة الخارجية). R410A خليط: اشحن سائلاً، وبالميزان دائماً." };
      },
    },
    ashrae_cecomaf: {
      title: "ASHRAE ↔ CECOMAF", sub: "قدرة الكباس في كتالوج ASHRAE أعلى من CECOMAF بحوالى 25–35%.",
      fields: [
        { k: "dir", l: "التحويل", type: "seg", v: "a2c", opts: [["a2c", "ASHRAE → CECOMAF"], ["c2a", "CECOMAF → ASHRAE"]] },
        { k: "val", l: "القدرة المعروفة", u: "W", v: 200, step: 5, min: 1, max: 50000 },
      ],
      calc(v) {
        const lo = v.dir === "a2c" ? v.val / 1.35 : v.val * 1.25, hi = v.dir === "a2c" ? v.val / 1.25 : v.val * 1.35;
        const to = v.dir === "a2c" ? "CECOMAF" : "ASHRAE";
        return { main: [to + " ≈", fmt(lo, 0) + " – " + fmt(hi, 0), "W"], rows: [["بالـ BTU/h", fmt(lo * 3.412, 0) + " – " + fmt(hi * 3.412, 0)], ["الفرق", "≈ 25–35%"]], tone: "blue",
          note: "الفرق يأتي من شروط الاختبار (subcooling وحرارة الـ suction). عند المقارنة بين كباسين استعمل نفس المعيار ونفس الـ evaporating temperature من الـ datasheet." };
      },
    },
    heater: {
      title: "الـ Heater وقانون أوم", sub: "احسب المقاومة المتوقعة أو القدرة من القياس.",
      fields: (v) => [
        { k: "mode", l: "الحالة", type: "seg", v: "pv", opts: [["pv", "أعرف P و V"], ["rv", "قِست R"]] },
        ...(v.mode === "rv" ? [{ k: "r", l: "المقاومة المقاسة (بارداً)", u: "Ω", v: 265, step: 1, min: 1, max: 100000 }] : [{ k: "p", l: "القدرة المكتوبة", u: "W", v: 200, step: 5, min: 1, max: 10000 }]),
        { k: "u", l: "الجهد", u: "V", v: 230, step: 1, min: 12, max: 400 },
      ],
      calc(v) {
        if (v.mode === "rv") {
          const P = v.u * v.u / v.r, I = v.u / v.r;
          return { main: ["القدرة المتوقعة ≈", fmt(P, 0), "W"], rows: [["التيار", fmt(I, 2) + " A"], ["P = V² / R", ""]], tone: "blue",
            note: "قراءة OL (مفتوح) = heater محروق. قراءة قريبة من 0 Ω = قصر. وقِس العزل بين الطرف والجسم." };
        }
        const Rr = v.u * v.u / v.p, I = v.p / v.u;
        return { main: ["المقاومة المتوقعة ≈", fmt(Rr, 1), "Ω"], rows: [["التيار", fmt(I, 2) + " A"], ["R = V² / P", ""]], tone: "blue",
          note: "القياس على الـ heater وهو بارد ومفصول. فرق ±10% تقريباً مقبول؛ OL = محروق." };
      },
    },
    r32_room: {
      title: "R32 (A2L) — أقل مساحة للغرفة", sub: "حسب IEC 60335-2-40 (مبسّط):<br><bdi dir=\"ltr\" style=\"display:inline-block\">A<sub>min</sub> = (m / (2.5 × LFL<sup>5/4</sup> × h₀))²</bdi>",
      fields: [
        { k: "m", l: "شحنة الفريون الكاملة", u: "kg", v: 1.1, step: 0.05, min: 0.1, max: 10 },
        { k: "h0", l: "ارتفاع تركيب الوحدة الداخلية", type: "seg", v: "1.8", opts: [["0.6", "أرضي"], ["1.0", "شباك"], ["1.8", "جداري"], ["2.2", "سقفي"]] },
        { k: "room", l: "مساحة الغرفة (اختياري)", u: "m²", v: 12, step: 0.5, min: 0, max: 500 },
      ],
      calc(v) {
        const LFL = 0.307, k = 2.5 * Math.pow(LFL, 1.25) * (+v.h0), Amin = Math.pow(v.m / k, 2);
        const mmax = v.room > 0 ? k * Math.sqrt(v.room) : NaN, ok = v.room > 0 ? v.room >= Amin : null;
        const rows = [["h₀", v.h0 + " m"], ["LFL (R32)", "0.307 kg/m³"]];
        if (v.room > 0) rows.push(["أقصى شحنة لهذه الغرفة ≈", fmt(mmax, 2) + " kg"]);
        return { main: ["أقل مساحة ≈", fmt(Amin, 1), "m²"], rows, tone: ok == null ? "blue" : ok ? "ok" : "bad",
          warns: ok === false ? ["الغرفة أصغر من المطلوب — غيّر الجهاز أو مكان التركيب أو راجع الـ manual."] : [],
          note: "حساب إرشادي مبسّط. الـ manual والمعيار المعتمد هما المرجع (قد تختلف الحدود والاستثناءات حسب الإصدار والموديل). R32 قابل للاشتعال بدرجة خفيفة (A2L): لا لهب مكشوف وتهوية جيدة." };
      },
    },
    units: {
      title: "تحويل الوحدات", sub: "ضغط، حرارة، vacuum، وقدرة تبريد.",
      fields: (v) => {
        const U = UNIT_SETS[v.cat] || UNIT_SETS.p;
        return [
          { k: "cat", l: "النوع", type: "seg", v: "p", opts: [["p", "ضغط"], ["t", "حرارة"], ["v", "Vacuum"], ["q", "قدرة"]], set: (vv) => { vv.unit = UNIT_SETS[vv.cat].def; vv.val = UNIT_SETS[vv.cat].val; } },
          { k: "val", l: "القيمة", u: "", v: U.val, step: "any" },
          { k: "unit", l: "الوحدة", type: "seg", v: U.def, opts: U.units.map((x) => [x[0], x[0]]) },
        ];
      },
      calc(v) {
        const U = UNIT_SETS[v.cat] || UNIT_SETS.p;
        const base = U.toBase(v.val, v.unit);
        const rows = U.units.filter((x) => x[0] !== v.unit).map((x) => [x[0], fmt(U.fromBase(base, x[0]), x[1])]);
        return { main: [v.val + " " + v.unit + " =", "", ""], rows, tone: "blue", big: rows, note: U.note };
      },
    },
    load: {
      title: "حمل غرفة التبريد — تقدير سريع", sub: "تقديري فقط — للاختيار النهائي استعمل حساباً تفصيلياً أو برنامج الشركة المصنّعة.",
      fields: [
        { k: "L", l: "الطول", u: "m", v: 3, step: 0.1, min: 1, max: 30 },
        { k: "W", l: "العرض", u: "m", v: 3, step: 0.1, min: 1, max: 30 },
        { k: "H", l: "الارتفاع", u: "m", v: 2.5, step: 0.1, min: 1.8, max: 8 },
        { k: "cls", l: "نوع الغرفة", type: "seg", v: "c", opts: [["c", "براد +2°C"], ["f", "فريزر −20°C"]] },
        { k: "door", l: "فتح الباب", type: "seg", v: "n", opts: [["l", "قليل"], ["n", "عادي"], ["h", "كثير"]] },
        { k: "amb", l: "حرارة المكان (صيفاً)", u: "°C", v: 35, step: 1, min: 20, max: 50 },
        { k: "prod", l: "بضاعة جديدة يومياً", u: "kg", v: 200, step: 10, min: 0, max: 20000 },
      ],
      calc(v) {
        const V = v.L * v.W * v.H, Ar = 2 * (v.L * v.W + v.L * v.H + v.W * v.H);
        const fr = v.cls === "f", Ti = fr ? -20 : 2, U = fr ? 0.17 : 0.25, dT = Math.max(0, v.amb - Ti);
        const qT = U * Ar * dT;
        const ach = (70 / Math.sqrt(Math.max(V, 1))) * ({ l: 0.6, n: 1, h: 2 }[v.door] || 1);
        const dh = (fr ? 115 : 80) * Math.max(0.3, (v.amb - (fr ? -20 : 2)) / (fr ? 55 : 33));
        const qI = V * ach * dh / 86.4;
        const qP = fr ? v.prod * 1.8 * 8 / 86.4 : v.prod * 3.6 * Math.max(0, 25 - Ti) / 86.4;
        const sub = qT + qI + qP, qX = sub * (fr ? 0.2 : 0.25);
        const tot = (sub + qX) * (24 / 18) * 1.1;
        const lo = tot * 0.9 / 1000, hi = tot * 1.25 / 1000;
        const parts = [["الجدران (العزل)", qT], ["الهواء وفتح الباب", qI], ["البضاعة", qP], ["إنارة، مراوح، أشخاص", qX]];
        return { main: ["القدرة المطلوبة ≈", fmt(lo, 1) + " – " + fmt(hi, 1), "kW"], rows: [["الحجم", fmt(V, 1) + " m³"], ["بالـ BTU/h", fmt(lo * 3412, 0) + " – " + fmt(hi * 3412, 0)], ["حرارة التبخير ≈", fr ? "−30…−28 °C" : "−10…−8 °C"]], parts, tone: "warn",
          note: "تقديري فقط: عزل PU قياسي (" + (fr ? "≈ 120–150 mm" : "≈ 80–100 mm") + ")، تشغيل 18 ساعة/يوم و10% أمان. لا يشمل التبريد السريع (blast) ولا منتجات تتنفس كثيراً." };
      },
    },
  };
  const UNIT_SETS = {
    p: { def: "bar", val: 10, units: [["bar", 2], ["psi", 1], ["kPa", 0], ["MPa", 3]], toBase: (x, u) => x * { bar: 100, psi: 6.894757, kPa: 1, MPa: 1000 }[u], fromBase: (b, u) => b / { bar: 100, psi: 6.894757, kPa: 1, MPa: 1000 }[u], note: "انتبه: ساعات المنيفولد تقرأ ضغطاً نسبياً (gauge). الضغط المطلق = gauge + 1.013 bar تقريباً." },
    t: { def: "°C", val: -18, units: [["°C", 1], ["°F", 1], ["K", 1]], toBase: (x, u) => (u === "°F" ? (x - 32) * 5 / 9 : u === "K" ? x - 273.15 : x), fromBase: (c, u) => (u === "°F" ? c * 9 / 5 + 32 : u === "K" ? c + 273.15 : c), note: "فرق درجات (مثل superheat): 1 K = 1°C = 1.8°F." },
    v: { def: "micron", val: 500, units: [["micron", 0], ["mbar", 3], ["Pa", 1], ["Torr", 3]], toBase: (x, u) => x * { micron: 0.133322, mbar: 100, Pa: 1, Torr: 133.322 }[u], fromBase: (b, u) => b / { micron: 0.133322, mbar: 100, Pa: 1, Torr: 133.322 }[u], note: "الهدف: ≤ 500 microns (≈ 0.67 mbar) ثم اختبار الثبات: يجب أن يبقى تحت 1000 microns." },
    q: { def: "BTU/h", val: 12000, units: [["BTU/h", 0], ["kW", 2], ["TR", 2], ["kcal/h", 0]], toBase: (x, u) => x * { "BTU/h": 0.000293071, kW: 1, TR: 3.516853, "kcal/h": 0.001163 }[u], fromBase: (b, u) => b / { "BTU/h": 0.000293071, kW: 1, TR: 3.516853, "kcal/h": 0.001163 }[u], note: "1 TR = 12,000 BTU/h ≈ 3.52 kW. «الطن» في السوق = 12,000 BTU/h تبريد وليس قدرة كهربائية." },
  };
  const CALC_ORDER = ["units", "extra_charge", "capillary", "heater", "ashrae_cecomaf", "r32_room", "load"];
  const CALC_SHORT = { units: "تحويل وحدات", extra_charge: "شحنة إضافية", capillary: "Capillary", heater: "Heater", ashrae_cecomaf: "ASHRAE/CECOMAF", r32_room: "R32 غرفة", load: "غرفة تبريد" };

  A.register("calc", {
    title: "حاسبة الفنّي",
    params: "kind: 'capillary'|'extra_charge'|'ashrae_cecomaf'|'heater'|'r32_room'|'units'|'load' (بدونه: كل الحاسبات مع أزرار اختيار), values?: {field: value} قيم مبدئية",
    demo: [{}, { kind: "extra_charge", values: { pre: 5, len: 12 } }, { kind: "r32_room", values: { m: 1.6, h0: "1.8", room: 10 } }],
    render(host, p) {
      const id = uid();
      const single = CALC[p.kind];
      let kind = single ? p.kind : "units";
      const tabs = h("div", "acv-ex-tabs", null, { role: "tablist", "aria-label": "اختر الحاسبة" });
      if (!single) host.appendChild(tabs);
      const panel = h("div", "acv-ex-cpanel"); host.appendChild(panel);
      function drawTabs() {
        tabs.innerHTML = "";
        CALC_ORDER.forEach((k) => {
          const b = h("button", "acv-ex-tab" + (k === kind ? " acv-ex-on" : ""), esc(CALC_SHORT[k]), { type: "button", role: "tab", "aria-selected": k === kind });
          b.addEventListener("click", () => { kind = k; drawTabs(); build(); });
          tabs.appendChild(b);
        });
      }
      function build() {
        const def = CALC[kind];
        const v = {};
        const getFields = () => (typeof def.fields === "function" ? def.fields(v) : def.fields);
        // initialise (two passes so dynamic field sets see mode values)
        for (let pass = 0; pass < 2; pass++) getFields().forEach((f) => { if (!(f.k in v)) v[f.k] = f.v; });
        if (single && p.values) Object.assign(v, p.values);
        getFields().forEach((f) => { if (!(f.k in v)) v[f.k] = f.v; });
        panel.innerHTML = "";
        head(panel, def.title, def.sub);
        const form = h("div", "acv-ex-form"); panel.appendChild(form);
        const res = h("div", "acv-ex-res", null, { "aria-live": "polite" }); panel.appendChild(res);
        function drawForm() {
          form.innerHTML = "";
          getFields().forEach((f) => {
            if (!(f.k in v)) v[f.k] = f.v;
            const row = h("div", "acv-ex-frow" + (f.type === "seg" ? " acv-ex-fseg" : ""));
            const fid = "acvx" + id + f.k;
            if (f.type === "seg") {
              row.appendChild(h("div", "acv-ex-flab", esc(f.l), { id: fid }));
              const g = h("div", "acv-ex-seg", null, { role: "radiogroup", "aria-labelledby": fid });
              f.opts.forEach(([val, lab]) => {
                const b = h("button", "acv-ex-segb" + (String(v[f.k]) === String(val) ? " acv-ex-on" : ""), `<span dir="auto">${esc(lab)}</span>`, { type: "button", role: "radio", "aria-checked": String(v[f.k]) === String(val) });
                b.addEventListener("click", () => { v[f.k] = val; if (f.set) f.set(v); drawForm(); compute(); const nb = form.querySelector(`#${fid}`); if (nb && nb.nextSibling) { const on = nb.nextSibling.querySelector(".acv-ex-on"); if (on) on.focus({ preventScroll: true }); } });
                g.appendChild(b);
              });
              row.appendChild(g);
            } else {
              row.appendChild(h("label", "acv-ex-flab", esc(f.l), { for: fid }));
              const wrap = h("div", "acv-ex-inp");
              const inp = h("input", null, null, { id: fid, type: "number", inputmode: "decimal", step: f.step || "any", dir: "ltr" });
              if (f.min != null) inp.min = f.min; if (f.max != null) inp.max = f.max;
              inp.value = v[f.k];
              inp.addEventListener("input", () => { const x = parseFloat(inp.value); if (isFinite(x)) { v[f.k] = x; compute(); } });
              wrap.appendChild(inp);
              if (f.u) wrap.appendChild(h("span", "acv-ex-unit", esc(f.u), { dir: "ltr" }));
              row.appendChild(wrap);
            }
            form.appendChild(row);
          });
        }
        function compute() {
          let r;
          try { r = def.calc(v); } catch (e) { r = null; }
          if (!r) { res.innerHTML = ""; return; }
          let html = "";
          if (r.big) {
            html += `<div class="acv-ex-rlab" dir="ltr">${esc(r.main[0])}</div><div class="acv-ex-ugrid">` + r.big.map((x) => `<div class="acv-ex-ucell"><b dir="ltr">${esc(x[1])}</b><span dir="ltr">${esc(x[0])}</span></div>`).join("") + "</div>";
          } else {
            html += `<div class="acv-ex-rmain"><span class="acv-ex-rlab">${esc(r.main[0])}</span><span class="acv-ex-rval" dir="ltr">${esc(r.main[1])}<small> ${esc(r.main[2])}</small></span></div>`;
            if (r.rows && r.rows.length) html += `<div class="acv-ex-rrows">` + r.rows.map((x) => `<div><span>${esc(x[0])}</span><b dir="ltr">${esc(x[1])}</b></div>`).join("") + "</div>";
          }
          if (r.parts) {
            const tot = r.parts.reduce((s, x) => s + x[1], 0) || 1;
            html += `<div class="acv-ex-parts">` + r.parts.map((x, i) => `<div class="acv-ex-prow"><span>${esc(x[0])}</span><span class="acv-ex-pbar"><i class="acv-ex-pc${i}" style="width:${Math.max(2, x[1] / tot * 100).toFixed(1)}%"></i></span><b dir="ltr">${Math.round(x[1] / tot * 100)}%</b></div>`).join("") + "</div>";
          }
          (r.warns || []).forEach((w) => { html += `<div class="acv-ex-warn">⚠ ${esc(w)}</div>`; });
          if (r.note) html += `<div class="acv-ex-note">${esc(r.note)}</div>`;
          res.innerHTML = html; setTone(res, r.tone || "blue");
        }
        drawForm(); compute();
      }
      if (!single) drawTabs();
      build();
    },
  });

  /* ================================================================
     6) CIRCUIT — مخطط كهرباء البراد
     ================================================================ */
  A.register("circuit", {
    title: "دارة البراد الكهربائية",
    params: "variant: 'nofrost' | 'static'",
    demo: [{ variant: "nofrost" }, { variant: "static" }],
    render(host, p) {
      const nf = p.variant !== "static";
      head(host, nf ? "دارة براد No-Frost (timer ميكانيكي)" : "دارة براد عادي (Static / Direct cool)", "غيّر وضع المفاتيح أو أدخل عطلاً، وتابع مسار التيار (الخطوط البرتقالية المتحركة) والأحمال التي تعمل.");
      const st = { th: true, timer: "cool", bim: true, door: false, f_ol: false, f_heat: false, f_timer: false, f_ptc: false };
      const W = 400, Hh = nf ? 446 : 250;
      const svg = S("svg", { viewBox: `0 0 ${W} ${Hh}`, class: "acv-ex-csvg", role: "img", "aria-label": "مخطط كهربائي للبراد" });
      host.appendChild(svg);
      const gW = S("g", { class: "acv-ex-wires" }, svg), gF = S("g", { class: "acv-ex-flows" + (reduce() ? " acv-ex-still" : "") }, svg), gC = S("g", {}, svg);
      const segs = [];
      const seg = (d, loads) => { S("path", { d, class: "acv-ex-wire" }, gW); const f = S("path", { d, class: "acv-ex-flow" }, gF); segs.push([f, loads]); };
      const dot = (x, y) => S("circle", { cx: x, cy: y, r: 3.2, class: "acv-ex-node" }, gC);
      const lab = (x, y, s, cls = "acv-ex-clab", anchor = "middle") => T(gC, x, y, s, { class: cls, "text-anchor": anchor });
      const parts = {};
      // switch: two terminals, lever
      function sw(key, x1, x2, y, label, ly, onTap, aria) {
        const g = S("g", { class: "acv-ex-sw" }, gC);
        S("rect", { x: x1 - 6, y: y - 26, width: x2 - x1 + 12, height: 40, rx: 8, class: "acv-ex-hit" }, g);
        S("circle", { cx: x1, cy: y, r: 3.6, class: "acv-ex-term" }, g);
        S("circle", { cx: x2, cy: y, r: 3.6, class: "acv-ex-term" }, g);
        const lev = S("line", { x1, y1: y, x2, y2: y, class: "acv-ex-lever" }, g);
        if (label) lab((x1 + x2) / 2, ly != null ? ly : y - 18, label);
        if (onTap) keyAct(g, onTap, aria || label);
        parts[key] = { g, set(closed) { const L = x2 - x1, a = closed ? 0 : -28 * Math.PI / 180; lev.setAttribute("x2", x1 + L * Math.cos(a)); lev.setAttribute("y2", y + L * Math.sin(a)); g.classList.toggle("acv-ex-open", !closed); } };
        return parts[key];
      }
      function motor(key, cx, cy, label, fan, ly) {
        const g = S("g", { class: "acv-ex-load" }, gC);
        S("circle", { cx, cy, r: 16, class: "acv-ex-lbody" }, g);
        if (fan) {
          const bl = S("g", { class: "acv-ex-blades" }, g);
          bl.style.transformOrigin = `${cx}px ${cy}px`;
          for (let i = 0; i < 3; i++) S("path", { d: `M${cx} ${cy} q 4 -9 0 -12 q -6 3 0 12z`, transform: `rotate(${i * 120} ${cx} ${cy})`, class: "acv-ex-blade" }, bl);
        } else T(g, cx, cy + 5, "M", { class: "acv-ex-mtxt", "text-anchor": "middle" });
        const x = S("path", { d: `M${cx - 9} ${cy - 9}L${cx + 9} ${cy + 9}M${cx + 9} ${cy - 9}L${cx - 9} ${cy + 9}`, class: "acv-ex-xmark" }, g);
        lab(cx, ly != null ? ly : cy - 22, label);
        parts[key] = { g, x };
      }
      function lamp(key, cx, cy, label) {
        const g = S("g", { class: "acv-ex-load acv-ex-lamp" }, gC);
        S("circle", { cx, cy, r: 13, class: "acv-ex-lbody" }, g);
        S("path", { d: `M${cx - 9} ${cy - 9}L${cx + 9} ${cy + 9}M${cx + 9} ${cy - 9}L${cx - 9} ${cy + 9}`, class: "acv-ex-lx" }, g);
        lab(cx, cy - 20, label);
        parts[key] = { g };
      }
      function heater(key, x1, x2, y, label) {
        const g = S("g", { class: "acv-ex-load acv-ex-heat" }, gC);
        let d = `M${x1} ${y}`; const n = 6, w = (x2 - x1) / n;
        for (let i = 0; i < n; i++) d += ` l${w / 4} -8 l${w / 2} 16 l${w / 4} -8`;
        S("rect", { x: x1 - 4, y: y - 14, width: x2 - x1 + 8, height: 28, rx: 6, class: "acv-ex-lbody acv-ex-hbox" }, g);
        S("path", { d, class: "acv-ex-zig" }, g);
        const x = S("path", { d: `M${(x1 + x2) / 2 - 9} ${y - 9}L${(x1 + x2) / 2 + 9} ${y + 9}M${(x1 + x2) / 2 + 9} ${y - 9}L${(x1 + x2) / 2 - 9} ${y + 9}`, class: "acv-ex-xmark" }, g);
        lab((x1 + x2) / 2, y - 20, label);
        parts[key] = { g, x };
      }
      function olp(key, x1, x2, y, ly) {
        sw(key, x1, x2, y, null);
        S("path", { d: `M${x1 + 6} ${y + 9} q ${(x2 - x1 - 12) / 4} 6 ${(x2 - x1 - 12) / 2} 0 t ${(x2 - x1 - 12) / 2} 0`, class: "acv-ex-olpw" }, parts[key].g);
        lab((x1 + x2) / 2, ly, "OLP");
      }
      function comp(cx, cy, ptcY) {
        const g = S("g", { class: "acv-ex-load acv-ex-comp" }, gC);
        S("circle", { cx, cy: cy + 10, r: 21, class: "acv-ex-lbody" }, g);
        T(g, cx, cy + 16, "M", { class: "acv-ex-mtxt", "text-anchor": "middle" });
        T(g, cx - 14, cy + 4, "C", { class: "acv-ex-tl", "text-anchor": "middle" });
        T(g, cx + 14, cy + 4, "R", { class: "acv-ex-tl", "text-anchor": "middle" });
        T(g, cx + 9, cy + 28, "S", { class: "acv-ex-tl", "text-anchor": "middle" });
        lab(cx, cy - 18, "Compressor");
        const pg = S("g", { class: "acv-ex-load acv-ex-ptc" }, gC);
        S("rect", { x: cx + 28, y: ptcY - 8, width: 30, height: 16, rx: 3, class: "acv-ex-lbody" }, pg);
        S("path", { d: `M${cx + 30} ${ptcY + 10} l26 -20`, class: "acv-ex-ptcline" }, pg);
        const px = S("path", { d: `M${cx + 34} ${ptcY - 6}L${cx + 52} ${ptcY + 6}M${cx + 52} ${ptcY - 6}L${cx + 34} ${ptcY + 6}`, class: "acv-ex-xmark" }, pg);
        lab(cx + 43, ptcY + 24, "PTC");
        parts.comp = { g }; parts.ptc = { g: pg, x: px };
      }

      const xL = 22, xN = 380;
      lab(xL, 40, "L", "acv-ex-rail"); lab(xN, 40, "N", "acv-ex-rail");
      const LOADS_ALL = nf ? ["lamp", "tm", "comp", "efan", "cfan", "heat"] : ["lamp", "comp"];
      const noLamp = LOADS_ALL.filter((x) => x !== "lamp");
      // lamp rung (y=62)
      seg(`M${xL} 48V62`, LOADS_ALL); seg(`M${xN} 62V48`, LOADS_ALL);
      seg(`M${xL} 62H110`, ["lamp"]); sw("doorA", 110, 150, 62, null, null, () => { st.door = !st.door; upd(); }, "باب البراد");
      lab(130, 44, "Door (NO)");
      seg(`M150 62H277`, ["lamp"]); lamp("lamp", 290, 62, "Lamp"); seg(`M303 62H${xN}`, ["lamp"]);
      dot(xL, 62); dot(xN, 62);
      const yT = nf ? 130 : 150;
      seg(`M${xL} 62V${yT}H50`, noLamp); seg(`M${xN} ${yT}V62`, noLamp);
      sw("th", 50, 100, yT, "Thermostat", yT - 18, () => { st.th = !st.th; upd(); }, "الـ thermostat");
      if (nf) {
        const yC = 184, yP = 216, yE = 286, yF = 342, yCo = 366, yPv = 390, yD = 414;
        seg(`M100 ${yT}H130`, noLamp); dot(130, yT);
        seg(`M130 ${yT}H274`, ["tm"]); motor("tm", 290, yT, "Timer motor"); seg(`M306 ${yT}H${xN}`, ["tm"]); dot(xN, yT);
        // bus down to SPDT pivot
        seg(`M130 ${yT}V${yPv}`, ["comp", "efan", "cfan", "heat"]);
        // SPDT (timer contacts)
        const g = S("g", { class: "acv-ex-sw" }, gC);
        S("rect", { x: 112, y: yCo - 16, width: 80, height: yD - yCo + 32, rx: 8, class: "acv-ex-hit" }, g);
        S("circle", { cx: 130, cy: yPv, r: 3.6, class: "acv-ex-term" }, g);
        S("circle", { cx: 178, cy: yCo, r: 3.6, class: "acv-ex-term" }, g);
        S("circle", { cx: 178, cy: yD, r: 3.6, class: "acv-ex-term" }, g);
        const lev = S("line", { x1: 130, y1: yPv, x2: 176, y2: yCo + 1, class: "acv-ex-lever" }, g);
        T(g, 172, yCo - 8, "COOL", { class: "acv-ex-tl", "text-anchor": "end" });
        T(g, 150, yD + 20, "DEF", { class: "acv-ex-tl", "text-anchor": "end" });
        lab(70, yPv - 6, "Defrost"); lab(70, yPv + 12, "timer");
        keyAct(g, () => { if (st.f_timer) { flash("الـ timer عالق — لا يتحرك. اضغط زر العطل لإلغائه."); return; } st.timer = st.timer === "cool" ? "def" : "cool"; upd(); }, "تلامس الـ defrost timer");
        parts.spdt = { g, set(pos) { lev.setAttribute("x2", 176); lev.setAttribute("y2", pos === "cool" ? yCo + 1 : yD - 1); } };
        // cool bus
        seg(`M178 ${yCo}H200V${yF}`, ["comp", "efan", "cfan"]); seg(`M200 ${yF}V${yE}`, ["comp", "efan"]); seg(`M200 ${yE}V${yC}`, ["comp"]);
        dot(200, yF); dot(200, yE);
        // compressor rung
        seg(`M200 ${yC}H222`, ["comp"]); olp("ol", 222, 256, yC, yC + 30); seg(`M256 ${yC}H282`, ["comp"]);
        comp(296, yC, yP);
        seg(`M310 ${yC}H${xN}`, ["comp"]); seg(`M305 ${yC + 30}V${yP}H324`, ["comp"]); seg(`M354 ${yP}H${xN}`, ["comp"]);
        seg(`M${xN} ${yP}V${yC}`, ["comp", "efan", "cfan", "heat"]); seg(`M${xN} ${yC}V${yT}`, ["comp", "efan", "cfan", "heat"]);
        dot(xN, yC); dot(xN, yP);
        // evap fan rung via door switch B (NC)
        seg(`M200 ${yE}H222`, ["efan"]); sw("doorB", 222, 258, yE, "Door (NC)", yE - 20, () => { st.door = !st.door; upd(); }, "باب البراد");
        seg(`M258 ${yE}H304`, ["efan"]); motor("efan", 320, yE, "Evap fan", true, yE - 22); seg(`M336 ${yE}H${xN}`, ["efan"]);
        seg(`M${xN} ${yE}V${yP}`, ["efan", "cfan", "heat"]); dot(xN, yE);
        // cond fan
        seg(`M200 ${yF}H304`, ["cfan"]); motor("cfan", 320, yF, "Cond fan", true, yF - 22); seg(`M336 ${yF}H${xN}`, ["cfan"]);
        seg(`M${xN} ${yF}V${yE}`, ["cfan", "heat"]); dot(xN, yF);
        // defrost rung
        seg(`M178 ${yD}H214`, ["heat"]); sw("bim", 214, 250, yD, "Bimetal", yD - 20, () => { st.bim = !st.bim; upd(); }, "الـ bimetal");
        seg(`M250 ${yD}H284`, ["heat"]); heater("heat", 284, 344, yD, "Heater"); seg(`M348 ${yD}H${xN}`, ["heat"]);
        seg(`M${xN} ${yD}V${yF}`, ["heat"]);
      } else {
        seg(`M100 ${yT}H150`, ["comp"]); olp("ol", 150, 186, yT, yT - 18); seg(`M186 ${yT}H262`, ["comp"]);
        comp(276, yT, yT + 34);
        seg(`M290 ${yT}H${xN}`, ["comp"]); seg(`M285 ${yT + 30}V${yT + 34}H304`, ["comp"]); seg(`M334 ${yT + 34}H${xN}`, ["comp"]);
        seg(`M${xN} ${yT + 34}V${yT}`, ["comp"]); dot(xN, yT + 34);
        T(gC, 200, 222, "الـ PTC بين S و R، والـ OLP على خط C", { class: "acv-ex-tl", "text-anchor": "middle" });
      }
      dot(xL, 48); dot(xN, 48);

      // controls
      const ctl = h("div", "acv-ex-cctl");
      const tg = (label, get, fn) => { const b = btn("", "acv-ex-tog", fn); b._lab = label; b._get = get; ctl.appendChild(b); return b; };
      const togs = [
        tg(() => "<small>Thermostat</small>" + (st.th ? "مغلق — يطلب تبريد" : "مفتوح — وصل للحرارة"), () => st.th, () => { st.th = !st.th; upd(); }),
        tg(() => "<small>باب البراد</small>" + (st.door ? "مفتوح" : "مغلق"), () => st.door, () => { st.door = !st.door; upd(); }),
      ];
      if (nf) {
        togs.push(tg(() => "<small>Defrost timer</small>" + (st.timer === "cool" ? "COOL — تبريد" : "DEFROST — إذابة"), () => st.timer === "def", () => { if (st.f_timer) { flash("الـ timer عالق — لا يتحرك."); return; } st.timer = st.timer === "cool" ? "def" : "cool"; upd(); }));
        togs.push(tg(() => "<small>Bimetal</small>" + (st.bim ? "مغلق — بارد/ثلج" : "مفتوح — ذاب الثلج"), () => st.bim, () => { st.bim = !st.bim; upd(); }));
      }
      host.appendChild(ctl);
      const fl = h("div", "acv-ex-faults"); fl.appendChild(h("span", "acv-ex-flt", "أدخل عطلاً:"));
      const fb = (key, label) => { const b = btn(label, "acv-ex-fbtn", () => { st[key] = !st[key]; upd(); }); b._k = key; fl.appendChild(b); return b; };
      const fbtns = [fb("f_ol", "OLP مفتوح")];
      if (nf) { fbtns.push(fb("f_heat", "Heater محروق")); fbtns.push(fb("f_timer", "Timer عالق")); }
      else fbtns.push(fb("f_ptc", "PTC تالف"));
      host.appendChild(fl);
      const out = infoBox(host);
      let flashT = 0;
      function flash(m) { out.innerHTML = esc(m); setTone(out, "warn"); flashT = Date.now(); }

      function upd() {
        const T_ = st.th;
        const on = {};
        on.lamp = st.door;
        if (nf) {
          on.tm = T_ && !st.f_timer;
          const cool = T_ && st.timer === "cool";
          on.comp = cool && !st.f_ol;
          on.efan = cool && !st.door;
          on.cfan = cool;
          on.heat = T_ && st.timer === "def" && st.bim && !st.f_heat;
        } else {
          on.comp = T_ && !st.f_ol && !st.f_ptc;
        }
        const hum = !nf && T_ && !st.f_ol && st.f_ptc;
        segs.forEach(([f, loads]) => f.classList.toggle("acv-ex-on", loads.some((l) => on[l]) || (hum && loads.includes("comp"))));
        parts.th.set(st.th); parts.doorA.set(st.door); if (parts.doorB) parts.doorB.set(!st.door);
        parts.ol.set(!st.f_ol); parts.ol.g.classList.toggle("acv-ex-fault", st.f_ol);
        if (nf) { parts.spdt.set(st.timer); parts.bim.set(st.bim); parts.spdt.g.classList.toggle("acv-ex-fault", st.f_timer); }
        ["lamp", "tm", "efan", "cfan", "heat"].forEach((k) => parts[k] && parts[k].g.classList.toggle("acv-ex-on", !!on[k]));
        parts.comp.g.classList.toggle("acv-ex-on", !!on.comp); parts.comp.g.classList.toggle("acv-ex-hum", hum);
        parts.ptc.g.classList.toggle("acv-ex-on", !!on.comp || hum); parts.ptc.g.classList.toggle("acv-ex-fault", st.f_ptc);
        if (parts.heat) parts.heat.g.classList.toggle("acv-ex-fault", st.f_heat);
        if (parts.tm) parts.tm.g.classList.toggle("acv-ex-fault", st.f_timer);
        togs.forEach((b) => { b.innerHTML = b._lab(); b.setAttribute("aria-pressed", b._get() ? "true" : "false"); b.classList.toggle("acv-ex-on", !!b._get()); });
        fbtns.forEach((b) => { b.classList.toggle("acv-ex-on", st[b._k]); b.setAttribute("aria-pressed", st[b._k] ? "true" : "false"); });
        // explanation
        const NAMES = nf ? [["comp", "الكباس"], ["cfan", "مروحة الـ condenser"], ["efan", "مروحة الـ evaporator"], ["heat", "الـ defrost heater"], ["tm", "محرك الـ timer"], ["lamp", "اللمبة"]] : [["comp", "الكباس"], ["lamp", "اللمبة"]];
        let html = `<div class="acv-ex-chips">` + NAMES.map(([k, n]) => `<span class="acv-ex-chip ${on[k] ? "acv-ex-chon" : ""}">${on[k] ? "●" : "○"} ${esc(n)}</span>`).join("") + "</div>";
        let why = "";
        if (st.f_ol) why = nf ? "الـ OLP مفتوح: الكباس متوقف بينما مراوح الـ condenser والـ evaporator تعمل — علامة مميزة. الـ OLP عادة يفصل لسبب (تيار عالٍ أو كباس ساخن): ابحث عن السبب قبل التبديل." : "الـ OLP مفتوح: لا يصل تيار للكباس إطلاقاً. قِس الـ OLP وهو بارد: يجب أن يكون موصولاً.";
        else if (hum) why = "الـ PTC تالف: ملف الـ start لا يأخذ تياراً، فالكباس يطنّ (تيار عالٍ في ملف الـ run) ثم يفصله الـ OLP بعد ثوانٍ — ويتكرر.";
        else if (nf && st.f_heat && st.timer === "def" && T_) why = "الـ heater محروق: الـ timer في وضع defrost لكن لا يمر تيار — الثلج يتراكم على الـ evaporator مع الأيام حتى ينقطع الهواء عن البراد.";
        else if (nf && st.f_timer) why = "محرك الـ timer عالق: التلامس لا يتغير. إن علق على COOL لا يحدث defrost ويتثلّج الـ evaporator؛ وإن علق على DEFROST يتوقف التبريد كلياً.";
        else if (!T_) why = "الـ thermostat مفتوح (الحرارة وصلت للمطلوب): كل شيء متوقف ما عدا دارة اللمبة.";
        else if (nf && st.timer === "def") why = st.bim ? "وضع defrost: الكباس والمراوح متوقفة والـ heater يذيب الثلج حتى يفصل الـ bimetal. محرك الـ timer يستمر بالدوران ليعود إلى COOL." : "الـ bimetal فصل (الثلج ذاب): الـ heater توقف، والـ timer ما زال على DEFROST — هذا وقت التنقيط (drip) قبل عودة التبريد.";
        else if (st.door && nf) why = "الباب مفتوح: اللمبة تضيء، وتلامس الـ door switch الثاني (NC) يوقف مروحة الـ evaporator حتى لا تدفع الهواء البارد للخارج.";
        else why = nf ? "تبريد عادي: الكباس ومروحتا الـ condenser والـ evaporator تعمل، ومحرك الـ timer يحسب ساعات التشغيل حتى الـ defrost التالي." : "تبريد عادي: الـ thermostat مغلق، التيار يمر عبر الـ OLP إلى C، والـ PTC يساعد ملف الـ start لحظة الإقلاع فقط.";
        if (Date.now() - flashT < 50) return;
        out.innerHTML = html + `<div>${esc(why)}</div>`;
        setTone(out, st.f_ol || st.f_heat || st.f_timer || st.f_ptc ? "bad" : "blue");
      }
      upd();
    },
  });

  /* ================================================================
     7) TIMELINE — دورة زمنية
     ================================================================ */
  const TL = {
    defrost: {
      title: "دورة الـ defrost في براد No-Frost",
      parts: ["Compressor", "Evap fan", "Cond fan", "Heater"],
      phases: [
        { name: "تبريد", mins: 480, range: "6–12 h حسب الـ timer", color: "blue", note: "الـ timer يحسب ساعات تشغيل الكباس. الرطوبة تتجمد تدريجياً على الـ evaporator.", parts: { Compressor: 1, "Evap fan": 1, "Cond fan": 1, Heater: 0 } },
        { name: "Defrost", mins: 20, range: "≈ 10–30 min", color: "orange", note: "الـ timer يقطع الكباس ويوصل الـ heater. الـ heater يعمل حتى يذوب الثلج ويفصل الـ bimetal.", parts: { Compressor: 0, "Evap fan": 0, "Cond fan": 0, Heater: 1 } },
        { name: "تنقيط", mins: 5, range: "≈ 2–10 min", color: "warn", note: "الـ bimetal فصل والـ timer ما زال على defrost: الماء ينزل من الـ evaporator إلى التصريف.", parts: { Compressor: 0, "Evap fan": 0, "Cond fan": 0, Heater: 0 } },
        { name: "تأخير المروحة", mins: 4, range: "≈ 2–5 min", color: "ok", note: "الكباس يعود، ومروحة الـ evaporator تنتظر حتى يبرد الـ evaporator كي لا تنفخ هواءً دافئاً ورطباً.", parts: { Compressor: 1, "Evap fan": 0, "Cond fan": 1, Heater: 0 } },
      ],
    },
    washer: {
      title: "برنامج الغسالة (قطن 40°C — تقريبي)",
      parts: ["Inlet valve", "Heater", "Motor", "Drain pump", "Door lock"],
      phases: [
        { name: "تعبئة", mins: 4, color: "blue", note: "صمام الماء يفتح حتى يصل الـ pressure switch للمستوى المطلوب. الباب مقفل.", parts: { "Inlet valve": 1, Heater: 0, Motor: "بطيء", "Drain pump": 0, "Door lock": 1 } },
        { name: "تسخين وغسيل", mins: 30, color: "orange", note: "الـ heater يعمل حتى يقرأ الـ NTC الحرارة المطلوبة. الـ heater لا يعمل إلا والماء فوق المستوى (حماية).", parts: { "Inlet valve": 0, Heater: 1, Motor: "يمين/يسار", "Drain pump": 0, "Door lock": 1 } },
        { name: "غسيل", mins: 15, color: "warn", note: "الحركة الميكانيكية للحلة تكمل التنظيف.", parts: { "Inlet valve": 0, Heater: 0, Motor: "يمين/يسار", "Drain pump": 0, "Door lock": 1 } },
        { name: "تصريف", mins: 2, color: "muted", note: "الـ drain pump تسحب الماء عبر الفلتر.", parts: { "Inlet valve": 0, Heater: 0, Motor: 0, "Drain pump": 1, "Door lock": 1 } },
        { name: "شطف ×2", mins: 16, color: "blue", note: "تعبئة، حركة، تصريف — مرتين أو ثلاثاً. آخر شطف يأخذ المنعّم.", parts: { "Inlet valve": "متقطع", Heater: 0, Motor: "يمين/يسار", "Drain pump": "متقطع", "Door lock": 1 } },
        { name: "عصر", mins: 10, color: "ok", note: "سرعة عالية (800–1400 rpm). البورد يفحص التوازن أولاً؛ الحمل غير المتوازن يخفّض السرعة.", parts: { "Inlet valve": 0, Heater: 0, Motor: "سرعة عالية", "Drain pump": 1, "Door lock": 1 } },
      ],
    },
  };
  const hm = (m) => { m = Math.round(m); const H = Math.floor(m / 60), M = m % 60; return H ? `${H}h ${String(M).padStart(2, "0")}m` : `${M} min`; };
  A.register("timeline", {
    title: "دورة زمنية",
    params: "kind: 'defrost'|'washer' أو phases: [{name, mins, color:'blue|orange|ok|warn|muted', note, range?, parts?:{part: 1|0|text}}], parts?: string[], title?",
    demo: [{ kind: "defrost" }, { kind: "washer" }],
    render(host, p) {
      const src = p.phases && p.phases.length ? p : TL[p.kind] || TL.defrost;
      const phases = src.phases, pnames = src.parts || p.parts || [];
      head(host, p.title || src.title || "دورة زمنية", "اضغط ▶ أو اسحب المؤشر لترى ما يحدث في كل مرحلة.");
      const total = phases.reduce((s, x) => s + x.mins, 0);
      // display weights: keep short phases visible
      const wts = phases.map((x) => Math.max(x.mins / total, 0.16));
      const ws = wts.reduce((a, b) => a + b, 0);
      const disp = wts.map((w) => w / ws);
      const nonlin = phases.some((x) => x.mins / total < 0.16);
      const starts = []; disp.reduce((s, w, i) => { starts[i] = s; return s + w; }, 0);
      const track = h("div", "acv-ex-track");
      const legend = h("div", "acv-ex-legend");
      const jump = (i) => { pos = starts[i] + 0.001; stop(); draw(); };
      phases.forEach((ph, i) => {
        const s = h("button", "acv-ex-tseg acv-ex-k-" + (ph.color || "blue"), `<span>${i + 1}</span>`, { type: "button", "aria-label": `${ph.name}: ${hm(ph.mins)}` });
        s.style.width = (disp[i] * 100).toFixed(2) + "%";
        s.addEventListener("click", () => jump(i));
        track.appendChild(s);
        const l = h("button", "acv-ex-lg acv-ex-k-" + (ph.color || "blue"), `<span class="acv-ex-lgn">${i + 1}</span>${esc(ph.name)} <small dir="ltr">${esc(hm(ph.mins))}</small>`, { type: "button" });
        l.addEventListener("click", () => jump(i));
        legend.appendChild(l);
      });
      const head_ = h("div", "acv-ex-phead"); track.appendChild(head_);
      host.appendChild(track); host.appendChild(legend);
      if (nonlin) host.appendChild(h("div", "acv-ex-scale", "ملاحظة: المراحل القصيرة مكبّرة للوضوح — المقياس غير خطّي."));
      const sl = h("input", "acv-ex-range", null, { type: "range", min: 0, max: 1000, value: 0, dir: "rtl", "aria-label": "موضع الوقت في الدورة" });
      host.appendChild(sl);
      const bar = h("div", "acv-ex-bar");
      const play = btn("▶ تشغيل", "acv-ex-pri", () => (running ? stop() : start()));
      const clock = h("span", "acv-ex-clock", null, { dir: "ltr" });
      bar.append(play, btn("⟲ من البداية", "", () => { pos = 0; draw(); }), clock);
      host.appendChild(bar);
      const card = h("div", "acv-ex-pcard", null, { "aria-live": "polite" }); host.appendChild(card);
      let pos = 0, running = false, last = 0, raf = 0, lastPh = -1, stepT = 0;
      const CYCLE_MS = 22000;
      function phaseAt(x) { for (let i = phases.length - 1; i >= 0; i--) if (x >= starts[i]) return i; return 0; }
      function draw() {
        const i = phaseAt(Math.min(pos, 0.99999)), ph = phases[i];
        const frac = Math.min(1, (pos - starts[i]) / disp[i]);
        const realT = phases.slice(0, i).reduce((s, x) => s + x.mins, 0) + frac * ph.mins;
        head_.style.right = (pos * 100).toFixed(2) + "%";
        sl.value = Math.round(pos * 1000);
        clock.textContent = `${hm(realT)} / ${hm(total)}`;
        [...track.querySelectorAll(".acv-ex-tseg")].forEach((s, k) => s.classList.toggle("acv-ex-cur", k === i));
        [...legend.children].forEach((s, k) => s.classList.toggle("acv-ex-cur", k === i));
        if (i !== lastPh) {
          lastPh = i;
          const chips = pnames.map((n) => { const v = ph.parts ? ph.parts[n] : 0; const onv = v === 1 || v === true || (typeof v === "string" && v); return `<span dir="ltr" class="acv-ex-chip ${onv ? "acv-ex-chon" : ""}"><bdi dir="ltr">${esc(n)}</bdi>: <b>${v === 1 || v === true ? "ON" : v ? esc(v) : "OFF"}</b></span>`; }).join("");
          card.innerHTML = `<div class="acv-ex-ptitle acv-ex-k-${ph.color || "blue"}"><span class="acv-ex-pdot"></span>${esc(ph.name)} <small dir="ltr">${esc(ph.range || hm(ph.mins))}</small></div><div class="acv-ex-pnote">${esc(ph.note || "")}</div>${chips ? `<div class="acv-ex-chips">${chips}</div>` : ""}`;
        }
      }
      function tick(t) {
        if (!alive(host)) { running = false; return; }
        if (!running) return;
        const dt = Math.min(100, t - last); last = t;
        if (reduce()) { stepT += dt; if (stepT > 1600) { stepT = 0; const i = phaseAt(pos); pos = starts[(i + 1) % phases.length] + 0.0001; } }
        else { pos += dt / CYCLE_MS; if (pos >= 1) pos -= 1; }
        draw(); raf = requestAnimationFrame(tick);
      }
      function start() { running = true; play.textContent = "❚❚ إيقاف"; last = performance.now(); stepT = 0; raf = requestAnimationFrame(tick); }
      function stop() { running = false; cancelAnimationFrame(raf); play.textContent = "▶ تشغيل"; }
      sl.addEventListener("input", () => { stop(); pos = Math.min(0.9999, sl.value / 1000); draw(); });
      draw();
    },
  });

  /* ================================================================
     8) TORQUE — عزم شدّ الـ flare
     ================================================================ */
  const TQ = [
    { s: '1/4"', mm: "6.35", t: [14, 18], nut: 17, a: "8.7–9.1", tip: "الأكثر عرضة للشد الزائد: الـ flare الرقيق يتشقق بعد أيام ويبدأ التسريب." },
    { s: '3/8"', mm: "9.52", t: [33, 42], nut: 22, a: "12.8–13.2", tip: "استعمل مفتاحين: مفتاح تثبيت على الـ union حتى لا يلتوي الأنبوب أو صمام الخدمة." },
    { s: '1/2"', mm: "12.7", t: [49, 61], nut: 26, a: "16.2–16.6", tip: "تأكد أن الـ flare في المركز تماماً قبل الشد — الـ flare المائل لا يُصلحه الشد الزائد." },
    { s: '5/8"', mm: "15.88", t: [62, 82], nut: 29, a: "19.3–19.7", tip: "يحتاج torque wrench حقيقي؛ بالتقدير اليدوي يحدث نقص الشد غالباً." },
    { s: '3/4"', mm: "19.05", t: [97, 110], nut: 36, a: "23.6–24.0", tip: "في الأنابيب الكبيرة يُفضّل اللحام أو الوصلات حسب الـ manual؛ إن استُعمل flare فبالعزم الكامل وبمفتاحين." },
  ];
  A.register("torque", {
    title: "عزم شدّ الـ Flare",
    params: "size?: '1/4\"'|'3/8\"'|'1/2\"'|'5/8\"'|'3/4\"' (الاختيار المبدئي)",
    demo: [{ size: '1/4"' }, { size: '5/8"' }],
    render(host, p) {
      let k = Math.max(0, TQ.findIndex((x) => x.s === p.size));
      head(host, "عزم شدّ صامولة الـ Flare", "اختر قطر الأنبوب لترى العزم الصحيح، ثم جرّب بنفسك.");
      const tabs = h("div", "acv-ex-seg acv-ex-tqtabs", null, { role: "radiogroup", "aria-label": "قطر الأنبوب" });
      host.appendChild(tabs);
      const svg = S("svg", { viewBox: "0 0 380 220", class: "acv-ex-tqsvg", role: "img", "aria-label": "مفتاح عزم على صامولة flare" });
      host.appendChild(svg);
      // pipe + nut + union
      const gP = S("g", {}, svg);
      S("rect", { x: 10, y: 92, width: 120, height: 16, rx: 3, class: "acv-ex-pipe" }, gP);
      S("rect", { x: 222, y: 92, width: 30, height: 16, rx: 3, class: "acv-ex-pipe" }, gP);
      S("path", { d: "M118 100h120", class: "acv-ex-pipehl" }, gP);
      const wr = S("g", { class: "acv-ex-wrench" }, svg);
      const wrBody = S("rect", { class: "acv-ex-wbody", rx: 7 }, wr);
      const wrGrip = S("rect", { class: "acv-ex-wgrip", rx: 7 }, wr);
      const wrHead = S("circle", { class: "acv-ex-whead" }, wr);
      const nut = S("path", { d: "", class: "acv-ex-nut" }, svg);
      const uni = S("path", { d: "", class: "acv-ex-union" }, svg);
      const arc = S("path", { d: "", class: "acv-ex-tarc" }, svg);
      const arrow = S("path", { d: "", class: "acv-ex-tarrow" }, svg);
      // gauge (right side)
      const gx = 310, gy = 168, gr = 54;
      const gG = S("g", {}, svg);
      const pol = (v, r) => { const a = Math.PI * (1 - v / 120); return [gx + r * Math.cos(a), gy - r * Math.sin(a)]; };
      const arcD = (v1, v2, r) => { const [x1, y1] = pol(v1, r), [x2, y2] = pol(v2, r); return `M${x1.toFixed(1)} ${y1.toFixed(1)}A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`; };
      S("path", { d: arcD(0, 120, gr), class: "acv-ex-gtrack" }, gG);
      const band = S("path", { d: "", class: "acv-ex-gband" }, gG);
      [0, 30, 60, 90, 120].forEach((v) => { const [x1, y1] = pol(v, gr - 9), [x2, y2] = pol(v, gr + 2); S("line", { x1, y1, x2, y2, class: "acv-ex-gtick" }, gG); const [tx, ty] = pol(v, gr - 20); T(gG, tx, ty + 4, String(v), { class: "acv-ex-gnum", "text-anchor": "middle" }); });
      const needle = S("line", { x1: gx, y1: gy, x2: gx, y2: gy - gr + 6, class: "acv-ex-needle" }, gG);
      S("circle", { cx: gx, cy: gy, r: 5, class: "acv-ex-hub" }, gG);
      T(gG, gx, gy + 20, "N·m", { class: "acv-ex-gnum", "text-anchor": "middle" });
      const bigT = T(svg, 190, 36, "", { class: "acv-ex-tqbig", "text-anchor": "middle" });
      const subT = T(svg, 190, 58, "", { class: "acv-ex-tqsub", "text-anchor": "middle" });
      const facts = h("div", "acv-ex-tqfacts"); host.appendChild(facts);
      // practice slider
      const pr = h("div", "acv-ex-tqtry");
      pr.innerHTML = `<label class="acv-ex-flab">جرّب: كم ستشدّ؟ <b dir="ltr" class="acv-ex-tqv"></b></label>`;
      const sl = h("input", "acv-ex-range", null, { type: "range", min: 0, max: 120, step: 1, value: 0, dir: "ltr", "aria-label": "العزم الذي ستشد به بالنيوتن متر" });
      pr.appendChild(sl); host.appendChild(pr);
      const out = infoBox(host);
      let tryV = null;
      function setNeedle(v) { const [x, y] = pol(Math.max(0, Math.min(120, v)), gr - 6); needle.setAttribute("x2", x.toFixed(1)); needle.setAttribute("y2", y.toFixed(1)); }
      function draw() {
        const d = TQ[k];
        tabs.innerHTML = "";
        TQ.forEach((x, i) => { const b = h("button", "acv-ex-segb" + (i === k ? " acv-ex-on" : ""), `<span dir="ltr">${x.s}</span>`, { type: "button", role: "radio", "aria-checked": i === k }); b.addEventListener("click", () => { k = i; tryV = null; draw(); tabs.querySelector(".acv-ex-on").focus({ preventScroll: true }); }); tabs.appendChild(b); });
        const sc = 0.75 + k * 0.12; // visual size
        const cx = 175, cy = 100, R1 = 17 * sc, R2 = 20 * sc;
        const hex = (r, cx_) => range(6).map((i) => { const a = Math.PI / 6 + i * Math.PI / 3; return `${(cx_ + r * Math.cos(a) * 0.55).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`; });
        nut.setAttribute("d", `M${cx - 22} ${cy - R2}h30v${2 * R2}h-30z M${cx - 22} ${cy - R2 * 0.5}h30 M${cx - 22} ${cy + R2 * 0.5}h30`);
        uni.setAttribute("d", `M${cx + 10} ${cy - R1}h34v${2 * R1}h-34z M${cx + 10} ${cy - R1 * 0.5}h34 M${cx + 10} ${cy + R1 * 0.5}h34`);
        void hex;
        // wrench: head behind the nut, handle hanging down at an angle (rotates about nut centre)
        const ncx = cx - 7, L = 70 + k * 9;
        wrHead.setAttribute("cx", ncx); wrHead.setAttribute("cy", cy); wrHead.setAttribute("r", R2 + 9);
        wrBody.setAttribute("x", ncx - 8); wrBody.setAttribute("y", cy); wrBody.setAttribute("width", 16); wrBody.setAttribute("height", L);
        wrGrip.setAttribute("x", ncx - 9.5); wrGrip.setAttribute("y", cy + L * 0.55); wrGrip.setAttribute("width", 19); wrGrip.setAttribute("height", L * 0.45 + 2);
        wr.setAttribute("transform", `rotate(28 ${ncx} ${cy})`);
        const ex = ncx - Math.sin(28 * Math.PI / 180) * (L + 6), ey = cy + Math.cos(28 * Math.PI / 180) * (L + 6);
        arc.setAttribute("d", `M${(ex + 22).toFixed(1)} ${(ey + 8).toFixed(1)} Q ${(ex - 18).toFixed(1)} ${(ey + 14).toFixed(1)} ${(ex - 26).toFixed(1)} ${(ey - 24).toFixed(1)}`);
        arrow.setAttribute("d", `M${(ex - 26).toFixed(1)} ${(ey - 34).toFixed(1)} l-6 11 l12 0z`);
        band.setAttribute("d", arcD(d.t[0], d.t[1], gr));
        bigT.textContent = `${d.t[0]}–${d.t[1]} N·m`;
        subT.textContent = `${d.s} (${d.mm} mm)`;
        setNeedle(tryV == null ? (d.t[0] + d.t[1]) / 2 : tryV);
        const kg = (x) => fmt(x / 0.2 / 9.81, 0);
        facts.innerHTML = `
          <div><span>العزم</span><b dir="ltr">${d.t[0]}–${d.t[1]} N·m</b></div>
          <div><span>مفتاح الصامولة (R410A/R32)</span><b dir="ltr">${d.nut} mm</b></div>
          <div><span>قطر الـ flare A (R410A/R32)</span><b dir="ltr">${d.a} mm</b></div>
          <div><span>بذراع 20 cm ≈ قوة يد</span><b dir="ltr">${kg(d.t[0])}–${kg(d.t[1])} kgf</b></div>`;
        sl.value = tryV == null ? 0 : tryV;
        pr.querySelector(".acv-ex-tqv").textContent = tryV == null ? "—" : tryV + " N·m";
        if (tryV == null) {
          out.innerHTML = `<b>نصيحة ${esc(d.s)}:</b> ${esc(d.tip)}<ul class="acv-ex-ul"><li>قصّ بالـ pipe cutter وأزل الـ burr والأنبوب متجه للأسفل.</li><li>ركّب الصامولة على الأنبوب <b>قبل</b> عمل الـ flare.</li><li>أداة flare لـ R410A/R32 تعطي القطر A الصحيح؛ الأداة القديمة تحتاج بروزاً أكبر للأنبوب.</li><li>لا تفلون ولا مانع تسريب على وجه الـ flare؛ زيت التبريد فقط إذا طلبه الـ manual.</li><li>بعد الشد: نيتروجين ثم vacuum ≤ 500 microns.</li></ul><div class="acv-ex-small">القياسات النموذجية — التزم بالـ manual الخاص بالجهاز.</div>`;
          setTone(out, "blue");
        } else if (tryV < d.t[0]) { out.innerHTML = `<b>شدّ ناقص (${tryV} N·m)</b>: الـ flare لا ينضغط كاملاً — تسريب بطيء يظهر بعد أسابيع. المطلوب ${d.t[0]}–${d.t[1]} N·m.`; setTone(out, "warn"); }
        else if (tryV > d.t[1]) { out.innerHTML = `<b>شدّ زائد (${tryV} N·m)</b>: يُرقّق الـ flare ويشققه أو يشوّه الصامولة — التسريب يظهر بعد التشغيل والتمدد الحراري. المطلوب ${d.t[0]}–${d.t[1]} N·m.`; setTone(out, "bad"); }
        else { out.innerHTML = `<b>✓ صحيح (${tryV} N·m)</b> ضمن ${d.t[0]}–${d.t[1]} N·m. أكمل باختبار النيتروجين وفحص الوصلة بالرغوة.`; setTone(out, "ok"); }

      }
      sl.addEventListener("input", () => { tryV = +sl.value; draw(); });
      draw();
    },
  });

  /* ================================================================
     9) CONTROLLER — محاكي كونترولر غرفة التبريد (Dixell-style)
     ================================================================ */
  const SEG = { "0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd", "6": "afgedc", "7": "abc", "8": "abcdefg", "9": "abcdfg", "-": "g", " ": "", A: "abcefg", b: "cdefg", C: "adef", c: "deg", d: "bcdeg", E: "adefg", F: "aefg", H: "bcefg", h: "cefg", I: "ef", i: "c", L: "def", M: "abcef", n: "ceg", o: "cdeg", P: "abefg", r: "eg", S: "afgcd", t: "defg", U: "bcdef", u: "cde", y: "bcdfg", Y: "bcdfg" };
  const CP = [
    { c: "Hy", n: "الفرق (Differential)", u: "°C", min: 0.5, max: 25, st: 0.5, d: 2, x: "الكباس يفصل عند St ويعود يشتغل عند St + Hy. فرق صغير جداً = تشغيل وإطفاء متكرر للكباس." },
    { c: "LS", n: "أدنى Set point مسموح", u: "°C", min: -50, max: 30, st: 1, d: -5, x: "يمنع الزبون من ضبط حرارة أقل من هذا الحد." },
    { c: "US", n: "أعلى Set point مسموح", u: "°C", min: -30, max: 50, st: 1, d: 10, x: "يمنع ضبط حرارة أعلى من هذا الحد." },
    { c: "AC", n: "تأخير حماية الكباس (Anti short cycle)", u: "min", min: 0, max: 50, st: 1, d: 3, x: "أقل وقت بين فصل الكباس وتشغيله مرة أخرى — ليتعادل الضغط ويحمي الكباس." },
    { c: "tdF", n: "نوع الـ defrost", u: "", opts: ["EL", "in"], d: "EL", x: "EL = heater كهربائي (الكباس يتوقف). in = hot gas (الكباس يعمل)." },
    { c: "dtE", n: "حرارة نهاية الـ defrost", u: "°C", min: -10, max: 30, st: 1, d: 8, x: "عندما يقرأ حساس الـ evaporator هذه الحرارة ينتهي الـ defrost (الثلج ذاب)." },
    { c: "IdF", n: "الفترة بين كل defrost", u: "h", min: 1, max: 120, st: 1, d: 6, x: "كل كم ساعة يبدأ defrost. غرف الخضار عادة أطول، والغرف الرطبة أو كثيرة الفتح أقصر." },
    { c: "MdF", n: "أقصى مدة للـ defrost", u: "min", min: 1, max: 120, st: 1, d: 20, x: "حماية: ينتهي الـ defrost بعد هذا الوقت حتى لو لم يصل الحساس إلى dtE." },
    { c: "dFd", n: "العرض أثناء الـ defrost", u: "", opts: ["rt", "it", "SEt", "dEF"], d: "dEF", x: "ماذا تعرض الشاشة أثناء الـ defrost: rt الحرارة الحقيقية، it حرارة بداية الـ defrost، SEt الـ set point، dEF كلمة dEF." },
    { c: "Fdt", n: "وقت التنقيط (Drip time)", u: "min", min: 0, max: 60, st: 1, d: 2, x: "في Dixell: وقت بعد الـ defrost ينتظر فيه الجهاز لينزل الماء قبل عودة التبريد. (في Eliwell نفس الاسم Fdt يعني تأخير المروحة!)" },
    { c: "FnC", n: "طريقة عمل المراوح", u: "", opts: ["C-n", "o-n", "C-Y", "o-Y"], d: "o-n", x: "C = مع الكباس فقط، o = دائماً. n = تتوقف أثناء الـ defrost، Y = تعمل أثناءه." },
    { c: "Fnd", n: "تأخير المروحة بعد الـ defrost", u: "min", min: 0, max: 60, st: 1, d: 5, x: "المراوح تنتظر بعد الـ defrost حتى يبرد الـ evaporator — كي لا تنفخ ماءً وهواءً دافئاً في الغرفة." },
    { c: "FSt", n: "حرارة إيقاف المروحة", u: "°C", min: -50, max: 50, st: 1, d: 2, x: "إذا كان الـ evaporator أدفأ من هذه القيمة تتوقف المراوح." },
  ];
  A.register("controller", {
    title: "كونترولر غرفة التبريد",
    params: "preset: 'chiller'|'freezer', values?: {St, Hy, IdF, ...}",
    demo: [{ preset: "chiller" }, { preset: "freezer" }],
    render(host, p) {
      const fz = p.preset === "freezer";
      const val = {}; CP.forEach((q) => (val[q.c] = q.d));
      val.St = 2;
      if (fz) Object.assign(val, { St: -18, LS: -30, US: -10, IdF: 8, MdF: 30, Fdt: 3, FSt: -5, dtE: 10 });
      if (p.values) Object.assign(val, p.values);
      head(host, fz ? "كونترولر فريزر (نمط Dixell)" : "كونترولر غرفة تبريد (نمط Dixell)", "استعمل الأزرار كما على الجهاز: SET لعرض/تغيير الـ set point، و SET+▼ للدخول إلى البرامج.");
      const svg = S("svg", { viewBox: "0 0 360 150", class: "acv-ex-dsvg", role: "img", "aria-label": "شاشة الكونترولر" });
      host.appendChild(svg);
      S("rect", { x: 6, y: 4, width: 348, height: 142, rx: 16, class: "acv-ex-face" }, svg);
      S("rect", { x: 16, y: 14, width: 328, height: 122, rx: 10, class: "acv-ex-bezel" }, svg);
      S("rect", { x: 92, y: 24, width: 236, height: 96, rx: 6, class: "acv-ex-lcd" }, svg);
      const digits = S("g", { class: "acv-ex-digits" }, svg);
      // 3 digit cells
      const cells = [];
      const dw = 56, dh = 70, dx0 = 116, dy0 = 37, gap = 16, t = 9;
      for (let i = 0; i < 3; i++) {
        const x = dx0 + i * (dw + gap), y = dy0;
        const g = S("g", { transform: `skewX(-6) translate(${6 * 0.105 * 0 + 7} 0)` }, digits);
        const segp = {
          a: `M${x + 4} ${y} h${dw - 8} l-${t} ${t} h-${dw - 8 - 2 * t}z`,
          d: `M${x + 4} ${y + dh} h${dw - 8} l-${t} -${t} h-${dw - 8 - 2 * t}z`,
          f: `M${x} ${y + 4} v${dh / 2 - 6} l${t} -${t / 2} v-${dh / 2 - 6 - 1.5 * t}z`,
          b: `M${x + dw} ${y + 4} v${dh / 2 - 6} l-${t} -${t / 2} v-${dh / 2 - 6 - 1.5 * t}z`,
          e: `M${x} ${y + dh - 4} v-${dh / 2 - 6} l${t} ${t / 2} v${dh / 2 - 6 - 1.5 * t}z`,
          c: `M${x + dw} ${y + dh - 4} v-${dh / 2 - 6} l-${t} ${t / 2} v${dh / 2 - 6 - 1.5 * t}z`,
          g: `M${x + 3} ${y + dh / 2} l${t} -${t / 2} h${dw - 6 - 2 * t} l${t} ${t / 2} l-${t} ${t / 2} h-${dw - 6 - 2 * t}z`,
        };
        const segs = {};
        for (const s in segp) segs[s] = S("path", { d: segp[s], class: "acv-ex-sg" }, g);
        const dp = S("circle", { cx: x + dw + 7, cy: y + dh - 2, r: 4, class: "acv-ex-sg" }, g);
        cells.push({ segs, dp });
      }
      // icons (left of display)
      const ic = S("g", {}, svg);
      const icon = (y, draw, lbl) => { const g = S("g", { class: "acv-ex-led" }, ic); draw(g); T(g, 64, y + 4, lbl, { class: "acv-ex-ledt", "text-anchor": "end" }); return g; };
      const icComp = icon(42, (g) => { const c = [80, 42]; for (let i = 0; i < 3; i++) S("path", { d: `M${c[0]} ${c[1] - 9}V${c[1] + 9}`, transform: `rotate(${i * 60} ${c[0]} ${c[1]})`, class: "acv-ex-ledl" }, g); }, "COMP");
      const icFan = icon(72, (g) => { const c = [80, 72]; for (let i = 0; i < 3; i++) S("path", { d: `M${c[0]} ${c[1]} q 4 -9 0 -10 q -5 2 0 10z`, transform: `rotate(${i * 120} ${c[0]} ${c[1]})`, class: "acv-ex-ledf" }, g); }, "FAN");
      const icDef = icon(102, (g) => { S("path", { d: "M80 93c-5 7-6 10-6 12a6 6 0 0 0 12 0c0-2-1-5-6-12z", class: "acv-ex-ledf" }, g); }, "DEF");
      const ctrlRow = h("div", "acv-ex-keys");
      const kSet = btn("SET", "acv-ex-key", () => press("set"), "زر SET");
      const kUp = btn("▲", "acv-ex-key", () => press("up"), "زر للأعلى");
      const kDn = btn("▼", "acv-ex-key", () => press("down"), "زر للأسفل");
      ctrlRow.append(kSet, kUp, kDn);
      host.appendChild(ctrlRow);
      const combo = h("div", "acv-ex-keys acv-ex-keys2");
      combo.append(
        btn('الدخول إلى البرامج <bdi dir="ltr" class="acv-ex-kc">SET + ▼</bdi> <small>(معاً 3 ث)</small>', "acv-ex-key2", () => press("prog"), "الدخول إلى البرامج: SET مع السهم للأسفل"),
        btn('خروج <bdi dir="ltr" class="acv-ex-kc">SET + ▲</bdi>', "acv-ex-key2", () => press("exit"), "خروج: SET مع السهم للأعلى"),
        btn('Defrost يدوي <bdi dir="ltr" class="acv-ex-kc">▲</bdi> <small>(2 ث)</small>', "acv-ex-key2", () => press("mdef"), "defrost يدوي")
      );
      host.appendChild(combo);
      const stat = h("div", "acv-ex-dstat", null, { dir: "rtl" }); host.appendChild(stat);
      const map = h("div", "acv-ex-pmap", null, { "aria-hidden": "true" }); host.appendChild(map);
      const out = infoBox(host);
      const cmp = h("details", "acv-ex-cmp");
      cmp.innerHTML = `<summary>نفس الوظيفة بأسماء مختلفة: Dixell / Eliwell / Carel</summary>
        <div class="acv-ex-tblw"><table class="acv-ex-tbl"><thead><tr><th>الوظيفة</th><th>Dixell</th><th>Eliwell</th><th>Carel</th></tr></thead><tbody>
        <tr><td>Set point</td><td>SET</td><td>SEt</td><td>St</td></tr>
        <tr><td>الفرق</td><td>Hy</td><td>diF</td><td>rd</td></tr>
        <tr><td>الفترة بين الـ defrost</td><td>IdF</td><td>dit</td><td>dI</td></tr>
        <tr><td>أقصى مدة defrost</td><td>MdF</td><td>dEt</td><td>dP1</td></tr>
        <tr><td>حرارة نهاية الـ defrost</td><td>dtE</td><td>dSt</td><td>dt1</td></tr>
        <tr><td>وقت التنقيط</td><td><b>Fdt</b></td><td>dt</td><td>dd</td></tr>
        <tr><td>تأخير المروحة بعد الـ defrost</td><td>Fnd</td><td><b>Fdt</b></td><td>Fd</td></tr>
        </tbody></table></div>
        <div class="acv-ex-small">انتبه: <b dir="ltr">Fdt</b> في Dixell = وقت التنقيط، وفي Eliwell = تأخير المروحة. الأسماء قد تختلف حتى بين موديلات نفس الشركة — راجع الـ manual.</div>`;
      host.appendChild(cmp);

      // ---- state ----
      let mode = "run", idx = 0, editV = null, blinkOn = true;
      const sim = { T: val.St + 4, Te: val.St - 2, comp: false, lastStop: -999, t: 0, ph: "norm", phT: 0, since: 0, itT: 0, fan: false };
      const fmtT = (v) => (v > -10 && v < 100 ? (Math.round(v * 10) / 10).toFixed(1) : String(Math.round(v)));
      function show(str) {
        // parse into up to 3 cells with dp flags, right aligned
        const cs = [];
        for (const ch of String(str)) { if (ch === "." && cs.length) cs[cs.length - 1].dp = true; else cs.push({ ch, dp: false }); }
        while (cs.length < 3) cs.unshift({ ch: " ", dp: false });
        const use = cs.slice(-3);
        use.forEach((c, i) => { const on = SEG[c.ch] != null ? SEG[c.ch] : SEG[c.ch.toUpperCase()] || ""; for (const s in cells[i].segs) cells[i].segs[s].classList.toggle("acv-ex-sgon", on.includes(s)); cells[i].dp.classList.toggle("acv-ex-sgon", c.dp); });
      }
      const pval = (q, v) => (q.opts ? v : q.u === "°C" ? fmtT(v) : String(Math.round(v)));
      function displayStr() {
        if (mode === "set") return fmtT(editV);
        if (mode === "list") return CP[idx].c;
        if (mode === "edit") return pval(CP[idx], editV);
        if (sim.ph === "def" || sim.ph === "drip") { const m = val.dFd; if (m === "rt") return fmtT(sim.T); if (m === "it") return fmtT(sim.itT); if (m === "SEt") return fmtT(val.St); return "dEF"; }
        return fmtT(sim.T);
      }
      function render() {
        const blinking = mode === "set" || mode === "edit";
        digits.classList.toggle("acv-ex-blink", blinking && !reduce());
        show(displayStr());
        icComp.classList.toggle("acv-ex-ledon", sim.comp);
        icFan.classList.toggle("acv-ex-ledon", sim.fan);
        icDef.classList.toggle("acv-ex-ledon", sim.ph === "def");
        const phTxt = { norm: "تبريد/انتظار", def: "Defrost", drip: "تنقيط (Fdt)", fdel: "تأخير مروحة (Fnd)" }[sim.ph];
        stat.innerHTML = `<span>الغرفة ${num(fmtT(sim.T) + "°C")}</span><span>الـ Evaporator ${num(fmtT(sim.Te) + "°C")}</span><span>${esc(phTxt)}</span><span>المحاكاة أسرع ${num("×120")}</span>`;
        map.innerHTML = CP.map((q, i) => `<span class="acv-ex-pm ${(mode === "list" || mode === "edit") && i === idx ? "acv-ex-on" : ""}" dir="ltr">${q.c}</span>`).join("");
        let html = "", tone = "blue";
        if (mode === "run") {
          html = `<b>الوضع العادي</b>: الشاشة تعرض حرارة الغرفة. الكباس يفصل عند ${num(fmtT(val.St) + "°C")} (St) ويعود عند ${num(fmtT(val.St + val.Hy) + "°C")} (St + Hy).`;
          if (sim.ph !== "norm") html += ` <br>الآن: <b>${esc(phTxt)}</b> — ${sim.ph === "def" ? `ينتهي عند ${num("dtE = " + val.dtE + "°C")} أو بعد ${num("MdF = " + val.MdF + " min")}` : sim.ph === "drip" ? `ينتظر ${num(val.Fdt + " min")} لينزل الماء` : `المراوح تنتظر ${num(val.Fnd + " min")}`}.`;
        } else if (mode === "set") {
          html = `<b>Set point</b> يرمش: غيّره بـ ▲▼ (بين ${num("LS " + val.LS)} و ${num("US " + val.US)}) ثم اضغط <b>SET</b> للحفظ.`; tone = "warn";
        } else {
          const q = CP[idx];
          html = `<b dir="ltr">${q.c}</b> — <b>${esc(q.n)}</b><br>${esc(q.x)}<br>القيمة: ${num(pval(q, mode === "edit" ? editV : val[q.c]) + (q.u ? " " + q.u : ""))}${q.opts ? "" : ` <span class="acv-ex-small">(${num(q.min + "…" + q.max)})</span>`}<div class="acv-ex-small">${mode === "edit" ? "▲▼ لتغيير القيمة، ثم SET للحفظ." : "▲▼ للتنقل بين البرامج، SET لفتح القيمة، SET+▲ للخروج."}</div>`;
          tone = mode === "edit" ? "warn" : "blue";
        }
        out.innerHTML = html; setTone(out, tone);
      }
      function press(k) {
        if (k === "prog") { mode = "list"; idx = 0; render(); return; }
        if (k === "exit") { mode = "run"; render(); return; }
        if (k === "mdef") { if (mode === "run" && sim.ph === "norm") startDef(); render(); return; }
        if (mode === "run") {
          if (k === "set") { mode = "set"; editV = val.St; }
          else if (k === "up" || k === "down") { out.innerHTML = "في الوضع العادي ▲▼ لا تغيّر شيئاً. اضغط <b>SET</b> أولاً لتغيير الـ set point."; setTone(out, "warn"); return; }
        } else if (mode === "set") {
          if (k === "up") editV = Math.min(val.US, Math.round((editV + 0.5) * 10) / 10);
          if (k === "down") editV = Math.max(val.LS, Math.round((editV - 0.5) * 10) / 10);
          if (k === "set") { val.St = editV; mode = "run"; }
        } else if (mode === "list") {
          if (k === "up") idx = (idx + CP.length - 1) % CP.length;
          if (k === "down") idx = (idx + 1) % CP.length;
          if (k === "set") { mode = "edit"; editV = val[CP[idx].c]; }
        } else if (mode === "edit") {
          const q = CP[idx];
          if (q.opts) { const i = q.opts.indexOf(editV); if (k === "up") editV = q.opts[(i + 1) % q.opts.length]; if (k === "down") editV = q.opts[(i + q.opts.length - 1) % q.opts.length]; }
          else { if (k === "up") editV = Math.min(q.max, Math.round((editV + q.st) * 10) / 10); if (k === "down") editV = Math.max(q.min, Math.round((editV - q.st) * 10) / 10); }
          if (k === "set") { val[q.c] = editV; if (q.c === "LS" || q.c === "US") val.St = Math.min(val.US, Math.max(val.LS, val.St)); mode = "list"; idx = (idx + 1) % CP.length; }
        }
        render();
      }
      function startDef() { sim.ph = "def"; sim.phT = 0; sim.itT = sim.T; sim.since = 0; }
      function step() {
        sim.t++; sim.phT++;
        const St = val.St, Hy = val.Hy, amb = 30;
        const fnC = val.FnC, contFan = fnC[0] === "o", fanInDef = fnC[2] === "Y";
        if (sim.ph === "norm" || sim.ph === "fdel") {
          sim.since++;
          if (sim.comp && sim.T <= St) { sim.comp = false; sim.lastStop = sim.t; }
          else if (!sim.comp && sim.T >= St + Hy && sim.t - sim.lastStop >= val.AC) sim.comp = true;
          if (sim.ph === "fdel" && sim.phT >= val.Fnd) sim.ph = "norm";
          if (sim.ph === "norm" && sim.since >= val.IdF * 60) startDef();
        }
        if (sim.ph === "def") {
          sim.comp = val.tdF === "in";
          if (sim.Te >= val.dtE || sim.phT >= val.MdF) { sim.ph = "drip"; sim.phT = 0; sim.comp = false; }
        } else if (sim.ph === "drip") {
          sim.comp = false;
          if (sim.phT >= val.Fdt) { sim.ph = "fdel"; sim.phT = 0; }
        }
        // fans
        let fan = contFan || sim.comp;
        if (sim.ph === "def") fan = fanInDef; if (sim.ph === "drip" || sim.ph === "fdel") fan = false;
        if (sim.ph === "norm" && sim.Te > val.FSt && !sim.comp && !contFan) fan = false;
        sim.fan = fan;
        // physics (very simplified)
        const target = St - 9;
        if (sim.ph === "def") sim.Te += 1.3;
        else if (sim.comp) sim.Te += (target - sim.Te) * 0.25;
        else sim.Te += (sim.T - sim.Te) * 0.15;
        const coolEff = sim.comp && (sim.fan || sim.ph === "fdel") ? (sim.fan ? 0.55 : 0.2) : 0;
        sim.T += (amb - sim.T) * 0.006 - coolEff * Math.max(0, (sim.T - sim.Te)) * 0.06 + (sim.ph === "def" ? 0.05 : 0);
        render();
      }
      let seen = false, idle = 0;
      const iv = setInterval(() => {
        if (alive(host)) { seen = true; idle = 0; step(); }
        else if (seen || ++idle > 120) clearInterval(iv); // removed from DOM (or never attached)
      }, 500);
      render();
    },
  });
})();
