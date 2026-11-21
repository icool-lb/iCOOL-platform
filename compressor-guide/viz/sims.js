/* iCOOL Academy — instrument simulators (group "sims").
   Widgets: pt, manifold, ohm, megger, capacitor, vacuum, pressure_test, scale, ntc
   Hand-built inline SVG, no external assets. */
(function () {
  "use strict";
  if (!window.ACV) return;
  const NS = "http://www.w3.org/2000/svg";
  const uid = () => Math.random().toString(36).slice(2, 8);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const reduce = () => { try { return ACV.reduce(); } catch (e) { return false; } };
  const AR = /[؀-ۿ]/;
  const PSI = 14.5038, ATM = 1.01325;
  const f = (v, d = 1) => (Number.isFinite(v) ? (Math.abs(v) < Math.pow(10, -d) / 2 ? 0 : v).toFixed(d) : "—");
  const sg = (v, d = 1) => (v > 0 ? "+" : "") + f(v, d);

  /* ---------- DOM helpers ---------- */
  function H(tag, attrs, parent, text) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) { if (attrs[k] == null) continue; if (k === "class") e.className = attrs[k]; else e.setAttribute(k, attrs[k]); }
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function S(tag, attrs, parent, text) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  /* SVG text. anchor: "l" | "r" | "m" (physical left/right/middle) — works for RTL and LTR strings */
  function T(parent, x, y, s, cls, anchor, extra) {
    const rtl = AR.test(String(s));
    const a = { x, y, class: "acv-sims-t " + (cls || "") };
    const an = anchor || "m";
    a["text-anchor"] = an === "m" ? "middle" : (an === "l") !== rtl ? "start" : "end";
    if (rtl) a.direction = "rtl";
    if (extra) Object.assign(a, extra);
    return S("text", a, parent, String(s));
  }
  function mkSvg(parent, w, h, label) {
    const s = S("svg", { viewBox: `0 0 ${w} ${h}`, role: "img", "aria-label": label, class: "acv-sims-svg", direction: "ltr" }, parent);
    s.style.direction = "ltr";
    return s;
  }
  function chips(parent, items, cur, onPick, aria) {
    const row = H("div", { class: "acv-sims-chips", role: "group", "aria-label": aria }, parent);
    const btns = items.map((it) => {
      const [val, lab] = Array.isArray(it) ? it : [it, it];
      const b = H("button", { type: "button", class: "acv-sims-chip", "aria-pressed": String(val === cur), dir: AR.test(String(lab)) ? null : "ltr" }, row, lab);
      b._v = val;
      b.addEventListener("click", () => { set(val); onPick(val); });
      return b;
    });
    function set(v) { btns.forEach((b) => b.setAttribute("aria-pressed", String(b._v === v))); }
    return { row, set, btns };
  }
  function btn(parent, label, cls, onClick, aria) {
    const b = H("button", { type: "button", class: "acv-sims-btn " + (cls || ""), "aria-label": aria || null }, parent, label);
    b.addEventListener("click", onClick);
    return b;
  }
  function slider(parent, o) {
    const w = H("div", { class: "acv-sims-sl" + (o.tone ? " acv-sims-sl-" + o.tone : "") }, parent);
    const top = H("div", { class: "acv-sims-slh" }, w);
    const id = "acvs-" + uid();
    H("label", { for: id }, top, o.label);
    const out = H("output", { class: "acv-sims-slv", dir: "ltr", for: id }, top);
    const inp = H("input", { type: "range", id, min: o.min, max: o.max, step: o.step || 1, value: o.value, dir: "ltr" }, w);
    const fmt = o.fmt || ((v) => String(v));
    const upd = () => { out.textContent = fmt(+inp.value); };
    inp.addEventListener("input", () => { upd(); o.onInput(+inp.value); });
    upd();
    return { el: w, inp, get: () => +inp.value, set(v) { inp.value = v; upd(); }, range(mn, mx, st) { inp.min = mn; inp.max = mx; if (st) inp.step = st; upd(); }, upd };
  }
  function readouts(parent, defs) {
    const g = H("div", { class: "acv-sims-reads" }, parent);
    const m = {};
    defs.forEach(([k, l]) => {
      const c = H("div", { class: "acv-sims-rd" }, g);
      H("div", { class: "acv-sims-rdl" }, c, l);
      m[k] = H("div", { class: "acv-sims-rdv", dir: "ltr" }, c, "—");
      m[k + "$"] = c;
    });
    m.tone = (k, t) => { if (m[k + "$"]) m[k + "$"].dataset.tone = t || ""; };
    return m;
  }
  // isolate "number + unit" runs so they read LTR inside Arabic sentences
  const NUM_RE = /([+\-−]?\d(?:[.,]?\d)*(?:\s?(?:bar\(g\)|bar|kΩ|MΩ|Ω|µF|°C|°|K|g|micron\/min|micron|min|h|%|V|A))?(?:\s?\/\s?[+\-]?\d(?:[.,]?\d)*(?:\s?(?:bar|°C|g|kΩ))?)?)(?![\w(])/g;
  const bidi = (html) => html.split(/(<[^>]+>)/).map((x) => (x.startsWith("<") ? x : x.replace(NUM_RE, '<bdi dir="ltr">$1</bdi>'))).join("");
  function info(parent) {
    const d = H("div", { class: "acv-sims-info", "aria-live": "polite" }, parent);
    return { el: d, set(html, tone) { d.innerHTML = bidi(html); d.dataset.tone = tone || "info"; } };
  }
  function shell(host, cls) {
    host.innerHTML = "";
    return H("div", { class: "acv-sims " + (cls || "") }, host);
  }
  function stage(parent) { return H("div", { class: "acv-sims-stage" }, parent); }
  function hot(el, label, fn) {
    el.setAttribute("role", "button"); el.setAttribute("tabindex", "0"); el.setAttribute("aria-label", label);
    el.classList.add("acv-sims-hot");
    el.addEventListener("click", fn);
    el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } });
  }
  function loop(host, step) {
    let raf = 0, last = 0, on = false;
    function fr(ts) {
      if (!host.isConnected) { on = false; return; }
      const dt = last ? Math.min(0.1, (ts - last) / 1000) : 0; last = ts;
      if (step(dt) === false) { on = false; return; }
      raf = requestAnimationFrame(fr);
    }
    return {
      start() { if (on) return; on = true; last = 0; raf = requestAnimationFrame(fr); },
      stop() { on = false; cancelAnimationFrame(raf); },
      get on() { return on; },
    };
  }

  /* ---------- P/T tables ---------- */
  const FB_T = [-40, -30, -20, -10, 0, 10, 20, 30, 40, 50, 60];
  const FB = { // CoolProp, bar(g) — bubble / dew
    R134a: { cls: "A1", b: [-0.5, -0.17, 0.31, 0.99, 1.91, 3.13, 4.7, 6.69, 9.15, 12.17, 15.8] },
    R600a: { cls: "A3", b: [-0.73, -0.55, -0.29, 0.07, 0.56, 1.19, 2.01, 3.03, 4.3, 5.84, 7.68] },
    R290: { cls: "A3", b: [0.1, 0.67, 1.43, 2.44, 3.73, 5.35, 7.35, 9.78, 12.68, 16.12, 20.15] },
    R410A: { cls: "A1", blend: true, b: [0.74, 1.69, 2.99, 4.73, 6.99, 9.87, 13.46, 17.88, 23.24, 29.69, 37.41], d: [0.74, 1.68, 2.98, 4.71, 6.97, 9.83, 13.42, 17.82, 23.17, 29.62, 37.33] },
    R32: { cls: "A2L", b: [0.76, 1.72, 3.04, 4.81, 7.12, 10.06, 13.73, 18.26, 23.77, 30.4, 38.32] },
    R404A: { cls: "A1", blend: true, b: [0.34, 1.06, 2.06, 3.38, 5.09, 7.26, 9.96, 13.27, 17.28, 22.09, 27.84], d: [0.3, 1.01, 1.99, 3.29, 4.99, 7.14, 9.83, 13.13, 17.13, 21.94, 27.7] },
  };
  function PT(ctx) {
    const kb = ctx && ctx.kb && ctx.kb.ptables;
    const out = {};
    if (kb && kb.refrigerants) {
      for (const n in kb.refrigerants) {
        const r = kb.refrigerants[n]; let t, b, d;
        if (Array.isArray(r.rows)) { const rows = r.rows.filter((x) => x && x[0] != null && x[1] != null && Number.isFinite(+x[1])); t = rows.map((x) => +x[0]); b = rows.map((x) => +x[1]); d = rows.map((x) => (x[2] != null && Number.isFinite(+x[2]) ? +x[2] : +x[1])); }
        else if (Array.isArray(r.bubble) && Array.isArray(kb.temps_c)) { const dw = r.dew || r.bubble; const ix = kb.temps_c.map((_, i) => i).filter((i) => r.bubble[i] != null && Number.isFinite(+r.bubble[i])); t = ix.map((i) => +kb.temps_c[i]); b = ix.map((i) => +r.bubble[i]); d = ix.map((i) => (dw[i] != null ? +dw[i] : +r.bubble[i])); }
        if (t && t.length > 2 && b.every(Number.isFinite)) out[n] = { name: n, t, b, d, cls: String(r.class || "").split(" ")[0], blend: !!r.blend };
      }
    }
    if (!Object.keys(out).length) for (const n in FB) out[n] = { name: n, t: FB_T, b: FB[n].b, d: FB[n].d || FB[n].b, cls: FB[n].cls, blend: !!FB[n].blend };
    for (const n in out) { const r = out[n]; r.glide = r.b.some((v, i) => Math.abs(v - r.d[i]) > 0.04); r.tmin = r.t[0]; r.tmax = r.t[r.t.length - 1]; }
    return out;
  }
  // interpolate ln(P_abs) linearly in T — close to Clausius-Clapeyron, accurate even on a 10 K grid
  function interp(xs, ys, x) {
    let i = 1; while (i < xs.length - 1 && xs[i] < x) i++;
    const x0 = xs[i - 1], x1 = xs[i];
    return ys[i - 1] + ((ys[i] - ys[i - 1]) * (x - x0)) / (x1 - x0);
  }
  function satP(r, t, k) { const arr = k === "d" ? r.d : r.b; return Math.exp(interp(r.t, arr.map((p) => Math.log(p + ATM)), t)) - ATM; }
  function satT(r, p, k) { const arr = k === "d" ? r.d : r.b; return interp(arr.map((q) => Math.log(q + ATM)), r.t, Math.log(Math.max(p + ATM, 0.02))); }
  function flamNote(r) {
    if (!r) return "";
    if (/A3/.test(r.cls)) return `<b>${r.name}</b> قابل للاشتعال (A3): تهوية، لا شرارة ولا لحام والغاز داخل الدورة، وأدوات مناسبة.`;
    if (/A2L/.test(r.cls)) return `<b>${r.name}</b> ضعيف الاشتعال (A2L): تهوية جيدة وأدوات مناسبة.`;
    return "";
  }
  function niceScale(maxV) {
    const o = [[5, 1, 0.5], [10, 2, 0.5], [16, 4, 1], [20, 5, 1], [25, 5, 1], [30, 5, 1], [40, 10, 2], [50, 10, 2], [60, 10, 2], [80, 20, 5]];
    return o.find((x) => x[0] >= maxV) || [Math.ceil(maxV / 20) * 20, 20, 5];
  }

  /* ---------- analog gauge ---------- */
  function gauge(svg, o) {
    const { cx, cy, r, min, max } = o;
    const g = S("g", { class: "acv-sims-gauge" }, svg);
    const A0 = -135, SW = 270;
    const ang = (v) => A0 + (SW * (clamp(v, min, max) - min)) / (max - min);
    const P = (a, rr) => [cx + rr * Math.sin((a * Math.PI) / 180), cy - rr * Math.cos((a * Math.PI) / 180)];
    S("circle", { cx, cy, r: r + 7, class: "acv-sims-bezel acv-sims-bz-" + (o.tone || "n") }, g);
    S("circle", { cx, cy, r, class: "acv-sims-face" }, g);
    const arc = (v0, v1, rr, cls) => {
      const a0 = ang(v0), a1 = ang(v1); const [x0, y0] = P(a0, rr), [x1, y1] = P(a1, rr);
      return S("path", { d: `M${x0} ${y0}A${rr} ${rr} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`, class: cls }, g);
    };
    if (min < 0) arc(min, 0, r - 5, "acv-sims-vacband");
    let red = o.redFrom != null && o.redFrom < max ? arc(o.redFrom, max, r - 5, "acv-sims-redband") : null;
    const k0 = Math.ceil(min / o.minor - 1e-9), k1 = Math.floor(max / o.minor + 1e-9);
    const vals = []; if (Math.abs(k0 * o.minor - min) > 1e-6) vals.push(min);
    for (let k = k0; k <= k1; k++) vals.push(k * o.minor);
    vals.forEach((v) => {
      const maj = Math.abs(v / o.major - Math.round(v / o.major)) < 1e-6;
      const a = ang(v); const [x0, y0] = P(a, r - 2), [x1, y1] = P(a, r - (maj ? 12 : 7));
      S("line", { x1: x0, y1: y0, x2: x1, y2: y1, class: maj ? "acv-sims-tk2" : "acv-sims-tk" }, g);
      if (maj) { const [tx, ty] = P(a, r - (o.labR || 23)); T(g, tx, ty + 4.5, String(v), "acv-sims-gl"); }
    });
    if (o.temps) {
      let lastA = -999; const rr = r - (o.tR || 50), ra = r - 35;
      const vis = o.temps.filter(({ p }) => p >= min && p <= max);
      if (vis.length > 1) { const a0 = ang(vis[0].p), a1 = ang(vis[vis.length - 1].p); const [x0, y0] = P(a0, ra), [x1, y1] = P(a1, ra); S("path", { d: `M${x0} ${y0}A${ra} ${ra} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`, class: "acv-sims-tarc acv-sims-tc-" + (o.tone || "n") }, g); }
      vis.forEach(({ t, p }) => {
        const a = ang(p); const [x0, y0] = P(a, ra), [x1, y1] = P(a, ra - 5);
        S("line", { x1: x0, y1: y0, x2: x1, y2: y1, class: "acv-sims-ttk acv-sims-tc-" + (o.tone || "n") }, g);
        if (a - lastA >= (o.tGap || 30) && Math.abs(a) <= 112) { const [tx, ty] = P(a, rr); T(g, tx, ty + 4, String(t), "acv-sims-gtl acv-sims-tc-" + (o.tone || "n")); lastA = a; }
      });
      if (vis.length && o.deg !== false) T(g, cx, cy + r * 0.22, "°C", "acv-sims-gtl acv-sims-tc-" + (o.tone || "n"));
    }
    if (o.title) T(g, cx, cy + r * 0.36, o.title, "acv-sims-gtitle acv-sims-tc-" + (o.tone || "n"));
    let lcd = null;
    if (o.lcd) {
      const w = r * 0.8;
      S("rect", { x: cx - w / 2, y: cy + r * 0.5, width: w, height: 22, rx: 4, class: "acv-sims-lcd" }, g);
      lcd = T(g, cx, cy + r * 0.5 + 16, "—", "acv-sims-lcdt");
    }
    const nd = S("g", { class: "acv-sims-needle" + (reduce() ? "" : " acv-sims-anim") }, g);
    nd.style.transformOrigin = `${cx}px ${cy}px`;
    S("path", { d: `M${cx - 3.2} ${cy + 16} L${cx - 0.9} ${cy - r + 11} L${cx + 0.9} ${cy - r + 11} L${cx + 3.2} ${cy + 16} Z`, class: "acv-sims-ndl acv-sims-nd-" + (o.tone || "n") }, nd);
    S("circle", { cx, cy, r: 7, class: "acv-sims-hub" }, g);
    S("circle", { cx, cy, r: 2.5, class: "acv-sims-hub2" }, g);
    return {
      g, ang,
      setRed(v) { if (red) red.remove(); red = v < max ? arc(v, max, r - 5, "acv-sims-redband") : null; if (red) g.insertBefore(red, g.children[2]); },
      set(v, txt) { nd.style.transform = `rotate(${ang(v)}deg)`; if (lcd && txt != null) lcd.textContent = txt + (o.unit ? " " + o.unit : ""); },
    };
  }

  /* ---------- digital multimeter ---------- */
  function dmm(svg, x, y, w, h, o) {
    const g = S("g", { class: "acv-sims-dmm" }, svg);
    S("rect", { x, y, width: w, height: h, rx: 16, class: "acv-sims-holster" }, g);
    S("rect", { x: x + 8, y: y + 8, width: w - 16, height: h - 16, rx: 10, class: "acv-sims-mface" }, g);
    S("rect", { x: x + 16, y: y + 18, width: w - 32, height: 58, rx: 5, class: "acv-sims-lcd" }, g);
    const lcd = T(g, x + w - 22, y + 60, "—", "acv-sims-lcdbig", "r");
    const unit = T(g, x + 22, y + 34, o.unit || "Ω", "acv-sims-lcdu", "l");
    const tag = T(g, x + 22, y + 70, o.tag || "", "acv-sims-lcds", "l");
    // dial
    const dcx = x + w / 2, dcy = y + (o.dialY || 132), dr = 24;
    S("circle", { cx: dcx, cy: dcy, r: dr + 9, class: "acv-sims-dialring" }, g);
    const marks = o.marks || ["V~", "Ω", "µF", "A"];
    const sel = o.sel || 1;
    marks.forEach((m, i) => {
      const a = (-60 + i * 40) * Math.PI / 180;
      T(g, dcx + (dr + 20) * Math.sin(a), dcy - (dr + 20) * Math.cos(a) + 4, m, "acv-sims-dialm" + (i === sel ? " acv-sims-dialon" : ""));
    });
    S("circle", { cx: dcx, cy: dcy, r: dr, class: "acv-sims-dial" }, g);
    const sa = (-60 + sel * 40) * Math.PI / 180;
    S("line", { x1: dcx, y1: dcy, x2: dcx + (dr - 4) * Math.sin(sa), y2: dcy - (dr - 4) * Math.cos(sa), class: "acv-sims-dialp" }, g);
    const jy = y + h - 26;
    const com = [x + w * 0.32, jy], vj = [x + w * 0.68, jy];
    S("circle", { cx: com[0], cy: jy, r: 8, class: "acv-sims-jack-k" }, g);
    S("circle", { cx: vj[0], cy: jy, r: 8, class: "acv-sims-jack-r" }, g);
    T(g, com[0], jy - 13, "COM", "acv-sims-jl");
    T(g, vj[0], jy - 13, o.vlab || "VΩ", "acv-sims-jl");
    return { g, lcd, unit, tag, com, vj };
  }
  function lead(parent, from, to, tone, sag, sagEnd) {
    const [x0, y0] = from, [x1, y1] = to; const s = sag == null ? 60 : sag;
    const sv = parent.ownerSVGElement || parent; const vb = sv.viewBox && sv.viewBox.baseVal; const lim = vb && vb.height ? vb.height - 6 : 1e4;
    const c0 = Math.min(y0 + s, lim), c1 = Math.min(y1 + (sagEnd == null ? s : sagEnd), lim);
    return S("path", { d: `M${x0} ${y0} C${x0} ${c0} ${x1} ${c1} ${x1} ${y1}`, class: "acv-sims-lead acv-sims-lead-" + tone }, parent);
  }
  function probe(parent, x, y, tone) {
    const g = S("g", { class: "acv-sims-probe" }, parent);
    S("circle", { cx: x, cy: y, r: 6, class: "acv-sims-ptip acv-sims-lead-" + tone }, g);
    return g;
  }

  /* ---------- compressor (shell + terminal plate) ---------- */
  function compressor(svg, cx, top, s, opts) {
    const g = S("g", { class: "acv-sims-comp" }, svg);
    const w = 150 * s, h = 210 * s, x = cx - w / 2;
    // stubs
    S("rect", { x: cx - 38 * s, y: top - 14 * s, width: 10 * s, height: 22 * s, rx: 3, class: "acv-sims-copper" }, g);
    S("rect", { x: cx + 26 * s, y: top - 10 * s, width: 8 * s, height: 18 * s, rx: 3, class: "acv-sims-copper" }, g);
    S("path", { d: `M${x} ${top + 40 * s} Q${x} ${top} ${cx} ${top} Q${x + w} ${top} ${x + w} ${top + 40 * s} L${x + w} ${top + h - 26 * s} Q${x + w} ${top + h} ${cx} ${top + h} Q${x} ${top + h} ${x} ${top + h - 26 * s} Z`, class: "acv-sims-shell" }, g);
    S("path", { d: `M${x + 8 * s} ${top + 70 * s} H${x + w - 8 * s}`, class: "acv-sims-weld" }, g);
    S("rect", { x: x - 12 * s, y: top + h - 10 * s, width: w + 24 * s, height: 10 * s, rx: 3, class: "acv-sims-foot" }, g);
    const pc = [cx, top + 120 * s];
    S("circle", { cx: pc[0], cy: pc[1], r: 52 * s, class: "acv-sims-plate" }, g);
    S("circle", { cx: pc[0], cy: pc[1], r: 44 * s, class: "acv-sims-plate2" }, g);
    const pins = [[pc[0], pc[1] - 24 * s], [pc[0] - 26 * s, pc[1] + 18 * s], [pc[0] + 26 * s, pc[1] + 18 * s]];
    pins.forEach(([px, py]) => { S("circle", { cx: px, cy: py, r: 10 * s, class: "acv-sims-glass" }, g); S("circle", { cx: px, cy: py, r: 5.5 * s, class: "acv-sims-pin" }, g); });
    const body = [x + w - 22 * s, top + 182 * s];
    S("circle", { cx: body[0], cy: body[1], r: 9 * s, class: "acv-sims-bolt" }, g);
    S("path", { d: `M${body[0] - 5 * s} ${body[1]} H${body[0] + 5 * s} M${body[0]} ${body[1] - 5 * s} V${body[1] + 5 * s}`, class: "acv-sims-boltx" }, g);
    if (!opts || opts.label !== false) T(g, cx, top + 40 * s, "Compressor", "acv-sims-lab2");
    return { g, pins, body, pc };
  }

  /* =====================================================================
     1) pt — P/T chart
     ===================================================================== */
  ACV.register("pt", {
    title: "مخطط الضغط والحرارة (P/T)",
    params: 'ref: "R134a" | "R410A" | ... ; mode: "t2p" (اسحب الحرارة) | "p2t" (اسحب الضغط); refs: ["R134a","R600a",...] قائمة الغازات المعروضة; t: حرارة البداية °C',
    demo: [{ ref: "R134a" }, { ref: "R410A", mode: "p2t" }, { ref: "R404A", refs: ["R404A", "R507A", "R448A", "R134a"] }],
    render(host, p, ctx) {
      const tb = PT(ctx);
      let names = (Array.isArray(p.refs) ? p.refs : []).filter((n) => tb[n]);
      if (!names.length) names = ["R134a", "R600a", "R290", "R22", "R410A", "R32", "R404A"].filter((n) => tb[n]);
      if (!names.length) names = Object.keys(tb);
      let ref = tb[p.ref] ? p.ref : names[0];
      if (!names.includes(ref)) names.unshift(ref);
      let mode = p.mode === "p2t" ? "p2t" : "t2p";
      let t = Number.isFinite(+p.t) && p.t != null ? +p.t : 5, pg = 0;

      const root = shell(host, "acv-sims-pt");
      chips(root, names, ref, (v) => { ref = v; build(); }, "اختر الغاز");
      chips(root, [["t2p", "حرارة ← ضغط"], ["p2t", "ضغط ← حرارة"]], mode, (v) => { mode = v; setupSlider(); update(); }, "اتجاه القراءة");
      const st = stage(root);
      const svg = mkSvg(st, 400, 420, "مانومتر ومنحنى الضغط المشبع مقابل الحرارة");
      const sl = slider(root, { label: "", min: 0, max: 1, step: 0.5, value: 0, fmt: (v) => (mode === "t2p" ? f(v, 1) + " °C" : f(v, 2) + " bar"), onInput: (v) => { if (mode === "t2p") t = v; else pg = v; update(); } });
      const rd = readouts(root, [["t", "الحرارة المشبعة"], ["bar", "الضغط bar(g)"], ["psi", "psi(g)"], ["abs", "bar(abs)"]]);
      const inf = info(root);
      let G, R, pt, pt2, cx1, cy1, cx2, cy2, sx, sy;

      function build() {
        R = tb[ref]; svg.innerHTML = "";
        const pmax = satP(R, R.tmax, "b");
        const [mx, mj, mn] = niceScale(pmax * 1.04);
        G = gauge(svg, { cx: 200, cy: 118, r: 108, min: -1, max: mx, major: mj, minor: mn, tone: "n", unit: "bar", title: ref, lcd: true,
          temps: R.t.filter((x) => x % 10 === 0).map((x) => ({ t: x, p: satP(R, x, "d") })) });
        // plot
        const X0 = 44, X1 = 388, Y0 = 250, Y1 = 384;
        sx = (v) => X0 + ((v - R.tmin) / (R.tmax - R.tmin)) * (X1 - X0);
        sy = (v) => Y1 - ((v + 1) / (mx + 1)) * (Y1 - Y0);
        S("rect", { x: X0, y: Y0, width: X1 - X0, height: Y1 - Y0, class: "acv-sims-plotbg" }, svg);
        for (let x = Math.ceil(R.tmin / 20) * 20; x <= R.tmax; x += 20) { S("line", { x1: sx(x), x2: sx(x), y1: Y0, y2: Y1, class: "acv-sims-grid" }, svg); T(svg, sx(x), Y1 + 15, String(x), "acv-sims-ax"); }
        Array.from({ length: Math.round(mx / mj) + 1 }, (_, i) => i * mj).forEach((v) => { S("line", { x1: X0, x2: X1, y1: sy(v), y2: sy(v), class: "acv-sims-grid" }, svg); T(svg, X0 - 4, sy(v) + 4, String(v), "acv-sims-ax", "r"); });
        T(svg, X1, Y1 + 30, "°C", "acv-sims-ax", "r"); T(svg, X0 + 6, Y0 + 16, "bar(g)", "acv-sims-ax", "l");
        const pts = (k) => { const a = []; for (let x = R.tmin; x <= R.tmax + 1e-6; x += 1) a.push(`${sx(x).toFixed(1)},${sy(satP(R, x, k)).toFixed(1)}`); return a.join(" "); };
        S("polyline", { points: pts("b"), class: "acv-sims-curve" }, svg);
        if (R.glide) S("polyline", { points: pts("d"), class: "acv-sims-curve2" }, svg);
        const ch = S("g", { class: "acv-sims-cross" }, svg);
        cx1 = S("line", { class: "acv-sims-xh" }, ch); cy1 = S("line", { class: "acv-sims-xh" }, ch);
        cx2 = S("line", { class: "acv-sims-xh" }, ch); cy2 = S("line", { class: "acv-sims-xh" }, ch);
        pt2 = S("circle", { r: 4.5, class: "acv-sims-dot2" }, svg);
        pt = S("circle", { r: 6.5, class: "acv-sims-dot" }, svg);
        svg._X = [X0, X1, Y0, Y1];
        setupSlider(); update();
      }
      function setupSlider() {
        const lab = sl.el.querySelector("label");
        if (mode === "t2p") {
          t = clamp(Math.round(t * 2) / 2, R.tmin, R.tmax);
          lab.textContent = "اسحب الحرارة (°C)";
          sl.range(R.tmin, R.tmax, 0.5); sl.set(t); sl.inp.setAttribute("aria-label", "درجة الحرارة");
          sl.el.dataset.tone = "t";
        } else {
          const p0 = satP(R, R.tmin, "b"), p1 = satP(R, R.tmax, "d");
          pg = clamp(Math.round(satP(R, t, "d") * 20) / 20, Math.ceil(p0 * 20) / 20, Math.floor(p1 * 20) / 20);
          lab.textContent = "اسحب الضغط bar(g)";
          sl.range(Math.ceil(p0 * 20) / 20, Math.floor(p1 * 20) / 20, 0.05); sl.set(pg); sl.inp.setAttribute("aria-label", "الضغط bar");
          sl.el.dataset.tone = "p";
        }
        sl.upd();
      }

      function update() {
        const [X0, X1, Y0, Y1] = svg._X;
        let pb, pd, tb_, td;
        if (mode === "t2p") { pb = satP(R, t, "b"); pd = satP(R, t, "d"); tb_ = td = t; }
        else { pb = pd = pg; td = satT(R, pg, "d"); tb_ = satT(R, pg, "b"); t = td; }
        const pShow = mode === "t2p" ? pb : pg;
        G.set(pShow, f(pShow, 2));
        const place = (c, lx, ly, x, y) => { c.setAttribute("cx", x); c.setAttribute("cy", y); lx.setAttribute("x1", x); lx.setAttribute("x2", x); lx.setAttribute("y1", y); lx.setAttribute("y2", Y1); ly.setAttribute("x1", X0); ly.setAttribute("x2", x); ly.setAttribute("y1", y); ly.setAttribute("y2", y); };
        if (mode === "t2p") place(pt, cx1, cy1, sx(t), sy(pb)); else place(pt, cx1, cy1, sx(td), sy(pg));
        const showDual = R.glide && Math.abs(pb - pd) + Math.abs(tb_ - td) > 0.05;
        pt2.style.display = cx2.style.display = cy2.style.display = showDual ? "" : "none";
        if (showDual) { if (mode === "t2p") place(pt2, cx2, cy2, sx(t), sy(pd)); else place(pt2, cx2, cy2, sx(tb_), sy(pg)); }
        if (mode === "t2p") {
          rd.t.textContent = f(t, 1) + " °C";
          rd.bar.textContent = showDual ? `${f(pb, 2)} / ${f(pd, 2)}` : f(pb, 2);
          rd.psi.textContent = showDual ? `${f(pb * PSI, 0)} / ${f(pd * PSI, 0)}` : f(pb * PSI, 1);
          rd.abs.textContent = f(pb + ATM, 2);
        } else {
          rd.t.textContent = showDual ? `${f(td, 1)} / ${f(tb_, 1)} °C` : f(td, 1) + " °C";
          rd.bar.textContent = f(pg, 2); rd.psi.textContent = f(pg * PSI, 1); rd.abs.textContent = f(pg + ATM, 2);
        }
        let h = `<b>${ref}</b> — طالما في الدورة سائل وبخار معاً (داخل الـ Evaporator أو الـ Condenser) فالضغط مرتبط بالحرارة فقط حسب هذا الجدول.`;
        if (pShow < 0) h += ` الضغط <b>تحت الجوي (vacuum)</b>: الـ low side ممكن يسحب هواء ورطوبة إذا كان فيه تسريب.`;
        if (R.glide) h += mode === "t2p" ? ` غاز <b>blend</b>: الرقم الأول Bubble (سائل) والثاني Dew (بخار).` : ` غاز <b>blend</b>: استعمل حرارة <b>Dew</b> (${f(td, 1)}°) للـ superheat وحرارة <b>Bubble</b> (${f(tb_, 1)}°) للـ subcooling.`;
        const fl = flamNote(R); if (fl) h += " " + fl;
        inf.set(h, pShow < 0 ? "warn" : "info");
      }
      build();
    },
  });

  /* =====================================================================
     2) manifold — gauges + clamp thermometers, SH / SC diagnosis
     ===================================================================== */
  const MF_SCN = { // evap sat °C, suction line °C, cond sat °C, liquid line °C
    normal: [5, 12, 45, 40], undercharge: [-4, 14, 37, 36], overcharge: [8.5, 10, 53, 40], restriction: [-10, 12, 43, 31],
  };
  ACV.register("manifold", {
    title: "ساعات المانيفولد والـ Superheat / Subcooling",
    params: 'ref: "R410A" | "R32" | "R22" | "R134a" | ...; scenario: "normal" | "undercharge" | "overcharge" | "restriction"; refs: قائمة الغازات',
    demo: [{ ref: "R410A", scenario: "normal" }, { ref: "R32", scenario: "undercharge" }],
    render(host, p, ctx) {
      const tb = PT(ctx);
      let names = (Array.isArray(p.refs) ? p.refs : ["R410A", "R32", "R22", "R134a", "R407C"]).filter((n) => tb[n]);
      if (!names.length) names = Object.keys(tb).slice(0, 5);
      let ref = tb[p.ref] ? p.ref : names[0];
      if (!names.includes(ref)) names.unshift(ref);
      let scn = MF_SCN[p.scenario] ? p.scenario : "normal";
      let R, LP, HP, TS, TL, GL, GH;

      const root = shell(host, "acv-sims-mf");
      chips(root, names, ref, (v) => { ref = v; build(); }, "الغاز");
      const sc = chips(root, [["normal", "طبيعي"], ["undercharge", "نقص شحنة"], ["overcharge", "شحنة زائدة"], ["restriction", "انسداد"]], scn, (v) => { scn = v; preset(); update(); }, "حالات جاهزة");
      const st = stage(root);
      const svg = mkSvg(st, 400, 344, "مانيفولد: ساعة الضغط المنخفض الزرقاء وساعة الضغط العالي الحمراء مع ميزان حرارة على خط السكشن وخط السائل");
      H("div", { class: "acv-cap" }, st, "الأرقام الملوّنة داخل الساعة = حرارة التشبع °C للغاز المختار");
      const grid = H("div", { class: "acv-sims-grid2" }, root);
      const sLP = slider(grid, { label: "ضغط Low (أزرق)", tone: "lo", min: 0, max: 10, step: 0.1, value: 5, fmt: (v) => f(v, 1) + " bar", onInput: (v) => { LP = v; dirty(); } });
      const sHP = slider(grid, { label: "ضغط High (أحمر)", tone: "hi", min: 0, max: 10, step: 0.1, value: 5, fmt: (v) => f(v, 1) + " bar", onInput: (v) => { HP = v; dirty(); } });
      const sTS = slider(grid, { label: "حرارة خط الـ Suction", tone: "lo", min: -20, max: 30, step: 0.5, value: 10, fmt: (v) => f(v, 1) + " °C", onInput: (v) => { TS = v; dirty(); } });
      const sTL = slider(grid, { label: "حرارة خط الـ Liquid", tone: "hi", min: 15, max: 60, step: 0.5, value: 40, fmt: (v) => f(v, 1) + " °C", onInput: (v) => { TL = v; dirty(); } });
      const rd = readouts(root, [["te", "Evap sat (Dew)"], ["sh", "Superheat"], ["tc", "Cond sat (Bubble)"], ["sc", "Subcooling"]]);
      const inf = info(root);
      let lcdS, lcdL;
      function dirty() { sc.set(null); update(); }

      function build() {
        R = tb[ref]; svg.innerHTML = "";
        const [lmx, lmj, lmn] = niceScale(satP(R, Math.min(30, R.tmax), "d") * 1.05);
        const [hmx, hmj, hmn] = niceScale(satP(R, R.tmax, "b") * 1.04);
        const tl = []; for (let x = -40; x <= 30; x += 10) if (x >= R.tmin) tl.push({ t: x, p: satP(R, x, "d") });
        const th = []; for (let x = -20; x <= R.tmax; x += 10) th.push({ t: x, p: satP(R, x, "b") });
        // manifold body + stems
        S("rect", { x: 93, y: 186, width: 14, height: 18, class: "acv-sims-brass" }, svg);
        S("rect", { x: 293, y: 186, width: 14, height: 18, class: "acv-sims-brass" }, svg);
        S("rect", { x: 44, y: 200, width: 312, height: 40, rx: 12, class: "acv-sims-mbody" }, svg);
        S("circle", { cx: 200, cy: 220, r: 11, class: "acv-sims-sight" }, svg);
        S("rect", { x: 14, y: 206, width: 30, height: 28, rx: 7, class: "acv-sims-knob-lo" }, svg);
        S("rect", { x: 356, y: 206, width: 30, height: 28, rx: 7, class: "acv-sims-knob-hi" }, svg);
        // hoses
        S("path", { d: "M130 240 C130 262 150 266 150 290", class: "acv-sims-hose acv-sims-hose-lo" }, svg);
        S("path", { d: "M200 240 C200 262 200 262 200 272", class: "acv-sims-hose acv-sims-hose-y" }, svg);
        S("rect", { x: 192, y: 270, width: 16, height: 10, rx: 3, class: "acv-sims-brass" }, svg);
        S("path", { d: "M270 240 C270 262 250 266 250 290", class: "acv-sims-hose acv-sims-hose-hi" }, svg);
        // pipes
        S("line", { x1: 8, y1: 306, x2: 192, y2: 306, class: "acv-sims-pipe-suc" }, svg);
        S("line", { x1: 208, y1: 306, x2: 392, y2: 306, class: "acv-sims-pipe-liq" }, svg);
        S("rect", { x: 143, y: 286, width: 14, height: 14, rx: 2, class: "acv-sims-brass" }, svg);
        S("rect", { x: 243, y: 288, width: 14, height: 12, rx: 2, class: "acv-sims-brass" }, svg);
        T(svg, 100, 337, "Suction line", "acv-sims-lab3");
        T(svg, 300, 337, "Liquid line", "acv-sims-lab3");
        // clamp thermometers
        const clamp_ = (x, tone) => {
          S("path", { d: `M${x - 13} 296 Q${x} 288 ${x + 13} 296 L${x + 13} 316 Q${x} 324 ${x - 13} 316 Z`, class: "acv-sims-clamp acv-sims-clamp-" + tone }, svg);
          S("line", { x1: x, y1: 288, x2: x, y2: 274, class: "acv-sims-wire" }, svg);
          S("rect", { x: x - 32, y: 252, width: 64, height: 22, rx: 5, class: "acv-sims-lcd" }, svg);
          return T(svg, x, 268, "—", "acv-sims-lcdt");
        };
        lcdS = clamp_(56, "lo"); lcdL = clamp_(344, "hi");
        GL = gauge(svg, { cx: 100, cy: 96, r: 86, min: -1, max: lmx, major: lmj, minor: lmn, tone: "lo", unit: "bar", title: "LOW", lcd: true, temps: tl, deg: false });
        GH = gauge(svg, { cx: 300, cy: 96, r: 86, min: -1, max: hmx, major: hmj, minor: hmn, tone: "hi", unit: "bar", title: "HIGH", lcd: true, temps: th, deg: false });
        const pl0 = Math.max(-0.5, satP(R, Math.max(R.tmin, -30), "d")), pl1 = satP(R, 20, "d");
        sLP.range(Math.ceil(pl0 * 10) / 10, Math.floor(pl1 * 10) / 10, 0.1);
        sHP.range(Math.ceil(satP(R, 20, "b") * 10) / 10, Math.floor(satP(R, Math.min(62, R.tmax), "b") * 10) / 10, 0.1);
        if (!sc.btns.some((b) => b.getAttribute("aria-pressed") === "true")) { scn = "normal"; sc.set("normal"); }
        preset(); update();
      }
      function preset() {
        const s = MF_SCN[scn] || MF_SCN.normal;
        LP = Math.round(satP(R, s[0], "d") * 10) / 10; TS = s[1];
        HP = Math.round(satP(R, s[2], "b") * 10) / 10; TL = s[3];
        sLP.set(LP); sTS.set(TS); sHP.set(HP); sTL.set(TL);
      }
      const lvl = (v, lo, hi) => (v < lo ? "low" : v > hi ? "high" : "ok");
      function update() {
        const te = satT(R, LP, "d"), tc = satT(R, HP, "b");
        const sh = TS - te, scv = tc - TL;
        GL.set(LP, f(LP, 1)); GH.set(HP, f(HP, 1));
        lcdS.textContent = f(TS, 1) + "°C"; lcdL.textContent = f(TL, 1) + "°C";
        rd.te.textContent = f(te, 1) + " °C"; rd.tc.textContent = f(tc, 1) + " °C";
        rd.sh.textContent = f(sh, 1) + " K"; rd.sc.textContent = f(scv, 1) + " K";
        const a = lvl(sh, 4, 12), b = lvl(scv, 3, 8);
        rd.tone("sh", a === "ok" ? "ok" : sh < 2 ? "bad" : "warn"); rd.tone("sc", b === "ok" ? "ok" : "warn");
        const nm = { low: "منخفض", high: "مرتفع", ok: "طبيعي" };
        let msg, tone = "warn";
        const key = a + "-" + b;
        const D = {
          "ok-ok": ["الدورة طبيعية: الشحنة والتغذية ضمن المجال.", "ok"],
          "high-low": ["<b>نقص شحنة (undercharge)</b> غالباً بسبب تسريب: ابحث عن التسريب وصلّحه قبل إضافة غاز.", "bad"],
          "low-high": ["<b>شحنة زائدة (overcharge)</b>: الـ condenser ممتلئ سائل، اسحب الزائد بالـ recovery.", "bad"],
          "high-high": ["<b>انسداد (restriction)</b> في الـ Filter drier أو الـ Capillary أو TXV شبه مغلق: السائل متجمع في الـ condenser والـ evaporator جوعان. افحص فرق الحرارة على الـ Filter drier.", "bad"],
          "low-low": ["<b>تغذية زائدة</b>: TXV مفتوح زيادة (overfeeding) أو بصلته غير مثبتة، أو هواء ضعيف على الـ Evaporator. خطر رجوع سائل للكومبروسور.", "bad"],
          "high-ok": ["Superheat مرتفع مع subcooling طبيعي: <b>TXV يغذي قليل</b> (underfeeding) أو بداية نقص شحنة.", "warn"],
          "low-ok": ["Superheat منخفض: <b>هواء ضعيف على الـ Evaporator</b> (فلتر/مروحة) أو تغذية زائدة.", "warn"],
          "ok-high": ["Subcooling مرتفع: بداية <b>شحنة زائدة</b> أو انسداد خفيف بعد الـ condenser.", "warn"],
          "ok-low": ["Subcooling منخفض: بداية <b>نقص شحنة</b> أو condenser لا يكثّف جيداً.", "warn"],
        };
        [msg, tone] = D[key];
        let extra = "";
        if (sh < 2) extra += " ⚠ Superheat قريب من الصفر: خطر <b>liquid floodback</b> على الكومبروسور.";
        if (tc - te < 15) extra += " فرق الضغطين صغير جداً — تأكد أن الكومبروسور يعمل (أو ضعيف).";
        inf.set(`Superheat ${nm[a]} · Subcooling ${nm[b]} — ${msg}${extra}<br><span class="acv-sims-note">قيم تقريبية (SH 4–12 K، SC 3–8 K)؛ القيمة الصحيحة حسب الـ manual وجدول الشحن. للـ blend: SH من Dew وSC من Bubble.</span>`, tone);
      }
      build();
    },
  });

  /* =====================================================================
     3) ohm — DMM on compressor terminals
     ===================================================================== */
  ACV.register("ohm", {
    title: "قياس ملفات الكومبروسور بالأوم",
    params: 'scenario: "healthy" | "open" | "short" | "ground" | "findc"; values: {cs, cr, sr} بالأوم (sr = cs + cr)',
    demo: [{ scenario: "healthy" }, { scenario: "findc", values: { cs: 5.2, cr: 2.1 } }],
    render(host, p) {
      const v = p.values || {};
      let cs = +v.cs, cr = +v.cr; const srv = +v.sr;
      if (!(cs > 0) && cr > 0 && srv > cr) cs = srv - cr;
      if (!(cr > 0) && cs > 0 && srv > cs) cr = srv - cs;
      if (!(cs > 0)) cs = 4.6; if (!(cr > 0)) cr = 2.4;
      let scn = ["healthy", "open", "short", "ground", "findc"].includes(p.scenario) ? p.scenario : "healthy";
      let probes = [], map, guess, measured;
      const root = shell(host, "acv-sims-ohm");
      chips(root, [["healthy", "سليم"], ["open", "Open"], ["short", "Short"], ["ground", "Grounded"], ["findc", "تمرين: حدّد C/S/R"]], scn, (x) => { scn = x; reset(); }, "الحالة");
      const st = stage(root);
      const svg = mkSvg(st, 400, 310, "كومبروسور مع ثلاثة أطراف C S R وجسم، وجهاز ملتيميتر على الأوم");
      const ctl = H("div", { class: "acv-sims-row" }, root);
      btn(ctl, "ارفع الـ probes", "", () => { probes = []; update(); });
      const rd = readouts(root, [["pair", "بين"], ["val", "القراءة"]]);
      const tableBox = H("div", { class: "acv-sims-tbl" }, root);
      const quiz = H("div", { class: "acv-sims-quiz" }, root);
      const inf = info(root);
      const cmp = compressor(svg, 124, 28, 1.25);
      const M = dmm(svg, 266, 30, 128, 236, { unit: "Ω", tag: "200Ω", marks: ["V~", "Ω", "µF", "A"], sel: 1 });
      const leadG = S("g", {}, svg);
      const labs = [], hits = [];
      const targets = [...cmp.pins, cmp.body];
      targets.forEach((pt, i) => {
        const isB = i === 3;
        const lab = T(svg, pt[0] + (isB ? 0 : i === 0 ? 0 : i === 1 ? -36 : 36), pt[1] + (isB ? 30 : i === 0 ? -24 : 6), "", "acv-sims-pinlab");
        labs.push(lab);
        const hc = S("circle", { cx: pt[0], cy: pt[1], r: isB ? 20 : 25, class: "acv-sims-hit" }, svg);
        hot(hc, isB ? "جسم الكومبروسور" : "طرف " + (i + 1), () => tap(i));
        hits.push(hc);
      });
      T(svg, cmp.body[0] - 30, cmp.body[1] + 5, "Body", "acv-sims-lab3", "r");
      function nodeOf(i) { return i === 3 ? "B" : map[i]; }
      function R(a, b) { // tree network: C centre; S via cs, R via cr, B via rg
        if (a === b) return 0;
        const sc = { healthy: [cs, cr, Infinity], findc: [cs, cr, Infinity], open: [Infinity, cr, Infinity], short: [cs * 0.25, cr, Infinity], ground: [cs, cr, 0.8] }[scn];
        const leg = { C: 0, S: sc[0], R: sc[1], B: sc[2] };
        return leg[a] + leg[b];
      }
      function fmtR(r) { return !Number.isFinite(r) || r > 2e6 ? "O.L" : r < 0.05 ? "0.0" : f(r, 1); }
      function reset() {
        probes = []; measured = {};
        map = ["C", "S", "R"];
        if (scn === "findc") { for (let i = 2; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [map[i], map[j]] = [map[j], map[i]]; } }
        guess = [null, null, null];
        labs.forEach((l, i) => { l.textContent = i === 3 ? "" : scn === "findc" ? String(i + 1) : map[i]; });
        buildQuiz(); update();
      }
      function tap(i) {
        if (probes.length === 0) probes = [i];
        else if (probes.length === 1 && probes[0] !== i) probes.push(i);
        else probes = [i];
        update();
      }
      function name(i) { return i === 3 ? "Body" : scn === "findc" ? String(i + 1) : map[i]; }
      function buildQuiz() {
        quiz.innerHTML = "";
        if (scn !== "findc") { quiz.style.display = "none"; return; }
        quiz.style.display = "";
        H("div", { class: "acv-sims-qh" }, quiz, "حدّد كل طرف:");
        [0, 1, 2].forEach((i) => {
          const row = H("div", { class: "acv-sims-qrow" }, quiz);
          H("span", { class: "acv-sims-qn", dir: "ltr" }, row, "طرف " + (i + 1));
          chips(row, ["C", "S", "R"], null, (x) => { guess[i] = x; }, "طرف " + (i + 1));
        });
        btn(quiz, "تحقّق من الإجابة", "acv-sims-primary", check);
      }
      function check() {
        if (guess.some((g) => !g)) { inf.set("اختر C أو S أو R لكل طرف أولاً.", "warn"); return; }
        const ok = guess.every((g, i) => g === map[i]);
        inf.set(ok ? `✓ صحيح! الطرف ${map.indexOf("C") + 1} = C. القاعدة: أكبر قراءة بين S وR، والطرف الباقي هو C؛ ومن C: الأقل = R (Run) والأكبر = S (Start).`
          : "✗ ليس بعد. قِس الأزواج الثلاثة: أكبر قراءة تكون بين S وR، فالطرف الثالث هو C. ثم من C: القراءة الأصغر للـ R والأكبر للـ S.", ok ? "ok" : "bad");
      }
      function table() {
        tableBox.innerHTML = "";
        const ks = Object.keys(measured); if (!ks.length) return;
        const t = H("div", { class: "acv-sims-tblg" }, tableBox);
        ks.forEach((k) => { const c = H("div", { class: "acv-sims-tblc" }, t); H("span", { dir: "ltr" }, c, k); H("b", { dir: "ltr" }, c, measured[k] + (measured[k] === "O.L" ? "" : " Ω")); });
      }
      function update() {
        leadG.innerHTML = "";
        hits.forEach((h, i) => h.classList.toggle("acv-sims-sel", probes.includes(i)));
        if (probes[0] != null) { const t0 = targets[probes[0]]; lead(leadG, M.com, t0, "k", 70); probe(leadG, t0[0], t0[1], "k"); }
        if (probes[1] != null) { const t1 = targets[probes[1]]; lead(leadG, M.vj, t1, "r", 90); probe(leadG, t1[0], t1[1], "r"); }
        if (probes.length < 2) {
          M.lcd.textContent = "O.L"; rd.pair.textContent = probes.length ? name(probes[0]) + " – ?" : "—"; rd.val.textContent = "—"; rd.tone("val", "");
          inf.set(probes.length ? "الآن اضغط على الطرف الثاني لوضع الـ probe الأحمر." : "اضغط على طرفين (أو طرف + Body) لوضع الـ probes. افصل الكهرباء وفك الأسلاك عن الـ terminals قبل القياس.", "info");
          table(); return;
        }
        const [i, j] = probes, a = nodeOf(i), b = nodeOf(j);
        const r = R(a, b), s = fmtR(r);
        M.lcd.textContent = s;
        const pr = [name(i), name(j)].sort().join("–");
        measured[pr] = s;
        rd.pair.textContent = pr; rd.val.textContent = s + (s === "O.L" ? "" : " Ω");
        table();
        const toBody = a === "B" || b === "B";
        let msg, tone = "info";
        if (scn === "findc") {
          msg = toBody ? (s === "O.L" ? "إلى الجسم: O.L — جيد (لكن الـ megger هو الفحص الحقيقي للعزل)." : "قراءة للجسم!") : `سجّل القراءة ${pr} = ${s} Ω. قِس الأزواج الثلاثة ثم حدّد الأطراف.`;
          const pairs = Object.keys(measured).filter((k) => !k.includes("Body"));
          if (pairs.length === 3) msg += " عندك الثلاث قراءات: أكبرها بين S وR.";
        } else if (toBody) {
          if (s === "O.L") { msg = "O.L إلى الجسم — لا يوجد تماس واضح. الملتيميتر لا يكشف ضعف العزل؛ افحص بالـ <b>megger</b> 500V."; tone = "ok"; }
          else { msg = `<b>Grounded</b>: قراءة ${s} Ω بين الملف والجسم — الملف ماسك بالجسم. لا تشغّل الكومبروسور (خطر كهرباء وقاطع يفصل) — غالباً استبدال.`; tone = "bad"; }
        } else if (s === "O.L") { msg = "<b>Open winding</b>: لا يوجد استمرارية. تأكد أولاً من الـ <b>internal overload</b> (إذا الكومبروسور ساخن انتظره يبرد ساعة وأعد القياس) قبل الحكم بالتلف."; tone = "bad"; }
        else {
          const exp = { "C–S": cs, "C–R": cr, "R–S": cs + cr }[pr];
          const lowish = exp && r < exp * 0.6;
          msg = { "C–S": "C–S = ملف الـ <b>Start</b> (مقاومته أكبر من الـ Run).", "C–R": "C–R = ملف الـ <b>Run</b> (أقل قراءة).", "R–S": "S–R = الملفين على التوالي = <b>أكبر قراءة</b>." }[pr] || "";
          if (lowish) { msg += ` القراءة أقل بكثير من المتوقع (~${f(exp, 1)} Ω) → <b>Shorted turns</b>: ملف محروق جزئياً.`; tone = "bad"; }
          const all = ["C–S", "C–R", "R–S"].map((k) => parseFloat(measured[k]));
          if (all.every(Number.isFinite)) { const sum = all[0] + all[1]; msg += ` التحقق: C–S + C–R = ${f(sum, 1)} ≈ S–R = ${f(all[2], 1)} ${Math.abs(sum - all[2]) < 0.15 ? "✓" : "✗"}`; if (tone === "info") tone = "ok"; }
          msg += ' <span class="acv-sims-note">القيم تختلف حسب القدرة — قارن مع الـ manual.</span>';
        }
        inf.set(msg, tone);
      }
      reset();
    },
  });

  /* =====================================================================
     4) megger — insulation test at 500 V DC
     ===================================================================== */
  ACV.register("megger", {
    title: "فحص العزل بالـ Megger (500V)",
    params: 'scenario: "healthy" | "marginal" | "failed"; value: قيمة MΩ مخصصة (اختياري)',
    demo: [{ scenario: "healthy" }, { scenario: "marginal" }],
    render(host, p) {
      const VAL = { healthy: 850, marginal: 3.2, failed: 0.35 };
      let scn = VAL[p.scenario] != null ? p.scenario : "healthy";
      let target = Number.isFinite(+p.value) && p.value != null ? +p.value : VAL[scn];
      const root = shell(host, "acv-sims-meg");
      chips(root, [["healthy", "سليم"], ["marginal", "رطوبة / ملوث"], ["failed", "عزل تالف"]], scn, (x) => { scn = x; target = VAL[x]; idle(); }, "الحالة");
      const st = stage(root);
      const svg = mkSvg(st, 400, 290, "جهاز Megger موصول بين طرف الكومبروسور والجسم");
      const ctl = H("div", { class: "acv-sims-row" }, root);
      const bT = btn(ctl, "⚡ اضغط TEST — 500V", "acv-sims-primary", run);
      const rd = readouts(root, [["v", "جهد الاختبار"], ["r", "مقاومة العزل"]]);
      const inf = info(root);
      const cmp = compressor(svg, 92, 52, 0.88);
      T(svg, cmp.pins[0][0], cmp.pins[0][1] - 16, "C", "acv-sims-pinlab");
      T(svg, cmp.pins[1][0] - 20, cmp.pins[1][1] + 24, "S", "acv-sims-pinlab");
      T(svg, cmp.pins[2][0] + 20, cmp.pins[2][1] + 24, "R", "acv-sims-pinlab");
      // instrument
      const x = 200, y = 14, w = 192, h = 262;
      S("rect", { x, y, width: w, height: h, rx: 16, class: "acv-sims-holster acv-sims-holster-b" }, svg);
      S("rect", { x: x + 8, y: y + 8, width: w - 16, height: h - 16, rx: 10, class: "acv-sims-mface" }, svg);
      const acx = x + w / 2, acy = y + 150, ar = 118;
      S("path", { d: `M${x + 16} ${y + 18} H${x + w - 16} V${y + 104} H${x + 16} Z`, class: "acv-sims-scaleface" }, svg);
      const lg = (v) => clamp((Math.log10(v) + 1) / 4, 0, 1); // 0.1 → 1000 MΩ
      const angM = (v) => (v >= 2000 ? 42 : -42 + 70 * lg(v));
      const Pm = (a, rr) => [acx + rr * Math.sin((a * Math.PI) / 180), acy - rr * Math.cos((a * Math.PI) / 180)];
      const band = (v0, v1, cls) => { const [x0, y0] = Pm(angM(v0), ar - 10), [x1, y1] = Pm(angM(v1), ar - 10); S("path", { d: `M${x0} ${y0} A${ar - 10} ${ar - 10} 0 0 1 ${x1} ${y1}`, class: cls }, svg); };
      band(0.1, 1, "acv-sims-bandbad"); band(1, 2, "acv-sims-bandwarn"); band(2, 1000, "acv-sims-bandok");
      [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].forEach((v) => {
        const maj = [0.1, 1, 10, 100, 1000].includes(v);
        const [x0, y0] = Pm(angM(v), ar - 4), [x1, y1] = Pm(angM(v), ar - (maj ? 18 : 12));
        S("line", { x1: x0, y1: y0, x2: x1, y2: y1, class: maj ? "acv-sims-tk2" : "acv-sims-tk" }, svg);
        if (maj) { const [tx, ty] = Pm(angM(v), ar - 31); T(svg, tx, ty + 4, v >= 1000 ? "1G" : String(v), "acv-sims-gl"); }
      });
      { const [x0, y0] = Pm(42, ar - 4), [x1, y1] = Pm(42, ar - 18); S("line", { x1: x0, y1: y0, x2: x1, y2: y1, class: "acv-sims-tk2" }, svg); const [ix, iy] = Pm(43, ar - 31); T(svg, ix, iy + 5, "∞", "acv-sims-gl"); }
      T(svg, acx, y + 98, "MΩ", "acv-sims-gu");
      const cid = "acv-sims-c" + uid();
      S("rect", { x: x + 16, y: y + 18, width: w - 32, height: 86 }, S("clipPath", { id: cid }, S("defs", {}, svg)));
      const ndc = S("g", { "clip-path": `url(#${cid})` }, svg);
      const nd = S("line", { x1: acx, y1: acy, x2: acx, y2: acy - ar + 6, class: "acv-sims-mneedle" }, ndc);
      nd.style.transformOrigin = `${acx}px ${acy}px`;
      S("rect", { x: x + 20, y: y + 120, width: w - 40, height: 44, rx: 5, class: "acv-sims-lcd" }, svg);
      const lcd = T(svg, x + w - 28, y + 151, "----", "acv-sims-lcdbig", "r");
      T(svg, x + 26, y + 136, "MΩ", "acv-sims-lcdu", "l");
      const lcdV = T(svg, x + 26, y + 157, "500V", "acv-sims-lcds", "l");
      S("circle", { cx: x + 54, cy: y + 200, r: 22, class: "acv-sims-testbtn" }, svg);
      T(svg, x + 54, y + 205, "TEST", "acv-sims-testt");
      S("rect", { x: x + 98, y: y + 184, width: 68, height: 32, rx: 6, class: "acv-sims-dial" }, svg);
      T(svg, x + 132, y + 205, "500V", "acv-sims-dialm acv-sims-dialon");
      const jL = [x + w * 0.32, y + h - 22], jE = [x + w * 0.7, y + h - 22];
      S("circle", { cx: jL[0], cy: jL[1], r: 8, class: "acv-sims-jack-r" }, svg);
      S("circle", { cx: jE[0], cy: jE[1], r: 8, class: "acv-sims-jack-k" }, svg);
      T(svg, jL[0], jL[1] - 12, "LINE", "acv-sims-jl"); T(svg, jE[0], jE[1] - 12, "EARTH", "acv-sims-jl");
      lead(svg, jL, cmp.pins[0], "r", 60); probe(svg, cmp.pins[0][0], cmp.pins[0][1], "r");
      lead(svg, jE, cmp.body, "k", 40); probe(svg, cmp.body[0], cmp.body[1], "k");
      const L = loop(host, step);
      let tt = 0, running = false;
      const fmtM = (v) => (v >= 1000 ? ">999" : v >= 100 ? f(v, 0) : v >= 10 ? f(v, 1) : f(v, 2));
      function setNeedle(v) { nd.style.transform = `rotate(${angM(Math.max(v, 0.1))}deg)`; }
      function idle() {
        L.stop(); running = false; tt = 0; setNeedle(0.1); lcd.textContent = "----"; lcdV.textContent = "500V";
        rd.v.textContent = "0 V"; rd.r.textContent = "—"; rd.tone("r", ""); bT.disabled = false;
        inf.set("افصل الكهرباء وفك الأسلاك عن الـ terminals. وصّل <b>LINE</b> على طرف (C) و<b>EARTH</b> على جسم نظيف (بدون دهان)، ثم اضغط TEST. لا تفحص والكومبروسور تحت <b>vacuum</b>.", "info");
      }
      function value(tau) { return target * (1 - Math.exp(-tau * 2.2)) + 0.02; } // capacitive charging: reading rises then settles
      function step(dt) {
        tt += dt; const tau = Math.min(tt / 2.4, 1);
        const v = tau >= 1 ? target : value(tau);
        setNeedle(v); lcd.textContent = fmtM(v); lcdV.textContent = Math.round(Math.min(1, tt * 3) * 500) + "V";
        rd.v.textContent = Math.round(Math.min(1, tt * 3) * 500) + " V DC"; rd.r.textContent = fmtM(v) + " MΩ";
        if (tau >= 1) { finish(); return false; }
      }
      function run() {
        if (running) return; running = true; bT.disabled = true; tt = 0;
        inf.set("جاري الاختبار… انتظر حتى تستقر القراءة (المكثفات والملفات تشحن في البداية).", "info");
        if (reduce()) { tt = 3; step(0); return; }
        L.start();
      }
      function finish() {
        running = false; bT.disabled = false; lcdV.textContent = "500V";
        const v = target; let msg, tone;
        if (v >= 100) { msg = `✓ <b>عزل ممتاز</b> (${fmtM(v)} MΩ ≥ 100). الملفات معزولة عن الجسم.`; tone = "ok"; }
        else if (v >= 10) { msg = `<b>مقبول</b> (${fmtM(v)} MΩ). الحد الأدنى المقبول 2 MΩ، والسليم عادةً أعلى بكثير من 10.`; tone = "ok"; }
        else if (v >= 2) { msg = `<b>على الحد</b> (${fmtM(v)} MΩ): غالباً <b>رطوبة أو زيت مخلوط بالفريون</b>. شغّل الـ crankcase heater أو دفّئ الكومبروسور ثم أعد القياس — إذا بقي ينزل لا تعتمد عليه.`; tone = "warn"; }
        else if (v >= 1) { msg = `<b>ضعيف — غير مقبول</b> (${fmtM(v)} MΩ &lt; 2).`; tone = "bad"; }
        else { msg = `✗ <b>عزل تالف</b> (${fmtM(v)} MΩ &lt; 1): ملف ماسك بالجسم (ground). لا تشغّل، افحص الـ terminals والأسلاك؛ إذا بقيت القراءة → استبدال الكومبروسور.`; tone = "bad"; }
        rd.tone("r", tone);
        msg += ' <span class="acv-sims-note">كومبروسور Inverter: افصل أسلاك U/V/W عن الـ PCB قبل الفحص. بعد الاختبار فرّغ الشحنة.</span>';
        inf.set(msg, tone);
      }
      idle();
    },
  });

  /* =====================================================================
     5) capacitor — µF tester + current method
     ===================================================================== */
  ACV.register("capacitor", {
    title: "فحص الـ Run capacitor",
    params: "uf: السعة المكتوبة µF (افتراضي 35); v: الجهد 450; measured: القيمة المقاسة µF; hz: 50|60",
    demo: [{ uf: 35, v: 450, measured: 33.8 }, { uf: 2.5, v: 450, measured: 2.1 }],
    render(host, p) {
      const UFS = [1.5, 2.5, 5, 10, 25, 35, 45, 60];
      let uf = +p.uf > 0 ? +p.uf : 35, volt = [250, 370, 450].includes(+p.v) ? +p.v : 450;
      let meas = +p.measured > 0 ? +p.measured : uf * 0.97, hz = +p.hz === 60 ? 60 : 50;
      let disch = false;
      const root = shell(host, "acv-sims-cap");
      const uList = UFS.includes(uf) ? UFS : [...UFS, uf].sort((a, b) => a - b);
      chips(root, uList.map((u) => [u, u + " µF"]), uf, (x) => { uf = x; meas = uf * 0.97; disch = false; iI.value = ((uf * (parseFloat(iV.value) || 440)) / (1e6 / (2 * Math.PI * hz))).toFixed(2); draw(); calc(); }, "السعة المكتوبة");
      chips(root, [[250, "250 VAC"], [370, "370 VAC"], [450, "450 VAC"]], volt, (x) => { volt = x; draw(); }, "الجهد");
      const st = stage(root);
      const svg = mkSvg(st, 400, 300, "مكثف تشغيل وجهاز قياس سعة");
      const ctl = H("div", { class: "acv-sims-row" }, root);
      const bD = btn(ctl, "⚡ فرّغ المكثف", "acv-sims-warnbtn", discharge);
      const sl = slider(root, { label: "القيمة الحقيقية للمكثف (محاكاة)", min: 0, max: 1, step: 0.1, value: meas, fmt: (v) => f(v, uf < 10 ? 2 : 1) + " µF", onInput: (v) => { meas = v; update(); } });
      const rd = readouts(root, [["m", "القراءة"], ["d", "الانحراف"]]);
      const inf = info(root);
      // current method
      const cm = H("div", { class: "acv-sims-calc" }, root);
      H("div", { class: "acv-sims-qh" }, cm, "طريقة التيار (والمكيف شغّال)");
      const fr = H("div", { class: "acv-sims-calcrow" }, cm);
      const mkIn = (lab, val, step) => { const w = H("label", { class: "acv-sims-in" }, fr); H("span", {}, w, lab); const i = H("input", { type: "number", inputmode: "decimal", step, min: "0", value: val, dir: "ltr" }, w); i.addEventListener("input", calc); return i; };
      const iI = mkIn("التيار I (A) على سلك المكثف", ((uf * 440) / (1e6 / (2 * Math.PI * hz))).toFixed(2), "0.01");
      const iV = mkIn("الجهد V على طرفي المكثف", "440", "1");
      chips(cm, [[50, "50 Hz"], [60, "60 Hz"]], hz, (x) => { hz = x; calc(); }, "التردد");
      const cOut = H("div", { class: "acv-sims-calcout", dir: "ltr" }, cm);
      const cNote = H("div", { class: "acv-sims-note" }, cm);
      let lcd, lcdTag, spark, mark, capLabel, capV;
      const X0 = 40, X1 = 360, BY = 262, pct = (d) => X0 + ((clamp(d, -20, 20) + 20) / 40) * (X1 - X0);
      function draw() {
        svg.innerHTML = "";
        // capacitor can
        const cx = 92;
        S("rect", { x: cx - 50, y: 66, width: 100, height: 160, rx: 14, class: "acv-sims-can" }, svg);
        S("ellipse", { cx, cy: 66, rx: 50, ry: 12, class: "acv-sims-cantop" }, svg);
        S("rect", { x: cx - 46, y: 104, width: 92, height: 86, rx: 4, class: "acv-sims-sticker" }, svg);
        capLabel = T(svg, cx, 132, uf + " µF", "acv-sims-capt");
        T(svg, cx, 152, "±5%", "acv-sims-caps");
        capV = T(svg, cx, 170, volt + " VAC", "acv-sims-caps");
        T(svg, cx, 185, "50/60Hz", "acv-sims-caps2");
        const tA = [cx - 18, 52], tB = [cx + 18, 52];
        [tA, tB].forEach(([tx, ty]) => S("rect", { x: tx - 7, y: ty - 6, width: 14, height: 16, rx: 2, class: "acv-sims-pin" }, svg));
        spark = S("g", { class: "acv-sims-spark" }, svg);
        S("path", { d: `M${cx - 12} 30 l8 -9 l-2 7 l10 -6 l-8 10 l2 -6 z`, class: "acv-sims-sparkp" }, spark);
        T(svg, cx, 250, "Run capacitor", "acv-sims-lab3");
        const M = dmm(svg, 236, 18, 156, 212, { unit: "µF", tag: "CAP", marks: ["V~", "Ω", "µF", "A"], sel: 2, vlab: "+" });
        lcd = M.lcd; lcdTag = M.tag;
        lead(svg, M.com, tA, "k", 30, -70); probe(svg, tA[0], tA[1], "k");
        lead(svg, M.vj, tB, "r", 40, -50); probe(svg, tB[0], tB[1], "r");
        // tolerance bar
        const yb = BY;
        S("rect", { x: X0, y: yb, width: X1 - X0, height: 12, rx: 3, class: "acv-sims-bandbadf" }, svg);
        S("rect", { x: pct(-10), y: yb, width: pct(-5) - pct(-10), height: 12, class: "acv-sims-bandwarnf" }, svg);
        S("rect", { x: pct(5), y: yb, width: pct(10) - pct(5), height: 12, class: "acv-sims-bandwarnf" }, svg);
        S("rect", { x: pct(-5), y: yb, width: pct(5) - pct(-5), height: 12, class: "acv-sims-bandokf" }, svg);
        [-20, -10, -5, 0, 5, 10, 20].forEach((d) => T(svg, pct(d), yb + 28, (d > 0 ? "+" : "") + d + "%", "acv-sims-ax"));
        mark = S("path", { d: "M0 0 l-7 -10 h14 z", class: "acv-sims-mark" }, svg);
        sl.range(0, +(uf * 1.25).toFixed(2), uf < 10 ? 0.01 : 0.1); sl.set(+meas.toFixed(2));
        update();
      }
      function discharge() {
        disch = true; spark.classList.remove("acv-sims-sparkon"); void spark.getBBox(); if (!reduce()) spark.classList.add("acv-sims-sparkon");
        update();
      }
      function update() {
        sl.set(+meas.toFixed(2));
        bD.textContent = disch ? "✓ تم التفريغ" : "⚡ فرّغ المكثف"; bD.classList.toggle("acv-sims-done", disch);
        if (!disch) {
          lcd.textContent = "----"; lcdTag.textContent = "CAP"; rd.m.textContent = "—"; rd.d.textContent = "—"; rd.tone("d", ""); mark.style.display = "none";
          inf.set("⚠ <b>فرّغ المكثف أولاً</b>: افصل الكهرباء ثم فرّغه بمقاومة (مثلاً 20 kΩ / 5 W) أو أداة تفريغ — لا تقصّر طرفيه بمفك. مكثف مشحون يضربك ويخرب جهاز القياس.", "warn");
          return;
        }
        const d = ((meas - uf) / uf) * 100;
        lcd.textContent = f(meas, uf < 10 ? 2 : 1); lcdTag.textContent = "CAP";
        rd.m.textContent = f(meas, uf < 10 ? 2 : 1) + " µF"; rd.d.textContent = sg(d, 1) + " %";
        mark.style.display = ""; mark.setAttribute("transform", `translate(${pct(d)} ${BY - 2})`);
        let msg, tone;
        if (meas < uf * 0.02) { msg = "قراءة ~0: المكثف <b>مفتوح (open)</b> أو طرف مقطوع — استبدال."; tone = "bad"; }
        else if (d >= -5 && d <= 5) { msg = `✓ <b>ضمن التسامح ±5%</b>. المكثف سليم.`; tone = "ok"; }
        else if (d < -10) { msg = `✗ <b>أقل من −10%</b>: المكثف ضعيف — <b>استبدله</b> بنفس الـ µF وجهد مساوٍ أو أعلى. الكومبروسور/المروحة يسخن ويسحب تيار زائد.`; tone = "bad"; }
        else if (d < -5) { msg = `<b>ضعيف (بين −5% و−10%)</b>: يعمل لكن على الحد — راقبه أو استبدله إذا في أعراض (حرارة، تيار عالٍ، صعوبة إقلاع).`; tone = "warn"; }
        else { msg = `القراءة أعلى من المكتوب (${sg(d, 1)}%): أعد القياس بعد التفريغ وتأكد من المكثف الصحيح؛ أكثر من +10% غير طبيعي.`; tone = "warn"; }
        rd.tone("d", tone);
        if (uf <= 5) msg += ' <span class="acv-sims-note">مكثفات المراوح الصغيرة: كل 0.2 µF فرق مهم.</span>';
        inf.set(msg, tone);
      }
      function calc() {
        const I = parseFloat(iI.value), V = parseFloat(iV.value);
        const k = 1e6 / (2 * Math.PI * hz);
        cNote.textContent = `C(µF) = I × 10⁶ / (2π × f × V) ≈ ${f(k, 0)} × I / V عند ${hz} Hz${hz === 50 ? " (لبنان)" : ""}. ملاحظة: الرقم 2650 الشائع هو لـ 60 Hz. جهد المكثف عادةً أعلى من جهد الخط.`;
        if (!(I > 0) || !(V > 0)) { cOut.textContent = "—"; return; }
        const c = (k * I) / V, d = ((c - uf) / uf) * 100;
        cOut.textContent = `${f(k, 0)} × ${I} / ${V} = ${f(c, 2)} µF  (${sg(d, 1)}% vs ${uf} µF)`;
        cOut.dataset.tone = Math.abs(d) <= 5 ? "ok" : d < -10 ? "bad" : "warn";
      }
      draw(); calc();
    },
  });

  /* =====================================================================
     6) vacuum — pump-down + decay test with micron gauge
     ===================================================================== */
  ACV.register("vacuum", {
    title: "الـ Vacuum واختبار الثبات (Decay test)",
    params: 'scenario: "good" | "leak" | "moisture"',
    demo: [{ scenario: "good" }, { scenario: "moisture" }],
    render(host, p) {
      let scn = ["good", "leak", "moisture"].includes(p.scenario) ? p.scenario : "good";
      const root = shell(host, "acv-sims-vac");
      chips(root, [["good", "نظام سليم"], ["leak", "فيه تسريب"], ["moisture", "فيه رطوبة"]], scn, (x) => { scn = x; reset(); }, "الحالة");
      const st = stage(root);
      const svg = mkSvg(st, 400, 150, "مضخة vacuum موصولة عبر صمام وساعة micron إلى النظام");
      const st2 = stage(root);
      const gsv = mkSvg(st2, 400, 210, "رسم قراءة الـ micron مع الزمن على مقياس لوغاريتمي");
      const ctl = H("div", { class: "acv-sims-row" }, root);
      const bP = btn(ctl, "▶ شغّل المضخة", "acv-sims-primary", startPump);
      const bI = btn(ctl, "أغلق الصمام وأطفئ المضخة (Decay test)", "", isolate);
      btn(ctl, "↺ من جديد", "", reset);
      const rd = readouts(root, [["m", "Micron"], ["t", "الزمن"], ["ph", "المرحلة"]]);
      const inf = info(root);
      // schematic
      const hose = S("path", { d: "M118 96 H150 M178 96 H228 M300 96 H322", class: "acv-sims-vhose" }, svg);
      const flow = S("path", { d: "M322 96 H300 M228 96 H178 M150 96 H118", class: "acv-sims-vflow" }, svg);
      // pump
      S("rect", { x: 10, y: 66, width: 108, height: 60, rx: 10, class: "acv-sims-pump" }, svg);
      S("rect", { x: 22, y: 50, width: 46, height: 18, rx: 4, class: "acv-sims-pumpm" }, svg);
      S("path", { d: "M30 50 V40 H96 V66", class: "acv-sims-handle" }, svg);
      const fan = S("g", { class: "acv-sims-fan" }, svg);
      fan.style.transformOrigin = "88px 96px";
      S("circle", { cx: 88, cy: 96, r: 18, class: "acv-sims-fanc" }, svg);
      [0, 120, 240].forEach((a) => S("path", { d: "M88 96 q6 -14 0 -16 q-6 2 0 16", class: "acv-sims-blade", transform: `rotate(${a} 88 96)` }, fan));
      svg.appendChild(fan);
      S("rect", { x: 22, y: 82, width: 40, height: 30, rx: 4, class: "acv-sims-sight" }, svg);
      const oilT = T(svg, 42, 101, "OIL", "acv-sims-jl");
      T(svg, 64, 144, "Vacuum pump", "acv-sims-lab3");
      // valve
      S("rect", { x: 150, y: 86, width: 28, height: 20, rx: 4, class: "acv-sims-brass" }, svg);
      const lever = S("rect", { x: 162, y: 58, width: 5, height: 30, rx: 2, class: "acv-sims-lever" }, svg);
      lever.style.transformOrigin = "164.5px 88px";
      const vl = T(svg, 164, 126, "مفتوح", "acv-sims-lab3");
      // micron gauge
      S("rect", { x: 228, y: 58, width: 72, height: 62, rx: 10, class: "acv-sims-mgauge" }, svg);
      S("rect", { x: 234, y: 66, width: 60, height: 30, rx: 4, class: "acv-sims-lcd" }, svg);
      const mlcd = T(svg, 288, 88, "760000", "acv-sims-lcdm", "r");
      T(svg, 264, 112, "MICRON", "acv-sims-jl");
      // system
      S("rect", { x: 322, y: 50, width: 70, height: 80, rx: 6, class: "acv-sims-unit" }, svg);
      S("circle", { cx: 357, cy: 90, r: 26, class: "acv-sims-grille" }, svg);
      S("circle", { cx: 357, cy: 90, r: 14, class: "acv-sims-grille" }, svg);
      T(svg, 357, 144, "النظام", "acv-sims-lab3");
      // graph
      const GX0 = 44, GX1 = 392, GY0 = 10, GY1 = 178, TMAX = 60;
      const gx = (t) => GX0 + (t / TMAX) * (GX1 - GX0);
      const gy = (m) => GY1 - ((Math.log10(clamp(m, 100, 1e6)) - 2) / 4) * (GY1 - GY0);
      S("rect", { x: GX0, y: GY0, width: GX1 - GX0, height: GY1 - GY0, class: "acv-sims-plotbg" }, gsv);
      [[100, "100"], [1e4, "10k"], [1e5, "100k"], [760000, "ATM"]].forEach(([m, l]) => { S("line", { x1: GX0, x2: GX1, y1: gy(m), y2: gy(m), class: "acv-sims-grid" }, gsv); T(gsv, GX0 - 4, gy(m) + 4, l, "acv-sims-ax", "r"); });
      S("line", { x1: GX0, x2: GX1, y1: gy(500), y2: gy(500), class: "acv-sims-lim-ok" }, gsv); T(gsv, GX0 - 4, gy(500) + 5, "500", "acv-sims-ax acv-sims-ax-ok", "r");
      S("line", { x1: GX0, x2: GX1, y1: gy(1000), y2: gy(1000), class: "acv-sims-lim-w" }, gsv); T(gsv, GX0 - 4, gy(1000) - 1, "1000", "acv-sims-ax acv-sims-ax-w", "r");
      for (let t = 0; t <= TMAX; t += 10) T(gsv, gx(t), GY1 + 16, String(t), "acv-sims-ax");
      T(gsv, GX1 - 2, GY1 + 30, "min", "acv-sims-ax", "r");
      const lineP = S("polyline", { points: "", class: "acv-sims-vline-p" }, gsv);
      const lineD = S("polyline", { points: "", class: "acv-sims-vline-d" }, gsv);
      const dot = S("circle", { r: 5, class: "acv-sims-dot" }, gsv);
      const isoLine = S("line", { y1: GY0, y2: GY1, class: "acv-sims-isoline" }, gsv);

      const L0 = Math.log10(760000);
      const curve = {
        good: (t) => 2.35 + (L0 - 2.35) * Math.exp(-t / 6),
        leak: (t) => 2.78 + (L0 - 2.78) * Math.exp(-t / 6),
        moisture: (t) => Math.max(2.42 + (L0 - 2.42) * Math.exp(-t / 6), Math.log10(1900) - 0.021 * Math.max(0, t - 14)),
      };
      const decay = {
        good: (m0, d) => m0 + 330 * (1 - Math.exp(-d / 3)),
        leak: (m0, d) => m0 + 320 * d,
        moisture: (m0, d) => m0 + Math.max(2300 - m0, 150) * (1 - Math.exp(-d / 3.2)),
      };
      const SPEED = 6, PUMPMAX = 45, DECAY = 15;
      let ph, t, tIso, mIso, m, ptsP, ptsD, acc;
      const L = loop(host, step);
      function micron() { return ph === "decay" || ph === "done" ? decay[scn](mIso, t - tIso) : Math.pow(10, curve[scn](t)); }
      function fmtMic(v) { return v >= 100000 ? Math.round(v / 1000) + "k" : String(Math.round(v)); }
      function draw() {
        m = micron();
        mlcd.textContent = fmtMic(m);
        rd.m.textContent = Math.round(m).toLocaleString("en-US"); rd.t.textContent = f(t, 1) + " min";
        rd.ph.textContent = { idle: "جاهز", pump: "سحب", decay: "Decay test", done: "انتهى" }[ph];
        rd.tone("m", m <= 500 ? "ok" : m <= 1000 ? "warn" : "");
        lineP.setAttribute("points", ptsP.join(" ")); lineD.setAttribute("points", ptsD.join(" "));
        dot.setAttribute("cx", gx(t)); dot.setAttribute("cy", gy(m));
        const pumping = ph === "pump";
        fan.classList.toggle("acv-sims-spin", pumping && !reduce());
        flow.classList.toggle("acv-sims-flowon", pumping && !reduce());
        lever.style.transform = ph === "decay" || ph === "done" ? "rotate(90deg)" : "";
        vl.textContent = ph === "decay" || ph === "done" ? "مغلق" : "مفتوح";
        isoLine.style.display = tIso != null ? "" : "none"; if (tIso != null) { isoLine.setAttribute("x1", gx(tIso)); isoLine.setAttribute("x2", gx(tIso)); }
        bP.disabled = ph !== "idle"; bI.disabled = ph !== "pump";
      }
      function push() { const pt = `${gx(t).toFixed(1)},${gy(micron()).toFixed(1)}`; (ph === "pump" ? ptsP : ptsD).push(pt); }
      function reset() {
        L.stop(); ph = "idle"; t = 0; tIso = null; mIso = null; ptsP = []; ptsD = []; acc = 0; draw();
        inf.set("الهدف: نزول تحت <b>500 micron</b>، ثم أغلق الصمام بين المضخة والنظام وراقب 10–15 دقيقة: يجب أن <b>يثبت تحت 1000</b>. ساعة الـ micron تُركّب على النظام وليس على المضخة.", "info");
        oilT.textContent = "OIL";
      }
      function startPump() {
        if (ph !== "idle") return; ph = "pump"; push();
        inf.set("المضخة تسحب… راقب الرسم: الهبوط سريع في البداية ثم يبطئ. استعمل hoses قصيرة وواسعة وانزع الـ Schrader cores لتسريع السحب.", "info");
        if (reduce()) { t = 35; ptsP = []; for (let x = 0; x <= 35; x += 0.5) ptsP.push(`${gx(x).toFixed(1)},${gy(Math.pow(10, curve[scn](x))).toFixed(1)}`); draw(); pumpMsg(); return; }
        L.start();
      }
      function pumpMsg() {
        const mm = micron();
        inf.set(mm <= 500 ? `وصلت ${Math.round(mm)} micron ✓ — الآن أغلق الصمام لبدء الـ decay test.` : `القراءة ${Math.round(mm)} micron ${scn === "moisture" ? "— تبطئ وتتوقف تقريباً (الرطوبة تتبخر ببطء)" : "— لا تنزل تحت 500"}. يمكنك الاستمرار أو إجراء الـ decay test لمعرفة السبب.`, mm <= 500 ? "ok" : "warn");
      }
      function isolate() {
        if (ph !== "pump") return; L.stop(); mIso = micron(); ph = "decay"; tIso = t; ptsD = [`${gx(t).toFixed(1)},${gy(mIso).toFixed(1)}`];
        inf.set("الصمام مغلق والمضخة مطفأة — راقب ارتفاع القراءة…", "info");
        if (reduce()) { for (let d = 0.5; d <= DECAY; d += 0.5) { t = tIso + d; push(); } t = tIso + DECAY; ph = "done"; draw(); verdict(); return; }
        L.start();
      }
      function step(dt) {
        const d = dt * SPEED; t += d; acc += d;
        if (ph === "pump") {
          if (t >= PUMPMAX) { t = PUMPMAX; push(); draw(); pumpMsg(); return false; }
          if (acc >= 0.3) { acc = 0; push(); }
          if (Math.abs(t - 25) < d) pumpMsg();
        } else if (ph === "decay") {
          if (t - tIso >= DECAY) { t = tIso + DECAY; push(); ph = "done"; draw(); verdict(); return false; }
          if (acc >= 0.3) { acc = 0; push(); }
        }
        draw();
      }
      function verdict() {
        const mEnd = decay[scn](mIso, DECAY), m10 = decay[scn](mIso, DECAY - 5);
        const slope = (mEnd - m10) / 5; let msg, tone;
        const pre = mIso > 500 ? `⚠ عزلت عند ${Math.round(mIso)} micron (فوق 500) — الهدف لم يتحقق. ` : "";
        if (mEnd < 1000 && slope < 30) { msg = `${pre}✓ <b>ناجح</b>: ارتفعت إلى ${Math.round(mEnd)} وثبتت تحت 1000. النظام جاف ومحكم — افتح الصمامات وأدخل الغاز.`; tone = mIso > 500 ? "warn" : "ok"; }
        else if (slope >= 100) { msg = `${pre}✗ <b>تسريب</b>: القراءة ترتفع بشكل مستمر (${Math.round(slope)} micron/min) بدون ما تثبت حتى ${Math.round(mEnd)}. ابحث عن التسريب بالنيتروجين والفقاعات، صلّح، ثم أعد الـ vacuum.`; tone = "bad"; }
        else { msg = `${pre}✗ <b>رطوبة</b>: ارتفعت ثم <b>ثبتت</b> حوالي ${Math.round(mEnd)} micron (فوق 1000). كمّل سحب لفترة أطول، دفّئ الأنابيب، اعمل <b>triple evacuation</b> مع كسر بالنيتروجين، وبدّل الـ Filter drier. غيّر زيت المضخة إذا كان عكر.`; tone = "bad"; }
        inf.set(msg, tone);
      }
      reset();
    },
  });

  /* =====================================================================
     7) pressure_test — nitrogen hold test with temperature compensation
     ===================================================================== */
  ACV.register("pressure_test", {
    title: "اختبار الضغط بالنيتروجين",
    params: 'ps: ضغط اللوحة PS bar (41.5); p: ضغط الاختبار bar(g); t0, t1: حرارة البداية/النهاية °C; hours: 1|6|24; scenario: "tight" | "small" | "leak" | "random"',
    demo: [{ ps: 41.5, p: 38, t0: 32, t1: 22, hours: 24, scenario: "tight" }, { ps: 41.5, p: 30, t0: 20, t1: 26, hours: 24, scenario: "small" }],
    render(host, p) {
      let PS = +p.ps > 0 ? +p.ps : 41.5;
      let P0 = +p.p > 0 ? +p.p : Math.min(30, PS);
      let T0 = Number.isFinite(+p.t0) && p.t0 != null ? +p.t0 : 30, T1 = Number.isFinite(+p.t1) && p.t1 != null ? +p.t1 : 22;
      let HRS = [1, 6, 24].includes(+p.hours) ? +p.hours : 24;
      const fixed = ["tight", "small", "leak"].includes(p.scenario) ? p.scenario : null;
      let scn = fixed || "tight";
      const root = shell(host, "acv-sims-pt2");
      const grid = H("div", { class: "acv-sims-grid2" }, root);
      const sPS = slider(grid, { label: "PS على لوحة الجهاز", min: 10, max: 50, step: 0.5, value: PS, fmt: (v) => f(v, 1) + " bar", onInput: (v) => { PS = v; reset(); } });
      const sP = slider(grid, { label: "ضغط الاختبار", tone: "hi", min: 5, max: 50, step: 0.5, value: P0, fmt: (v) => f(v, 1) + " bar", onInput: (v) => { P0 = v; reset(); } });
      const sT0 = slider(grid, { label: "الحرارة عند البداية", min: 5, max: 45, step: 1, value: T0, fmt: (v) => v + " °C", onInput: (v) => { T0 = v; reset(); } });
      const sT1 = slider(grid, { label: "الحرارة عند النهاية", min: 5, max: 45, step: 1, value: T1, fmt: (v) => v + " °C", onInput: (v) => { T1 = v; reset(); } });
      chips(root, [[1, "ساعة"], [6, "6 ساعات"], [24, "24 ساعة"]], HRS, (x) => { HRS = x; reset(); }, "مدة الاختبار");
      const st = stage(root);
      const svg = mkSvg(st, 400, 250, "قنينة نيتروجين مع منظّم وساعة ضغط موصولة على النظام وميزان حرارة");
      const st2 = stage(root);
      const gsv = mkSvg(st2, 400, 170, "رسم الضغط مع الزمن");
      const ctl = H("div", { class: "acv-sims-row" }, root);
      const bS = btn(ctl, "▶ ابدأ الاختبار", "acv-sims-primary", start);
      if (!fixed) btn(ctl, "🎲 حالة جديدة", "", () => { random(); reset(); });
      const dec = H("div", { class: "acv-sims-row acv-sims-dec" }, root);
      const bOk = btn(dec, "✓ ناجح — لا تسريب", "acv-sims-okbtn", () => decide(true));
      const bNo = btn(dec, "✗ فيه تسريب", "acv-sims-badbtn", () => decide(false));
      const rd = readouts(root, [["p0", "P البداية"], ["p1", "P الآن"], ["tt", "الحرارة"], ["h", "الزمن"]]);
      const inf = info(root);
      // scene
      S("rect", { x: 18, y: 70, width: 44, height: 160, rx: 20, class: "acv-sims-n2" }, svg);
      S("rect", { x: 18, y: 92, width: 44, height: 12, class: "acv-sims-n2band" }, svg);
      T(svg, 40, 178, "N₂", "acv-sims-n2t");
      S("rect", { x: 34, y: 52, width: 12, height: 20, class: "acv-sims-brass" }, svg);
      S("rect", { x: 26, y: 34, width: 44, height: 22, rx: 6, class: "acv-sims-brass" }, svg);
      S("circle", { cx: 34, cy: 24, r: 11, class: "acv-sims-mini" }, svg); S("circle", { cx: 62, cy: 24, r: 11, class: "acv-sims-mini" }, svg);
      S("line", { x1: 34, y1: 24, x2: 39, y2: 17, class: "acv-sims-mini-n" }, svg); S("line", { x1: 62, y1: 24, x2: 66, y2: 31, class: "acv-sims-mini-n" }, svg);
      T(svg, 48, 246, "Regulator", "acv-sims-ax");
      S("path", { d: "M70 45 C110 45 110 120 140 120", class: "acv-sims-hose acv-sims-hose-y" }, svg);
      S("path", { d: "M290 120 C320 120 320 120 330 120", class: "acv-sims-hose acv-sims-hose-hi" }, svg);
      S("rect", { x: 330, y: 60, width: 62, height: 110, rx: 6, class: "acv-sims-unit" }, svg);
      S("circle", { cx: 361, cy: 110, r: 22, class: "acv-sims-grille" }, svg);
      T(svg, 361, 186, "النظام", "acv-sims-lab3");
      // thermometer
      S("rect", { x: 352, y: 196, width: 18, height: 42, rx: 9, class: "acv-sims-thermo" }, svg);
      const merc = S("rect", { x: 358, width: 6, rx: 3, class: "acv-sims-merc" }, svg);
      S("circle", { cx: 361, cy: 238, r: 7, class: "acv-sims-bulb" }, svg);
      const tLab = T(svg, 340, 224, "", "acv-sims-lab3", "r");
      const G = gauge(svg, { cx: 215, cy: 120, r: 82, min: 0, max: 60, major: 10, minor: 2, tone: "hi", unit: "bar", title: "N₂", lcd: true, redFrom: PS });
      let gRed = G;
      // graph
      const X0 = 40, X1 = 392, Y0 = 10, Y1 = 140;
      const plotBg = S("g", {}, gsv);
      const lineE = S("polyline", { class: "acv-sims-pexp" }, gsv);
      const lineM = S("polyline", { class: "acv-sims-pmeas" }, gsv);
      const dot = S("circle", { r: 5, class: "acv-sims-dot" }, gsv);
      const L = loop(host, step);
      let h, pts, ptsE, decided, rate;
      function random() {
        scn = ["tight", "tight", "small", "leak"][Math.floor(Math.random() * 4)];
        T0 = 18 + Math.round(Math.random() * 16); T1 = T0 + Math.round((Math.random() - 0.6) * 16);
        T1 = clamp(T1, 8, 42); sT0.set(T0); sT1.set(T1);
      }
      const Tat = (hh) => T0 + (T1 - T0) * (0.5 - 0.5 * Math.cos((Math.PI * hh) / HRS));
      const pExp = (hh) => (P0 + ATM) * (Tat(hh) + 273.15) / (T0 + 273.15) - ATM;
      const pMeas = (hh) => pExp(hh) - rate * hh;
      let ymin, ymax;
      const gx = (hh) => X0 + (hh / HRS) * (X1 - X0), gy = (v) => Y1 - ((v - ymin) / (ymax - ymin)) * (Y1 - Y0);
      function frame() {
        plotBg.innerHTML = "";
        const all = []; for (let i = 0; i <= 20; i++) { all.push(pExp((i / 20) * HRS), pMeas((i / 20) * HRS)); }
        ymin = Math.floor(Math.min(...all) - 0.5); ymax = Math.ceil(Math.max(...all) + 0.5);
        S("rect", { x: X0, y: Y0, width: X1 - X0, height: Y1 - Y0, class: "acv-sims-plotbg" }, plotBg);
        const st_ = ymax - ymin > 6 ? 2 : 1;
        for (let v = ymin; v <= ymax; v += st_) { S("line", { x1: X0, x2: X1, y1: gy(v), y2: gy(v), class: "acv-sims-grid" }, plotBg); T(plotBg, X0 - 4, gy(v) + 4, String(v), "acv-sims-ax", "r"); }
        for (let i = 0; i <= 4; i++) T(plotBg, gx((i / 4) * HRS), Y1 + 16, String(+((i / 4) * HRS).toFixed(1)), "acv-sims-ax");
        T(plotBg, X1 - 2, Y1 + 29, "h", "acv-sims-ax", "r");
        T(plotBg, X0 + 4, Y0 + 14, "bar(g)", "acv-sims-ax", "l");
      }
      function draw() {
        const pm = pMeas(h), tn = Tat(h);
        const shown = Math.round(pm * 10) / 10;
        G.set(shown, f(shown, 1));
        rd.p0.textContent = f(P0, 1) + " bar"; rd.p1.textContent = f(shown, 1) + " bar";
        rd.tt.textContent = f(tn, 0) + " °C"; rd.h.textContent = f(h, 1) + " h";
        const fr = clamp((tn - 0) / 50, 0, 1); merc.setAttribute("y", 234 - fr * 34); merc.setAttribute("height", 6 + fr * 34);
        tLab.textContent = f(tn, 0) + "°C";
        lineM.setAttribute("points", pts.join(" "));
        lineE.setAttribute("points", decided ? ptsE.join(" ") : "");
        dot.setAttribute("cx", gx(h)); dot.setAttribute("cy", gy(pm));
      }
      function reset() {
        L.stop(); h = 0; decided = false;
        rate = { tight: 0, small: 0.03 * 24 / HRS * (P0 / 38), leak: 0.15 * 24 / HRS * (P0 / 38) }[scn] * (HRS === 24 ? 1 : 0.6);
        pts = [`${gx(0)},${0}`]; ptsE = [];
        frame(); pts = [`${gx(0).toFixed(1)},${gy(P0).toFixed(1)}`];
        dec.style.display = "none";
        G.setRed(PS);
        const over = P0 > PS;
        bS.disabled = over;
        if (over) { inf.set(`⛔ <b>ممنوع</b>: ضغط الاختبار ${f(P0, 1)} bar أعلى من PS المكتوب على اللوحة (${f(PS, 1)} bar). خطر انفجار أو تلف — خفّض الضغط. استعمل دائماً regulator ولا توصل القنينة مباشرة.`, "bad"); }
        else if (P0 < 10) inf.set(`ضغط ${f(P0, 1)} bar منخفض لكشف التسريبات الصغيرة. للمكيفات غالباً 30–41.5 bar حسب الـ PS والـ manual (لا تتجاوز PS).`, "warn");
        else inf.set(`عبّئ النيتروجين ببطء حتى ${f(P0, 1)} bar (≤ PS = ${f(PS, 1)}). انتظر دقائق حتى تستقر الحرارة، ثم سجّل الضغط والحرارة وابدأ العدّ.`, "info");
        draw();
      }
      function step(dt) {
        h = Math.min(HRS, h + (dt * HRS) / 5);
        pts.push(`${gx(h).toFixed(1)},${gy(pMeas(h)).toFixed(1)}`);
        draw();
        if (h >= HRS) { end(); return false; }
      }
      function start() {
        if (P0 > PS) return; reset(); bS.disabled = true;
        if (reduce()) { for (let i = 1; i <= 40; i++) { h = (i / 40) * HRS; pts.push(`${gx(h).toFixed(1)},${gy(pMeas(h)).toFixed(1)}`); } draw(); end(); return; }
        L.start();
      }
      function end() {
        bS.disabled = false; dec.style.display = "";
        const pm = Math.round(pMeas(HRS) * 10) / 10;
        inf.set(`انتهت ${HRS} ساعة: الضغط ${f(P0, 1)} → ${f(pm, 1)} bar، والحرارة ${T0} → ${T1} °C. صحّح للحرارة: P_abs ∝ T_abs → P المتوقع = (P₀ + 1.013) × (T₁ + 273) / (T₀ + 273) − 1.013. ثم قرّر:`, "info");
        bOk.focus && 0;
      }
      function decide(pass) {
        decided = true;
        for (let i = 0; i <= 40; i++) { const hh = (i / 40) * HRS; ptsE.push(`${gx(hh).toFixed(1)},${gy(pExp(hh)).toFixed(1)}`); }
        draw();
        const pe = pExp(HRS), pm = Math.round(pMeas(HRS) * 10) / 10, diff = pm - pe;
        const isTight = Math.abs(diff) <= 0.2;
        const right = pass === isTight;
        const tdrop = pe - P0;
        let msg = `${right ? "✓ صح" : "✗ خطأ"} — المتوقع من الحرارة فقط: <b>${f(pe, 2)} bar</b> (${sg(tdrop, 2)} بسبب الحرارة)، المقاس: <b>${f(pm, 1)} bar</b> → الفرق ${sg(diff, 2)} bar. `;
        msg += isTight ? "الفرق ضمن دقة الساعة: <b>لا يوجد تسريب</b> — تغيّر الضغط سببه الحرارة فقط." : "الضغط نزل أكثر مما تفسّره الحرارة: <b>يوجد تسريب</b> — افحص الوصلات (flare، لحام، Schrader) بالرغوة.";
        inf.set(msg + ' <span class="acv-sims-note">الخط المتقطع = الضغط المتوقع من الحرارة.</span>', right ? "ok" : "bad");
      }
      if (!fixed && p.scenario === "random") random();
      reset();
      void gRed; void sPS; void sP;
    },
  });

  /* =====================================================================
     8) scale — charging by weight
     ===================================================================== */
  const SC_DEF = { R600a: 55, R290: 120, R134a: 150, R32: 650, R410A: 1100, R404A: 900, R22: 900, R407C: 1000 };
  ACV.register("scale", {
    title: "الشحن بالوزن (ميزان الفريون)",
    params: 'ref: "R600a" | "R290" | "R134a" | "R32" | "R410A" | "R404A"; charge: شحنة اللوحة بالغرام; refs: قائمة',
    demo: [{ ref: "R600a", charge: 48 }, { ref: "R32", charge: 750 }],
    render(host, p, ctx) {
      const tb = PT(ctx);
      let names = (Array.isArray(p.refs) ? p.refs : ["R600a", "R290", "R134a", "R32", "R410A", "R404A"]).filter((n) => SC_DEF[n] || tb[n]);
      if (!names.length) names = ["R600a", "R134a", "R32", "R410A"];
      let ref = names.includes(p.ref) ? p.ref : SC_DEF[p.ref] ? p.ref : names[0];
      if (!names.includes(ref)) names.unshift(ref);
      let charge = +p.charge > 0 ? Math.round(+p.charge) : SC_DEF[ref] || 500;
      let gross, tare, added, pulse = "m", open = false;
      const root = shell(host, "acv-sims-scale");
      chips(root, names, ref, (x) => { ref = x; charge = SC_DEF[x] || 500; inC.value = charge; reset(); }, "الغاز");
      const cr = H("label", { class: "acv-sims-in acv-sims-in1" }, root);
      H("span", {}, cr, "الشحنة على اللوحة (g)");
      const inC = H("input", { type: "number", inputmode: "numeric", min: "5", max: "20000", step: "1", value: charge, dir: "ltr" }, cr);
      inC.addEventListener("change", () => { const v = Math.round(+inC.value); if (v >= 5) { charge = Math.min(v, 20000); reset(); } else inC.value = charge; });
      const st = stage(root);
      const svg = mkSvg(st, 400, 250, "ميزان شحن فريون عليه قنينة موصولة بالجهاز");
      const ctl = H("div", { class: "acv-sims-row" }, root);
      const bZ = btn(ctl, "ZERO / TARE", "", () => { tare = gross; update("zero"); });
      const bO = btn(ctl, "افتح الصمام (نبضة)", "acv-sims-primary", pulseIn);
      btn(ctl, "↺", "", reset, "من جديد");
      const pc = chips(root, [["l", "نبضة كبيرة"], ["m", "متوسطة"], ["s", "صغيرة"]], pulse, (x) => { pulse = x; }, "حجم النبضة");
      const prog = H("div", { class: "acv-sims-prog" }, root);
      const pf = H("div", { class: "acv-sims-progf" }, prog); const pz = H("div", { class: "acv-sims-progz" }, prog);
      const rd = readouts(root, [["a", "انشحن"], ["r", "الباقي"], ["pct", "%"]]);
      const inf = info(root);
      // scene
      const hose = S("path", { d: "M180 56 C180 20 260 20 300 60", class: "acv-sims-hose acv-sims-hose-y" }, svg);
      const flow = S("path", { d: "M180 56 C180 20 260 20 300 60", class: "acv-sims-sflow" }, svg);
      S("rect", { x: 290, y: 58, width: 102, height: 110, rx: 8, class: "acv-sims-unit" }, svg);
      T(svg, 341, 96, "الجهاز", "acv-sims-lab2");
      const sysT = T(svg, 341, 126, "", "acv-sims-lcdt");
      S("rect", { x: 90, y: 196, width: 180, height: 26, rx: 6, class: "acv-sims-platform" }, svg);
      S("rect", { x: 80, y: 220, width: 200, height: 16, rx: 5, class: "acv-sims-scalebase" }, svg);
      const cyl = S("g", {}, svg);
      const cylBody = S("rect", { x: 140, y: 80, width: 80, height: 116, rx: 22, class: "acv-sims-cyl" }, cyl);
      const band = S("rect", { x: 140, y: 112, width: 80, height: 16, class: "acv-sims-cylband" }, cyl);
      const cylT = T(cyl, 180, 158, ref, "acv-sims-cylt");
      S("rect", { x: 170, y: 62, width: 20, height: 20, rx: 3, class: "acv-sims-brass" }, cyl);
      const valve = S("rect", { x: 160, y: 52, width: 40, height: 10, rx: 4, class: "acv-sims-vhandle" }, cyl);
      valve.style.transformOrigin = "180px 57px";
      // display pod
      S("path", { d: "M270 228 C310 236 330 236 340 226", class: "acv-sims-wire" }, svg);
      S("rect", { x: 300, y: 176, width: 92, height: 64, rx: 10, class: "acv-sims-mgauge" }, svg);
      S("rect", { x: 306, y: 182, width: 80, height: 34, rx: 4, class: "acv-sims-lcd" }, svg);
      const lcd = T(svg, 380, 206, "", "acv-sims-lcdm", "r");
      const lmode = T(svg, 346, 232, "", "acv-sims-jl");
      const warnG = S("g", {}, svg);
      function reset() {
        open = false; added = 0; tare = null;
        const can = charge <= 300 ? 420 : charge <= 2000 ? 11300 : 13600;
        gross = can + (charge <= 300 ? 180 : 4200);
        cylT.textContent = ref;
        const small = charge <= 300;
        cylBody.setAttribute("y", small ? 120 : 80); cylBody.setAttribute("height", small ? 76 : 116);
        cylBody.setAttribute("x", small ? 152 : 140); cylBody.setAttribute("width", small ? 56 : 80);
        band.setAttribute("y", small ? 136 : 112); band.setAttribute("x", small ? 152 : 140); band.setAttribute("width", small ? 56 : 80);
        cylT.setAttribute("y", small ? 176 : 158);
        cyl.querySelector(".acv-sims-brass").setAttribute("y", small ? 102 : 62);
        valve.setAttribute("y", small ? 92 : 52); valve.style.transformOrigin = `180px ${small ? 97 : 57}px`;
        hose.setAttribute("d", `M180 ${small ? 96 : 56} C180 20 260 20 300 60`); flow.setAttribute("d", hose.getAttribute("d"));
        band.setAttribute("class", "acv-sims-cylband" + (/A3/.test(cls()) ? " acv-sims-flam" : /A2L/.test(cls()) ? " acv-sims-a2l" : ""));
        warnG.innerHTML = "";
        if (/A3|A2L/.test(cls())) {
          S("path", { d: "M26 70 L50 112 H2 Z", class: "acv-sims-flamtri" }, warnG);
          S("path", { d: "M26 84 c6 8 8 12 4 18 c-2 3 -6 3 -8 0 c-3 -4 0 -8 4 -18z", class: "acv-sims-flamico" }, warnG);
          T(warnG, 26, 132, cls().startsWith("A3") ? "A3" : "A2L", "acv-sims-flaml");
        }
        update();
      }
      function cls() { const r = tb[ref]; return (r && r.cls) || (FB[ref] && FB[ref].cls) || "A1"; }
      function tol() { return charge <= 200 ? (charge <= 80 ? 1 : 2) : Math.max(5, Math.round(charge * 0.01)); }
      function pulseIn() {
        if (tare == null) { update("notare"); return; }
        const base = { l: Math.max(5, charge * 0.12), m: Math.max(2, charge * 0.035), s: charge <= 300 ? 1 : Math.max(2, charge * 0.008) }[pulse];
        const g = Math.max(0.5, base * (0.75 + Math.random() * 0.5));
        added += g; gross -= g; open = true;
        valve.style.transform = "rotate(-35deg)";
        flow.classList.remove("acv-sims-flowon"); void flow.getBBox(); if (!reduce()) flow.classList.add("acv-sims-flowon");
        clearTimeout(host._sc); host._sc = setTimeout(() => { valve.style.transform = ""; open = false; }, 450);
        update();
      }
      function update(ev) {
        const disp = tare == null ? gross : -(tare - gross);
        lcd.textContent = tare == null ? (gross >= 1000 ? (gross / 1000).toFixed(3) + " kg" : Math.round(gross) + " g") : Math.round(disp) + " g";
        lmode.textContent = tare == null ? "WEIGH" : "CHARGE";
        const a = Math.round(added), r = charge - a, t = tol();
        rd.a.textContent = a + " g"; rd.r.textContent = r + " g"; rd.pct.textContent = f((a / charge) * 100, 0) + "%";
        sysT.textContent = a + " / " + charge + " g";
        pf.style.width = clamp((a / (charge * 1.15)) * 100, 0, 100) + "%";
        pz.style.left = ((charge - t) / (charge * 1.15)) * 100 + "%"; pz.style.width = ((2 * t) / (charge * 1.15)) * 100 + "%";
        pf.dataset.tone = a > charge + t ? "bad" : a >= charge - t ? "ok" : "";
        bZ.disabled = tare != null && added > 0;
        bO.disabled = a > charge + t;
        let msg, tone = "info";
        const A3 = /A3/.test(cls()), A2L = /A2L/.test(cls());
        const blend = (tb[ref] && tb[ref].blend) || (FB[ref] && FB[ref].blend);
        if (ev === "notare") { msg = "⚠ اضغط <b>ZERO / TARE</b> أولاً والقنينة على الميزان والـ hose مركّب — وإلا لن تعرف كم دخل."; tone = "warn"; }
        else if (tare == null) msg = `الشحنة المطلوبة <b>${charge} g</b> (من لوحة الجهاز). ضع القنينة على الميزان، ركّب الـ hose واطرد الهواء منه، ثم اضغط ZERO.`;
        else if (a === 0) msg = "الميزان على 0 ✓. افتح الصمام بنبضات — الرقم السالب = الكمية التي خرجت من القنينة.";
        else if (a > charge + t) { msg = `✗ <b>تجاوزت الشحنة</b> بـ ${a - charge} g. لا تطلق الغاز في الهواء — اسحب الزائد بالـ <b>recovery</b>${A3 ? " (في مكان مهوّى، بعيداً عن الشرر)" : ""}، أو فرّغ وأعد الشحن.`; tone = "bad"; }
        else if (a >= charge - t) { msg = `✓ <b>وصلت</b> ${a} g من ${charge} g (ضمن ±${t} g). أغلق الصمام وافصل الـ hose.`; tone = "ok"; }
        else if (r <= charge * 0.15) { msg = `اقتربت — باقي <b>${r} g</b>. انتقل للنبضات <b>الصغيرة</b>.`; tone = "warn"; if (pulse === "l") { pulse = "s"; pc.set("s"); } }
        else msg = `انشحن ${a} g — باقي ${r} g.`;
        let extra = "";
        if (charge <= 150) extra += ` شحنة صغيرة: كل 1–2 g مهم (${f((2 / charge) * 100, 0)}% من الشحنة عند 2 g) — استعمل ميزان دقته 1 g أو أفضل.`;
        if (A3) extra += " ⚠ A3 قابل للاشتعال: تهوية، لا شرارة ولا لحام والغاز داخل الدورة، اسحب الغاز وانفخ نيتروجين قبل أي لحام.";
        else if (A2L) extra += " ⚠ R32 (A2L) ضعيف الاشتعال: تهوية جيدة.";
        if (blend) extra += " غاز blend: اشحن <b>سائل</b> (القنينة مقلوبة أو بأنبوب سائل) ببطء من الـ low side.";
        inf.set(msg + (extra ? `<span class="acv-sims-note">${extra}</span>` : ""), tone);
      }
      reset();
    },
  });

  /* =====================================================================
     9) ntc — thermistor curve + check
     ===================================================================== */
  ACV.register("ntc", {
    title: "حساس الحرارة NTC",
    params: "r25: 5|10|15|20|50 kΩ (افتراضي 10); b: قيمة B (3950); t: حرارة البداية °C",
    demo: [{ r25: 10, b: 3950, t: 25 }, { r25: 5, b: 3435, t: 0 }],
    render(host, p) {
      let r25 = [5, 10, 15, 20, 50].includes(+p.r25) ? +p.r25 : 10;
      let B = +p.b > 1000 && +p.b < 6000 ? +p.b : 3950;
      let t = Number.isFinite(+p.t) && p.t != null ? clamp(+p.t, -30, 100) : 25;
      const Rk = (T, rr = r25, bb = B) => rr * Math.exp(bb * (1 / (T + 273.15) - 1 / 298.15)); // kΩ
      const root = shell(host, "acv-sims-ntc");
      chips(root, [5, 10, 15, 20, 50].map((x) => [x, x + " kΩ"]), r25, (x) => { r25 = x; draw(); }, "R25");
      const bl = [3435, 3950, 4100]; if (!bl.includes(B)) bl.push(B);
      chips(root, bl.map((x) => [x, "B " + x]), B, (x) => { B = x; draw(); }, "قيمة B");
      const st = stage(root);
      const svg = mkSvg(st, 400, 340, "حساس NTC موصول بملتيميتر ومنحنى المقاومة مع الحرارة");
      const sl = slider(root, { label: "حرارة الحساس", min: -30, max: 100, step: 0.5, value: t, fmt: (v) => f(v, 1) + " °C", onInput: (v) => { t = v; update(); } });
      const rd = readouts(root, [["t", "الحرارة"], ["r", "المقاومة"]]);
      const inf = info(root);
      // check mode
      const ck = H("div", { class: "acv-sims-calc" }, root);
      H("div", { class: "acv-sims-qh" }, ck, "افحص حساس: أدخل الحرارة المعروفة والقراءة");
      const row = H("div", { class: "acv-sims-calcrow" }, ck);
      const mk = (lab, val, ph) => { const w = H("label", { class: "acv-sims-in" }, row); H("span", {}, w, lab); const i = H("input", { type: "text", inputmode: "decimal", value: val, placeholder: ph, dir: "ltr" }, w); return i; };
      const iT = mk("الحرارة المعروفة (°C)", "25", "25");
      const iR = mk("القراءة (kΩ) أو OL", "", "9.8");
      btn(ck, "تحقّق", "acv-sims-primary", check);
      const cOut = H("div", { class: "acv-sims-info", "aria-live": "polite" }, ck); cOut.style.display = "none";
      // illustration
      S("rect", { x: 6, y: 30, width: 168, height: 26, rx: 13, class: "acv-sims-pipe-cu" }, svg);
      S("path", { d: "M70 24 h56 v38 h-56 z", class: "acv-sims-clip" }, svg);
      S("ellipse", { cx: 98, cy: 43, rx: 16, ry: 11, class: "acv-sims-bead" }, svg);
      S("path", { d: "M94 54 C94 96 160 104 196 100 M102 54 C104 90 164 112 196 108", class: "acv-sims-ntcw" }, svg);
      S("rect", { x: 192, y: 94, width: 24, height: 20, rx: 3, class: "acv-sims-plug" }, svg);
      T(svg, 40, 84, "NTC", "acv-sims-lab2");
      const ttxt = T(svg, 40, 106, "", "acv-sims-lcdt");
      const M = dmm(svg, 262, 6, 130, 132, { unit: "kΩ", tag: "", marks: ["V~", "Ω", "µF"], sel: 1 });
      // compact dmm: hide dial (no space) -> redraw jacks positions
      M.g.querySelectorAll(".acv-sims-dialring,.acv-sims-dial,.acv-sims-dialp,.acv-sims-dialm").forEach((e) => e.remove());
      lead(svg, M.com, [216, 100], "k", 20, 0); lead(svg, M.vj, [216, 108], "r", 30, 10);
      // plot
      const X0 = 50, X1 = 378, Y0 = 156, Y1 = 312;
      const pg = S("g", {}, svg);
      let curve, dot, xh, yh, ylo, yhi;
      const sx = (T) => X0 + ((T + 30) / 130) * (X1 - X0);
      const sy = (r) => Y1 - ((Math.log10(r) - ylo) / (yhi - ylo)) * (Y1 - Y0);
      function draw() {
        pg.innerHTML = "";
        ylo = Math.floor(Math.log10(Rk(100))); yhi = Math.ceil(Math.log10(Rk(-30)));
        S("rect", { x: X0, y: Y0, width: X1 - X0, height: Y1 - Y0, class: "acv-sims-plotbg" }, pg);
        for (let e = ylo; e <= yhi; e++) { S("line", { x1: X0, x2: X1, y1: sy(10 ** e), y2: sy(10 ** e), class: "acv-sims-grid" }, pg); T(pg, X0 - 4, sy(10 ** e) + 4, e < 0 ? String(10 ** e) : e >= 3 ? 10 ** (e - 3) + "M" : String(10 ** e) + "k", "acv-sims-ax", "r"); }
        for (let T_ = -20; T_ <= 100; T_ += 20) { S("line", { x1: sx(T_), x2: sx(T_), y1: Y0, y2: Y1, class: "acv-sims-grid" }, pg); T(pg, sx(T_), Y1 + 16, String(T_), "acv-sims-ax"); }
        T(pg, X1 - 2, Y1 + 28, "°C", "acv-sims-ax", "r");
        T(pg, X1 - 6, Y0 + 16, "R (kΩ, log)", "acv-sims-ax", "r");
        const a = []; for (let T_ = -30; T_ <= 100; T_ += 2) a.push(`${sx(T_).toFixed(1)},${sy(Rk(T_)).toFixed(1)}`);
        curve = S("polyline", { points: a.join(" "), class: "acv-sims-curve" }, pg);
        S("circle", { cx: sx(25), cy: sy(r25), r: 3.5, class: "acv-sims-dot2" }, pg);
        T(pg, sx(25) + 6, sy(r25) - 8, "R25", "acv-sims-ax", "l");
        xh = S("line", { class: "acv-sims-xh" }, pg); yh = S("line", { class: "acv-sims-xh" }, pg);
        dot = S("circle", { r: 6.5, class: "acv-sims-dot" }, pg);
        update();
      }
      const fmtK = (r) => (r >= 100 ? f(r, 1) : r >= 10 ? f(r, 2) : f(r, 3));
      function update() {
        const r = Rk(t);
        M.lcd.textContent = fmtK(r); ttxt.textContent = f(t, 1) + " °C";
        rd.t.textContent = f(t, 1) + " °C"; rd.r.textContent = fmtK(r) + " kΩ";
        const x = sx(t), y = sy(r);
        dot.setAttribute("cx", x); dot.setAttribute("cy", y);
        xh.setAttribute("x1", x); xh.setAttribute("x2", x); xh.setAttribute("y1", y); xh.setAttribute("y2", Y1);
        yh.setAttribute("x1", X0); yh.setAttribute("x2", x); yh.setAttribute("y1", y); yh.setAttribute("y2", y);
        inf.set(`<bdi dir="ltr">R = R25 × e<sup>B(1/T − 1/298.15)</sup></bdi> (T بالكلفن). كلما <b>زادت</b> الحرارة <b>نقصت</b> المقاومة. حساس <bdi dir="ltr">${r25} kΩ · B${B}</bdi> عند ${f(t, 1)}°C ≈ <b>${fmtK(r)} kΩ</b>. قِس والحساس مفصول عن الـ PCB.`, "info");
      }
      function check() {
        const T_ = parseFloat(iT.value); const raw = String(iR.value).trim().toUpperCase().replace(",", ".");
        cOut.style.display = "";
        if (!Number.isFinite(T_)) { cOut.innerHTML = "أدخل الحرارة المعروفة (مثلاً من ميزان حرارة بجانب الحساس، أو ماء مع ثلج = 0°C)."; cOut.dataset.tone = "warn"; return; }
        const exp = Rk(T_);
        const isOL = /^O\.?L/.test(raw); const m = parseFloat(raw);
        let msg, tone;
        if (!isOL && !Number.isFinite(m)) { msg = "أدخل القراءة بالـ kΩ أو اكتب OL."; tone = "warn"; }
        else if (isOL || m > Math.max(exp * 20, 5000)) { msg = `✗ <b>Open</b>: المتوقع ≈ ${fmtK(exp)} kΩ والقراءة مفتوحة — سلك مقطوع أو حساس تالف. افحص الـ socket على الـ PCB أيضاً.`; tone = "bad"; }
        else if (m < 0.05) { msg = `✗ <b>Short</b>: قراءة ~0 (المتوقع ≈ ${fmtK(exp)} kΩ) — قصر في الحساس أو السلك (غالباً رطوبة أو سلك مقشور).`; tone = "bad"; }
        else {
          const d = ((m - exp) / exp) * 100;
          if (Math.abs(d) <= 10) { msg = `✓ <b>سليم</b>: المتوقع ${fmtK(exp)} kΩ، المقاس ${fmtK(m)} kΩ (${sg(d, 1)}%).`; tone = "ok"; }
          else {
            const eq = m / Math.exp(B * (1 / (T_ + 273.15) - 1 / 298.15));
            const near = [5, 10, 15, 20, 50].reduce((a, b) => (Math.abs(Math.log(b / eq)) < Math.abs(Math.log(a / eq)) ? b : a));
            msg = `✗ <b>خارج المنحنى</b>: المتوقع ${fmtK(exp)} kΩ، المقاس ${fmtK(m)} kΩ (${sg(d, 0)}%). القراءة تعادل R25 ≈ ${f(eq, 1)} kΩ${Math.abs(Math.log(near / eq)) < 0.1 && near !== r25 ? ` — ربما الحساس <b>${near} kΩ</b> وليس ${r25} kΩ (تأكد من الموديل)` : " — الحساس منحرف/تالف، استبدله بنفس القيمة"}.`;
            tone = "bad";
          }
        }
        cOut.innerHTML = bidi(msg); cOut.dataset.tone = tone;
      }
      draw();
    },
  });
})();
