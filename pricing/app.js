/* iCOOL Pricing — suggests a rate for every BOQ line so the offer is edited, not typed. */
(function () {
"use strict";
var C = window.PR_CONFIG;
var S = { token: null, view: "projects", pid: null, P: null, list: [], catalog: [], costs: [], settings: null, open: {} };
var $ = function (s) { return document.querySelector(s); };
var app = $("#app");

var TRADES = { hvac: "تكييف", solar: "طاقة شمسية", elec: "كهرباء", plumb: "صحية", heat: "تدفئة", mep: "MEP عام" };
var SRC = { history: "سعر مثبّت سابق", supplier: "سعر مورد", cost: "كلفة معروفة", estimate: "تقدير", none: "بلا سعر" };
var STATUS = { draft: "مسودة", sent: "مبعوت", won: "ربحنا", lost: "خسرنا" };

try { S.token = localStorage.getItem("pr_token"); } catch (e) {}

function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function n(x) { return x == null || x === "" || isNaN(+x) ? null : +x; }
function money(x, d) {
  if (x == null) return "—";
  return (+x).toLocaleString("en-US", { minimumFractionDigits: d == null ? 0 : d, maximumFractionDigits: d == null ? 2 : d });
}
function toast(t) { var el = $("#toast"); el.textContent = t; el.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove("on"); }, 2200); }

function rpc(fn, body) {
  return fetch(C.url + "/rest/v1/rpc/" + fn, {
    method: "POST",
    headers: { apikey: C.key, Authorization: "Bearer " + C.key, "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  }).then(function (r) { return r.json(); });
}
function api(action, p) {
  return rpc("pr_api", { p_token: S.token, p_action: action, p: p || {} }).then(function (j) {
    if (j && j.error === "session") { logout(); throw new Error(j.msg); }
    if (j && j.error) { toast(j.error); throw new Error(j.error); }
    if (j && j.code && j.message) { toast("خطأ: " + j.message); throw new Error(j.message); }
    return j;
  });
}

/* ---------------- login ---------------- */
function logout() { S.token = null; try { localStorage.removeItem("pr_token"); } catch (e) {} render(); }
function viewLogin() {
  $("#top").hidden = true; $("#nav").hidden = true;
  app.innerHTML = '<div class="login card"><img src="logo.png" alt="iCOOL"><h3>منصة التسعير</h3>' +
    '<input id="pin" class="in pin num" type="password" inputmode="numeric" autocomplete="current-password" placeholder="••••">' +
    '<div style="height:10px"></div><button class="btn" style="width:100%" data-act="login">دخول</button></div>';
  var pin = $("#pin"); pin.focus();
  pin.addEventListener("keydown", function (e) { if (e.key === "Enter") act("login"); });
}

/* ---------------- totals ---------------- */
function totals(P) {
  var sub = 0, cost = 0, costKnown = 0, conf = 0, all = 0, missing = 0;
  P.lines.forEach(function (l) {
    var q = n(l.qty), r = n(l.rate);
    all++;
    if (l.status === "confirmed") conf++;
    if (q == null || r == null) { missing++; return; }
    sub += q * r;
    if (n(l.cost_usd) != null) { cost += q * l.cost_usd; costKnown += q * r; }
  });
  var disc = sub * (n(P.project.discount_pct) || 0) / 100;
  var net = sub - disc;
  var vat = P.project.vat ? net * (n(P.vat_rate) || 0.11) : 0;
  return { sub: sub, disc: disc, net: net, vat: vat, total: net + vat, cost: cost, costKnown: costKnown,
           margin: costKnown ? (costKnown - cost) / costKnown : null, conf: conf, all: all, missing: missing };
}

/* ---------------- views ---------------- */
function setBar(title, sub, back) {
  $("#top").hidden = false; $("#nav").hidden = false;
  $("#barTitle").textContent = title; $("#barSub").textContent = sub || "";
  $("#back").hidden = !back;
  document.querySelectorAll(".nav button").forEach(function (b) { b.classList.toggle("on", b.dataset.go === (S.view === "project" ? "projects" : S.view)); });
}

function viewProjects() {
  setBar("التسعير", "المشاريع وعروض الأسعار");
  app.innerHTML = '<div class="btns" style="margin-bottom:10px"><button class="btn" data-act="newProject">+ مشروع جديد</button></div><div id="pl"><div class="empty">…</div></div>';
  api("projects").then(function (list) {
    S.list = list || [];
    $("#pl").innerHTML = S.list.length ? S.list.map(function (p) {
      return '<div class="card proj" data-act="openProject" data-id="' + p.id + '"><div class="row"><div class="grow"><div class="t">' + esc(p.name) + '</div>' +
        '<div class="muted">' + esc([p.client, p.site].filter(Boolean).join(" · ")) + '</div></div>' +
        '<div style="text-align:left"><div class="tot num">$' + money(p.total, 0) + '</div><div class="small muted">' + (STATUS[p.status] || p.status) + '</div></div></div>' +
        '<div class="meta small muted" style="margin-top:6px">' + p.lines + ' بند · ' + (p.open ? '<span class="chip c-estimate">' + p.open + ' مش مثبّت</span>' : '<span class="chip c-history">كلو مثبّت</span>') +
        (p.drawing_ref ? ' · <span class="chip c-supplier">من الخرائط</span>' : '') + ' · ' + (TRADES[p.trade] || "") + '</div></div>';
    }).join("") : '<div class="empty">ما في مشاريع بعد.</div>';
  });
}

function lineHtml(l) {
  var q = n(l.qty), r = n(l.rate), amt = q != null && r != null ? q * r : null;
  var st = l.status === "confirmed" ? "confirmed" : (q == null || r == null ? "tbc" : "suggested");
  var src = l.suggest_src || "none";
  var below = n(l.cost_usd) != null && r != null && r < l.cost_usd * 1.03;
  var open = S.open[l.id];
  var h = '<div class="ln ' + st + '" data-id="' + l.id + '">' +
    '<div class="row"><div class="d grow" data-act="toggleLine" data-id="' + l.id + '">' + esc(l.description) + '</div></div>' +
    '<div class="meta">' +
      (l.status === "confirmed" ? '<span class="chip c-confirmed">مثبّت</span>' : '<span class="chip c-' + src + '">' + (SRC[src] || src) + '</span>') +
      (n(l.cost_usd) != null ? '<span class="small muted">كلفة <span class="num">$' + money(l.cost_usd) + '</span></span>' : '') +
      (l.status === "confirmed" && n(l.suggested) != null && +l.suggested !== +l.rate ? '<span class="small muted">مقترح <span class="num">$' + money(l.suggested) + '</span></span>' : '') +
    '</div>' +
    '<div class="calc"><span class="num">' + (q == null ? '<span class="chip c-tbc">' + esc(l.qty_note || "كمية؟") + '</span>' : money(q)) + '</span>' +
      '<span class="muted small">' + esc(l.unit || "") + ' ×</span>' +
      '<input class="rate num' + (l.status === "confirmed" ? "" : " sug") + '" inputmode="decimal" data-rate="' + l.id + '" value="' + (r == null ? "" : r) + '" placeholder="سعر">' +
      '<span class="amt num">' + (amt == null ? "—" : "$" + money(amt, 0)) + '</span></div>' +
    (below ? '<div class="warn">⚠ السعر قريب أو تحت الكلفة</div>' : '') +
    (l.suggest_note && l.status !== "confirmed" ? '<div class="note">' + esc(l.suggest_note) + '</div>' : '') +
    (l.note ? '<div class="note">📝 ' + esc(l.note) + '</div>' : '');
  if (open) {
    h += '<div style="margin-top:8px;border-top:1px dashed var(--line);padding-top:8px">' +
      '<label class="f">الوصف</label><input class="in" data-f="description" value="' + esc(l.description) + '">' +
      '<div class="grid2"><div><label class="f">الكمية</label><input class="in num" inputmode="decimal" data-f="qty" value="' + (q == null ? "" : q) + '"></div>' +
      '<div><label class="f">الوحدة</label><input class="in" data-f="unit" value="' + esc(l.unit || "") + '"></div></div>' +
      '<div class="grid2"><div><label class="f">ملاحظة كمية (TBC)</label><input class="in" data-f="qty_note" value="' + esc(l.qty_note || "") + '"></div>' +
      '<div><label class="f">القسم</label><input class="in" data-f="section" value="' + esc(l.section || "") + '"></div></div>' +
      '<label class="f">ملاحظة</label><input class="in" data-f="note" value="' + esc(l.note || "") + '">' +
      '<div class="btns" style="margin-top:8px"><button class="btn sm" data-act="saveLine" data-id="' + l.id + '">حفظ</button>' +
      (l.status === "confirmed" ? '<button class="btn g sm" data-act="resetLine" data-id="' + l.id + '">رجّع للمقترح</button>' : '') +
      (l.catalog_key ? '<button class="btn g sm" data-act="editCatalog" data-key="' + esc(l.catalog_key) + '">مصدر السعر</button>' : '') +
      '<button class="btn g sm" style="color:var(--red)" data-act="deleteLine" data-id="' + l.id + '">حذف</button></div></div>';
  }
  return h + '</div>';
}

function viewProject() {
  var P = S.P; if (!P) return;
  var p = P.project, T = totals(P);
  setBar(p.name, [p.client, p.site].filter(Boolean).join(" · "), true);
  var secs = [], by = {};
  P.lines.forEach(function (l) { var s = l.section || ""; if (!(s in by)) { by[s] = []; secs.push(s); } by[s].push(l); });
  var pct = T.all ? Math.round(T.conf / T.all * 100) : 0;
  app.innerHTML =
    '<div class="sum"><div class="row"><div class="grow"><div class="muted small">المجموع ' + (p.vat ? "مع TVA" : "") + '</div><div class="big num">$' + money(T.total, 0) + '</div></div>' +
      '<div style="text-align:left" class="small muted">قبل TVA <span class="num">$' + money(T.net, 0) + '</span><br>' +
      (T.margin != null ? 'ربح تقديري <span class="num">' + Math.round(T.margin * 100) + '%</span>' : '') + '</div></div>' +
      '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="kv" style="margin-top:4px"><span>' + T.conf + ' / ' + T.all + ' مثبّت</span>' + (T.missing ? '<span style="color:var(--red)">' + T.missing + ' ناقص سعر أو كمية</span>' : '<span></span>') + '</div></div>' +
    '<div class="btns" style="margin-bottom:6px">' +
      '<button class="btn" data-act="confirmAll"' + (T.conf === T.all ? " disabled" : "") + '>✓ ثبّت كل المقترح</button>' +
      '<button class="btn g" data-act="addLine">+ بند</button>' +
      '<button class="btn o" data-act="quote">عرض سعر PDF</button>' +
      '<button class="btn g" data-act="projectInfo">⋯</button></div>' +
    '<div class="muted small" style="margin:4px">اكتب السعر مباشرة بالخانة؛ الخانة المنقطة = سعر مقترح. السعر اللي بتكتبو بينحفظ بالمكتبة للمرة الجاية.</div>' +
    (P.lines.length ? secs.map(function (s) { return (s ? '<div class="sec">' + esc(s) + '</div>' : '') + by[s].map(lineHtml).join(""); }).join("") :
      '<div class="empty">ما في بنود. زيد بند من الكاتالوج أو من أسعار الموردين، أو صدّر الـ BOQ من محرّك الخرائط.</div>');
}

function viewCatalog() {
  setBar("مكتبة البنود", "الأسعار المقترحة لكل بند");
  app.innerHTML = '<div class="row" style="margin-bottom:8px"><input class="in grow" id="cq" placeholder="فتّش: دكت، نحاس، 60k، كابل…">' +
    '<select class="in" id="ct" style="width:auto"><option value="">الكل</option>' + Object.keys(TRADES).map(function (k) { return '<option value="' + k + '">' + TRADES[k] + '</option>'; }).join("") + '</select></div>' +
    '<div class="btns" style="margin-bottom:8px"><button class="btn g sm" data-act="editCatalog" data-key="">+ بند جديد</button></div><div id="cl"></div>';
  var go = function () {
    api("catalog", { q: $("#cq").value, trade: $("#ct").value }).then(function (list) {
      S.catalog = list || [];
      $("#cl").innerHTML = S.catalog.map(function (c) {
        var s = c.sug || {};
        return '<div class="card" data-act="editCatalog" data-key="' + esc(c.key) + '"><div class="row"><div class="grow"><b>' + esc(c.name_ar || c.name) + '</b><div class="muted small">' + esc(c.name) + '</div></div>' +
          '<div style="text-align:left"><div class="num" style="font-weight:800">' + (s.rate != null ? "$" + money(s.rate) : "—") + '</div><div class="small muted">/' + esc(c.unit) + '</div></div></div>' +
          '<div class="meta small" style="margin-top:4px"><span class="chip c-' + (s.src || "none") + '">' + (SRC[s.src] || "بلا سعر") + '</span> <span class="muted">' + esc(s.note || "") + '</span></div></div>';
      }).join("") || '<div class="empty">ما في نتائج</div>';
    });
  };
  var t; $("#cq").addEventListener("input", function () { clearTimeout(t); t = setTimeout(go, 250); });
  $("#ct").addEventListener("change", go);
  go();
}

function viewCosts() {
  setBar("أسعار الموردين", "من منصة يوميات iCOOL والفواتير");
  app.innerHTML = '<input class="in" id="kq" placeholder="فتّش: كابل 3×2.5، قاطع، PPR، MIDEA…" style="margin-bottom:8px"><div id="kl"></div>';
  var go = function () {
    api("costs", { q: $("#kq").value }).then(function (list) {
      S.costs = list || [];
      $("#kl").innerHTML = S.costs.map(function (k) {
        return '<div class="card"><div class="row"><div class="grow"><b>' + esc(k.item) + '</b><div class="muted small">' + esc(k.supplier_name || k.supplier) + ' · ' + esc(k.code || "") + ' · ' + esc(k.last_date || "") + '</div></div>' +
          '<div style="text-align:left"><div class="num" style="font-weight:800">$' + money(k.net_usd) + '</div><div class="small muted">/' + esc(k.unit || "") + '</div></div></div>' +
          '<div class="meta small"><span class="chip c-' + (k.source === "oral" ? "estimate" : "supplier") + '">' + esc(k.source || "") + '</span>' +
          (k.discount_pct ? ' <span class="muted">حسم ' + k.discount_pct + '%</span>' : '') + '</div></div>';
      }).join("") || '<div class="empty">ما في نتائج</div>';
    });
  };
  var t; $("#kq").addEventListener("input", function () { clearTimeout(t); t = setTimeout(go, 250); });
  go();
}

function viewSettings() {
  setBar("الإعدادات", "");
  app.innerHTML = '<div class="empty">…</div>';
  api("settings").then(function (s) {
    S.settings = s; var m = s.markup || {};
    app.innerHTML = '<div class="card"><b>هامش الربح على كلفة المورد</b><div class="muted small">بينطبق لما يكون في سعر مورد وما في سعر مثبّت سابق.</div>' +
      Object.keys(TRADES).map(function (k) { return '<div class="row" style="margin-top:6px"><span class="grow">' + TRADES[k] + '</span><input class="in num" style="width:90px" inputmode="decimal" data-mk="' + k + '" value="' + Math.round((m[k] || 0) * 100) + '"><span>%</span></div>'; }).join("") +
      '<div class="row" style="margin-top:10px"><span class="grow">مدة صلاحية السعر المثبّت (يوم)</span><input class="in num" style="width:90px" id="hd" value="' + (s.history_days || 180) + '"></div>' +
      '<div class="row" style="margin-top:10px"><span class="grow">رمز دخول جديد</span><input class="in num" style="width:120px" id="np" inputmode="numeric" placeholder="اختياري"></div>' +
      '<div class="btns" style="margin-top:10px"><button class="btn" data-act="saveSettings">حفظ</button></div></div>' +
      '<div class="card small muted">أسعار موردين: <b class="num">' + s.costs + '</b> · آخر مزامنة: <span class="num">' + esc((s.synced || "").slice(0, 16).replace("T", " ")) + '</span><br>' +
      'بنود بالمكتبة: <b class="num">' + s.catalog + '</b> · أسعار مثبّتة محفوظة: <b class="num">' + s.rates + '</b></div>' +
      '<div class="btns"><button class="btn g" data-act="logout">خروج</button></div>';
  });
}

function render() {
  if (!S.token) return viewLogin();
  if (S.view === "project") return viewProject();
  if (S.view === "catalog") return viewCatalog();
  if (S.view === "costs") return viewCosts();
  if (S.view === "settings") return viewSettings();
  S.view = "projects"; return viewProjects();
}

/* ---------------- sheets ---------------- */
function sheet(html) { $("#sheet").innerHTML = html; $("#sheet").hidden = false; $("#sheetBg").hidden = false; }
function closeSheet() { $("#sheet").hidden = true; $("#sheetBg").hidden = true; $("#sheet").innerHTML = ""; }

function addLineSheet(tab) {
  tab = tab || "cat";
  sheet('<h3>زيد بند</h3><div class="tabs"><button data-act="addTab" data-t="cat" class="' + (tab === "cat" ? "on" : "") + '">الكاتالوج</button>' +
    '<button data-act="addTab" data-t="cost" class="' + (tab === "cost" ? "on" : "") + '">أسعار الموردين</button>' +
    '<button data-act="addTab" data-t="free" class="' + (tab === "free" ? "on" : "") + '">بند حر</button></div>' +
    (tab === "free" ?
      '<label class="f">الوصف</label><input class="in" id="fd"><div class="grid2"><div><label class="f">الكمية</label><input class="in num" id="fq" inputmode="decimal"></div><div><label class="f">الوحدة</label><input class="in" id="fu" value="no"></div></div>' +
      '<label class="f">السعر (اختياري)</label><input class="in num" id="fr" inputmode="decimal"><div style="height:10px"></div><button class="btn" data-act="addFree">زيد</button>' :
      '<div class="grid2" style="margin-bottom:6px"><input class="in" id="aq" placeholder="فتّش…"><input class="in num" id="aqty" inputmode="decimal" placeholder="الكمية"></div><div id="al" class="muted">…</div>'));
  if (tab === "free") return;
  var go = function () {
    var q = $("#aq").value;
    (tab === "cat" ? api("catalog", { q: q, trade: "" }) : api("costs", { q: q })).then(function (list) {
      $("#al").innerHTML = (list || []).slice(0, 60).map(function (x) {
        if (tab === "cat") {
          var s = x.sug || {};
          return '<div class="pick"><div class="grow"><b>' + esc(x.name_ar || x.name) + '</b><div class="small muted">' + esc(x.name) + '</div></div>' +
            '<span class="num">' + (s.rate != null ? "$" + money(s.rate) : "—") + '/' + esc(x.unit) + '</span><button class="btn sm" data-act="addCat" data-key="' + esc(x.key) + '">+</button></div>';
        }
        return '<div class="pick"><div class="grow"><b>' + esc(x.item) + '</b><div class="small muted">' + esc(x.supplier_name || x.supplier) + ' · ' + esc(x.last_date || "") + '</div></div>' +
          '<span class="num">$' + money(x.net_usd) + '/' + esc(x.unit || "") + '</span><button class="btn sm" data-act="addCost" data-id="' + esc(x.id) + '">+</button></div>';
      }).join("") || "ما في نتائج";
    });
  };
  var t; $("#aq").addEventListener("input", function () { clearTimeout(t); t = setTimeout(go, 250); });
  go();
}

function catalogSheet(key) {
  var c = S.catalog.filter(function (x) { return x.key === key; })[0];
  var show = function (c) {
    c = c || { key: "", trade: "hvac", unit: "no", cost_ids: [] };
    sheet('<h3>' + (c.key ? "مصدر سعر البند" : "بند جديد") + '</h3>' +
      '<label class="f">رمز البند</label><input class="in mono" id="ck" value="' + esc(c.key) + '"' + (c.key ? " readonly" : "") + ' placeholder="hvac.duct.midea.60k">' +
      '<div class="grid2"><div><label class="f">القسم</label><select class="in" id="ctr">' + Object.keys(TRADES).map(function (k) { return '<option value="' + k + '"' + (k === c.trade ? " selected" : "") + '>' + TRADES[k] + '</option>'; }).join("") + '</select></div>' +
      '<div><label class="f">الوحدة</label><input class="in" id="cu" value="' + esc(c.unit) + '"></div></div>' +
      '<label class="f">الوصف بالإنكليزي (بيطلع بالعرض)</label><input class="in" id="cn" value="' + esc(c.name || "") + '">' +
      '<label class="f">الاسم بالعربي</label><input class="in" id="ca" value="' + esc(c.name_ar || "") + '">' +
      '<div class="grid2"><div><label class="f">كلفة المادة $ (إذا ما في مورد مربوط)</label><input class="in num" id="cc" inputmode="decimal" value="' + (c.cost_usd == null ? "" : c.cost_usd) + '"></div>' +
      '<div><label class="f">تركيب $ للوحدة</label><input class="in num" id="ci" inputmode="decimal" value="' + (c.install_usd || 0) + '"></div></div>' +
      '<div class="grid2"><div><label class="f">هامش خاص % (فاضي = حسب القسم)</label><input class="in num" id="cm" inputmode="decimal" value="' + (c.markup_pct == null ? "" : Math.round(c.markup_pct * 100)) + '"></div>' +
      '<div><label class="f">سعر تقديري $ (آخر خيار)</label><input class="in num" id="ce" inputmode="decimal" value="' + (c.est_rate == null ? "" : c.est_rate) + '"></div></div>' +
      '<label class="f">ملاحظة الكلفة</label><input class="in" id="cno" value="' + esc(c.cost_note || "") + '">' +
      '<label class="f">مربوط بأسعار موردين</label><div id="cids" class="small">' + ((c.cost_ids || []).map(function (i) { return '<span class="chip c-supplier" style="margin:2px">' + esc(i) + ' <a data-act="unlinkCost" data-id="' + esc(i) + '">✕</a></span>'; }).join("") || '<span class="muted">ولا شي</span>') + '</div>' +
      '<input class="in" id="lq" placeholder="فتّش سعر مورد لتربطه…" style="margin-top:6px"><div id="ll"></div>' +
      (c.sug ? '<div class="card small" style="margin-top:8px">المقترح هلّق: <b class="num">$' + money(c.sug.rate) + '</b> <span class="chip c-' + c.sug.src + '">' + (SRC[c.sug.src] || "") + '</span><br><span class="muted">' + esc(c.sug.note || "") + '</span></div>' : '') +
      '<div class="btns" style="margin-top:10px"><button class="btn" data-act="saveCatalog">حفظ</button><button class="btn g" data-act="closeSheet">إلغاء</button></div>');
    S.edit = c;
    var t; $("#lq").addEventListener("input", function () {
      clearTimeout(t); t = setTimeout(function () {
        api("costs", { q: $("#lq").value }).then(function (list) {
          $("#ll").innerHTML = (list || []).slice(0, 20).map(function (k) {
            return '<div class="pick"><div class="grow">' + esc(k.item) + '<div class="small muted">' + esc(k.supplier_name || k.supplier) + ' · $' + money(k.net_usd) + '/' + esc(k.unit || "") + '</div></div><button class="btn sm" data-act="linkCost" data-id="' + esc(k.id) + '">ربط</button></div>';
          }).join("");
        });
      }, 250);
    });
  };
  if (c || !key) return show(c);
  api("catalog", { q: key }).then(function (list) { S.catalog = list || []; show(S.catalog.filter(function (x) { return x.key === key; })[0]); });
}

function projectSheet(p) {
  p = p || {};
  sheet('<h3>' + (p.id ? "معلومات المشروع" : "مشروع جديد") + '</h3>' +
    '<label class="f">الاسم</label><input class="in" id="pn" value="' + esc(p.name || "") + '">' +
    '<div class="grid2"><div><label class="f">الزبون</label><input class="in" id="pc" value="' + esc(p.client || "") + '"></div><div><label class="f">الموقع</label><input class="in" id="ps" value="' + esc(p.site || "") + '"></div></div>' +
    '<div class="grid2"><div><label class="f">القسم</label><select class="in" id="pt">' + Object.keys(TRADES).map(function (k) { return '<option value="' + k + '"' + (k === (p.trade || "hvac") ? " selected" : "") + '>' + TRADES[k] + '</option>'; }).join("") + '</select></div>' +
    '<div><label class="f">الحالة</label><select class="in" id="pst">' + Object.keys(STATUS).map(function (k) { return '<option value="' + k + '"' + (k === (p.status || "draft") ? " selected" : "") + '>' + STATUS[k] + '</option>'; }).join("") + '</select></div></div>' +
    (p.id ? '<div class="grid2"><div><label class="f">حسم %</label><input class="in num" id="pd" value="' + (p.discount_pct || 0) + '"></div><div><label class="f">صلاحية العرض (يوم)</label><input class="in num" id="pv" value="' + (p.validity_days || 15) + '"></div></div>' +
      '<label class="f"><input type="checkbox" id="pvat"' + (p.vat ? " checked" : "") + '> فاتورة رسمية مع TVA 11%</label>' +
      '<label class="f">ملاحظات العرض</label><textarea class="in" id="pno" rows="3">' + esc(p.notes || "") + '</textarea>' : '') +
    '<div class="btns" style="margin-top:10px"><button class="btn" data-act="saveProject" data-id="' + (p.id || "") + '">حفظ</button>' +
    (p.id ? '<button class="btn g" data-act="refresh">حدّث الاقتراحات</button><button class="btn g" style="color:var(--red)" data-act="deleteProject">حذف المشروع</button>' : '') + '</div>');
}

/* ---------------- quotation ---------------- */
function quote() {
  var P = S.P, p = P.project, T = totals(P), i = 0, secs = [], by = {};
  P.lines.forEach(function (l) { var s = l.section || ""; if (!(s in by)) { by[s] = []; secs.push(s); } by[s].push(l); });
  var d = new Date();
  var rows = secs.map(function (s) {
    return (s ? '<tr class="sec"><td colspan="6">' + esc(s) + '</td></tr>' : '') + by[s].map(function (l) {
      i++; var q = n(l.qty), r = n(l.rate);
      return '<tr><td class="n">' + i + '</td><td>' + esc(l.description) + '</td><td class="n">' + esc(l.unit || "") + '</td><td class="n num">' + (q == null ? esc(l.qty_note || "TBC") : money(q)) +
        '</td><td class="n num">' + (r == null ? "—" : money(r, 2)) + '</td><td class="n num">' + (q == null || r == null ? "—" : money(q * r, 2)) + '</td></tr>';
    }).join("");
  }).join("");
  $("#print").innerHTML = '<img class="q-wm" src="logo.png" alt="">' +
    '<div class="q-head"><img src="logo.png" alt="iCOOL"><div class="q-co"><b>iCOOL Trading &amp; Contracting</b><div class="tag">HVAC • SOLAR • MEP</div>' +
    '<div class="s">ELECTROMECHANICAL SERVICES</div><div class="s">Tel/WhatsApp: +961 3 715 512 · info.icool.lb@gmail.com</div></div></div>' +
    '<div class="q-title">QUOTATION / عرض سعر</div>' +
    '<div class="q-meta"><div><b>Client:</b> ' + esc(p.client || "") + '</div><div><b>Date:</b> ' + d.toLocaleDateString("en-GB") + '</div>' +
    '<div><b>Project:</b> ' + esc(p.name) + '</div><div><b>Ref:</b> ' + esc(p.code || ("Q-" + p.id.slice(0, 6).toUpperCase())) + '</div>' +
    '<div><b>Site:</b> ' + esc(p.site || "") + '</div><div><b>Validity:</b> ' + (p.validity_days || 15) + ' days</div></div>' +
    '<table class="q-t"><thead><tr><th>#</th><th>Description</th><th>Unit</th><th>Qty</th><th>Rate $</th><th>Amount $</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    '<div class="q-tot"><div><span>Subtotal</span><span class="num">$' + money(T.sub, 2) + '</span></div>' +
    (T.disc ? '<div><span>Discount ' + p.discount_pct + '%</span><span class="num">−$' + money(T.disc, 2) + '</span></div>' : '') +
    (p.vat ? '<div><span>VAT 11%</span><span class="num">$' + money(T.vat, 2) + '</span></div>' : '') +
    '<div class="g"><span>TOTAL</span><span class="num">$' + money(T.total, 2) + '</span></div></div>' +
    '<div class="q-notes">' + (p.notes ? esc(p.notes).replace(/\n/g, "<br>") + "<br>" : "") +
    'Prices in USD, supply and installation unless stated. Items marked TBC are priced after site confirmation. ' + (p.vat ? "" : "Prices exclude VAT. ") + 'Validity ' + (p.validity_days || 15) + ' days.</div>' +
    '<div class="q-foot"><span>iCOOL Trading &amp; Contracting — COOL YOUR LIFE</span><span>Eng. Ahmad Mohammad Nasser · OEA 36359</span></div>';
  setTimeout(function () { window.print(); }, 150);
}

/* ---------------- actions ---------------- */
function loadProject(id) {
  return api("project", { id: id }).then(function (P) { S.P = P; S.pid = id; S.view = "project"; render(); });
}
function setP(P) { S.P = P; render(); }

function act(a, el) {
  var id = el && el.dataset.id;
  switch (a) {
    case "login":
      rpc("pr_login", { p_pin: $("#pin").value }).then(function (j) {
        if (j.error) return toast(j.error);
        S.token = j.token; try { localStorage.setItem("pr_token", j.token); } catch (e) {}
        render();
      }); break;
    case "logout": logout(); break;
    case "back": S.view = "projects"; S.P = null; render(); break;
    case "newProject": projectSheet({}); break;
    case "projectInfo": projectSheet(S.P.project); break;
    case "saveProject":
      api("save_project", { id: id || "", name: $("#pn").value, client: $("#pc").value, site: $("#ps").value, trade: $("#pt").value, status: $("#pst").value,
        discount_pct: $("#pd") ? $("#pd").value || 0 : undefined, validity_days: $("#pv") ? $("#pv").value || 15 : undefined,
        vat: $("#pvat") ? $("#pvat").checked : undefined, notes: $("#pno") ? $("#pno").value : undefined
      }).then(function (P) { closeSheet(); S.P = P; S.pid = P.project.id; S.view = "project"; render(); toast("انحفظ"); }); break;
    case "deleteProject":
      if (!confirm("أكيد بدك تحذف المشروع؟")) return;
      api("delete_project", { id: S.P.project.id }).then(function () { closeSheet(); S.view = "projects"; S.P = null; render(); }); break;
    case "openProject": loadProject(id); break;
    case "refresh": api("refresh", { project_id: S.P.project.id }).then(function (P) { closeSheet(); setP(P); toast("تحدّثت الاقتراحات"); }); break;
    case "confirmAll":
      api("confirm_all", { project_id: S.P.project.id }).then(function (P) { setP(P); toast("تثبّتت الأسعار وانحفظت بالمكتبة"); }); break;
    case "toggleLine": S.open[id] = !S.open[id]; render(); break;
    case "saveLine": {
      var box = document.querySelector('.ln[data-id="' + id + '"]'), body = { id: id };
      box.querySelectorAll("[data-f]").forEach(function (i) { body[i.dataset.f] = i.value; });
      api("save_line", body).then(function (P) { S.open[id] = false; setP(P); toast("انحفظ"); }); break;
    }
    case "resetLine": api("save_line", { id: id, rate: "" }).then(setP); break;
    case "deleteLine": if (confirm("حذف البند؟")) api("delete_line", { id: id }).then(setP); break;
    case "addLine": addLineSheet("cat"); break;
    case "addTab": addLineSheet(el.dataset.t); break;
    case "addCat":
      api("add_line", { project_id: S.P.project.id, catalog_key: el.dataset.key, qty: $("#aqty").value }).then(function (P) { setP(P); toast("انزاد"); }); break;
    case "addCost":
      api("add_line", { project_id: S.P.project.id, cost_id: id, qty: $("#aqty").value }).then(function (P) { setP(P); toast("انزاد"); }); break;
    case "addFree":
      api("add_line", { project_id: S.P.project.id, description: $("#fd").value, qty: $("#fq").value, unit: $("#fu").value, rate: $("#fr").value })
        .then(function (P) { closeSheet(); setP(P); }); break;
    case "editCatalog": catalogSheet(el.dataset.key); break;
    case "linkCost": S.edit.cost_ids = (S.edit.cost_ids || []).concat([id]); saveCatalog(true); break;
    case "unlinkCost": S.edit.cost_ids = (S.edit.cost_ids || []).filter(function (x) { return x !== id; }); saveCatalog(true); break;
    case "saveCatalog": saveCatalog(false); break;
    case "closeSheet": closeSheet(); break;
    case "quote": quote(); break;
    case "saveSettings": {
      var mk = {};
      document.querySelectorAll("[data-mk]").forEach(function (i) { mk[i.dataset.mk] = (n(i.value) || 0) / 100; });
      api("save_settings", { markup: mk, history_days: n($("#hd").value) || 180, new_pin: $("#np").value }).then(function () { toast("انحفظ"); render(); }); break;
    }
  }
}

function saveCatalog(keepOpen) {
  var c = S.edit, key = $("#ck").value.trim();
  if (!key || !$("#cn").value.trim()) return toast("الرمز والوصف مطلوبين");
  var mk = $("#cm").value;
  api("save_catalog", { key: key, trade: $("#ctr").value, unit: $("#cu").value, name: $("#cn").value, name_ar: $("#ca").value,
    cost_usd: $("#cc").value, install_usd: $("#ci").value, markup_pct: mk === "" ? "" : (n(mk) || 0) / 100, est_rate: $("#ce").value,
    cost_note: $("#cno").value, cost_ids: c.cost_ids || [] }).then(function (r) {
    toast("انحفظ · المقترح $" + money(r.sug && r.sug.rate));
    return api("catalog", { q: key });
  }).then(function (list) {
    S.catalog = list || [];
    if (keepOpen) return catalogSheet(key);
    closeSheet();
    if (S.view === "project") loadProject(S.P.project.id); else render();
  });
}

document.addEventListener("click", function (e) {
  var g = e.target.closest("[data-go]");
  if (g) { S.view = g.dataset.go; S.P = null; closeSheet(); render(); return; }
  if (e.target.id === "sheetBg") return closeSheet();
  var el = e.target.closest("[data-act]");
  if (el && !(el.tagName === "INPUT")) act(el.dataset.act, el);
});

// rate typed directly in the line → confirmed + saved to the library
document.addEventListener("change", function (e) {
  var id = e.target.dataset && e.target.dataset.rate;
  if (!id) return;
  api("save_line", { id: id, rate: e.target.value.trim() }).then(function (P) { setP(P); toast(e.target.value.trim() ? "تثبّت السعر" : "رجع للمقترح"); });
});
document.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.dataset && e.target.dataset.rate) e.target.blur(); });

render();
})();
