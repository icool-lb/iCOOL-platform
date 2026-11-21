/* iCOOL Academy visual widgets — registry. Each widget file calls ACV.register(name, def). */
(function () {
  const W = {};
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const svgEl = (tag, attrs = {}, parent) => { const e = document.createElementNS("http://www.w3.org/2000/svg", tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.ACV = {
    W,
    register(name, def) { W[name] = def; },
    // ctx: { kb } — kb.ptables available for P/T widgets
    render(host, spec, ctx = {}) {
      const def = W[spec.w];
      if (!def) { host.innerHTML = ""; return false; }
      host.classList.add("acv", "acv-" + spec.w);
      try { def.render(host, spec.p || {}, { esc, svgEl, reduce, kb: ctx.kb || (window.SVC && window.SVC.KB) || null, ...ctx }); }
      catch (e) { console.warn("acv", spec.w, e); host.innerHTML = ""; return false; }
      return true;
    },
    esc, svgEl, reduce,
  };
})();
