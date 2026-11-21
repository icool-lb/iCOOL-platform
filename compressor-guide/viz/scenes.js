/* iCOOL Academy — "scenes" group: interactive cut-away / schematic illustrations.
   Widgets: cycle, fridge, split, washer, coldroom, compressor.  Hand-built inline SVG, no deps. */
(function () {
  if (!window.ACV) return;
  const ACV = window.ACV;
  const SV = ACV.svgEl;
  const PX = "acv-scenes-";
  const uid = () => Math.random().toString(36).slice(2, 8);

  /* ---------- tiny SVG drawing kit ---------- */
  const c = (s) => (s ? s.split(" ").map((k) => PX + k).join(" ") : "");
  const G = (p, cls, attrs) => SV("g", Object.assign(cls ? { class: c(cls) } : {}, attrs || {}), p);
  const P = (p, d, cls, attrs) => SV("path", Object.assign({ d, class: c(cls) }, attrs || {}), p);
  const R = (p, x, y, w, h, rx, cls, attrs) => SV("rect", Object.assign({ x, y, width: w, height: h, rx: rx || 0, class: c(cls) }, attrs || {}), p);
  const C = (p, cx, cy, r, cls, attrs) => SV("circle", Object.assign({ cx, cy, r, class: c(cls) }, attrs || {}), p);
  const E = (p, cx, cy, rx, ry, cls, attrs) => SV("ellipse", Object.assign({ cx, cy, rx, ry, class: c(cls) }, attrs || {}), p);
  const L = (p, x1, y1, x2, y2, cls, attrs) => SV("line", Object.assign({ x1, y1, x2, y2, class: c(cls) }, attrs || {}), p);
  function T(p, x, y, s, cls, anchor, rtl) {
    const ar = rtl == null ? /[؀-ۿ]/.test(s) : rtl;
    const t = SV("text", { x, y, class: c("tx " + (cls || "")), "text-anchor": anchor || "middle", direction: ar ? "rtl" : "ltr" }, p);
    t.textContent = s; return t;
  }
  // serpentine coil: rows of horizontal tubes joined by U-bends. startRight=true → first row flows right→left
  function serp(x1, x2, ys, startRight) {
    let d = "", dir = startRight ? -1 : 1;
    ys.forEach((y, i) => {
      const a = dir > 0 ? x1 : x2, b = dir > 0 ? x2 : x1;
      if (i === 0) d += `M${a},${y}`;
      d += ` H${b}`;
      if (i < ys.length - 1) { const ny = ys[i + 1], r = (ny - y) / 2; d += ` A${r},${r} 0 0 ${dir > 0 ? 1 : 0} ${b},${ny}`; }
      dir = -dir;
    });
    return d;
  }
  function fins(p, x, y, w, h, step, cls) { let d = ""; for (let i = x + step / 2; i < x + w; i += step) d += `M${i.toFixed(1)},${y}V${y + h}`; return P(p, d, cls || "fin"); }
  function hatch(p, x, y, w, h, step, cls) { // diagonal hatch clipped manually to rect
    let d = "";
    for (let k = -h; k < w; k += step) { const x0 = x + Math.max(k, 0), y0 = y + (k < 0 ? -k : 0); const len = Math.min(w - Math.max(k, 0), h - (k < 0 ? -k : 0)); if (len > 0) d += `M${x0},${y0}l${len},${len}`; }
    return P(p, d, cls || "hatch");
  }
  function zig(x1, y1, x2, y2, n, a) { // spring / heater zigzag
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    let d = `M${x1},${y1}`; for (let i = 1; i < n * 2; i++) { const t = i / (n * 2), s = i % 2 ? a : -a; d += ` L${(x1 + dx * t + nx * s).toFixed(1)},${(y1 + dy * t + ny * s).toFixed(1)}`; }
    return d + ` L${x2},${y2}`;
  }
  function fan(p, cx, cy, r, cls) { // axial fan front view
    const g = G(p, cls || "");
    C(g, cx, cy, r, "fanring");
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2, a2 = a + 0.75, rr = r * 0.82;
      P(g, `M${cx},${cy} Q${(cx + Math.cos(a - 0.35) * rr).toFixed(1)},${(cy + Math.sin(a - 0.35) * rr).toFixed(1)} ${(cx + Math.cos(a + 0.25) * rr).toFixed(1)},${(cy + Math.sin(a + 0.25) * rr).toFixed(1)} Q${(cx + Math.cos(a2) * rr * 0.6).toFixed(1)},${(cy + Math.sin(a2) * rr * 0.6).toFixed(1)} ${cx},${cy}Z`, "blade");
    }
    C(g, cx, cy, r * 0.18, "hub");
    return g;
  }
  function xfan(p, cx, cy, r) { // cross-flow (tangential) fan section
    const g = G(p, "");
    C(g, cx, cy, r, "fanring");
    for (let i = 0; i < 16; i++) { const a = (i * Math.PI) / 8; P(g, `M${(cx + Math.cos(a) * r * 0.62).toFixed(1)},${(cy + Math.sin(a) * r * 0.62).toFixed(1)} Q${(cx + Math.cos(a + 0.35) * r * 0.9).toFixed(1)},${(cy + Math.sin(a + 0.35) * r * 0.9).toFixed(1)} ${(cx + Math.cos(a + 0.2) * r * 0.98).toFixed(1)},${(cy + Math.sin(a + 0.2) * r * 0.98).toFixed(1)}`, "ln thin"); }
    C(g, cx, cy, r * 0.22, "hub");
    return g;
  }
  // refrigerant / water pipe with optional animated flow beads. st: hot|liq|mix|vap|wat|air
  function pipe(p, d, st, w) {
    const g = G(p, "pipe st-" + st + (w ? " w" + w : ""));
    P(g, d, "pipe-o"); P(g, d, "pipe-i"); P(g, d, "flow");
    return g;
  }
  function arrow(p, x, y, ang, cls, s) { // small chevron arrow head
    s = s || 6; const g = G(p, cls || "arr", { transform: `translate(${x},${y}) rotate(${ang})` });
    P(g, `M${-s},${-s * 0.8} L${s * 0.6},0 L${-s},${s * 0.8}`, "arrp");
    return g;
  }
  function wavy(p, x, y, len, ang, cls) { // airflow arrow (wavy line + head)
    const g = G(p, cls || "air", { transform: `translate(${x},${y}) rotate(${ang})` });
    let d = "M0,0"; const n = Math.max(2, Math.round(len / 10)); for (let i = 0; i < n; i++) d += ` q${len / n / 4},-4 ${len / n / 2},0 t${len / n / 2},0`;
    P(g, d, "airp"); P(g, `M${len - 6},-5 L${len + 1},0 L${len - 6},5`, "airp");
    return g;
  }

  /* ---------- the generic interactive scene engine ---------- */
  // o: { vb:[w,h], label, intro, parts(state)->[{id, n, ar, en, b:[x,y], t:[x,y], what, fail, test}], draw(S, state),
  //      controls:[{type:'toggle', key, label, cls?, redraw?} | {type:'seg', key, items:[[val,label]], redraw:true}],
  //      state:{}, legend(state)->html, focus:[ids], caption }
  function scene(host, o) {
    const id = uid();
    const st = Object.assign({}, o.state || {});
    host.classList.add(PX + "root");
    host.innerHTML = "";
    const mk = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls.split(" ").map((k) => PX + k).join(" "); if (html != null) e.innerHTML = html; return e; };
    const bar = mk("div", "bar"); bar.setAttribute("role", "toolbar"); bar.setAttribute("aria-label", "خيارات الرسم");
    const stage = mk("div", "stage");
    const legend = mk("div", "legend");
    const chips = mk("div", "chips");
    const info = mk("div", "info"); info.setAttribute("aria-live", "polite");
    const nav = mk("div", "nav");
    host.append(bar, stage, legend, chips, info, nav);
    if (o.caption) { const cp = document.createElement("div"); cp.className = "acv-cap"; cp.textContent = o.caption; host.appendChild(cp); }
    let parts = [], walk = [], sel = null, tour = null, svg = null, hiLayer = null, moved = [];
    const focus = Array.isArray(o.focus) ? o.focus.map(String) : null;

    // controls
    const ctlBtns = [];
    (o.controls || []).forEach((ct) => {
      if (ct.type === "seg") {
        const grp = mk("div", "seg"); grp.setAttribute("role", "group"); grp.setAttribute("aria-label", ct.label || "");
        ct.items.forEach(([v, lab]) => {
          const b = mk("button", "btn", ACV.esc(lab)); b.type = "button";
          b.addEventListener("click", () => { if (st[ct.key] === v) return; st[ct.key] = v; sync(); if (ct.redraw) draw(); });
          grp.appendChild(b); ctlBtns.push(() => b.setAttribute("aria-pressed", st[ct.key] === v ? "true" : "false"));
        });
        bar.appendChild(grp);
      } else {
        const b = mk("button", "btn tog", ACV.esc(ct.label)); b.type = "button";
        b.addEventListener("click", () => { st[ct.key] = !st[ct.key]; sync(); if (ct.redraw) draw(); });
        bar.appendChild(b); ctlBtns.push(() => b.setAttribute("aria-pressed", st[ct.key] ? "true" : "false"));
      }
    });
    if (!ctlBtns.length) bar.remove();
    function sync() {
      ctlBtns.forEach((f) => f());
      (o.controls || []).forEach((ct) => { if (ct.cls && svg) svg.classList.toggle(PX + ct.cls, !st[ct.key]); });
    }

    // navigation
    const bPrev = mk("button", "btn", "السابق"), bTour = mk("button", "btn pri", ""), bNext = mk("button", "btn", "التالي");
    [bPrev, bTour, bNext].forEach((b) => { b.type = "button"; nav.appendChild(b); });
    bPrev.setAttribute("aria-label", "القطعة السابقة"); bNext.setAttribute("aria-label", "القطعة التالية");
    const tourLabel = () => { bTour.textContent = tour ? "إيقاف" : "عرض الكل"; bTour.setAttribute("aria-pressed", tour ? "true" : "false"); };
    const step = (k) => { const ids = walk.map((p) => p.id); let i = ids.indexOf(sel); i = i < 0 ? (k > 0 ? 0 : ids.length - 1) : (i + k + ids.length) % ids.length; select(ids[i]); };
    bPrev.addEventListener("click", () => { stopTour(); step(-1); });
    bNext.addEventListener("click", () => { stopTour(); step(1); });
    function stopTour() { if (tour) { clearInterval(tour); tour = null; tourLabel(); } }
    bTour.addEventListener("click", () => {
      if (tour) { stopTour(); return; }
      const ids = walk.map((p) => p.id); if (!ids.length) return;
      select(ids[0]);
      tour = setInterval(() => {
        if (!host.isConnected) { stopTour(); return; }
        const i = ids.indexOf(sel); if (i >= ids.length - 1) { stopTour(); return; } select(ids[i + 1]);
      }, 4200);
      tourLabel();
    });
    tourLabel();

    function select(pid) {
      sel = pid;
      const p = parts.find((q) => q.id === pid);
      if (svg) {
        svg.classList.toggle(PX + "has-sel", !!p);
        // lift the selected part above a dimmed base (group opacity → no see-through)
        moved.forEach(([n, ph]) => { ph.parentNode.insertBefore(n, ph); ph.remove(); }); moved = [];
        svg.querySelectorAll("[data-pid]").forEach((e) => e.classList.toggle(PX + "on", e.getAttribute("data-pid") === pid));
        if (p) svg.querySelectorAll(`.${PX}base .${PX}p[data-pid="${pid}"]`).forEach((n) => { const ph = document.createComment(""); n.parentNode.insertBefore(ph, n); hiLayer.appendChild(n); moved.push([n, ph]); });
      }
      chips.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.pid === pid ? "true" : "false"));
      if (!p) { info.innerHTML = `<p class="${PX}intro">${o.intro || ""}<br><span class="${PX}hint">اضغط على أي رقم أو قطعة في الرسم لمعرفة وظيفتها، كيف تتعطل، وكيف تفحصها.</span></p>`; return; }
      const sec = (k, lab, cls) => (p[k] ? `<div class="${PX}sec ${PX}${cls}"><b>${lab}</b><p>${p[k]}</p></div>` : "");
      info.innerHTML = `<div class="${PX}ih"><span class="${PX}num">${p.n}</span><div><strong>${ACV.esc(p.ar)}</strong><span class="${PX}en" dir="ltr">${ACV.esc(p.en || "")}</span></div></div>` +
        sec("what", "الوظيفة", "s-what") + sec("fail", "كيف تتعطل", "s-fail") + sec("test", "كيف تفحصها", "s-test");
    }

    function draw() {
      stopTour();
      parts = o.parts(st).map((p, i) => Object.assign({ n: i + 1 }, p));
      const known = new Set(parts.map((p) => p.id));
      const fset = focus ? focus.filter((f) => known.has(f)) : [];
      walk = fset.length ? parts.filter((p) => fset.includes(p.id)) : parts;
      stage.innerHTML = "";
      svg = SV("svg", { viewBox: `0 0 ${o.vb[0]} ${o.vb[1]}`, class: c("svg"), role: "group", "aria-label": o.label || "" }, stage);
      const S = {
        id, svg, st,
        defs: SV("defs", {}, svg),
        base: G(svg, "base"),
        clip(d) { const cid = PX + id + "-c" + (S._n = (S._n || 0) + 1); const cp = SV("clipPath", { id: cid }, S.defs); SV("path", { d, "clip-rule": "evenodd" }, cp); return `url(#${cid})`; },
        part(pid, parent) { const g = G(parent || S.base, "p", { "data-pid": pid }); return g; },
      };
      o.draw(S, st);
      // leaders + badges on top
      hiLayer = G(svg, "hi"); moved = [];
      const lead = G(svg, "leads"), badges = G(svg, "badges");
      parts.forEach((p) => {
        if (!p.b) return;
        if (p.t) { L(lead, p.b[0], p.b[1], p.t[0], p.t[1], "lead", { "data-pid": p.id }); C(lead, p.t[0], p.t[1], 2.2, "leaddot", { "data-pid": p.id }); }
        const g = G(badges, "badge" + (fset.length && !fset.includes(p.id) ? " dim" : ""), { "data-pid": p.id, role: "button", tabindex: "0", "aria-label": `${p.n}. ${p.ar} ${p.en || ""}` });
        C(g, p.b[0], p.b[1], 19, "hit");
        C(g, p.b[0], p.b[1], 9.5, "bc");
        T(g, p.b[0], p.b[1] + 4.3, String(p.n), "bn", "middle", false);
      });
      // events
      svg.addEventListener("click", (e) => { const t = e.target.closest("[data-pid]"); if (!t) return; stopTour(); select(t.getAttribute("data-pid")); });
      svg.addEventListener("keydown", (e) => { if (e.key !== "Enter" && e.key !== " ") return; const t = e.target.closest("[data-pid]"); if (!t) return; e.preventDefault(); stopTour(); select(t.getAttribute("data-pid")); });
      // chips
      chips.innerHTML = "";
      parts.forEach((p) => {
        const b = mk("button", "chip" + (fset.length && !fset.includes(p.id) ? " dim" : ""), `<span class="${PX}cn">${p.n}</span>${ACV.esc(p.ar)}`);
        b.type = "button"; b.dataset.pid = p.id; b.addEventListener("click", () => { stopTour(); select(p.id); }); chips.appendChild(b);
      });
      legend.innerHTML = o.legend ? o.legend(st) : ""; legend.hidden = !o.legend;
      sync();
      select(known.has(sel) ? sel : fset.length ? fset[0] : null);
    }
    draw();
    return { st, redraw: draw, select };
  }

  const LEG = (items) => items.map(([cls, lab]) => `<span class="${PX}lg"><i class="${PX}sw ${PX}st-${cls}"></i>${lab}</span>`).join("");
  const STATE_LEG = LEG([["hot", "غاز ساخن <em dir=ltr>Hot gas</em>"], ["liq", "سائل <em dir=ltr>Liquid</em>"], ["mix", "خليط بارد <em dir=ltr>Mix</em>"], ["vap", "بخار <em dir=ltr>Vapor</em>"]]);
  const arr = (v, def) => (Array.isArray(v) ? v : typeof v === "string" && v ? v.split(/[,\s]+/) : def);

  /* ---------- saturation helper (ctx.kb.ptables) ---------- */
  const FALLBACK = { R410A: [8.3, 26.3], R32: [8.5, 27.0], R22: [4.8, 16.3], R134a: [0.1, 9.2], R600a: [-0.4, 4.3], R290: [3.8, 14.2], R404A: [1.0, 17.3], R507A: [1.2, 17.8], R407C: [4.4, 17.4], R448A: [0.4, 16.0], R449A: [0.4, 15.8] };
  function satP(kb, ref, t, side) { // side: 'bubble' (high/liquid) or 'dew' (low/vapor)
    const pt = kb && kb.ptables; if (!pt || !pt.refrigerants || !pt.refrigerants[ref]) return null;
    const r = pt.refrigerants[ref];
    let pts = [];
    if (Array.isArray(r.rows)) pts = r.rows.map((row) => [row[0], row[side === "bubble" ? 1 : 2]]);
    else if (Array.isArray(r[side]) && Array.isArray(pt.temps_c)) pts = pt.temps_c.map((x, i) => [x, r[side][i]]);
    pts = pts.filter((q) => typeof q[0] === "number" && typeof q[1] === "number").sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < pts.length - 1; i++) { const [t0, p0] = pts[i], [t1, p1] = pts[i + 1]; if (t >= t0 && t <= t1) return t1 === t0 ? p0 : p0 + ((t - t0) / (t1 - t0)) * (p1 - p0); }
    return null;
  }

  /* =====================================================================
     1) cycle — vapor-compression refrigeration cycle
     ===================================================================== */
  ACV.register("cycle", {
    title: "دورة التبريد بالانضغاط",
    params: 'device:"capillary"|"txv"; mode:"basic"|"pressures"; ref:"R410A"|"R32"|"R22"|"R134a"|"R600a"|"R290"|"R404A"...; focus:[part ids: comp,dis,cond,cfan,drier,cap|txv,bulb,evap,efan,suc]; caption',
    demo: [{ device: "capillary", mode: "basic", ref: "R600a" }, { device: "txv", mode: "pressures", ref: "R410A" }],
    render(host, p, ctx) {
      const ref = String(p.ref || "R410A");
      const fridge = /R134a|R600a/i.test(ref), low = /R404A|R507A|R448A|R449A/i.test(ref);
      const Te = fridge ? -23 : low ? -28 : 5, Tc = fridge ? 40 : low ? 40 : 45;
      const pd = satP(ctx.kb, ref, Te, "dew"), pb = satP(ctx.kb, ref, Tc, "bubble");
      const fb = FALLBACK[ref] || [null, null];
      const pLow = pd != null ? pd : fb[0], pHigh = pb != null ? pb : fb[1];
      const fmt = (v) => (v == null ? "—" : (Math.round(v * 10) / 10).toFixed(1));
      const reduce = ACV.reduce();
      const dev = p.device === "txv" ? "txv" : "capillary";
      scene(host, {
        vb: [360, 420], label: "رسم دورة التبريد بالانضغاط", focus: arr(p.focus), caption: p.caption,
        intro: `دورة تبريد بالانضغاط (${ACV.esc(ref)}): الكباس يضغط البخار، المكثف يطرد الحرارة، جهاز التمدد يخفض الضغط، والمبخّر يمتص الحرارة. اتبع النقاط الملوّنة لترى حالة الغاز في كل مقطع.`,
        state: { dev, mode: p.mode === "pressures" ? "pressures" : "basic", labels: p.mode === "pressures" || !!p.labels, flow: !reduce },
        controls: [
          { type: "seg", key: "dev", label: "جهاز التمدد", items: [["capillary", "Capillary"], ["txv", "TXV"]], redraw: true },
          { type: "toggle", key: "labels", label: "الحالة", redraw: true },
          { type: "toggle", key: "flow", label: "التدفق", cls: "noflow" },
          { type: "seg", key: "mode", label: "العرض", items: [["basic", "مبسّط"], ["pressures", "الضغوط"]], redraw: true },
        ],
        legend: () => STATE_LEG,
        parts: (s) => [
          { id: "comp", ar: "الكباس", en: "Compressor", b: [338, 280], t: [330, 312],
            what: "يسحب البخار البارد منخفض الضغط ويضغطه إلى غاز ساخن عالي الضغط. هو «المضخّة» وحدّ الفصل بين الجانب المنخفض والجانب العالي.",
            fail: "احتراق أو تماس في الملفات، صمامات مكسورة (لا يرفع الضغط)، علوق ميكانيكي (يشدّ تيار LRA فيفصل الـ Overload)، أو كسر بسبب رجوع سائل.",
            test: "قِس الملفات: C-S + C-R = R-S، والعزل للجسم ≥ 2 MΩ. قارن تيار التشغيل بالـ nameplate. طرد منخفض مع سحب مرتفع وتيار قليل = كفاءة انضغاط ضعيفة." },
          { id: "dis", ar: "خط الطرد", en: "Discharge line", b: [340, 175], t: [318, 175],
            what: "يحمل الغاز الساخن المحمّص (Superheated) من الكباس إلى المكثف. أسخن نقطة في الدورة.",
            fail: "تشقّق أو تسريب عند اللحامات بسبب الاهتزاز. حرارة طرد عالية جداً (فوق ≈ 105–110°C تقريباً) تحرق الزيت وتدل على نقص غاز أو ضغط عالٍ.",
            test: "قِس حرارة الأنبوب قرب الكباس بحسّاس ملامس، وافحص اللحامات برغوة الصابون أو جهاز كشف التسريب." },
          { id: "cond", ar: "المكثف", en: "Condenser", b: [80, 46], t: [100, 70],
            what: "يطرد حرارة الغاز للهواء: يبرّده ثم يكثّفه إلى سائل، وآخر لفّاته تعطي تبريداً إضافياً للسائل (Subcooling).",
            fail: "اتساخ الزعانف أو سدّ مجرى الهواء يرفع ضغط الطرد والتيار. تسريب في الأكواع أو التآكل.",
            test: "حرارة التكثيف أعلى من هواء الدخول بـ ≈ 10–20 K تقريباً. فرق أكبر = اتساخ، شحنة زائدة أو هواء داخل الدورة." },
          { id: "cfan", ar: "مروحة المكثف", en: "Condenser fan", b: [222, 22], t: [196, 24],
            what: "تمرّر الهواء عبر المكثف لتحمل الحرارة بعيداً.",
            fail: "محرك محروق، Capacitor ضعيف، رولمان ناشف أو ريشة مكسورة ← ضغط عالٍ وفصل الحماية.",
            test: "تأكد من الدوران واتجاه الهواء، قِس مقاومة ملفات المحرك وسعة الـ Capacitor وتيار المروحة." },
          { id: "drier", ar: "الفلتر درايِر", en: "Filter drier", b: [20, 150], t: [37, 158],
            what: "يمتص الرطوبة ويحجز الأوساخ قبل جهاز التمدد ليحميه من الانسداد.",
            fail: "انسداد جزئي (خروجه أبرد من دخوله أو عليه تعرّق) أو تشبّع بالرطوبة فيتجمّد الكابيلاري أو الـ TXV.",
            test: "المس الدخول والخروج: فرق حرارة واضح = انسداد. يُبدَّل دائماً كلما فُتحت الدورة." },
          s.dev === "txv"
            ? { id: "txv", ar: "صمام التمدد الحراري", en: "TXV — Thermostatic expansion valve", b: [20, 228], t: [37, 228],
                what: "يخفض الضغط ويعدّل كمية الغاز تلقائياً ليحافظ على Superheat ثابت عند مخرج المبخّر (عادة ≈ 5–8 K حسب الـ manual).",
                fail: "فقدان شحنة البصلة (يغلق ← سحب منخفض جداً)، علوق مفتوح (رجوع سائل للكباس)، أو انسداد شبكة المدخل.",
                test: "قِس الـ Superheat عند البصلة = حرارة الأنبوب − حرارة التشبّع لضغط السحب. تأكد أن البصلة مثبتة ومعزولة جيداً." }
            : { id: "cap", ar: "الكابيلاري", en: "Capillary tube", b: [20, 228], t: [37, 228],
                what: "أنبوب رفيع جداً بطول محسوب يخفض الضغط ويحدّد كمية الغاز. ثابت لا يتحكّم، لذلك الشحنة يجب أن تكون دقيقة.",
                fail: "انسداد بالأوساخ أو الشمع، تجمّد الرطوبة عند المخرج (يبرد ثم ينقطع التبريد دورياً)، أو انثناء/كسر.",
                test: "سحب منخفض جداً (أو فاكيوم) مع مكثف غير ساخن = انسداد. إذا عاد التبريد بعد تسخين مخرج الكابيلاري = رطوبة." },
          ...(s.dev === "txv" ? [{ id: "bulb", ar: "بصلة الإحساس", en: "Sensing bulb", b: [262, 388], t: [276, 364],
            what: "تحسّ حرارة أنبوب السحب عند مخرج المبخّر وتنقل الضغط للصمام عبر أنبوب شعري ليفتح أو يغلق.",
            fail: "تثبيت مرتخٍ أو بلا عزل فتقرأ حرارة الهواء ← الصمام يفتح زيادة ويرجع سائل. كسر الأنبوب الشعري يُفقد الشحنة.",
            test: "ثبّتها بمشبك معدني على أنبوب أفقي (موضع الساعة 4 أو 8) واعزلها، ثم راقب ثبات الـ Superheat." }] : []),
          { id: "evap", ar: "المبخّر", en: "Evaporator", b: [80, 290], t: [100, 312],
            what: "يمتص الحرارة من الهواء المراد تبريده: الخليط البارد يغلي فيه ويتحوّل إلى بخار.",
            fail: "تجمّد الثلج بسبب ضعف الهواء أو الفلتر أو نقص الغاز، اتساخ الزعانف، تسريب في الأكواع.",
            test: fridge ? "في الفريزر حرارة التبخّر ≈ −20 إلى −28°C تقريباً. تجمّد غير منتظم (أول اللفّات فقط) = نقص غاز أو انسداد." : "في المكيّف حرارة التبخّر عادة ≈ 0 إلى +7°C، وفرق حرارة هواء الدخول والخروج ≈ 8–14 K تقريباً." },
          { id: "efan", ar: "مروحة المبخّر", en: "Evaporator fan", b: [224, 400], t: [197, 398],
            what: "تدفع الهواء عبر المبخّر لتوزيع البرودة.",
            fail: "توقّفها أو ضعفها يجمّد المبخّر ويرجع سائلاً للكباس.",
            test: "تأكد من الدوران وقِس الملفات والتيار، ونظّف الريش والفلتر." },
          { id: "suc", ar: "خط السحب", en: "Suction line", b: [300, 236], t: [292, 336],
            what: "يعيد البخار البارد منخفض الضغط من المبخّر إلى الكباس. يكون بارداً ويُعزَل.",
            fail: "تجمّد يصل حتى الكباس = رجوع سائل أو شحنة زائدة. أنبوب دافئ = نقص غاز أو انسداد.",
            test: "قِس الـ Superheat = حرارة الأنبوب − حرارة التشبّع لضغط السحب. قيمة قريبة من 0 خطر رجوع سائل." },
        ],
        draw(S, s) {
          const b = S.base, txv = s.dev === "txv";
          // pressure halos
          if (s.mode === "pressures") {
            const hg = G(b, "halo");
            P(hg, "M318,300 V58 H255 M100,58 V106 H45 V200", "halo-h");
            R(hg, 92, 50, 178, 62, 8, "halo-hf");
            P(hg, "M45,262 V298 H105 M255,346 H292", "halo-l");
            R(hg, 92, 290, 178, 64, 8, "halo-lf");
          }
          // condenser
          const cg = S.part("cond");
          R(cg, 92, 52, 176, 56, 3, "coilbox");
          fins(cg, 98, 53, 164, 54, 5);
          R(cg, 89, 50, 6, 60, 1.5, "m"); R(cg, 265, 50, 6, 60, 1.5, "m");
          pipe(cg, serp(102, 258, [58, 70, 82], true), "hot");
          pipe(cg, "M102,82 A6,6 0 0 0 102,94 H258 A6,6 0 0 1 258,106 H102", "liq");
          // cond fan + hot air
          const cf = S.part("cfan");
          fan(cf, 180, 24, 17);
          wavy(b, 128, 38, 26, -90, "air hotair"); wavy(b, 236, 38, 26, -90, "air hotair");
          // discharge line
          pipe(S.part("dis"), "M318,302 V58 H258", "hot");
          arrow(b, 318, 150, -90, "arr st-hot");
          // liquid line + drier
          pipe(b, "M102,106 H45 V138", "liq");
          const dg = S.part("drier");
          pipe(dg, "M45,138 V200", "liq");
          R(dg, 37, 142, 16, 50, 7, "m"); L(dg, 37, 150, 53, 150, "ln thin"); L(dg, 37, 184, 53, 184, "ln thin");
          arrow(b, 45, 128, 90, "arr st-liq");
          // expansion device
          const xg = S.part(txv ? "txv" : "cap");
          if (txv) {
            pipe(xg, "M45,200 V214", "liq");
            R(xg, 35, 214, 20, 26, 3, "m");
            P(xg, "M55,219 a9,9 0 0 1 0,16z", "m2"); L(xg, 59, 219, 59, 235, "ln thin"); // diaphragm power head
            pipe(xg, "M45,240 V262", "mix");
            
          } else {
            pipe(xg, "M45,200 V206", "liq");
            P(xg, "M45,206 c14,0 14,8 0,8 c-14,0 -14,8 0,8 c14,0 14,8 0,8 c-14,0 -14,8 0,8 c14,0 14,8 0,8 c-14,0 -14,8 0,8 V262", "capl");
          }
          // to evaporator (cold mix)
          pipe(b, "M45,262 V298 H102", "mix");
          arrow(b, 45, 280, 90, "arr st-mix");
          // evaporator
          const eg = S.part("evap");
          R(eg, 92, 292, 176, 60, 3, "coilbox");
          fins(eg, 98, 293, 164, 58, 5);
          R(eg, 89, 290, 6, 64, 1.5, "m"); R(eg, 265, 290, 6, 64, 1.5, "m");
          pipe(eg, serp(102, 258, [298, 310, 322, 334], false), "mix");
          pipe(eg, "M102,334 A6,6 0 0 0 102,346 H258", "vap");
          // evap fan + cold air
          fan(S.part("efan"), 180, 398, 17);
          wavy(b, 128, 372, 26, 90, "air coldair"); wavy(b, 236, 372, 26, 90, "air coldair");
          // suction line
          pipe(S.part("suc"), "M258,346 H292", "vap");
          arrow(b, 284, 346, 0, "arr st-vap");
          if (txv) {
            const bg = S.part("bulb");
            P(bg, "M64,227 H70 V364 H276 V354", "capl thin");
            R(bg, 266, 349, 22, 6, 3, "bulb");
          }
          // compressor
          const k = S.part("comp");
          P(k, "M294,316 Q294,302 318,302 Q342,302 342,316 V366 Q342,374 334,374 H302 Q294,374 294,366Z", "shell");
          L(k, 294, 340, 342, 340, "ln thin");
          R(k, 290, 374, 56, 5, 2, "m");
          C(k, 318, 302, 3, "m");
          // state labels
          if (s.labels) {
            const lab = G(b, "labs");
            const pill = (x, y, w, st2, l1, l2) => { const g = G(lab, "pill st-" + st2); R(g, x, y, w, 36, 7, "pillr"); T(g, x + w / 2, y + 15, l1, "pl1"); T(g, x + w / 2, y + 30, l2, "pl2", "middle", false); };
            pill(196, 124, 108, "hot", "غاز ساخن", fridge ? "≈ 55–80°C" : "≈ 70–90°C");
            pill(66, 124, 108, "liq", "سائل عالي الضغط", `≈ ${Tc - 8}–${Tc - 3}°C`);
            pill(66, 246, 108, "mix", "خليط بارد", `≈ ${Te}°C`);
            pill(196, 246, 108, "vap", "بخار منخفض", `≈ ${Te + 4}–${Te + 10}°C`);
            if (s.mode === "pressures") {
              const z = G(lab, "zone");
              R(z, 90, 166, 180, 32, 7, "zh"); T(z, 180, 180, "الجانب العالي HIGH", "zl"); T(z, 180, 194, `≈ ${fmt(pHigh)} bar(g) @ ${Tc}°C`, "pl2", "middle", false);
              R(z, 90, 204, 180, 32, 7, "zlw"); T(z, 180, 218, "الجانب المنخفض LOW", "zl"); T(z, 180, 232, `≈ ${fmt(pLow)} bar(g) @ ${Te}°C`, "pl2", "middle", false);
            }
          }
        },
      });
    },
  });

  /* =====================================================================
     2) fridge — domestic top-freezer refrigerator (side section)
     ===================================================================== */
  const P_COMMON = {
    relay: { id: "relay", ar: "جهاز التقويم PTC / Relay", en: "Start device (PTC / relay)",
      what: "يوصل ملف التقويم (S) لثوانٍ عند الإقلاع ثم يفصله. الـ PTC يسخن فترتفع مقاومته جداً فيقطع.",
      fail: "PTC مشقوق أو مفتوح: الكباس لا يقلع ويفصل الـ Overload كل دقيقة تقريباً. ريليه ملتصق: يبقى ملف التقويم موصولاً فيسخن الكباس.",
      test: "افحص الـ PTC وهو بارد: مقاومة صغيرة (عادة ≈ 3–47 Ω حسب الموديل)، مفتوح = تالف. انتظر 3–5 دقائق ليبرد قبل إعادة التجربة." },
    ol: { id: "ol", ar: "الأوفرلود", en: "Overload protector",
      what: "قرص Bimetal ملاصق لجسم الكباس يقطع الخط (C) عند ارتفاع التيار أو الحرارة ثم يرجع وحده.",
      fail: "يفصل باستمرار بسبب علّة أخرى (PTC، ملفات، جهد منخفض، مكثف متّسخ)، أو يتلف مفتوحاً أو ملتصقاً.",
      test: "يجب أن يكون موصولاً (≈ 0–1 Ω) وهو بارد. مفتوح وهو بارد = تالف. لا تجسّره أبداً." },
    drier: { id: "drier", ar: "الفلتر درايِر", en: "Filter drier",
      what: "يحجز الرطوبة والأوساخ قبل الكابيلاري. مع R600a استعمل الفلتر المناسب للغاز (حسب الشركة).",
      fail: "انسداد جزئي أو تشبّع بالرطوبة فيتجمّد مخرج الكابيلاري ويتقطّع التبريد.",
      test: "فرق حرارة واضح بين دخوله وخروجه = انسداد. يُبدَّل دائماً عند فتح الدورة، مع فاكيوم ≤ 500 microns." },
    hx: { id: "hx", ar: "الكابيلاري الملحوم على خط السحب", en: "Capillary–suction heat exchanger",
      what: "الكابيلاري ملحوم على أنبوب السحب (أو داخله) داخل العزل: يبرّد السائل ويسخّن البخار الراجع، فيزيد التبريد ويمنع تعرّق خط السحب.",
      fail: "انسداد الكابيلاري بالرطوبة أو الشمع؛ تسريب داخل العزل يصعب الوصول إليه.",
      test: "سحب في الفاكيوم مع مكثف بارد = انسداد. تعرّق أو تجمّد خط السحب عند الكباس = شحنة زائدة أو انفصال الأنبوبين." },
    gasket: { id: "gasket", ar: "جوان الباب المغناطيسي", en: "Door gasket",
      what: "يُحكم إغلاق الأبواب بالمغناطيس ويمنع دخول الهواء الرطب.",
      fail: "تمزّق أو تصلّب أو التواء ← تعرّق، ثلج زائد، وكباس يعمل بلا توقف.",
      test: "اختبار الورقة: أغلق الباب على ورقة في عدة نقاط؛ يجب أن تُمسك بقوة. الجوان الملتوي يُسخَّن بالمجفف ليستعيد شكله." },
  };
  ACV.register("fridge", {
    title: "مقطع براد منزلي",
    params: 'type:"nofrost"|"static"; focus:[ids: comp,relay,ol,cond,drier,hx,evap,efan,heater,dsens,damper,ctrl,gasket,drain | static: fevap,plate,thermo]; caption',
    demo: [{ type: "nofrost" }, { type: "static" }],
    render(host, p) {
      const reduce = ACV.reduce();
      scene(host, {
        vb: [360, 470], label: "مقطع جانبي لبراد بفريزر علوي", focus: arr(p.focus), caption: p.caption,
        intro: "مقطع جانبي لبراد بفريزر علوي (الواجهة إلى اليسار). في الـ No-Frost المبخّر مخفي ومروحة توزّع الهواء ويوجد ديفروست أوتوماتيكي؛ في الـ Static التبريد بالتلامس بلا مروحة.",
        state: { type: p.type === "static" ? "static" : "nofrost", flow: !reduce },
        controls: [
          { type: "seg", key: "type", label: "النوع", items: [["nofrost", "No-Frost"], ["static", "Static"]], redraw: true },
          { type: "toggle", key: "flow", label: "التدفق", cls: "noflow" },
        ],
        legend: (s) => STATE_LEG + (s.type === "nofrost" ? LEG([["air", "هواء بارد <em dir=ltr>Air</em>"]]) : ""),
        parts: (s) => {
          const nf = s.type === "nofrost";
          const L1 = [
            { id: "comp", ar: "الكباس", en: "Compressor (R600a / R134a)", b: [222, 452], t: [222, 418],
              what: "كباس ترددي (أو Inverter) يضغط البخار الراجع من المبخّر ويرسله ساخناً للمكثف. يعمل ويتوقف حسب الترموستات أو البورد.",
              fail: "لا يقلع وتطقطق الحماية (ملفات، علوق، PTC)، أو يعمل بلا تبريد (صمامات ضعيفة)، أو صوت عالٍ من نوابض التعليق.",
              test: "الملفات C-S + C-R = R-S، العزل ≥ 2 MΩ، وتيار التشغيل قريب من الـ nameplate (البرادات المنزلية عادة ≈ 0.5–1.2 A)." },
            Object.assign({ b: [158, 452], t: [190, 400] }, P_COMMON.relay),
            Object.assign({ b: [130, 434], t: [190, 412] }, P_COMMON.ol),
            { id: "cond", ar: "المكثف الخلفي / الجانبي", en: "Back (wire-tube) / skin condenser", b: [330, 150], t: [282, 150],
              what: "يطرد الحرارة: إما شبكة أنابيب وأسلاك خلف البراد، أو أنبوب ملتصق بالجوانب من الداخل (Skin) فتسخن جوانب البراد.",
              fail: "الغبار أو التصاق البراد بالحائط يرفع الضغط والحرارة. تسريب الـ Skin condenser صعب الإصلاح (يُعمل bypass بمكثف خارجي).",
              test: "يسخن بالتدرّج: ساخن من الأعلى (الدخول) وفاتر في الأسفل. اترك ≈ 5–10 cm تهوية خلف البراد." },
            Object.assign({ b: [330, 372], t: [306, 372] }, P_COMMON.drier),
            Object.assign({ b: [330, 260], t: [262, 260] }, P_COMMON.hx),
          ];
          const L2 = nf ? [
            { id: "evap", ar: "مبخّر الفريزر خلف اللوح", en: "Fin evaporator (behind panel)", b: [330, 84], t: [240, 90],
              what: "مبخّر بزعانف مخفي خلف لوح الفريزر الخلفي؛ يبرّد الهواء الذي تدفعه المروحة لكل البراد.",
              fail: "يتغطّى بكتلة ثلج إذا تعطل الديفروست ← الفريزر بارد قليلاً والثلاجة دافئة. ثقب بأداة حادة في أنابيب الألمنيوم.",
              test: "افتح اللوح الخلفي: ثلج متكتّل على كامل المبخّر = عطل ديفروست (سخّان/حساس/بورد). تجمّد أول اللفّات فقط = نقص غاز." },
            { id: "efan", ar: "مروحة المبخّر", en: "Evaporator fan motor", b: [330, 30], t: [238, 38],
              what: "تسحب الهواء عبر المبخّر وتوزّعه على الفريزر، وعبر الـ Damper إلى الثلاجة.",
              fail: "تتوقف بسبب جليد على الريش، محرك محروق، أو مفتاح الباب (Door switch) عالق.",
              test: "اضغط مفتاح الباب فيجب أن تدور. قِس الجهد والملف (DC 12 V أو AC 220 V حسب الموديل)." },
            { id: "heater", ar: "سخّان الديفروست", en: "Defrost heater", b: [330, 124], t: [240, 126],
              what: "يذيب الثلج عن المبخّر دورياً (عادة بعد ≈ 6–12 ساعة تشغيل حسب الموديل) لمدة قصيرة.",
              fail: "ينقطع السلك أو أنبوب الزجاج فيتراكم الثلج تدريجياً حتى يتوقف الهواء.",
              test: "قِس المقاومة وقارنها بـ R = V² / P؛ مثلاً 220 V و 150 W ≈ 320 Ω. مفتوح (∞) = تالف." },
            { id: "dsens", ar: "حسّاس / Bimetal الديفروست", en: "Defrost sensor / bimetal", b: [176, 30], t: [214, 58],
              what: "على أنبوب المبخّر: ينهي الديفروست عندما ترتفع حرارة المبخّر (≈ +5 إلى +10°C حسب الموديل) ليحمي من السخونة.",
              fail: "Bimetal يبقى مفتوحاً فلا يعمل السخّان، أو NTC يعطي قراءة خاطئة للبورد.",
              test: "الـ Bimetal موصول وهو بارد (تحت ≈ −5°C) ومفتوح بحرارة الغرفة. قارن مقاومة الـ NTC بجدول الشركة." },
            { id: "damper", ar: "الـ Damper ومجرى الهواء", en: "Air damper & duct", b: [176, 246], t: [196, 174],
              what: "بوابة تتحكم بكمية الهواء البارد النازل من الفريزر إلى الثلاجة (يدوية أو بمحرك).",
              fail: "تجمّد المجرى أو علوق البوابة مغلقة ← الثلاجة دافئة والفريزر طبيعي. علوقها مفتوحة ← تتجمّد الخضار.",
              test: "تحسّس الهواء الداخل للثلاجة والمروحة تعمل، افحص المجرى من الجليد ومحرك الـ Damper حسب الـ manual." },
            { id: "ctrl", ar: "بورد التحكم / الترموستات", en: "Control board / thermostat", b: [26, 196], t: [96, 172],
              what: "يقرأ حرارة الحجرات (NTC) ويشغّل الكباس والمروحة ودورة الديفروست.",
              fail: "حساس تالف، ريليه الكباس لا يوصل، أو رطوبة على البورد.",
              test: "قِس جهد خروج الكباس من البورد، وقارن الحساسات بجدول المقاومة. كثير من البوردات لها Test mode حسب الـ manual." },
          ] : [
            { id: "fevap", ar: "مبخّر الفريزر (Static)", en: "Freezer evaporator (wrap / roll-bond)", b: [330, 84], t: [242, 84],
              what: "أنابيب ملفوفة حول جدران الفريزر أو رفوف Roll-bond؛ يبرّد بالتلامس والحمل الطبيعي بلا مروحة.",
              fail: "تراكم الثلج يضعف التبريد (يحتاج تذويب يدوي). ثقب الـ Roll-bond عند كشط الثلج بأداة حادة.",
              test: "تجمّد متساوٍ على كامل السطح = شحنة سليمة؛ تجمّد جزئي = نقص غاز أو انسداد." },
            { id: "plate", ar: "لوح التبريد Cold plate", en: "Fresh-food cold plate", b: [330, 226], t: [242, 226],
              what: "مبخّر لوحي في الجدار الخلفي للثلاجة: يتجمّد أثناء العمل ويذوب تلقائياً عند توقف الكباس (Off-cycle defrost).",
              fail: "لا يذوب إذا لم يفصل الترموستات فيتراكم الثلج؛ انسداد مجرى التنقيط يملأ القاع بالماء.",
              test: "أثناء العمل يتكوّن عليه ثلج خفيف، وفي فترة التوقف يذوب ويقطر نحو فتحة التصريف." },
            { id: "thermo", ar: "الترموستات الميكانيكي", en: "Mechanical thermostat", b: [26, 196], t: [96, 172],
              what: "منفاخ (Bellows) مع أنبوب شعري ملامس للـ Cold plate؛ يوصل ويفصل الكباس حسب حرارة اللوح.",
              fail: "تسرّب شحنة الأنبوب الشعري ← لا يوصل الكباس أبداً. تلامس ملتصق ← لا يفصل فيتجمّد كل شيء.",
              test: "قِس الاستمرارية بين طرفيه: موصول والبصلة دافئة، ويفصل عند البرودة. يجب أن تلامس البصلة اللوح جيداً." },
          ];
          return L1.concat(L2, [
            Object.assign({ b: [22, 112], t: [70, 128] }, P_COMMON.gasket),
            { id: "drain", ar: "أنبوب التصريف والصينية", en: "Drain pipe & evaporation tray", b: [330, 330], t: [252, 330],
              what: "ماء الذوبان ينزل عبر أنبوب إلى صينية فوق الكباس فيتبخّر بحرارته.",
              fail: "انسداد الأنبوب بالجليد أو الأوساخ ← ماء تحت درج الخضار أو جليد في قاع الفريزر.",
              test: "اسكب قليلاً من الماء الدافئ في فتحة التصريف وتأكد أنه يصل للصينية؛ نظّف بسلك/أنبوب مرن." },
          ]);
        },
        draw(S, s) {
          const b = S.base, nf = s.type === "nofrost";
          // cabinet shell + insulation
          const shell = "M70,14 H264 V364 H180 V420 H70 Z";
          P(b, shell, "ins");
          const cav = "M72,28 H246 V134 H72 Z M72,156 H246 V350 H166 V406 H72 Z";
          hatch(b, 72, 16, 190, 400, 7).setAttribute("clip-path", S.clip(shell + " " + cav));
          P(b, cav, "sf");
          P(b, shell, "cab2");
          // shelves & crisper
          L(b, 74, 84, nf ? 202 : 236, 84, "ln"); L(b, 74, 220, 228, 220, "ln"); L(b, 74, 286, 228, 286, "ln");
          R(b, 78, 356, 82, 46, 4, "ln");
          // doors
          const dg = G(b, "");
          R(dg, 50, 14, 20, 118, 3, "cab"); R(dg, 50, 138, 20, 282, 3, "cab");
          L(dg, 56, 60, 56, 90, "lk"); L(dg, 56, 190, 56, 240, "lk");
          // gaskets
          const gk = S.part("gasket");
          [[16, 12], [118, 12], [140, 12], [404, 12]].forEach(([y, h]) => R(gk, 68, y, 6, h, 2.5, "rub"));
          // machine compartment floor
          L(b, 172, 420, 300, 420, "lk"); R(b, 76, 420, 10, 6, 1, "m"); R(b, 250, 420, 10, 6, 1, "m");
          // back condenser (wire-and-tube, side view: tube sections)
          const cg = S.part("cond");
          L(cg, 268, 40, 268, 350, "ln thin"); L(cg, 278, 40, 278, 350, "ln thin");
          for (let y = 44; y <= 346; y += 11) C(cg, 273, y, 2.6, "cuf", { style: `fill:var(--sc-${y < 170 ? "hot" : "liq"})` });
          pipe(cg, "M240,404 H292 V40 H273", "hot", 4);
          // drier + capillary/suction HX
          pipe(b, "M273,350 V358 H306 V362", "liq", 4);
          const dr = S.part("drier");
          R(dr, 299, 362, 14, 30, 6, "m"); L(dr, 299, 368, 313, 368, "ln thin");
          const hx = S.part("hx");
          P(hx, "M306,392 V400 Q306,410 296,410 H264 Q259,410 259,402 V" + (nf ? 116 : 60), "capl");
          if (nf) P(hx, "M259,116 Q259,112 252,112 H240", "capl"); else P(hx, "M259,60 Q259,52 252,52 H240", "capl");
          pipe(hx, nf ? "M240,54 H255 V380 Q255,392 244,392 H238" : "M240,300 H255 V380 Q255,392 244,392 H238", "vap", 4);
          // compressor + start device + overload
          const k = S.part("comp");
          P(k, "M200,392 Q200,378 220,378 Q240,378 240,392 V412 Q240,418 234,418 H206 Q200,418 200,412Z", "shell");
          R(k, 196, 417, 48, 3, 1, "m");
          const rl = S.part("relay"); R(rl, 182, 392, 16, 14, 2, "m2"); T(rl, 190, 402, "PTC", "tiny", "middle", false);
          const ol = S.part("ol"); C(ol, 190, 412, 5, "m");
          // drain + tray
          const dn = S.part("drain");
          R(dn, 202, 366, 40, 7, 2, "coldf");
          pipe(dn, nf ? "M226,132 L246,138 H251 V358 Q251,368 241,368" : "M240,320 H250 V358 Q250,368 241,368", "wat", 4);
          if (nf) {
            // evaporator behind rear panel
            L(b, 204, 30, 204, 132, "lk"); L(b, 204, 30, 246, 30, "ln thin");
            const ev = S.part("evap");
            R(ev, 210, 56, 30, 64, 2, "coilbox"); for (let y = 60; y < 120; y += 4) L(ev, 210, y, 240, y, "fin");
            for (let y = 62; y <= 114; y += 13) { C(ev, 216, y, 3, "cuf", { style: "fill:var(--sc-mix)" }); C(ev, 233, y + 6, 3, "cuf", { style: "fill:var(--sc-mix)" }); }
            const fn = S.part("efan");
            R(fn, 214, 34, 24, 10, 3, "m2"); E(fn, 210, 39, 3, 9, "blade");
            const ht = S.part("heater"); R(ht, 210, 122, 30, 6, 3, "heatf");
            const ds = S.part("dsens"); R(ds, 214, 54, 10, 6, 2, "rub");
            // damper & duct through the mullion
            const dp = S.part("damper");
            R(dp, 186, 134, 16, 24, 1, "coldf");
            P(dp, "M188,166 L204,176", "lk"); C(dp, 188, 166, 2, "hub");
            // control board
            const ct = S.part("ctrl"); R(ct, 90, 158, 56, 14, 3, "pcb"); for (let x = 96; x < 142; x += 9) R(ct, x, 162, 5, 5, 1, "chipk");
            // air flow
            const af = G(b, "pipe st-air");
            P(af, "M206,38 H90 Q78,38 78,52 V120 Q78,128 90,128 H200", "flow");
            P(af, "M194,140 V182 Q194,196 180,200 H100", "flow");
            wavy(b, 120, 46, 40, 180, "air coldair"); wavy(b, 150, 204, 40, 180, "air coldair");
          } else {
            // static: wrapped freezer evaporator + cold plate + mechanical thermostat
            const fe = S.part("fevap");
            for (let x = 84; x <= 236; x += 13) C(fe, x, 32, 2.8, "cuf", { style: "fill:var(--sc-mix)" });
            for (let y = 44; y <= 128; y += 13) C(fe, 242, y, 2.8, "cuf", { style: "fill:var(--sc-mix)" });
            for (let x = 84; x <= 236; x += 13) C(fe, x, 130, 2.8, "cuf", { style: "fill:var(--sc-mix)" });
            const pl = S.part("plate"); R(pl, 236, 180, 8, 100, 2, "coldf"); P(pl, "M232,292 L240,300 L248,292", "ln");
            pipe(b, "M242,128 V146 Q242,152 248,152 H253 V176 H244", "mix", 4);
            const th = S.part("thermo"); R(th, 90, 158, 56, 14, 3, "m2"); C(th, 118, 165, 4.5, "m"); P(th, "M146,166 H226 Q232,166 232,174 V200 H236", "capl thin");
          }
        },
      });
    },
  });

  /* =====================================================================
     3) split — wall split AC (indoor side section + outdoor front, cover removed)
     ===================================================================== */
  ACV.register("split", {
    title: "مكيّف سبليت جداري",
    params: "inverter:true|false; focus:[ids: filter,icoil,xfan,louver,drain,ipcb,rntc,pntc,comp,acc,rv,ocoil,ofan,eev|cap,dsens,opcb|capac,sv,pipes,flare,comm]; caption",
    demo: [{ inverter: true }, { inverter: false }],
    render(host, p) {
      const reduce = ACV.reduce();
      scene(host, {
        vb: [360, 496], label: "مكيّف سبليت: مقطع الوحدة الداخلية والوحدة الخارجية", focus: arr(p.focus), caption: p.caption,
        intro: "الوحدة الداخلية (مقطع جانبي، الواجهة لليسار) والوحدة الخارجية (من الأمام والغطاء مفكوك) في وضع التبريد. لاحظ أن جهاز التمدد في الخارج، لذلك الأنبوب الرفيع يحمل خليطاً بارداً ويجب عزله.",
        state: { inv: p.inverter !== false && p.inverter !== "false", flow: !reduce },
        controls: [
          { type: "seg", key: "inv", label: "النوع", items: [[true, "Inverter"], [false, "On/Off"]], redraw: true },
          { type: "toggle", key: "flow", label: "التدفق", cls: "noflow" },
        ],
        legend: () => STATE_LEG,
        parts: (s) => {
          const inv = s.inv;
          return [
            { id: "filter", ar: "فلتر الهواء", en: "Air filter", b: [18, 30], t: [56, 46],
              what: "شبكة تحجز الغبار قبل أن يصل للمبخّر.",
              fail: "الانسداد يضعف الهواء ← تجمّد المبخّر، تنقيط ماء، وضعف تبريد وروائح.",
              test: "افحصه كل 2–4 أسابيع في الصيف واغسله بماء فاتر بلا ضغط عالٍ. ركّبه وهو جاف." },
            { id: "icoil", ar: "المبخّر (الكويل الداخلي)", en: "Evaporator coil", b: [18, 100], t: [49, 96],
              what: "في التبريد يغلي فيه الخليط البارد فيمتص حرارة الغرفة، ويكثّف رطوبة الهواء على زعانفه.",
              fail: "اتساخ الزعانف، تجمّد بسبب الفلتر أو نقص الغاز، تسريب في الأكواع (خاصة بعد التآكل).",
              test: "فرق حرارة الهواء الداخل والخارج ≈ 8–14 K تقريباً. تجمّد أول الكويل فقط = نقص غاز." },
            { id: "xfan", ar: "مروحة البرميل", en: "Cross-flow fan + motor", b: [120, 150], t: [120, 124],
              what: "مروحة أسطوانية طويلة يحرّكها محرك (DC في الإنفرتر غالباً) تسحب الهواء عبر الفلتر والكويل وتدفعه للأسفل.",
              fail: "اتساخ الريش يضعف الهواء ويسبب اهتزازاً، كسر الريش، أو عطل محرك/حساس سرعة (Hall) فيظهر كود خطأ.",
              test: "افحص الدوران والصوت. محرك DC: افحص جهد التغذية وإشارة الـ feedback حسب الـ manual." },
            { id: "louver", ar: "الريشة (الفلاب)", en: "Louver + swing motor", b: [18, 160], t: [44, 150],
              what: "توجّه الهواء البارد أعلى/أسفل بمحرك Stepper صغير.",
              fail: "محرك Swing محروق أو تُرس مكسور ← الريشة لا تتحرك أو تُغلق أثناء العمل.",
              test: "قِس ملفات محرك الـ Stepper (عادة 12 V DC حسب الموديل) وجرّب الـ Swing من الريموت." },
            { id: "drain", ar: "صينية وخرطوم التصريف", en: "Drain pan & hose", b: [150, 196], t: [172, 160],
              what: "تجمع ماء التكثيف من الكويل وتصرّفه بالميل عبر الخرطوم للخارج.",
              fail: "انسداد بالطين أو العفن أو خرطوم بلا ميل ← تنقيط ماء من الوحدة الداخلية.",
              test: "اسكب ماءً في الصينية وتأكد من خروجه بسرعة. الخرطوم يجب أن ينزل باستمرار بلا ارتفاع." },
            { id: "ipcb", ar: "بورد الوحدة الداخلية", en: "Indoor PCB", b: [342, 112], t: [314, 64],
              what: "يستقبل الريموت والحساسات، يتحكم بالمروحة والـ Swing، ويتواصل مع الخارجية عبر كابل الاتصال.",
              fail: "فيوز محروق، ريليه أو منظّم جهد تالف، رطوبة، أو كود خطأ اتصال.",
              test: "افحص الفيوز وجهد التغذية، واقرأ كود الخطأ ثم ارجع للـ manual قبل تبديل البورد." },
            { id: "rntc", ar: "حساس حرارة الغرفة", en: "Room NTC sensor", b: [18, 64], t: [38, 68],
              what: "NTC عند مدخل الهواء يقيس حرارة الغرفة ليقرر البورد متى يبرّد.",
              fail: "قراءة خاطئة أو مفتوح ← الجهاز يفصل مبكراً أو لا يفصل، أو كود خطأ حساس.",
              test: "قِس مقاومته بعد فصل الفيشة وقارنها بجدول الشركة (كثير منها ≈ 10 kΩ أو 15 kΩ عند 25°C حسب الموديل)." },
            { id: "pntc", ar: "حساس حرارة الأنبوب", en: "Indoor pipe (coil) NTC", b: [176, 18], t: [158, 46],
              what: "NTC مثبت على أنبوب الكويل يحمي من التجمّد ويستعمله البورد في التدفئة لمنع الهواء البارد.",
              fail: "مفكوك من مكانه أو تالف ← حماية تجمّد خاطئة أو كود خطأ.",
              test: "تأكد أنه داخل جيبه على الأنبوب، وقِس مقاومته مقارنة بالجدول." },
            { id: "comp", ar: "الكباس الروتاري", en: inv ? "Rotary compressor (BLDC inverter)" : "Rotary compressor (PSC)", b: [186, 452], t: [218, 452],
              what: inv ? "كباس روتاري بمحرك DC ثلاثي الأطوار U-V-W تتحكم بسرعته الـ IPM فيغيّر القدرة حسب الحِمل." : "كباس روتاري بمحرك أحادي الطور C-S-R يعمل بسرعة ثابتة مع مكثف تشغيل.",
              fail: inv ? "قِصر أو عزل ضعيف في الملفات، أو علوق ← أكواد IPM/تيار زائد." : "لا يقلع بسبب الـ Capacitor، ملفات محروقة، علوق، أو حماية داخلية مفتوحة لأنه ساخن.",
              test: inv ? "الملفات U-V، V-W، U-W متساوية تقريباً (عادة بضعة أوم أو أقل)، والعزل ≥ 2 MΩ. قِس التيار مقارنة بالـ manual." : "C-S + C-R = R-S، العزل ≥ 2 MΩ، وقِس الـ Capacitor (±5%)." },
            { id: "acc", ar: "الأكيوموليتر", en: "Suction accumulator", b: [342, 404], t: [276, 412],
              what: "خزان صغير على مدخل الكباس الروتاري يحجز أي سائل راجع ليحمي الكباس.",
              fail: "نادراً ما يتعطل؛ قد يتآكل أو يتسرّب عند اللحامات.",
              test: "تعرّق أو تجمّد عليه بشكل دائم = رجوع سائل (شحنة زائدة أو ضعف هواء داخلي)." },
            { id: "rv", ar: "صمام عاكس 4-Way", en: "4-way reversing valve", b: [186, 322], t: [214, 364],
              what: "يعكس اتجاه الغاز للتبديل بين التبريد والتدفئة بواسطة ملف (Solenoid) على الصمام الدليلي.",
              fail: "ملف محروق أو صمام عالق في المنتصف ← لا يتحول للتدفئة أو ضعف في الوضعين.",
              test: "قِس مقاومة الملف (≈ 1–2 kΩ تقريباً)، وجهده عند التحويل. تحسّس الأنابيب: ساخن/بارد في الأماكن الصحيحة." },
            { id: "ocoil", ar: "المكثف (الكويل الخارجي)", en: "Condenser coil", b: [18, 306], t: [40, 320],
              what: "في التبريد يطرد الحرارة للهواء الخارجي ويكثّف الغاز إلى سائل.",
              fail: "اتساخ أو سدّ الهواء أو تركيب في مكان مغلق ← ضغط عالٍ، تيار مرتفع وفصل حماية.",
              test: "نظّفه بالماء من الداخل للخارج. حرارة التكثيف عادة أعلى من الهواء الخارجي بـ ≈ 10–20 K." },
            { id: "ofan", ar: "المروحة الخارجية", en: "Axial fan + motor", b: [18, 442], t: [70, 430],
              what: "تسحب الهواء عبر المكثف وتطرده للخارج.",
              fail: inv ? "محرك DC تالف أو مشكلة في البورد ← كود خطأ مروحة وحماية ضغط عالٍ." : "Capacitor المروحة ضعيف أو محرك محروق ← لا تدور أو بطيئة فيرتفع الضغط.",
              test: inv ? "افحص جهد التغذية DC وإشارة السرعة حسب الـ manual." : "قِس سعة الـ Capacitor (عادة 1.5–5 µF تقريباً) وملفات المحرك." },
            inv
              ? { id: "eev", ar: "صمام التمدد الإلكتروني", en: "EEV (electronic expansion valve)", b: [342, 352], t: [306, 352],
                  what: "صمام بمحرك Stepper يفتح بخطوات يحددها البورد حسب حرارة الطرد والأنابيب، فيضبط التدفق بدقة.",
                  fail: "ملف تالف أو إبرة عالقة ← حرارة طرد عالية جداً أو رجوع سائل؛ انسداد بالأوساخ.",
                  test: "قِس مقاومة ملفات الـ Stepper (متساوية عادة ≈ 40–60 Ω حسب الموديل) واسمع النقرات عند تشغيل الجهاز." }
              : { id: "cap", ar: "الكابيلاري", en: "Capillary tube", b: [342, 352], t: [306, 352],
                  what: "أنبوب رفيع بطول محسوب يخفض الضغط في الوحدة الخارجية (On/Off). ثابت لا يتحكّم.",
                  fail: "انسداد بالأوساخ أو الرطوبة ← ضغط سحب منخفض جداً وتجمّد عند المخرج.",
                  test: "قارن ضغط السحب مع التيار وحرارة الأنابيب؛ تجمّد مكان معيّن بعد الكابيلاري يدل على انسداد." },
            ...(inv ? [{ id: "dsens", ar: "حساس حرارة الطرد", en: "Discharge temperature sensor", b: [186, 384], t: [230, 388],
              what: "NTC على أنبوب الطرد يحمي الكباس ويستعمله البورد لضبط فتحة الـ EEV.",
              fail: "مفكوك أو تالف ← كود حرارة طرد عالية أو فتح خاطئ للـ EEV.",
              test: "تأكد من تثبيته وقِس مقاومته (غالباً 50 kΩ عند 25°C حسب الشركة)." }] : []),
            inv
              ? { id: "opcb", ar: "بورد الخارجية + IPM", en: "Outdoor PCB / IPM", b: [342, 296], t: [300, 304],
                  what: "يحوّل التيار المتناوب إلى DC ثم الـ IPM يولّد 3 أطوار بتردد متغيّر للكباس، ويتحكم بالمروحة والـ EEV.",
                  fail: "IPM محروق، مكثفات DC منتفخة، جسر تقويم تالف، أو أكواد تيار زائد واتصال.",
                  test: "افرغ شحنة مكثفات الـ DC قبل اللمس (قد تبقى ≈ 300+ V DC). افحص الـ IPM بوضع الديود بين P/N وU/V/W." }
              : { id: "capac", ar: "مكثف التشغيل", en: "Run capacitor (dual)", b: [342, 296], t: [300, 304],
                  what: "مكثف تشغيل (غالباً مزدوج للكباس والمروحة) يعطي الإزاحة اللازمة لتقويم وتشغيل المحرك.",
                  fail: "ينقص سعته أو ينتفخ ← الكباس يطنّ ولا يقلع ويفصل الـ Overload.",
                  test: "افرغ الشحنة ثم قِس السعة: السماحية ±5%، بدّله إذا نقص أكثر من 10%." },
            { id: "sv", ar: "صمامات الخدمة", en: "Service valves: 2-way (liquid) / 3-way (gas)", b: [342, 488], t: [334, 470],
              what: "الصمام الثنائي على الخط الرفيع والثلاثي على الخط العريض (فيه بلف خدمة للساعات). يحبسان الغاز في الخارجية.",
              fail: "تسريب من البلف أو تحت الغطاء، أو صمام غير مفتوح بالكامل بعد التركيب.",
              test: "افحص بالرغوة مع الأغطية مفكوكة. بعد الفاكيوم (≤ 500 microns) افتح الصمامين بالكامل وأعد الأغطية." },
            { id: "pipes", ar: "أنابيب التوصيل", en: "Interconnecting pipes (liquid small / gas large)", b: [342, 214], t: [352, 238],
              what: "الأنبوب الرفيع (مثلاً 1/4\") والعريض (مثلاً 3/8\" أو 1/2\") حسب القدرة. يُعزل كلٌّ منهما منفصلاً.",
              fail: "عزل ممزّق ← تعرّق وتنقيط، انثناء الأنبوب، أو تسريب.",
              test: "اختبار نيتروجين حسب PS على اللوحة (≈ 30–41.5 bar للمكيفات)، ثم فاكيوم ≤ 500 microns يثبت تحت 1000." },
            { id: "flare", ar: "وصلات الفلير", en: "Flare joints", b: [222, 118], t: [212, 136],
              what: "وصلات بصامولة على أطراف الأنابيب عند الداخلية وصمامات الخارجية.",
              fail: "فلير مشقوق، عزم خاطئ، أو بلا زيت ← أكثر مصدر للتسريب في السبليت.",
              test: "عزم الربط: 1/4\" 14–18، 3/8\" 33–42، 1/2\" 49–61، 5/8\" 62–82 N·m. افحص بالرغوة." },
            { id: "comm", ar: "كابل الاتصال والتغذية", en: "Interconnecting / communication cable", b: [272, 214], t: [300, 214],
              what: "ينقل التغذية والإشارة بين البوردين (في الإنفرتر إشارة اتصال رقمية).",
              fail: "توصيل خاطئ أو مقلوب، أسلاك مرتخية، كابل غير مطابق ← كود خطأ اتصال.",
              test: "طابق الأرقام على الطرفين وتأكد من الشد والتأريض؛ قِس جهد/إشارة خط الاتصال حسب الـ manual." },
          ];
        },
        draw(S, s) {
          const b = S.base, inv = s.inv;
          /* ---------- wall ---------- */
          R(b, 200, 10, 7, 260, 0, "ins");
          /* ---------- indoor unit, side section ---------- */
          const body = "M196,18 H58 Q30,18 28,50 L26,110 Q26,136 46,150 L62,162 H196 Z";
          P(b, body, "cab");
          // coil band (A-shaped, wrapping the fan)
          const coilD = "M58,128 L46,70 Q46,56 58,48 L96,34 H150 Q160,34 166,42 L182,72";
          const ic = S.part("icoil");
          P(ic, coilD, "coilband"); P(ic, coilD, "coilfin"); P(ic, coilD, "coilfins");
          [[50, 86], [54, 108], [62, 52], [86, 38], [112, 34], [136, 34], [170, 54]].forEach(([x, y]) => C(ic, x, y, 3, "cuf", { style: "fill:var(--sc-mix)" }));
          C(ic, 176, 64, 3, "cuf", { style: "fill:var(--sc-vap)" });
          // filter (just outside the coil)
          P(S.part("filter"), "M40,72 Q36,50 54,40 L94,24 H152 Q166,24 174,36 L190,64", "filt");
          // fan
          const xf = S.part("xfan"); xfan(xf, 120, 110, 22);
          // drain pans + hose
          const dn = S.part("drain");
          P(dn, "M42,124 V132 H74 V124", "coldf"); P(dn, "M164,78 V86 H184 V76", "coldf");
          pipe(dn, "M172,86 V168 Q172,176 180,178 V214", "wat", 4);
          // louver + outlet
          const lv = S.part("louver"); P(lv, "M40,150 Q56,158 76,154", "lk", { style: "stroke-width:3" });
          wavy(b, 70, 168, 26, 125, "air coldair"); wavy(b, 100, 168, 26, 105, "air coldair");
          wavy(b, 96, 6, 18, 90, "air"); wavy(b, 140, 6, 18, 90, "air");
          // sensors
          const rn = S.part("rntc"); R(rn, 34, 64, 8, 8, 2, "rub");
          const pn = S.part("pntc"); R(pn, 152, 42, 10, 7, 2, "rub");
          // indoor tails + flare nuts
          pipe(b, "M207,140 H200 Q194,140 194,132 V80", "mix", 4);
          pipe(b, "M184,72 Q186,78 186,90 V146 Q186,154 194,154 H207", "vap", 9);
          const fl = S.part("flare");
          P(fl, "M207,135 h7 l2,5 l-2,5 h-7z", "m2"); P(fl, "M207,148 h8 l2,6 l-2,6 h-8z", "m2");
          P(fl, "M335,426 v7 l-5,2 l-5,-2 v-7z", "m2"); P(fl, "M346,463 h7 l2,6 l-2,6 h-7z", "m2");
          // indoor control box inset
          const ip = S.part("ipcb");
          R(ip, 222, 18, 120, 78, 8, "sf");
          R(ip, 232, 26, 76, 46, 3, "pcb");
          for (let i = 0; i < 4; i++) R(ip, 240 + i * 15, 36, 9, 9, 1, "chipk");
          R(ip, 240, 52, 22, 14, 2, "m2"); C(ip, 286, 60, 7, "m");
          R(ip, 316, 26, 18, 46, 2, "m2"); for (let i = 0; i < 4; i++) C(ip, 325, 34 + i * 10, 2.6, "m");
          T(ip, 282, 90, "علبة التحكم الداخلية", "lbm");
          /* ---------- interconnecting pipes & cable ---------- */
          const pp = S.part("pipes");
          pipe(pp, "M335,426 V262 H216 V140 H214", "mix", 4);           // small: outdoor → indoor (cold 2-phase)
          pipe(pp, "M215,154 H230 V252 H352 V463", "vap", 9);           // large: indoor → outdoor
          const cm = S.part("comm"); P(cm, "M300,96 V294", "wire dash");
          /* ---------- outdoor unit, front, cover off ---------- */
          R(b, 20, 288, 312, 200, 6, "cab");
          const oc = S.part("ocoil"); R(oc, 26, 294, 172, 188, 2, "coilbox"); fins(oc, 28, 295, 168, 186, 4);
          const of = S.part("ofan"); fan(of, 112, 388, 62); C(of, 112, 388, 14, "m2");
          L(b, 202, 290, 202, 486, "lk");
          // electrical box
          const eb = S.part(inv ? "opcb" : "capac");
          R(eb, 206, 292, 120, 28, 3, "sf");
          if (inv) { R(eb, 212, 296, 88, 20, 2, "pcb"); R(eb, 274, 298, 20, 14, 1, "chipk"); for (let x = 276; x < 294; x += 3) L(eb, x, 292, x, 296, "ln thin"); R(eb, 220, 299, 12, 14, 6, "m2"); R(eb, 236, 299, 12, 14, 6, "m2"); }
          else { R(eb, 212, 297, 32, 18, 8, "m2"); T(eb, 228, 310, "µF", "tiny", "middle", false); R(eb, 256, 298, 36, 16, 2, "m"); for (let i = 0; i < 4; i++) C(eb, 262 + i * 8, 306, 2.3, "hub"); }
          // refrigerant piping (cooling mode, written in flow direction)
          pipe(b, "M196,328 H" + (inv ? 306 : 306) + " V334", "liq");     // condenser out → expansion
          pipe(b, "M326,470 H294 V348 H248 V360", "vap");             // gas valve → 4-way (E)
          pipe(b, "M235,360 V338 H268 V392", "vap");                  // 4-way (S) → accumulator
          pipe(b, "M235,404 V372", "hot");                            // discharge → 4-way (D)
          pipe(b, "M222,360 V344 H198", "hot");                       // 4-way (C) → condenser
          // 4-way valve
          const rv = S.part("rv"); R(rv, 214, 360, 42, 12, 6, "m2"); R(rv, 256, 358, 10, 16, 2, "m");
          // expansion device
          const xd = S.part(inv ? "eev" : "cap");
          if (inv) { pipe(xd, "M306,334 V342", "liq"); R(xd, 298, 340, 16, 20, 4, "m2"); R(xd, 301, 360, 10, 10, 2, "m"); pipe(xd, "M306,370 V436 H326", "mix"); }
          else { P(xd, "M306,334 c10,0 10,6 0,6 c-10,0 -10,6 0,6 c10,0 10,6 0,6 c-10,0 -10,6 0,6 c10,0 10,6 0,6 V366", "capl"); pipe(xd, "M306,366 V436 H326", "mix"); }
          // accumulator + compressor
          const ac = S.part("acc"); R(ac, 260, 392, 16, 58, 7, "shell"); pipe(ac, "M268,450 V462 Q268,468 262,468 H254", "vap");
          const k = S.part("comp");
          P(k, "M216,416 Q216,404 235,404 Q254,404 254,416 V474 Q254,480 248,480 H222 Q216,480 216,474Z", "shell");
          R(k, 212, 480, 46, 4, 1.5, "m"); R(k, 229, 398, 12, 6, 1, "m");
          if (inv) { const ds = S.part("dsens"); R(ds, 230, 384, 10, 7, 2, "rub"); }
          // service valves
          const sv = S.part("sv");
          R(sv, 326, 430, 14, 12, 2, "m"); R(sv, 326, 462, 20, 16, 2, "m"); R(sv, 332, 478, 7, 6, 1, "m2");
        },
      });
    },
  });

  /* =====================================================================
     4) washer — front-load washing machine (side section, front to the left)
     ===================================================================== */
  ACV.register("washer", {
    title: "مقطع غسالة تحميل أمامي",
    params: 'motor:"dd"|"belt"|"brush"; focus:[ids: drum,tub,door,boot,lock,drawer,valve,pswitch,heater,ntc,pump,motor,pulley,brushes,bearing,spider,shocks,springs,pcb]; caption',
    demo: [{ motor: "dd" }, { motor: "brush" }],
    render(host, p) {
      const reduce = ACV.reduce();
      const M = { dd: "dd", belt: "belt", brush: "brush" }[p.motor] || "dd";
      scene(host, {
        vb: [360, 466], label: "مقطع جانبي لغسالة تحميل أمامي", focus: arr(p.focus), caption: p.caption,
        intro: "مقطع جانبي لغسالة تحميل أمامي (الباب لليسار). الحلة تدور داخل حوض ثابت معلّق بالنوابض والمساعدات. اختر نوع المحرك: دفع مباشر، سير، أو فحمات.",
        state: { m: M, flow: !reduce },
        controls: [
          { type: "seg", key: "m", label: "المحرك", items: [["dd", "Direct drive"], ["belt", "سير"], ["brush", "فحمات"]], redraw: true },
          { type: "toggle", key: "flow", label: "الماء", cls: "noflow" },
        ],
        legend: () => LEG([["wat", "ماء دخول/تصريف <em dir=ltr>Water</em>"]]),
        parts: (s) => {
          const m = s.m;
          const motor = m === "dd"
            ? { id: "motor", ar: "محرك الدفع المباشر", en: "Direct-drive motor (stator + rotor)", b: [344, 246], t: [312, 246],
                what: "ستاتور ثابت على ظهر الحوض وروتور مغناطيسي مركّب على العامود مباشرة؛ البورد (Inverter) يتحكم بالسرعة بلا سير.",
                fail: "ملف مقطوع، حساس Hall تالف، أو برغي الروتور مرتخٍ ← اهتزاز، صوت، أو كود محرك.",
                test: "قِس مقاومة الملفات الثلاثة (متساوية تقريباً، بضعة أوم حسب الموديل) والعزل للجسم، وافحص حساس Hall وفيشته." }
            : m === "belt"
              ? { id: "motor", ar: "محرك تحريضي", en: "Induction motor (with capacitor)", b: [344, 380], t: [296, 380],
                  what: "محرك تحريضي (Induction) بسرعتين للغسيل والعصر يعمل مع مكثف تشغيل، ويدير الحلة عبر السير.",
                  fail: "مكثف ضعيف (يطنّ ولا يدور)، ملفات محروقة، أو حماية حرارية مفتوحة.",
                  test: "قِس المكثف (السماحية ±5%، بدّله إذا نقص > 10%) ومقاومة ملفات السرعتين والعزل." }
              : { id: "motor", ar: "محرك بالفحمات", en: "Universal (brush) motor + tacho", b: [344, 380], t: [296, 380],
                  what: "محرك عام (Universal) بفحمات وكوموتاتور، معه Tacho لقياس السرعة؛ يدير الحلة عبر السير.",
                  fail: "كوموتاتور محروق أو ملفات، أو Tacho تالف ← سرعة غير ثابتة أو لا يدور.",
                  test: "قِس الـ Tacho (عادة ≈ 50–200 Ω تقريباً) وملفات الروتور عبر الكوموتاتور والستاتور حسب الـ manual." };
          const list = [
            { id: "drum", ar: "الحلة", en: "Drum", b: [180, 200],
              what: "أسطوانة ستانلس مثقّبة تدور بالملابس، داخلها رافعات (Lifters) ترفع الملابس وتسقطها.",
              fail: "ارتخاء بسبب البيلية أو الـ Spider فتحتك بالحوض؛ أجسام غريبة (ملاقط، عملات) تعلق بين الحلة والحوض.",
              test: "ارفع الحلة وأنزلها باليد: أي حركة = بيلية أو Spider. أدرها ببطء واستمع لأي احتكاك." },
            { id: "tub", ar: "الحوض", en: "Outer tub", b: [344, 108], t: [282, 122],
              what: "الحوض الثابت الذي يحمل الماء؛ معلّق بالنوابض والمساعدات وفيه السخّان ومقعد البيلية.",
              fail: "تشقّق من جسم غريب أو بيلية خربانة، أو تسريب من وصلة نصفي الحوض.",
              test: "ابحث عن آثار ماء وصدأ أسفله، وافحص الوصلات والخراطيم أثناء الملء." },
            { id: "door", ar: "الباب والزجاج", en: "Door & glass bowl", b: [52, 216],
              what: "زجاج مقعّر يُبقي الملابس داخل الحلة ويضغط على جوان الفم.",
              fail: "مفصّلة مرتخية أو لسان القفل مكسور فلا يُقفل.",
              test: "تحقق من محاذاة الباب ودخول اللسان في القفل وضغطه المتساوي على الجوان." },
            { id: "boot", ar: "جوان الفم (Boot seal)", en: "Door boot / bellows seal", b: [52, 306], t: [58, 284],
              what: "جوان مطاطي منفاخي يصل فتحة الهيكل بفم الحوض ويمنع التسريب أثناء الاهتزاز.",
              fail: "تمزّق من أجسام حادة، عفن ورائحة، أو تسريب من أسفل الباب.",
              test: "افتح طيّات الجوان وافحصها بالضوء؛ نظّفه وجففه واترك الباب مفتوحاً بعد الغسيل." },
            { id: "lock", ar: "قفل الباب", en: "Door lock (interlock)", b: [62, 108], t: [48, 128],
              what: "يقفل الباب كهربائياً (PTC أو Solenoid) قبل دخول الماء ويؤكّد الإقفال للبورد.",
              fail: "لا يُقفل ← لا تبدأ الدورة وكود باب؛ أو يبقى مقفولاً بعد انتهاء الغسيل.",
              test: "قِس الجهد على القفل عند البدء واستمرارية مفتاح الإقفال حسب المخطط. القفل الحراري يحتاج ≈ 1–2 دقيقة ليفك." },
            { id: "drawer", ar: "درج المسحوق", en: "Detergent drawer", b: [46, 84], t: [60, 52],
              what: "ماء الدخول يمرّ عبر خانات المسحوق والمنعّم فيحملها إلى الحوض.",
              fail: "تكتّل المسحوق أو انسداد فتحات الرش ← مسحوق متبقٍّ أو فيضان من الدرج.",
              test: "انزع الدرج ونظّفه مع فتحات الرش، وتأكد أن الماء يتجه للخانة الصحيحة." },
            { id: "valve", ar: "محبس الماء", en: "Water inlet valve", b: [344, 38], t: [302, 38],
              what: "صمام كهربائي بملف أو أكثر يفتح ماء الشبكة نحو خانات الدرج حسب البرنامج.",
              fail: "ملف محروق ← لا يدخل الماء؛ صمام عالق أو شبكة مسدودة ← تسريب دائم أو ملء بطيء.",
              test: "قِس مقاومة الملف (عادة ≈ 3–5 kΩ تقريباً حسب الموديل) ونظّف الشبكة عند مدخل الخرطوم." },
            { id: "pswitch", ar: "حساس مستوى الماء + خرطومه", en: "Pressure switch / level sensor + hose", b: [214, 84], t: [196, 46],
              what: "يقيس ضغط الهواء المحبوس في خرطوم موصول بغرفة هواء أسفل الحوض فيعرف مستوى الماء.",
              fail: "خرطوم مثقوب أو مسدود أو غرفة الهواء متّسخة ← فيضان، ملء لا يتوقف، أو لا يسخّن.",
              test: "انفخ بخفة في الخرطوم واسمع طقّة المفتاح. الحساس الإلكتروني: قِس الخرج حسب الـ manual." },
            { id: "heater", ar: "السخّان", en: "Heating element", b: [214, 302], t: [214, 328],
              what: "مقاومة في قاع الحوض تسخّن الماء حسب البرنامج.",
              fail: "ينقطع أو يتماس مع الجسم بسبب الكلس ← يفصل قاطع التسريب (RCD) أو يبقى الماء بارداً.",
              test: "قِس المقاومة: R = V² / P، مثلاً 2000 W على 230 V ≈ 26 Ω. وقِس العزل للجسم (يجب أن يكون بالـ MΩ)." },
            { id: "ntc", ar: "حساس الحرارة NTC", en: "Water temperature NTC", b: [120, 302], t: [116, 328],
              what: "يقرأ حرارة الماء ليوقف السخّان عند الدرجة المطلوبة.",
              fail: "مقاومة خاطئة ← ماء ساخن جداً، أو لا يسخّن، أو كود خطأ.",
              test: "قِس المقاومة وقارنها بجدول الشركة (كثير منها ≈ 20 kΩ عند 25°C حسب الموديل)." },
            { id: "pump", ar: "مضخة التصريف والفلتر", en: "Drain pump + filter", b: [24, 372], t: [44, 404],
              what: "تسحب الماء من قاع الحوض وترميه للمجاري. أمامها فلتر يُفتح من الأسفل الأمامي.",
              fail: "انسداد الفلتر بقطع صغيرة، ريشة مكسورة، أو ملف محروق ← الماء لا يخرج وكود تصريف.",
              test: "افتح الفلتر فوق صينية، أدر الريشة باليد، وقِس الملف (عادة ≈ 150–200 Ω تقريباً حسب الموديل)." },
            motor,
            ...(m !== "dd" ? [{ id: "pulley", ar: "البكرة والسير", en: "Drum pulley & belt", b: [344, 290], t: [306, 290],
              what: "بكرة كبيرة على عامود الحلة يديرها السير من بكرة المحرك الصغيرة (تخفيض سرعة).",
              fail: "سير مرتخٍ أو مقطوع أو قافز ← المحرك يدور والحلة لا تدور. برغي البكرة مرتخٍ ← طقطقة.",
              test: "افحص شد السير وتآكله، وثبات برغي البكرة، ودوران الحلة باليد." }] : []),
            ...(m === "brush" ? [{ id: "brushes", ar: "الفحمات", en: "Carbon brushes", b: [344, 430], t: [286, 400],
              what: "قطعتا كربون تضغطان على الكوموتاتور لإيصال التيار للروتور.",
              fail: "تتآكل مع الوقت ← شرر، ضعف، توقف متقطع ثم توقف كامل.",
              test: "انزعهما وقِس الطول (بدّلهما كزوج إذا قصرتا كثيراً) وافحص الكوموتاتور من الحروق." }] : []),
            { id: "bearing", ar: "البيلية والجوان", en: "Bearings & shaft seal", b: [344, 188], t: [290, 206],
              what: "بيليتان على العامود في ظهر الحوض مع جوان يمنع الماء من الوصول إليهما.",
              fail: "تسريب الجوان يصدّئ البيلية ← هدير قوي في العصر وارتخاء الحلة.",
              test: "هزّ الحلة ودوّرها: خشخشة أو ارتخاء = بدّل البيليتين والجوان معاً." },
            { id: "spider", ar: "الـ Spider (الصليبة)", en: "Drum spider", b: [344, 148], t: [274, 150],
              what: "قاعدة ألمنيوم بثلاث أذرع تثبّت الحلة على العامود.",
              fail: "تآكل الألمنيوم بالمنظفات ثم كسر ذراع ← الحلة تتمايل وتحتك.",
              test: "افحص تمايل الحلة؛ عند فك الحوض ابحث عن تشقق أو تآكل أبيض في الأذرع." },
            { id: "shocks", ar: "المساعدات", en: "Shock absorbers (dampers)", b: [154, 432], t: [174, 412],
              what: "تمتص اهتزاز الحوض من الأسفل أثناء العصر.",
              fail: "تفقد الاحتكاك ← اهتزاز ومشي الغسالة وضرب الحوض بالهيكل.",
              test: "فكّها واضغطها باليد: يجب أن تقاوم بالتساوي في الاتجاهين." },
            { id: "springs", ar: "النوابض العلوية", en: "Suspension springs", b: [262, 84], t: [242, 82],
              what: "تعلّق الحوض من الأعلى وتعيده لمكانه.",
              fail: "نابض مكسور أو مفكوك ← الحوض يميل ويخبط.",
              test: "تأكد من وجودها كلها وتثبيتها بالتساوي." },
            { id: "pcb", ar: "بورد التحكم", en: "Main PCB", b: [140, 84], t: [134, 50],
              what: "ينفّذ البرنامج: يفتح المحابس، يسخّن، يدير المحرك، يصرّف، ويقرأ الحساسات.",
              fail: "ريليه أو Triac تالف، رطوبة أو تسريب ماء عليه، أكواد خطأ.",
              test: "اقرأ كود الخطأ وجرّب وضع الخدمة (Test mode) حسب الـ manual قبل اتهام البورد." },
          ];
          return list;
        },
        draw(S, s) {
          const b = S.base, m = s.m;
          R(b, 30, 16, 296, 436, 8, "cab");
          L(b, 30, 64, 326, 64, "ln"); R(b, 42, 452, 14, 6, 1, "m"); R(b, 300, 452, 14, 6, 1, "m");
          // top components
          const dw = S.part("drawer"); R(dw, 34, 24, 62, 32, 3, "m"); L(dw, 56, 26, 56, 54, "ln thin"); L(dw, 76, 26, 76, 54, "ln thin"); R(dw, 28, 30, 8, 20, 2, "m2");
          const pc = S.part("pcb"); R(pc, 106, 28, 56, 22, 3, "pcb"); for (let x = 112; x < 158; x += 11) R(pc, x, 34, 6, 6, 1, "chipk");
          const ps = S.part("pswitch"); C(ps, 194, 38, 11, "m2"); C(ps, 194, 38, 4, "m"); P(ps, "M194,49 V62 Q194,72 200,80 V350", "ln thin dash");
          const iv = S.part("valve"); R(iv, 246, 28, 56, 20, 3, "m"); R(iv, 252, 24, 14, 28, 3, "m2"); R(iv, 272, 24, 14, 28, 3, "m2");
          // tub, water, drum
          const tb = S.part("tub");
          P(tb, "M92,96 H266 Q284,96 284,114 V318 Q284,336 266,336 H92 Q74,336 74,318 V284 M74,148 V114 Q74,96 92,96", "tubp");
          R(b, 76, 290, 206, 44, 14, "water");
          const dr = S.part("drum");
          P(dr, "M92,160 V120 Q92,110 102,110 H262 Q268,110 268,118 V312 Q268,322 260,322 H102 Q92,322 92,312 V272", "drump");
          for (let y = 124; y < 318; y += 12) for (let x = 106 + ((y / 12) % 2) * 6; x < 262; x += 12) C(dr, x, y, 1.3, "perf");
          P(dr, "M150,111 l8,12 l8,-12z M200,321 l8,-12 l8,12z", "m");
          // spider + shaft + bearings
          const sp = S.part("spider"); P(sp, "M268,128 L278,215 L268,302", "spid"); C(sp, 278, 215, 6, "m2");
          L(b, 278, 215, 302, 215, "lk", { style: "stroke-width:4" });
          const br = S.part("bearing"); R(br, 284, 203, 8, 9, 1.5, "m"); R(br, 284, 218, 8, 9, 1.5, "m"); P(br, "M284,203 l8,9 M292,203 l-8,9 M284,218 l8,9 M292,218 l-8,9", "ln thin"); R(br, 280, 211, 4, 8, 1, "rub");
          // boot + door + lock
          const bt = S.part("boot"); P(bt, zig(34, 148, 76, 148, 4, 4), "boot"); P(bt, zig(34, 284, 76, 284, 4, 4), "boot");
          const dg = S.part("door"); R(dg, 16, 134, 18, 164, 8, "cab"); P(dg, "M34,150 Q76,170 76,216 Q76,262 34,282", "glass");
          const lk = S.part("lock"); R(lk, 38, 122, 18, 14, 2, "m2"); P(lk, "M28,138 V128 H40", "lk");
          // heater + NTC + air trap
          const ht = S.part("heater"); P(ht, "M124,325 H248 A3,3 0 0 1 248,331 H124", "heat");
          const nt = S.part("ntc"); R(nt, 110, 324, 10, 8, 2, "rub");
          R(b, 196, 336, 8, 14, 2, "sf");
          // springs + shocks
          const sg = S.part("springs"); P(sg, zig(118, 64, 118, 96, 5, 4), "lk"); P(sg, zig(240, 64, 240, 96, 5, 4), "lk");
          const sh = S.part("shocks");
          [[132, 336, 124, 444], [186, 336, 180, 444]].forEach(([x1, y1, x2, y2]) => { const mx = (x1 + x2) / 2, my = (y1 + y2) / 2; L(sh, x1, y1, mx, my, "lk", { style: "stroke-width:2.5" }); P(sh, `M${mx - 4},${my - 8} L${x2 - 4},${y2 - 4} H${x2 + 4} L${mx + 4},${my - 8}Z`, "m2"); C(sh, x1, y1 + 2, 3, "m"); C(sh, x2, y2 - 1, 3, "m"); });
          // drain pump + filter
          const pm = S.part("pump"); C(pm, 84, 404, 13, "m2"); R(pm, 96, 396, 30, 16, 3, "m"); R(pm, 34, 398, 16, 14, 3, "rub"); L(pm, 50, 405, 71, 405, "lk");
          // water paths
          pipe(b, "M336,38 H302", "wat", 4);
          pipe(b, "M262,48 V58 H90 V54", "wat", 4);
          pipe(b, "M66,56 V74 Q66,92 92,99", "wat", 4);
          pipe(b, "M100,336 V391", "wat", 4);
          pipe(b, "M84,417 V426 H316 Q322,426 322,418 V372 H336", "wat", 4);
          // motor variants
          const mo = S.part("motor");
          if (m === "dd") {
            R(mo, 296, 168, 9, 94, 2, "ws");
            for (let y = 174; y < 258; y += 8) L(mo, 296, y, 305, y, "ln thin");
            P(mo, "M302,150 H318 V280 H302 V272 H312 V158 H302 Z", "m2");
            for (let y = 164; y < 268; y += 14) R(mo, 308, y, 4, 9, 1, "chipk");
          } else {
            const pu = S.part("pulley");
            E(pu, 304, 215, 9, 98, "pul"); E(pu, 304, 215, 5, 92, "pulin"); C(pu, 304, 215, 4, "m2");
            P(pu, "M304,117 A9,98 0 0 1 313,215 L307,378 A3.5,10 0 0 1 300,378 L295,215 A9,98 0 0 1 304,117", "belt");
            R(mo, 196, 360, 104, 34, 8, "m2"); for (let x = 210; x < 290; x += 10) L(mo, x, 362, x, 392, "ln thin");
            E(mo, 304, 377, 3.5, 10, "m");
            if (m === "brush") { const bb = S.part("brushes"); R(bb, 280, 352, 8, 8, 1, "chipk"); R(bb, 280, 394, 8, 8, 1, "chipk"); R(mo, 186, 368, 10, 18, 3, "m"); }
            else R(mo, 186, 368, 10, 18, 3, "m");
          }
        },
      });
    },
  });

  /* =====================================================================
     5) coldroom — cold room refrigeration system (section + schematic)
     ===================================================================== */
  ACV.register("coldroom", {
    title: "نظام غرفة تبريد",
    params: "focus:[ids: panels,door,curtain,evap,efans,dheat,drain,txv,bulb,equal,sol,sight,drier,recv,comp,cond,cfan,hplp,trap,ctrl,probes]; freezer:true|false (door/drain heaters shown); caption",
    demo: [{ freezer: true }],
    render(host, p) {
      const reduce = ACV.reduce();
      const fz = p.freezer !== false && p.freezer !== "false";
      scene(host, {
        vb: [360, 500], label: "مقطع غرفة تبريد مع وحدة التكثيف والأنابيب", focus: arr(p.focus), caption: p.caption,
        intro: "غرفة تبريد مع وحدة تكثيف مركّبة أعلى الغرفة. خط السائل: Receiver ← Drier ← Sight glass ← Solenoid ← TXV. خط السحب يصعد إلى الكباس مع مصيدة زيت عند أسفل الصاعد.",
        state: { flow: !reduce },
        controls: [{ type: "toggle", key: "flow", label: "التدفق", cls: "noflow" }],
        legend: () => STATE_LEG,
        parts: () => [
          { id: "comp", ar: "الكباس", en: "Compressor (hermetic / semi-hermetic)", b: [190, 82], t: [214, 92],
            what: "يسحب البخار من المبخّر ويضغطه للمكثف. في الغرف غالباً كباس Hermetic أو Semi-hermetic أو Scroll.",
            fail: "رجوع سائل أو نقص زيت (مصيدة/ميل خاطئ)، حرارة طرد عالية، ملفات محروقة.",
            test: "قِس التيار والملفات والعزل (≥ 2 MΩ). الـ Superheat عند مدخل الكباس عادة ≈ 10–20 K تقريباً، وراقب زجاجة الزيت إن وُجدت." },
          { id: "hplp", ar: "مفاتيح الضغط HP / LP", en: "High / low pressure switches", b: [190, 30], t: [214, 30],
            what: "HP يفصل الكباس عند ضغط عالٍ خطر (غالباً Manual reset). LP يفصل عند ضغط منخفض ويستعمل لإيقاف الـ Pump-down.",
            fail: "نقطة ضبط خاطئة، أنبوب شعري مكسور، أو تلامسات محروقة ← فصل متكرر أو لا حماية.",
            test: "ركّب المانيفولد وقارن ضغط الفصل والتوصيل الفعلي بالإعداد حسب الغاز والتطبيق." },
          { id: "cond", ar: "المكثف", en: "Air-cooled condenser", b: [344, 22], t: [330, 38],
            what: "يطرد حرارة الغرفة مع حرارة الكباس للهواء الخارجي.",
            fail: "اتساخ أو تركيب في مكان حار بلا تهوية ← ضغط عالٍ وفصل HP.",
            test: "حرارة التكثيف عادة أعلى من الهواء الخارجي بـ ≈ 10–15 K تقريباً. نظّفه دورياً." },
          { id: "cfan", ar: "مروحة المكثف", en: "Condenser fan", b: [344, 64], t: [334, 64],
            what: "تسحب الهواء عبر المكثف؛ قد يتحكم بسرعتها منظّم ضغط في الشتاء.",
            fail: "محرك أو Capacitor تالف ← ضغط عالٍ.",
            test: "تأكد من الدوران والاتجاه، وقِس التيار والـ Capacitor." },
          { id: "recv", ar: "خزان السائل", en: "Liquid receiver", b: [344, 114], t: [330, 114],
            what: "يخزّن الغاز السائل ويؤمّن عموداً من السائل للـ TXV، ويستوعب الشحنة عند الـ Pump-down.",
            fail: "شحنة زائدة تملؤه فيرتفع الضغط؛ تسريب من صمام الخدمة أو صمام الأمان.",
            test: "افحص صمامات الخدمة والأمان بالرغوة، وتأكد أن السائل يصل صافياً للـ Sight glass." },
          { id: "drier", ar: "الفلتر درايِر", en: "Liquid-line filter drier", b: [306, 172], t: [304, 152],
            what: "يحجز الرطوبة والأحماض والأوساخ قبل الصمامات.",
            fail: "انسداد ← فرق حرارة بين طرفيه وفقاعات بعده.",
            test: "فرق حرارة أكثر من ≈ 1–2 K بين دخوله وخروجه = انسداد. يُبدَّل عند كل فتح للدورة." },
          { id: "sight", ar: "زجاجة البيان", en: "Sight glass / moisture indicator", b: [276, 172], t: [272, 152],
            what: "تُظهر حالة السائل: صافٍ = سائل كامل. المؤشر يتغير لونه مع الرطوبة (الألوان حسب الشركة).",
            fail: "فقاعات مستمرة = نقص غاز أو انسداد قبلها؛ لون الرطوبة = دورة رطبة.",
            test: "راقبها بعد استقرار التشغيل ≈ 10–15 دقيقة؛ فقاعات عند الإقلاع فقط طبيعية." },
          { id: "sol", ar: "صمام الملف (Solenoid)", en: "Liquid-line solenoid valve (NC)", b: [246, 172], t: [246, 152],
            what: "مغلق طبيعياً؛ يفتحه الكونترولر عند الطلب. عند الإغلاق يسحب الكباس الغاز (Pump-down) حتى يفصل الـ LP.",
            fail: "ملف محروق ← لا تبريد. صمام لا يُحكم ← الكباس يقلع ويطفي باستمرار بعد التوقف.",
            test: "قِس جهد الملف وجرّب الجذب المغناطيسي بمفك. يجب ألا يكون هناك فرق حرارة عبره وهو مفتوح." },
          { id: "trap", ar: "خط السحب: المصيدة والميل", en: "Suction riser oil trap & slope", b: [176, 186], t: [204, 186],
            what: "مصيدة زيت عند أسفل الصاعد ترفع الزيت للكباس، والخط الأفقي يميل نحو الكباس (≈ 0.5–1%). يُعزَل كامل خط السحب.",
            fail: "بلا مصيدة أو قطر كبير جداً ← الزيت يبقى في المبخّر والكباس يجف ويتلف.",
            test: "افحص مستوى الزيت أثناء التشغيل، والعزل والميل؛ تعرّق قوي حتى الكباس = رجوع سائل." },
          { id: "panels", ar: "الألواح المعزولة", en: "Insulated sandwich panels (PU/PIR)", b: [22, 212], t: [40, 236],
            what: "ألواح Sandwich بعزل PU أو PIR؛ السماكة حسب الحرارة (للفريزر أكثر سماكة).",
            fail: "فواصل غير معزولة أو ثقوب أنابيب غير مسدودة ← ثلج، تكاثف، وتشغيل طويل.",
            test: "افحص الفواصل والسيليكون وفتحات الأنابيب؛ بقع ثلج أو ماء على الألواح تكشف مكان التسرب الحراري." },
          { id: "door", ar: "الباب وسخّان الإطار", en: fz ? "Door + frame heater (+ pressure relief valve)" : "Door + gasket", b: [22, 324], t: [12, 350],
            what: fz ? "باب معزول مع سخّان في الإطار يمنع تجمّد الجوان والتصاقه. غرف التجميد تحتاج صمام موازنة ضغط." : "باب معزول مع جوان يُحكم الإغلاق.",
            fail: "جوان تالف أو سخّان مقطوع ← تسرّب هواء رطب أو تجمّد الباب.",
            test: "قِس مقاومة سخّان الإطار، واختبر الجوان بالورقة في عدة نقاط." },
          { id: "curtain", ar: "الستارة البلاستيكية", en: "PVC strip curtain", b: [56, 432], t: [30, 432],
            what: "شرائط PVC تقلل دخول الهواء الدافئ الرطب عند فتح الباب.",
            fail: "شرائط ممزقة أو مرفوعة ← ثلج أكثر على المبخّر وتشغيل أطول.",
            test: "تأكد أنها تغطي كامل الفتحة وتتداخل الشرائط." },
          { id: "evap", ar: "المبخّر (Unit cooler)", en: "Evaporator coil", b: [118, 226], t: [118, 252],
            what: "يمتص حرارة الغرفة. الفرق بين حرارة الغرفة وحرارة التبخّر عادة ≈ 6–10 K حسب التصميم.",
            fail: "ثلج كثيف لضعف الديفروست أو الستارة/الباب، اتساخ، أو تسريب.",
            test: "قارن حرارة التبخّر (من الضغط) مع حرارة الغرفة، وافحص توزيع الثلج على الكويل." },
          { id: "efans", ar: "مراوح المبخّر", en: "Evaporator fans", b: [36, 268], t: [58, 268],
            what: "تدفع الهواء عبر الكويل. تتوقف أثناء الديفروست وتتأخر بعده حتى يبرد الكويل (Fan delay).",
            fail: "محرك تالف أو ريش مثلجة ← تبريد ضعيف ورجوع سائل.",
            test: "افحص الدوران، التيار، ومفتاح الباب الذي يوقف المراوح." },
          { id: "dheat", ar: "سخّانات الديفروست", en: "Electric defrost heaters", b: [118, 322], t: [118, 296],
            what: "عناصر داخل الكويل وتحت الصينية تذيب الثلج؛ ينهي الديفروست حساس المبخّر أو الوقت.",
            fail: "سخّان مقطوع ← ثلج يتراكم في جزء من الكويل.",
            test: "قِس كل سخّان: R = V² / P (مثلاً 230 V و 500 W ≈ 106 Ω)." },
          { id: "drain", ar: "خط التصريف وسخّانه", en: fz ? "Drain line + heater tape" : "Drain line", b: [282, 400], t: [256, 400],
            what: fz ? "يصرّف ماء الديفروست للخارج بميل، مع سخّان ملفوف داخل الغرفة الباردة وسيفون خارجها." : "يصرّف ماء الديفروست للخارج بميل مع سيفون خارج الغرفة.",
            fail: "تجمّد الخط أو انسداده ← ثلج في الصينية وتنقيط داخل الغرفة.",
            test: "اسكب ماءً في الصينية وتأكد من خروجه، وافحص استمرارية سخّان الخط." },
          { id: "txv", ar: "صمام التمدد TXV", en: "TXV (external equalizer)", b: [262, 250], t: [226, 276],
            what: "يغذّي المبخّر ويحافظ على Superheat ثابت (عادة ≈ 4–8 K حسب التطبيق والـ manual).",
            fail: "فقدان شحنة البصلة، انسداد الشبكة، أو اختيار Orifice خاطئ.",
            test: "قِس الـ Superheat عند البصلة واضبط ببطء (ربع لفة ثم انتظر الاستقرار)." },
          { id: "bulb", ar: "بصلة الإحساس", en: "Sensing bulb", b: [176, 228], t: [182, 256],
            what: "على خط السحب الأفقي عند مخرج المبخّر، قبل المصيدة.",
            fail: "تثبيت مرتخٍ أو بلا عزل ← رجوع سائل أو تغذية ضعيفة.",
            test: "ثبّتها بمشبك معدني عند الساعة 4 أو 8 واعزلها جيداً." },
          { id: "equal", ar: "خط المعادلة الخارجي", en: "External equalizer line", b: [262, 222], t: [214, 246],
            what: "ينقل ضغط مخرج المبخّر للصمام ليعوّض هبوط الضغط في الموزّع والكويل. يُركَّب بعد البصلة.",
            fail: "مسدود أو مثني أو مغطّى بغطاء ← الصمام يجوّع المبخّر.",
            test: "تأكد أنه موصول بخط السحب بعد البصلة ومفتوح، ولا يُغلق أبداً بغطاء." },
          { id: "ctrl", ar: "الكونترولر", en: "Digital controller", b: [344, 356], t: [322, 356],
            what: "يقرأ حساسات الغرفة والمبخّر ويتحكم بالصولونويد/الكباس، المراوح، والديفروست (فترة، نهاية، تأخير المراوح).",
            fail: "إعدادات خاطئة أو خطأ حساس ← تبريد زائد/ناقص أو ديفروست غير كافٍ.",
            test: "راجع الإعدادات (Setpoint، Differential، Defrost) وقارن قراءة الحساسات بميزان حرارة مرجعي." },
          { id: "probes", ar: "حساسات الغرفة والمبخّر", en: "Room & evaporator probes (NTC)", b: [92, 382], t: [118, 392],
            what: "حساس الغرفة في هواء الرجوع بعيداً عن الباب؛ حساس المبخّر بين الزعانف لإنهاء الديفروست.",
            fail: "حساس مكسور ← إنذار؛ مكان خاطئ ← ديفروست ناقص أو قراءة غير صحيحة.",
            test: "قِس المقاومة وقارن بجدول الحساس (كثير منها NTC 10 kΩ عند 25°C حسب الشركة)." },
        ],
        draw(S, s) {
          const b = S.base;
          /* ---- room ---- */
          const outer = "M2,230 H248 V490 H2 Z", inner = "M12,240 H238 V480 H12 Z";
          const pn = S.part("panels");
          P(pn, outer, "ins");
          hatch(pn, 2, 230, 246, 260, 7).setAttribute("clip-path", S.clip(outer + " " + inner));
          P(pn, inner, "sf");
          P(pn, outer, "cab2");
          // door (left wall opening) + frame heater + curtain
          const dr = S.part("door");
          R(dr, 0, 334, 14, 144, 2, "cab");
          if (fz) P(dr, "M4,330 H16 M14,334 V478", "heat dash");
          const cu = S.part("curtain");
          for (let x = 18; x < 32; x += 4) R(cu, x, 336, 3, 142, 1, "strip");
          // product
          R(b, 120, 440, 40, 40, 2, "m"); R(b, 164, 452, 34, 28, 2, "m"); R(b, 140, 412, 34, 28, 2, "m");
          /* ---- evaporator unit ---- */
          const ev = S.part("evap");
          R(ev, 56, 244, 116, 48, 3, "sf");
          R(ev, 76, 248, 92, 40, 1, "coilbox"); fins(ev, 77, 249, 90, 38, 3.5);
          const ef = S.part("efans");
          [256, 278].forEach((y) => { E(ef, 64, y, 4, 9, "blade"); R(ef, 66, y - 5, 8, 10, 2, "m2"); });
          wavy(b, 50, 262, 26, 180, "air coldair"); wavy(b, 50, 284, 26, 165, "air coldair");
          const dh = S.part("dheat");
          [256, 268, 280].forEach((y) => L(dh, 78, y, 166, y, "heat"));
          P(dh, "M56,296 H172", "heat");
          // drain pan + drain line
          const dn = S.part("drain");
          P(dn, "M54,292 V300 H174 V292", "coldf");
          pipe(dn, "M170,300 V306 H256 V476", "wat", 4);
          if (fz) P(dn, zig(256, 312, 256, 470, 14, 4), "heat thinh");
          /* ---- piping (written in flow direction) ---- */
          // liquid line: receiver → drier → sight glass → solenoid → TXV
          pipe(b, "M330,124 V152 H222 V268", "liq");
          const dri = S.part("drier"); R(dri, 290, 145, 28, 14, 6, "m");
          const sg = S.part("sight"); C(sg, 272, 152, 7, "m"); C(sg, 272, 152, 3.6, "glass");
          const so = S.part("sol"); R(so, 238, 138, 16, 14, 2, "m2"); R(so, 241, 147, 10, 10, 1, "m");
          // TXV + outlet to coil
          const tx = S.part("txv");
          R(tx, 214, 268, 16, 16, 2, "m"); P(tx, "M230,270 a7,7 0 0 1 0,12z", "m2");
          pipe(tx, "M214,280 H168", "mix");
          // suction: coil out → bulb → trap → riser → compressor
          pipe(b, "M168,252 H192 V266", "vap");
          const tr = S.part("trap");
          pipe(tr, "M192,266 A6,6 0 0 0 204,266 V104 H214", "vap");
          const bl = S.part("bulb"); R(bl, 174, 255, 14, 5, 2.5, "bulb"); P(bl, "M181,260 V264 Q181,290 214,288 H232 V282", "capl thin");
          const eq = S.part("equal"); P(eq, "M222,268 V246 H206", "capl thin", { style: "stroke-width:1.6" });
          /* ---- condensing unit ---- */
          R(b, 186, 12, 168, 124, 6, "cab"); R(b, 190, 136, 8, 6, 1, "m"); R(b, 342, 136, 8, 6, 1, "m");
          const cd = S.part("cond"); R(cd, 266, 18, 82, 80, 2, "coilbox"); fins(cd, 267, 19, 80, 78, 4);
          const cf = S.part("cfan"); fan(cf, 306, 58, 30);
          const k = S.part("comp");
          P(k, "M214,72 Q214,58 236,58 Q258,58 258,72 V124 Q258,130 252,130 H220 Q214,130 214,124Z", "shell");
          pipe(b, "M236,58 V46 H266", "hot");                // discharge → condenser
          pipe(b, "M306,98 V104", "liq");                    // condenser → receiver
          const rc = S.part("recv"); R(rc, 262, 104, 84, 20, 10, "shell");
          const hl = S.part("hplp"); R(hl, 212, 20, 18, 16, 2, "m2"); R(hl, 236, 20, 18, 16, 2, "m2");
          T(hl, 221, 31, "HP", "tiny", "middle", false); T(hl, 245, 31, "LP", "tiny", "middle", false);
          P(hl, "M221,36 V46 M245,36 V40 Q245,44 240,44 H208 V96", "capl thin");
          /* ---- controller + probes ---- */
          const ct = S.part("ctrl"); R(ct, 266, 342, 56, 30, 4, "m2"); R(ct, 272, 348, 30, 12, 2, "pcb"); for (let i = 0; i < 3; i++) C(ct, 278 + i * 10, 366, 2.2, "hub");
          const pr = S.part("probes");
          R(pr, 112, 388, 12, 6, 3, "rub"); R(pr, 132, 262, 10, 5, 2.5, "rub");
          P(pr, "M118,388 V356 H266 M137,267 V316 H286 V342", "wire dash");
        },
      });
    },
  });

  /* =====================================================================
     6) compressor — hermetic reciprocating compressor: terminals & start
        circuits (PTC / current relay / CSR) + internal cut-away
     ===================================================================== */
  const CMP = {
    shell: { ar: "الجسم المحكم", en: "Hermetic shell",
      what: "غلاف فولاذي ملحوم يضم المحرك والمضخة والزيت. في الكباسات الترددية الصغيرة داخل الجسم يكون ضغط السحب (Low-side shell).",
      fail: "صدأ وتسريب عند اللحامات أو القاعدة؛ سخونة مفرطة عند نقص الغاز أو ضعف التهوية.",
      test: "افحص اللحامات وجذور الأنابيب بالرغوة؛ جسم ساخن جداً مع طرد ضعيف يدل على علّة داخلية." },
    suc: { ar: "أنبوب السحب", en: "Suction tube (largest)",
      what: "يدخل منه البخار الراجع إلى داخل الجسم ثم إلى كاتم السحب. عادة الأكبر قطراً.",
      fail: "رجوع سائل: تعرّق أو تجمّد شديد عليه وصوت طرق داخلي.",
      test: "قِس الـ Superheat قرب المدخل؛ تأكد أن تعرّقه لا يصل حتى جسم الكباس." },
    proc: { ar: "أنبوب الخدمة", en: "Process tube",
      what: "للتفريغ والشحن؛ يُغلق بعد الشحن بالكبس واللحام أو يُركّب عليه بلف خدمة.",
      fail: "تسريب من طرف مكبوس بشكل سيئ أو من بلف الخدمة.",
      test: "افحص بالرغوة أو جهاز كشف التسريب؛ بعد الشحن اكبس مرتين ثم الحم." },
    dis: { ar: "أنبوب الطرد", en: "Discharge tube (smallest)",
      what: "يخرج منه الغاز الساخن المضغوط إلى المكثف. أسخن أنبوب على الكباس.",
      fail: "تشقّق من الاهتزاز عند جذره؛ سخونة مفرطة تدل على نقص غاز أو ضغط عالٍ.",
      test: "افحص الجذر بالرغوة؛ حرارة طرد عالية جداً (فوق ≈ 105–110°C تقريباً) غير طبيعية." },
    base: { ar: "القاعدة والمطاط", en: "Mounting feet & grommets",
      what: "مطاط ماص للاهتزاز بين أرجل الكباس والقاعدة.",
      fail: "مطاط متصلّب أو براغي مشدودة بقوة ← صوت واهتزاز ينتقل للبراد والأنابيب.",
      test: "تأكد أن البراغي لا تضغط المطاط بالكامل وأن الأنابيب لا تلمس الجسم." },
    term: { ar: "الأطراف C / S / R", en: "Terminal pins (Fusite)",
      what: "C مشترك، S ملف التقويم (Start)، R ملف التشغيل (Run). ملف التقويم مقاومته أكبر.",
      fail: "تماس للجسم، احتراق الطرف، أو تسريب حول الزجاج (خطر قذف الطرف عند الضغط العالي).",
      test: "C-S + C-R = R-S (أكبر قراءة بين S و R، أصغرها C-R). العزل لكل طرف مع الجسم ≥ 2 MΩ (السليم عادة ≫ 10 MΩ). لا تشغّل الكباس وغطاء الأطراف مفكوك." },
    ol: { ar: "الأوفرلود", en: "Overload protector (on C)",
      what: "قاطع Bimetal على خط C ملاصق للجسم: يفصل عند تيار أو حرارة زائدة ثم يرجع وحده.",
      fail: "يفصل باستمرار بسبب علّة أخرى (جهاز تقويم، مكثف، علوق، جهد)، أو يتلف مفتوحاً.",
      test: "وهو بارد ≈ 0–1 Ω؛ مفتوح وهو بارد = تالف. لا تجسّره أبداً." },
    ptc: { ar: "الـ PTC Starter", en: "PTC starter (on S)",
      what: "ثرمستور: بارد مقاومته صغيرة فيوصل ملف التقويم، يسخن خلال ثوانٍ فترتفع مقاومته جداً ويفصله.",
      fail: "مشقوق أو مفتوح ← لا إقلاع وطقطقة الـ Overload. يحتاج 3–5 دقائق ليبرد بين محاولتين.",
      test: "وهو بارد: بضعة أوم إلى عشرات الأوم حسب الموديل؛ ∞ = تالف. صوت خشخشة عند هزّه = مكسور." },
    relay: { ar: "ريليه التيار", en: "Current relay (L–M–S)",
      what: "ملفّه (L–M) على التوالي مع ملف التشغيل: تيار الإقلاع العالي يجذب التلامس فيوصل S، ثم يفصل عندما ينخفض التيار.",
      fail: "تلامس ملتصق ← ملف التقويم يبقى موصولاً فيسخن ويفصل الـ Overload. ملف مفتوح ← الكباس لا يعمل.",
      test: "L–M مقاومة صغيرة جداً، و L–S مفتوح والريليه في وضعه الصحيح. يُركّب مستقيماً حسب السهم لأنه يعمل بالجاذبية." },
    prel: { ar: "ريليه الجهد", en: "Potential relay (1–2–5)",
      what: "ملفّه 2–5 على ملف التقويم يحسّ الجهد المتولد عند ارتفاع السرعة فيفتح التلامس 1–2 ويفصل مكثف التقويم.",
      fail: "تلامس ملتصق ← مكثف التقويم يبقى موصولاً فينتفخ أو ينفجر. ملف مفتوح ← التلامس لا يفتح.",
      test: "1–2 موصول (≈ 0 Ω) وهو مفصول عن الكهرباء، والملف 2–5 بضعة kΩ حسب الموديل. اختره مطابقاً لموديل الكباس." },
    scap: { ar: "مكثف التقويم", en: "Start capacitor",
      what: "مكثف إلكتروليتي كبير (عشرات إلى مئات µF) يعطي عزم إقلاع عالياً لثوانٍ فقط.",
      fail: "ينتفخ أو يحترق إذا بقي موصولاً (ريليه ملتصق) ← الكباس يطنّ ولا يقلع.",
      test: "افرغ الشحنة أولاً عبر مقاومة، ثم قِس السعة ضمن المدى المكتوب عليه (مثلاً 88–108 µF)." },
    rcap: { ar: "مكثف التشغيل", en: "Run capacitor (R–S)",
      what: "مكثف (عادة ≈ 2–30 µF حسب القدرة) يبقى موصولاً بين R و S ليحسّن الكفاءة ويخفض التيار.",
      fail: "تنقص سعته أو ينتفخ ← تيار عالٍ، حرارة، وإقلاع أضعف.",
      test: "افرغ الشحنة ثم قِس السعة: السماحية ±5%، بدّله إذا نقص أكثر من 10%." },
    wrun: { ar: "ملف التشغيل (C–R)", en: "Run winding",
      what: "يبقى موصولاً طوال التشغيل؛ سلك أثخن ومقاومة أقل.",
      fail: "احتراق بسبب حرارة أو جهد منخفض أو رطوبة وأحماض ← قِصر بين اللفّات أو للجسم.",
      test: "C-R أصغر قراءة. قراءة 0 أو ∞ أو تسريب للجسم = تالف (الكباس المحكم لا يُصلّح ملفه)." },
    wstart: { ar: "ملف التقويم (C–S)", en: "Start (auxiliary) winding",
      what: "يعمل لحظة الإقلاع فقط (أو مع مكثف تشغيل) لإنشاء مجال دوّار؛ سلك أرفع ومقاومة أعلى.",
      fail: "يحترق إذا بقي موصولاً (PTC أو ريليه ملتصق) أو بتكرار الإقلاع السريع.",
      test: "C-S أكبر من C-R، ومجموعهما = R-S." },
    rotor: { ar: "الروتور والعامود المرفقي", en: "Rotor & crankshaft",
      what: "روتور قفصي على عامود عمودي؛ رأسه الأعلى لامركزي يحرّك ذراع المكبس، وأسفله يغطس في الزيت ويضخّه للأعلى.",
      fail: "علوق ميكانيكي (Locked rotor) من نقص الزيت أو الأوساخ ← تيار LRA وفصل الـ Overload.",
      test: "ملفات سليمة + تيار عالٍ جداً + فصل الأوفرلود = غالباً علوق. يمكن تجربة مكثف تقويم مؤقت (Hard start) بحذر." },
    piston: { ar: "المكبس والذراع والأسطوانة", en: "Piston, connecting rod & cylinder",
      what: "المكبس يتحرك ذهاباً وإياباً: يسحب البخار ثم يضغطه عبر صمام الطرد.",
      fail: "تآكل المكبس أو الأسطوانة، أو كسر الذراع ← ضغط ضعيف أو صوت طرق.",
      test: "الدليل: طرد منخفض، سحب مرتفع، وتيار أقل من الطبيعي رغم الشحنة الصحيحة." },
    valves: { ar: "لوحة الصمامات", en: "Valve plate (suction & discharge reeds)",
      what: "رقائق فولاذية (Reeds) للسحب والطرد تفتح وتغلق بفرق الضغط فقط.",
      fail: "تنكسر من رجوع السائل (Liquid slugging) أو الأوساخ والكربون ← الكباس يعمل ولا يرفع الضغط.",
      test: "الدليل: فرق ضغط ضعيف بين الطرد والسحب، تيار منخفض، وصوت مختلف، رغم الشحنة والتهوية الصحيحة." },
    smuff: { ar: "كاتم السحب", en: "Suction muffler",
      what: "كاتم بلاستيكي يخفف صوت السحب ويوجّه البخار البارد مباشرة للأسطوانة.",
      fail: "تشقق أو انفكاك ← صوت أعلى وكفاءة أقل.",
      test: "لا يُفحص من الخارج؛ يُستدل عليه بالصوت وارتفاع حرارة الطرد." },
    dmuff: { ar: "كاتم وأنبوب الطرد الداخلي", en: "Discharge muffler & internal discharge loop",
      what: "حجرة تخفف نبضات الطرد، ثم أنبوب لولبي مرن يوصل الطرد إلى أنبوب الطرد الخارجي.",
      fail: "كسر الأنبوب الداخلي من الاهتزاز ← غاز الطرد يرجع داخل الجسم: الكباس يعمل بلا ضغط والجسم ساخن جداً.",
      test: "طرد منخفض جداً مع جسم ساخن جداً وتيار منخفض = اشتباه كسر داخلي." },
    oil: { ar: "حوض الزيت", en: "Oil sump & pick-up",
      what: "زيت في قاع الجسم (نوعه حسب الغاز والشركة، مثلاً POE مع R134a)؛ العامود يضخّه لتزييت البيليات والمكبس.",
      fail: "نقص الزيت أو تحوّله لأحماض بالرطوبة ← تآكل، علوق، واحتراق الملفات.",
      test: "زيت داكن برائحة حرقان عند فتح الدورة = احتراق: نظّف الدورة وبدّل الفلتر وافحص الحموضة." },
    springs: { ar: "نوابض التعليق الداخلية", en: "Internal suspension springs",
      what: "تعلّق المحرك والمضخة داخل الجسم لامتصاص الاهتزاز.",
      fail: "انكسار أو خروج نابض من مكانه ← طرقة عند الإقلاع أو التوقف.",
      test: "استمع عند الإيقاف: طرقة معدنية داخلية متكررة مؤشر قوي." },
  };
  ACV.register("compressor", {
    title: "الكباس المحكم الترددي",
    params: 'start:"ptc"|"relay"|"csr"; view:"ext"|"cut"; focus:[ids: shell,suc,proc,dis,base,term,ol,ptc|relay|prel,scap,rcap | cut: wrun,wstart,rotor,piston,valves,smuff,dmuff,oil,springs]; caption',
    demo: [{ start: "ptc" }, { start: "csr" }, { view: "cut" }],
    render(host, p) {
      const reduce = ACV.reduce();
      const ST = { ptc: "ptc", relay: "relay", csr: "csr" }[p.start] || "ptc";
      const mkp = (id, b, t, extra) => Object.assign({ id, b, t }, CMP[id], extra || {});
      scene(host, {
        vb: [360, 470], label: "الكباس المحكم: الأطراف ودائرة التقويم والمقطع الداخلي", focus: arr(p.focus), caption: p.caption,
        intro: "الكباس المحكم الترددي (برادات وتبريد صغير). تبويب «خارجي» يبيّن الأطراف C/S/R وتوصيل جهاز التقويم، وتبويب «مقطع» يبيّن ما بداخل الجسم.",
        state: { view: p.view === "cut" ? "cut" : "ext", st: ST, flow: !reduce },
        controls: [
          { type: "seg", key: "view", label: "العرض", items: [["ext", "خارجي + توصيل"], ["cut", "مقطع داخلي"]], redraw: true },
          { type: "seg", key: "st", label: "التقويم", items: [["ptc", "PTC"], ["relay", "Relay"], ["csr", "CSR"]], redraw: true },
          { type: "toggle", key: "flow", label: "التدفق", cls: "noflow" },
        ],
        legend: (s) => (s.view === "cut" ? STATE_LEG : LEG([["liq", "خط L"], ["mix", "خط N"]])),
        parts: (s) => {
          if (s.view === "cut") return [
            mkp("shell", [18, 70], [32, 92]), mkp("suc", [344, 226], [346, 250]), mkp("dis", [18, 300], [12, 276]), mkp("proc", [344, 324], [348, 300]),
            mkp("term", [18, 392], [24, 366]),
            mkp("wrun", [56, 236], [100, 186]), mkp("wstart", [118, 236], [132, 188]), mkp("rotor", [180, 350], [180, 330]),
            mkp("piston", [234, 72], [232, 112]), mkp("valves", [300, 70], [283, 96]), mkp("smuff", [262, 190], [292, 180]),
            mkp("dmuff", [92, 64], [92, 100]), mkp("oil", [140, 430], [140, 418]), mkp("springs", [306, 388], [282, 396]),
          ];
          const L = [mkp("shell", [100, 120]), mkp("suc", [62, 12]), mkp("proc", [100, 12]), mkp("dis", [138, 12]), mkp("base", [18, 214], [40, 212]),
            mkp("term", [344, 52], [306, 74]), mkp("ol", [134, 238], [134, 260])];
          if (s.st === "ptc") L.push(mkp("ptc", [102, 382], [122, 382]), mkp("rcap", [278, 446], [278, 428], { ar: "مكثف التشغيل (اختياري)" }));
          if (s.st === "relay") L.push(mkp("relay", [86, 350], [100, 372]), mkp("scap", [160, 314], [160, 334]));
          if (s.st === "csr") L.push(mkp("prel", [42, 306], [60, 318]), mkp("scap", [44, 392], [62, 392]), mkp("rcap", [278, 446], [278, 428]));
          return L;
        },
        draw(S, s) {
          const b = S.base;
          if (s.view === "cut") return drawCut(S, b);
          /* ---- external view ---- */
          const sh = S.part("shell");
          P(sh, "M36,98 Q36,44 104,44 Q172,44 172,98 V190 Q172,204 158,204 H50 Q36,204 36,190Z", "shell");
          L(sh, 36, 132, 172, 132, "ln thin");
          const sc = S.part("suc"); pipe(sc, "M62,54 V24", "cu", 9);
          const pc = S.part("proc"); pipe(pc, "M100,46 V26", "cu", 9); P(pc, "M95,26 h10", "lk", { style: "stroke-width:3" });
          const dc = S.part("dis"); pipe(dc, "M138,52 V24", "cu", 4);
          const bs = S.part("base"); R(bs, 30, 204, 148, 8, 2, "m"); [44, 164].forEach((x) => R(bs, x - 7, 212, 14, 6, 2, "rub"));
          // fusite + zoom
          const tm = S.part("term");
          C(tm, 152, 150, 12, "m2"); [[152, 144], [147, 154], [157, 154]].forEach(([x, y]) => C(tm, x, y, 2, "hub"));
          P(b, "M160,141 L216,70 M160,159 L224,168", "lead");
          C(tm, 270, 112, 60, "sf"); C(tm, 270, 112, 52, "glass");
          [["C", 270, 80], ["S", 238, 136], ["R", 302, 136]].forEach(([n, x, y]) => { C(tm, x, y, 11, "m2"); C(tm, x, y, 5, "hub"); T(tm, x + (n === "C" ? 20 : n === "S" ? -20 : 20), y + 5, n, "pin", "middle", false); });
          T(b, 270, 196, "R–S = C–S + C–R", "pl2", "middle", false);
          /* ---- wiring diagram ---- */
          const W = G(b, "");
          T(W, 16, 266, "L", "pin", "middle", false); T(W, 16, 449, "N", "pin", "middle", false);
          C(W, 26, 262, 3, "hub"); C(W, 26, 444, 3, "hub");
          // motor symbol
          R(W, 214, 300, 120, 100, 10, "sf", { style: "stroke-dasharray:4 3" });
          T(W, 274, 394, "Motor", "tiny", "middle", false);
          P(W, "M274,300 V318 " + "q8,4 0,8 q-8,4 0,8 q8,4 0,8 q-8,4 0,8 " + "L230,368 V380 H214", "wire", { style: "stroke:var(--orange)" }); // start winding (to S)
          P(W, "M274,350 L316,368 V380 H334", "wire", { style: "stroke:var(--blue)" });                  // run winding (to R)
          T(W, 242, 352, "S", "tiny", "middle", false); T(W, 308, 352, "R", "tiny", "middle", false);
          [[274, 300, "C"], [214, 380, "S"], [334, 380, "R"]].forEach(([x, y, n]) => { C(W, x, y, 4.5, "m2"); T(W, x + (n === "C" ? 12 : n === "S" ? -10 : 10), y - 6, n, "pinS", "middle", false); });
          // L line with overload to C
          P(W, "M26,262 H116", "wire-l"); P(W, "M152,262 H274 V300", "wire-l");
          const ol = S.part("ol"); C(ol, 134, 262, 13, "m2"); P(ol, "M120,262 Q134,250 148,262", "lk"); T(ol, 134, 274, "OL", "tiny", "middle", false);
          const st = s.st;
          if (st === "ptc" || st === "csr") P(W, "M26,444 H344 V380 H334", "wire-n");
          if (st === "ptc") {
            P(W, "M130,444 V398 M130,366 V380 H214", "wire-n");
            const pt = S.part("ptc"); R(pt, 120, 366, 20, 32, 3, "m2"); P(pt, "M124,394 L136,370 h4", "lk"); T(pt, 146, 404, "PTC", "tiny", "start", false);
            const rc = S.part("rcap"); P(rc, "M214,380 H204 V426 H274 M282,426 H344", "wire dash"); L(rc, 274, 418, 274, 434, "lk", { style: "stroke-width:2.5" }); L(rc, 282, 418, 282, 434, "lk", { style: "stroke-width:2.5" });
          }
          if (st === "csr") {
            const rc = S.part("rcap"); P(rc, "M214,380 H204 V426 H274 M282,426 H344", "wire"); L(rc, 274, 418, 274, 434, "lk", { style: "stroke-width:2.5" }); L(rc, 282, 418, 282, 434, "lk", { style: "stroke-width:2.5" });
            const sc2 = S.part("scap"); P(sc2, "M70,444 V402 M70,384 V350", "wire-n"); R(sc2, 60, 384, 20, 18, 4, "m2"); L(sc2, 62, 393, 78, 393, "lk");
            const pr = S.part("prel"); R(pr, 60, 300, 116, 50, 5, "m");
            P(pr, "M70,350 V336 L96,326 M110,336 V350 H166", "lk"); // contact 1-2 (NC)
            P(pr, "M166,350 V340 q-6,-3 0,-6 q6,-3 0,-6 q-6,-3 0,-6 q6,-3 0,-6 V310 H118 V300", "lk"); // coil 2-5
            T(pr, 76, 316, "1", "tiny", "middle", false); T(pr, 158, 346, "2", "tiny", "middle", false); T(pr, 126, 312, "5", "tiny", "middle", false);
            P(W, "M118,300 V284 H274", "wire"); C(W, 274, 284, 2.5, "hub");
            P(W, "M166,350 V380 H214", "wire");
          }
          if (st === "relay") {
            P(W, "M26,444 H80 V404 H96 M176,404 H196 V444 H344 V380 H334", "wire-n");
            const rl = S.part("relay"); R(rl, 96, 372, 80, 46, 5, "m");
            P(rl, "M104,404 h8 q4,-8 8,0 q4,-8 8,0 q4,-8 8,0 q4,-8 8,0 q4,-8 8,0 h12", "lk");
            P(rl, "M104,404 V388 L122,380 M136,384 V372", "lk");
            T(rl, 104, 414, "L", "tiny", "middle", false); T(rl, 168, 414, "M", "tiny", "middle", false); T(rl, 146, 382, "S", "tiny", "middle", false);
            const sc2 = S.part("scap"); P(sc2, "M136,372 V334 H150 M170,334 H196 V380 H214", "wire-n"); R(sc2, 150, 325, 20, 18, 4, "m2"); L(sc2, 160, 327, 160, 341, "lk");
          }
          function drawCut(S2, base) {
            const shell = "M24,92 Q24,36 92,36 H268 Q336,36 336,92 V418 Q336,448 306,448 H54 Q24,448 24,418 Z";
            const sh2 = S2.part("shell"); P(sh2, shell, "sf"); 
            const oi = S2.part("oil"); const o = R(oi, 24, 404, 312, 46, 0, "oil"); o.setAttribute("clip-path", S2.clip(shell));
            P(sh2, shell, "cab2", { style: "stroke-width:3" });
            // springs
            const sp = S2.part("springs"); P(sp, zig(76, 330, 76, 400, 6, 6), "lk"); P(sp, zig(284, 330, 284, 400, 6, 6), "lk"); R(sp, 66, 400, 20, 6, 2, "m"); R(sp, 274, 400, 20, 6, 2, "m");
            // frame/crankcase plate
            R(base, 64, 150, 232, 14, 3, "m2");
            // stator + windings
            const stt = G(base, "");
            R(stt, 86, 196, 64, 116, 3, "m"); R(stt, 210, 196, 64, 116, 3, "m");
            for (let y = 204; y < 308; y += 8) { L(stt, 88, y, 148, y, "fin"); L(stt, 212, y, 272, y, "fin"); }
            const wr = S2.part("wrun"), ws = S2.part("wstart");
            [[88, 196, -1], [88, 312, 1], [212, 196, -1], [212, 312, 1]].forEach(([x, y, d]) => {
              P(wr, `M${x},${y} q16,${d * 22} 32,0 z`, "wr"); P(ws, `M${x + 30},${y} q15,${d * 18} 30,0 z`, "ws");
            });
            // rotor + shaft
            const ro = S2.part("rotor");
            R(ro, 154, 200, 52, 108, 3, "m2"); for (let x = 160; x < 204; x += 8) L(ro, x, 202, x, 306, "ln thin");
            R(ro, 176, 104, 8, 316, 2, "shaftc"); C(ro, 186, 116, 9, "m");
            // piston / cylinder
            const pi = S2.part("piston");
            R(pi, 206, 96, 76, 40, 3, "m"); R(pi, 212, 103, 68, 26, 2, "sf"); R(pi, 222, 104, 26, 24, 3, "m2");
            P(pi, "M186,116 L234,116", "lk", { style: "stroke-width:5" }); C(pi, 234, 116, 3, "hub");
            const va = S2.part("valves"); R(va, 280, 94, 6, 44, 1, "chipk");
            R(base, 286, 92, 20, 48, 4, "m");
            // suction muffler + path
            const sm = S2.part("smuff"); R(sm, 290, 156, 36, 46, 8, "coldf");
            // tubes on shell
            pipe(S2.part("suc"), "M356,250 H318 Q310,250 310,214 V204", "vap", 9);
            pipe(base, "M308,156 V140", "vap");
            const pr2 = S2.part("proc"); pipe(pr2, "M336,300 H356", "cu", 9); P(pr2, "M356,295 v10", "lk", { style: "stroke-width:3" });
            // discharge muffler + internal loop + discharge stub
            const dm = S2.part("dmuff");
            pipe(dm, "M296,92 V78 H118", "hot", 4);
            R(dm, 66, 86, 52, 34, 6, "m");
            pipe(dm, "M70,120 c-26,8 -26,24 0,30 c26,6 26,22 0,30 c-26,6 -26,22 0,30 c22,6 18,26 -14,34 V276 H26", "hot", 4);
            pipe(S2.part("dis"), "M26,276 H4", "hot", 4);
            // terminal (fusite) + internal leads
            const tm2 = S2.part("term"); P(tm2, "M24,350 a12,12 0 0 0 0,24", "m2"); P(tm2, "M24,356 H40 Q60,356 72,316 M24,362 H44 Q70,362 96,318 M24,368 H48 Q80,368 122,318", "wire thinw");
            // oil pickup arrow + gas arrows
            P(base, "M180,420 V408", "ln");
          }
        },
      });
    },
  });
})();
