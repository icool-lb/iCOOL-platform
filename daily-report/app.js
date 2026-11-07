/* iCOOL Daily Report — field operations app (admin / foreman / worker). Talks only to public.dr_* RPCs + the dr-photos bucket. */
(function () {
"use strict";
var C = window.DR_CONFIG;
var $ = function (s, r) { return (r || document).querySelector(s); };
var S = { token: null, ticket: null, me: null, users: [], today: null, date: null, view: "today", day: null, cache: {}, form: null, seg: {}, weekFrom: null };
var LS = "icool_dr_v1";

/* ---------------- utils ---------------- */
function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function beirutToday() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Beirut" }).format(new Date()); }
function beirutHour() { return +new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Beirut", hour: "2-digit", hour12: false }).format(new Date()); }
function addDays(d, n) { var x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
var WD = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
function wday(d) { return WD[new Date(d + "T12:00:00Z").getUTCDay()]; }
function dShort(d) { return d ? (+d.slice(8, 10)) + "/" + (+d.slice(5, 7)) : ""; }
function dLabel(d) {
  if (!d) return "";
  var t = S.today || beirutToday();
  var rel = d === t ? "اليوم" : d === addDays(t, 1) ? "بكرا" : d === addDays(t, -1) ? "مبارح" : "";
  return wday(d) + " " + dShort(d) + (rel ? " · " + rel : "");
}
function money(v, cur) { if (v == null || v === "") return "—"; var n = +v; if (cur === "LL") return n.toLocaleString("en-US") + " ل.ل"; return "$" + (Math.round(n * 100) / 100).toLocaleString("en-US"); }
function usd(v) { return v == null ? "—" : (v < 0 ? "−" : "") + "$" + Math.abs(Math.round(v * 100) / 100).toLocaleString("en-US"); }
function initials(n) { n = String(n || "").trim(); return n ? n[0] : "؟"; }
function userById(id) { for (var i = 0; i < S.users.length; i++) if (S.users[i].id === id) return S.users[i]; return null; }
function uname(id) { var u = userById(id); return u ? u.name : "—"; }
function isBoss() { return S.me && (S.me.role === "admin" || S.me.role === "foreman"); }
function isAdmin() { return S.me && S.me.role === "admin"; }
function field() { return S.users.filter(function (u) { return u.role !== "admin"; }); }
function uuid() { return (crypto.randomUUID ? crypto.randomUUID() : "x" + Date.now() + Math.random().toString(16).slice(2)); }
function photoUrl(path) { return C.url + "/storage/v1/object/public/" + C.bucket + "/" + path.split("/").map(encodeURIComponent).join("/"); }
function mapLink(c) {
  if (!c) return null;
  if (c.lat != null && c.lng != null) return "https://maps.google.com/?q=" + c.lat + "," + c.lng;
  if (c.map_url) return c.map_url;
  return null;
}
function telLink(p) { return p ? "tel:" + String(p).replace(/[^\d+]/g, "") : null; }
function waNumber(p) {
  var d = String(p || "").replace(/\D/g, "");
  if (!d) return null;
  if (d.indexOf("00") === 0) d = d.slice(2);
  if (d.indexOf("961") !== 0) d = "961" + d.replace(/^0/, "");
  return d;
}
function parseCoords(s) {
  s = String(s || "");
  var m = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || s.match(/[?&](?:q|ll|query)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/) || s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || s.match(/^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/);
  return m ? { lat: +m[1], lng: +m[2] } : null;
}
function hm(t) { if (!t) return null; var m = String(t).match(/(\d{1,2})[:.](\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : null; }
function hoursBetween(a, b) { var x = hm(a), y = hm(b); if (x == null || y == null) return null; if (y < x) y += 12 * 60; return (y - x) / 60; }
function fmtH(h) { if (h == null) return "—"; var r = Math.round(h * 4) / 4; return (r % 1 ? r.toFixed(2).replace(/0$/, "") : r) + " س"; }
function toast(msg) { var t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove("on"); }, 2600); }

var KIND = { work: "شغل", install: "تركيب", maintenance: "صيانة", repair: "تصليح", visit: "كشف", solar: "طاقة شمسية", project: "مشروع", other: "غيره" };
var ST = { planned: ["مخططة", ""], in_progress: ["عم يشتغل", "blue"], done: ["منجزة", "ok"], postponed: ["مأجلة", "warn"], cancelled: ["ملغاة", "bad"] };
var ROLE = { admin: "مدير", foreman: "فورمان", worker: "عامل" };
var PAYK = { advance: "سلفة استلمتها", customer_receipt: "قبضت من زبون", wage: "أجرة/يومية دفعتها", other: "غيره" };

/* ---------------- API ---------------- */
function rpc(fn, body) {
  return fetch(C.url + "/rest/v1/rpc/" + fn, {
    method: "POST",
    headers: { apikey: C.key, Authorization: "Bearer " + C.key, "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  }).then(function (r) {
    return r.text().then(function (t) {
      var j; try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
      if (!r.ok) throw new Error((j && (j.message || j.hint)) || "خطأ بالاتصال (" + r.status + ")");
      return j;
    });
  }, function () { throw new Error("ما في إنترنت — جرّب كمان شوي"); });
}
function api(action, p) {
  return rpc("dr_api", { p_token: S.token, p_action: action, p: p || {} }).then(function (j) {
    if (j && j.error) {
      if (j.error === "session") { logout(true); }
      var e = new Error(j.msg || (j.error === "forbidden" ? "مش مسموح" : "خطأ")); e.code = j.error; throw e;
    }
    return j;
  });
}
function fail(e) { toast(e && e.message ? e.message : "صار خطأ"); }

/* ---------------- photos ---------------- */
function compress(file) {
  return new Promise(function (res, rej) {
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      var max = 1600, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
      var cv = document.createElement("canvas"); cv.width = Math.round(w * k); cv.height = Math.round(h * k);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      cv.toBlob(function (b) { b ? res(b) : rej(new Error("ما قدرت حضّر الصورة")); }, "image/jpeg", 0.72);
    };
    img.onerror = function () { URL.revokeObjectURL(url); rej(new Error("صورة مش مقروءة")); };
    img.src = url;
  });
}
function uploadPhoto(file, kind, date, taskId) {
  return compress(file).then(function (blob) {
    var path = S.ticket + "/" + date + "/" + uuid() + ".jpg";
    return fetch(C.url + "/storage/v1/object/" + C.bucket + "/" + path, {
      method: "POST", headers: { apikey: C.key, Authorization: "Bearer " + C.key, "Content-Type": "image/jpeg", "x-upsert": "false" }, body: blob
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error("ما انرفعت الصورة (" + r.status + ")"); });
      return api("photo_add", { path: path, kind: kind, date: date, task_id: taskId || "" }).then(function (j) { return { id: j.id, path: path, kind: kind }; });
    });
  });
}
function thumbs(list, removable) {
  return (list || []).map(function (ph, i) {
    return '<span class="thumb-w"><img class="thumb" loading="lazy" src="' + esc(photoUrl(ph.path)) + '" data-act="view" data-src="' + esc(photoUrl(ph.path)) + '" alt="">' +
      (removable ? '<button class="x" data-act="rmPhoto" data-key="' + removable + '" data-i="' + i + '" aria-label="شيل">✕</button>' : "") + "</span>";
  }).join("");
}
function shotBtn(key, kind, label) {
  return '<label class="shot" title="' + esc(label) + '">📷<small>' + esc(label) + '</small><input type="file" accept="image/*" multiple data-up="' + key + '" data-kind="' + kind + '"></label>';
}
function photoField(key, kinds) {
  var F = S.form, list = F[key] || [];
  return '<div class="thumbs" id="ph_' + key + '">' + thumbs(list, key) + (F["_up_" + key] ? '<span class="thumb uploading" style="display:grid;place-items:center"><span class="spin"></span></span>' : "") +
    kinds.map(function (k) { return shotBtn(key, k[0], k[1]); }).join("") + "</div>";
}
function refreshPhotos(key, kinds) { var el = document.getElementById("ph_" + key); if (el) el.outerHTML = photoField(key, kinds); }

/* ---------------- session ---------------- */
function save() { try { localStorage.setItem(LS, JSON.stringify({ token: S.token, ticket: S.ticket, me: S.me })); } catch (e) { } }
function logout(silent) {
  if (S.token && !silent) api("logout").catch(function () { });
  S.token = S.ticket = S.me = null; try { localStorage.removeItem(LS); } catch (e) { }
  closeSheet(); showLogin();
}
function boot() {
  return api("boot").then(function (j) {
    S.me = j.me; S.ticket = j.ticket; S.users = j.users || []; S.today = j.today; if (!S.date) S.date = j.today;
    if (!S.weekFrom) S.weekFrom = j.today;
    save();
    $("#top").hidden = false; $("#nav").hidden = false;
    $("#who").innerHTML = esc(S.me.name) + "<br>" + esc(ROLE[S.me.role] || "");
    go(S.view || "today");
  });
}

/* ---------------- login ---------------- */
var L = { user: null, pin: "" };
function showLogin() {
  $("#top").hidden = true; $("#nav").hidden = true;
  var app = $("#app");
  app.innerHTML = '<div class="login"><img class="logo-big" src="logo.png" alt="iCOOL"><h1>iCOOL Daily Report</h1><div class="muted small">يوميات الورش والمهام</div><div id="lg"><div class="empty"><span class="spin"></span></div></div></div>';
  rpc("dr_users_public").then(function (list) {
    L.list = list || [];
    drawLogin();
  }, function (e) { $("#lg").innerHTML = '<div class="banner bad">' + esc(e.message) + '</div><button class="btn pri" style="margin-top:12px" data-act="reload">جرّب مرة تانية</button>'; });
}
function drawLogin() {
  var el = $("#lg"); if (!el) return;
  if (!L.user) {
    el.innerHTML = '<div class="muted" style="margin-top:20px">مين إنت؟</div><div class="users">' + L.list.map(function (u) {
      return '<button data-act="pickUser" data-id="' + u.id + '"><span class="av">' + esc(initials(u.name)) + "</span>" + esc(u.name) + '<span class="tiny muted">' + esc(ROLE[u.role]) + "</span></button>";
    }).join("") + "</div>";
    return;
  }
  var u = L.list.filter(function (x) { return x.id === L.user; })[0] || {};
  var dots = ""; for (var i = 0; i < 6; i++) dots += '<i class="' + (i < L.pin.length ? "f" : "") + '"></i>';
  el.innerHTML = '<div style="margin-top:20px;font-weight:700">' + esc(u.name) + '</div><div class="muted small">دخّل الرمز</div><div class="pin-dots">' + dots + '</div><div class="pad">' +
    [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) { return '<button data-act="pin" data-k="' + n + '">' + n + "</button>"; }).join("") +
    '<button data-act="pinBack" aria-label="رجوع">⌫</button><button data-act="pin" data-k="0">0</button><button data-act="pinGo" style="background:var(--blue);color:#fff;font-family:var(--f-body);font-size:16px">دخول</button></div>' +
    '<button class="btn ghost" style="margin-top:14px" data-act="pickUser" data-id="">تغيير الاسم</button>';
}
function tryLogin() {
  if (L.pin.length < 4) return toast("الرمز 4 أرقام عالأقل");
  rpc("dr_login", { p_user: L.user, p_pin: L.pin }).then(function (j) {
    if (j.error) { L.pin = ""; drawLogin(); return toast(j.error); }
    S.token = j.token; S.ticket = j.ticket; S.me = j.me; save(); L = { user: null, pin: "" };
    S.view = "today"; S.date = null; boot().catch(fail);
  }, fail);
}

/* ---------------- navigation ---------------- */
function tabs() {
  if (isAdmin()) return [["today", "📋", "اليوم"], ["plan", "🗓️", "الجدول"], ["customers", "📍", "الزبائن"], ["log", "🧾", "الورقة"], ["review", "✅", "المراجعة"], ["more", "☰", "المزيد"]];
  if (isBoss()) return [["today", "📋", "اليوم"], ["plan", "🗓️", "الجدول"], ["customers", "📍", "الزبائن"], ["log", "🧾", "الورقة"], ["more", "☰", "المزيد"]];
  return [["today", "📋", "مهامي"], ["account", "💵", "حسابي"], ["more", "☰", "المزيد"]];
}
var TITLES = { today: "اليوم", plan: "جدول المهام", customers: "الزبائن والمواقع", log: "الورقة اليومية", review: "المراجعة", account: "حسابي", more: "المزيد", users: "المستخدمين" };
function go(v) {
  S.view = v; closeSheet();
  $("#nav").innerHTML = tabs().map(function (t) { return '<button data-act="go" data-v="' + t[0] + '" class="' + (t[0] === v || (v === "users" && t[0] === "more") ? "on" : "") + '"><span class="ic">' + t[1] + "</span>" + t[2] + "</button>"; }).join("");
  $("#barTitle").textContent = TITLES[v] || "";
  $("#barSub").textContent = dLabel(S.today);
  window.scrollTo(0, 0);
  render();
}
function render() {
  var v = S.view, app = $("#app");
  if (v === "today") return isBoss() ? vBossToday(app) : vWorkerToday(app);
  if (v === "plan") return vPlan(app);
  if (v === "customers") return vCustomers(app);
  if (v === "log") return vLog(app);
  if (v === "review") return vReview(app);
  if (v === "account") return vAccount(app, S.me.platform_name);
  if (v === "users") return vUsers(app);
  return vMore(app);
}
function loading(app) { app.innerHTML = '<div class="empty" style="padding-top:60px"><span class="spin"></span></div>'; }
function dayBar() {
  return '<div class="daybar"><button class="btn sm" data-act="day" data-n="-1" aria-label="اليوم السابق">→</button><div class="d">' + esc(dLabel(S.date)) +
    '</div><button class="btn sm" data-act="day" data-n="1" aria-label="اليوم التالي">←</button>' + (S.date !== S.today ? '<button class="btn sm" data-act="day" data-n="0">اليوم</button>' : "") + "</div>";
}

/* ---------------- task card ---------------- */
function taskCard(t, opts) {
  opts = opts || {};
  var c = t.customer || null, st = ST[t.status] || ST.planned;
  var mine = S.me && t.assignees && t.assignees.indexOf(S.me.id) >= 0;
  var reps = (S.day && S.day.reports || []).filter(function (r) { return r.task_id === t.id; });
  var myRep = reps.filter(function (r) { return r.user_id === S.me.id && r.photo_ids && r.photo_ids.length; }).length > 0;
  var ml = mapLink(c), tl = telLink(c && c.phone);
  var h = '<div class="task st-' + t.status + (t.priority === "urgent" ? " urgent" : "") + '"><div class="rail"></div><div class="task-b">';
  h += '<div class="task-h"><div class="grow"><div class="task-t">' + esc(t.title) + "</div>";
  if (c) h += '<div class="task-c">' + esc(c.name) + (c.area ? " — " + esc(c.area) : "") + "</div>";
  h += "</div>" + (t.time ? '<span class="chip mono">' + esc(t.time) + "</span>" : "") + "</div>";
  if (t.details) h += '<div class="small" style="margin-top:4px;white-space:pre-wrap">' + esc(t.details) + "</div>";
  h += '<div class="chips"><span class="chip ' + st[1] + '">' + st[0] + '</span><span class="chip">' + esc(KIND[t.kind] || t.kind) + "</span>" + (t.priority === "urgent" ? '<span class="chip or">مستعجل</span>' : "") +
    (t.plan_id ? '<span class="chip warn">صيانة دورية</span>' : "") +
    (t.assignees || []).map(function (id) { return '<span class="chip blue">' + esc(uname(id)) + "</span>"; }).join("") +
    (reps.length ? '<span class="chip ok">📷 ' + reps.reduce(function (s, r) { return s + (r.photo_ids || []).length; }, 0) + "</span>" : "") + "</div>";
  h += '<div class="acts">';
  if (ml) h += '<a class="btn sm" href="' + esc(ml) + '" target="_blank" rel="noopener">📍 الموقع</a>';
  if (tl) h += '<a class="btn sm" href="' + esc(tl) + '">📞 اتصال</a>';
  if (mine || isBoss()) {
    if (t.status === "planned") h += '<button class="btn sm" data-act="taskSt" data-id="' + t.id + '" data-s="in_progress">▶︎ بلّشت</button>';
    if (t.status !== "done") h += '<button class="btn sm pri" data-act="report" data-task="' + t.id + '">📝 تقرير وصور</button>';
    if (t.status !== "done" && (myRep || isBoss())) h += '<button class="btn sm ok" data-act="taskSt" data-id="' + t.id + '" data-s="done">✓ خلصت</button>';
  }
  if (isBoss() && !opts.noEdit) h += '<button class="btn sm ghost" data-act="taskEdit" data-id="' + t.id + '">تعديل</button>';
  h += "</div>";
  if (opts.showReports && reps.length) h += reps.map(repBlock).join("");
  h += "</div></div>";
  return h;
}
function repBlock(r) {
  var hrs = hoursBetween(r.start_time, r.end_time);
  return '<div class="card tight" style="margin-top:8px;background:var(--sunk)"><div class="row between"><b class="small">' + esc(uname(r.user_id)) + '</b><span class="tiny muted mono">' +
    esc((r.start_time || "") + (r.end_time ? " → " + r.end_time : "")) + (hrs != null ? " · " + fmtH(hrs) : "") + "</span></div>" +
    (r.site ? '<div class="tiny muted">' + esc(r.site) + "</div>" : "") +
    '<div class="small" style="white-space:pre-wrap">' + esc(r.work) + '</div><div class="thumbs">' + thumbs(r.photos) + "</div>" +
    (r.user_id === S.me.id || isAdmin() ? '<div class="acts"><button class="btn sm ghost" data-act="report" data-id="' + r.id + '">تعديل</button></div>' : "") + "</div>";
}

/* ---------------- worker: today ---------------- */
function loadDay() { return api("day", { date: S.date }).then(function (d) { S.day = d; return d; }); }
function vWorkerToday(app) {
  loading(app);
  loadDay().then(function (d) {
    var h = dayBar();
    var tasks = d.tasks || [], reps = d.reports || [];
    var noRep = tasks.filter(function (t) { return t.status !== "done" && !reps.some(function (r) { return r.task_id === t.id && r.photo_ids.length; }); });
    if (S.date === S.today && beirutHour() >= 15 && (noRep.length || !reps.length))
      h += '<div class="banner warn">⚠️ <div><b>تقرير آخر النهار إلزامي</b><br>صوّر الشغل المنجز واكتب شو خلّصت' + (noRep.length ? " — باقي " + noRep.length + " مهمة بلا تقرير" : "") + ".</div></div>";
    h += '<div class="sec-h"><h2>مهامي</h2></div>';
    h += tasks.length ? tasks.map(function (t) { return taskCard(t); }).join("") : '<div class="card empty"><b>ما في مهام مسجّلة</b>إذا اشتغلت بموقع، اكتب تقرير تحت.</div>';
    h += '<div class="sec-h"><h2>تقاريري</h2><button class="btn sm pri" data-act="report">+ تقرير شغل</button></div>';
    h += reps.length ? reps.map(repBlock).join("") : '<div class="card empty">لسا ما في تقرير لهالنهار</div>';
    h += moneySection(d);
    app.innerHTML = h;
  }, function (e) { app.innerHTML = dayBar() + '<div class="banner bad">' + esc(e.message) + "</div>"; });
}
function moneySection(d) {
  var h = '<div class="sec-h"><h2>فواتير ومدفوعات</h2></div><div class="acts"><button class="btn sm" data-act="expense" data-k="goods">🧾 فاتورة بضاعة</button><button class="btn sm" data-act="expense" data-k="fuel">⛽ محروقات</button><button class="btn sm" data-act="payment">💵 دفعة / مقبوض</button></div>';
  var ex = d.expenses || [], py = d.payments || [];
  if (!ex.length && !py.length) return h + '<div class="tiny muted" style="margin-top:6px">البضاعة والمحروقات بتنحسب بس مع صورة الفاتورة والمصدر.</div>';
  h += '<div class="card" style="margin-top:10px">' + ex.map(function (e) {
    return '<div class="li"><div class="m"><div class="t">' + (e.kind === "fuel" ? "⛽ " : "🧾 ") + esc(e.item) + (e.qty ? " × " + esc(e.qty) : "") + '</div><div class="tiny muted">' + esc(e.source) +
      (isBoss() ? " · " + esc(uname(e.user_id)) : "") + (e.site ? " · " + esc(e.site) : "") + '</div><div class="thumbs">' + thumbs(e.photos) + '</div></div><div style="text-align:left"><b class="num">' + money(e.amount, e.currency) + "</b><br>" + stChip(e.status) + "</div></div>";
  }).join("") + py.map(function (p) {
    return '<div class="li"><div class="m"><div class="t">💵 ' + esc(PAYK[p.kind] || p.kind) + " — " + esc(p.party) + '</div><div class="tiny muted">' + esc(p.note || "") + (isBoss() ? " · " + esc(uname(p.user_id)) : "") +
      '</div><div class="thumbs">' + thumbs(p.photos) + '</div></div><div style="text-align:left"><b class="num">' + money(p.amount, p.currency) + "</b><br>" + stChip(p.status) + "</div></div>";
  }).join("") + "</div>";
  return h;
}
function stChip(s) { return s === "approved" ? '<span class="chip ok">معتمد</span>' : s === "rejected" ? '<span class="chip bad">مرفوض</span>' : '<span class="chip warn">بانتظار</span>'; }

/* ---------------- boss: today ---------------- */
function vBossToday(app) {
  loading(app);
  loadDay().then(function (d) {
    var tasks = d.tasks || [], reps = d.reports || [], ex = d.expenses || [];
    var done = tasks.filter(function (t) { return t.status === "done"; }).length;
    var nPh = reps.reduce(function (s, r) { return s + (r.photo_ids || []).length; }, 0);
    var pendEx = ex.filter(function (e) { return e.status === "pending"; }).length;
    var h = dayBar();
    h += '<div class="kpis"><div class="kpi"><b>' + tasks.length + '</b><span>مهمة</span></div><div class="kpi"><b>' + done + '</b><span>منجزة</span></div><div class="kpi"><b>' + reps.length +
      '</b><span>تقرير</span></div><div class="kpi ' + (pendEx ? "warn" : "") + '"><b>' + ex.length + '</b><span>فاتورة</span></div></div>';
    var logs = d.daylogs || [], myLog = logs.filter(function (l) { return l.foreman_id === S.me.id; })[0];
    if (S.me.role === "foreman") {
      h += '<div class="banner ' + (myLog && myLog.closed ? "ok" : "info") + '">🧾 <div class="grow"><b>الورقة اليومية: ' + (myLog ? (myLog.closed ? "مسكّرة ✓" : "مسودة") : "لسا ما انرفعت") +
        '</b><br><span class="small">صوّر الورقة اليدوية أو عبّيها من الموبايل.</span></div><button class="btn sm pri" data-act="go" data-v="log">فتح</button></div>';
    } else if (logs.length) {
      h += '<div class="banner ok">🧾 <div class="grow">' + logs.map(function (l) { return esc(uname(l.foreman_id)) + ": " + (l.closed ? "الورقة مسكّرة" : "مسودة") + (l.mode === "paper" ? " (ورقة)" : " (موبايل)"); }).join("<br>") + "</div></div>";
    }
    if (d.platform && d.platform.length) h += crossCheck(S.date, d.platform, reps);
    h += '<div class="sec-h"><h2>المهام</h2><button class="btn sm pri" data-act="taskNew">+ مهمة</button></div>';
    var people = field(), any = false;
    people.forEach(function (u) {
      var ts = tasks.filter(function (t) { return t.assignees.indexOf(u.id) >= 0; });
      var rs = reps.filter(function (r) { return r.user_id === u.id && !r.task_id; });
      if (!ts.length && !rs.length) return;
      any = true;
      var urs = reps.filter(function (r) { return r.user_id === u.id; });
      var hrs = urs.reduce(function (s, r) { var x = hoursBetween(r.start_time, r.end_time); return s + (x || 0); }, 0);
      h += '<div class="wk"><span class="person"><span class="av">' + esc(initials(u.name)) + "</span>" + esc(u.name) + '</span><span class="tiny muted">' +
        ts.filter(function (t) { return t.status === "done"; }).length + "/" + ts.length + " منجزة · " + urs.length + " تقرير" + (hrs ? " · " + fmtH(hrs) : "") + "</span></div>";
      h += ts.map(function (t) { return taskCard(t, { showReports: true }); }).join("");
      h += rs.map(repBlock).join("");
    });
    var orphan = tasks.filter(function (t) { return !t.assignees.length; });
    if (orphan.length) { any = true; h += '<div class="wk"><span>بلا عامل</span></div>' + orphan.map(function (t) { return taskCard(t); }).join(""); }
    if (!any) h += '<div class="card empty" style="margin-top:10px"><b>ما في مهام لهالنهار</b>زيد مهمة ووزّعها عالعمال؛ بتطلع عندهم عالموبايل مع موقع الزبون.</div>';
    h += '<div class="sec-h"><h2>تقريري</h2><button class="btn sm" data-act="report">+ تقرير</button></div>';
    h += moneySection(d);
    app.innerHTML = h;
  }, function (e) { app.innerHTML = dayBar() + '<div class="banner bad">' + esc(e.message) + "</div>"; });
}

/* Maher's sheet (from the platform) vs workers' own reports — confirmation only, never overrides the sheet */
function normName(s) { return String(s || "").replace(/[ىي]/g, "ي").replace(/[أإآا]/g, "ا").replace(/ة/g, "ه").replace(/\s+/g, " ").trim(); }
function crossIssues(date, pw, reps) {
  var out = [];
  field().forEach(function (u) {
    if (!u.platform_name) return;
    var sheet = (pw || []).filter(function (w) { return normName(w.name) === normName(u.platform_name); })[0];
    var mine = reps.filter(function (r) { return r.user_id === u.id; });
    if (!sheet && !mine.length) return;
    if (sheet && !mine.length) { out.push({ u: u, kind: "warn", msg: "بالورقة بس بلا تقرير منه" }); return; }
    if (!sheet && mine.length) { out.push({ u: u, kind: "bad", msg: "عنده تقرير بس مش مسجّل بورقة ماهر" }); return; }
    var st = mine.map(function (r) { return hm(r.start_time); }).filter(function (x) { return x != null; });
    var en = mine.map(function (r) { var e = hm(r.end_time); return e != null && e < 12 * 60 ? e + 720 : e; }).filter(function (x) { return x != null; });
    var sS = hm(sheet.start), sE = hm(sheet.end); if (sE != null && sE < 12 * 60) sE += 720;
    var notes = [];
    if (st.length && sS != null && Math.abs(Math.min.apply(null, st) - sS) > 30) notes.push("البداية: الورقة " + sheet.start + " · تقريره " + mine[0].start_time);
    if (en.length && sE != null && Math.abs(Math.max.apply(null, en) - sE) > 30) notes.push("الانتهاء: الورقة " + sheet.end + " · تقريره " + mine[mine.length - 1].end_time);
    if (notes.length) out.push({ u: u, kind: "warn", msg: notes.join(" — ") });
    else out.push({ u: u, kind: "ok", msg: "مطابق" });
  });
  return out;
}
function crossCheck(date, pw, reps) {
  var iss = crossIssues(date, pw, reps);
  if (!iss.length) return "";
  return '<div class="card" style="margin-top:12px"><div class="row between"><b>ورقة ماهر ↔ تقارير العمال</b><span class="tiny muted">للتأكيد بس</span></div>' + iss.map(function (x) {
    return '<div class="li"><span class="chip ' + x.kind + '">' + (x.kind === "ok" ? "✓" : "!") + '</span><div class="m"><b class="small">' + esc(x.u.name) + '</b> <span class="small muted">' + esc(x.msg) + "</span></div></div>";
  }).join("") + "</div>";
}

/* ---------------- plan (week board) ---------------- */
function vPlan(app) {
  loading(app);
  var from = S.weekFrom || S.today, to = addDays(from, 6);
  api("range", { date: from, to: to }).then(function (d) {
    S.cache.range = d;
    var h = '<div class="daybar"><button class="btn sm" data-act="week" data-n="-7">→</button><div class="d">' + dShort(from) + " – " + dShort(to) + '</div><button class="btn sm" data-act="week" data-n="7">←</button>' +
      (from !== S.today ? '<button class="btn sm" data-act="week" data-n="0">اليوم</button>' : "") + "</div>";
    h += '<div class="acts"><button class="btn sm pri" data-act="taskNew" data-date="' + from + '">+ مهمة</button><button class="btn sm" data-act="waPlan" data-date="' + addDays(S.today, 1) + '">📤 خطة بكرا عالواتساب</button><button class="btn sm" data-act="go" data-v="customers">🔁 صيانات دورية</button></div>';
    for (var i = 0; i < 7; i++) {
      var day = addDays(from, i), ts = (d.tasks || []).filter(function (t) { return t.date === day; });
      h += '<div class="wk ' + (day === S.today ? "today" : "") + '"><span>' + esc(dLabel(day)) + '</span><button class="btn sm ghost" data-act="taskNew" data-date="' + day + '">+</button></div>';
      if (!ts.length) { h += '<div class="tiny muted" style="padding:2px 4px 6px">' + (new Date(day + "T12:00:00Z").getUTCDay() === 0 ? "أحد" : "ما في مهام") + "</div>"; continue; }
      h += '<div class="card tight">' + ts.map(function (t) {
        var st = ST[t.status] || ST.planned;
        return '<div class="li" data-act="taskEdit" data-id="' + t.id + '" style="cursor:pointer"><div class="m"><div class="t">' + (t.priority === "urgent" ? "🔴 " : "") + esc(t.title) + '</div><div class="tiny muted">' +
          esc(t.customer_name || "") + (t.area ? " — " + esc(t.area) : "") + (t.time ? " · " + esc(t.time) : "") + '</div><div class="chips">' +
          (t.assignees || []).map(function (id) { return '<span class="chip blue">' + esc(uname(id)) + "</span>"; }).join("") + (t.assignees.length ? "" : '<span class="chip bad">بلا عامل</span>') +
          '</div></div><span class="chip ' + st[1] + '">' + st[0] + "</span></div>";
      }).join("") + "</div>";
    }
    app.innerHTML = h;
  }, function (e) { app.innerHTML = '<div class="banner bad">' + esc(e.message) + "</div>"; });
}

/* ---------------- customers ---------------- */
function loadCustomers(force) {
  if (S.cache.customers && !force) return Promise.resolve(S.cache.customers);
  return api("customers").then(function (l) { S.cache.customers = l || []; return S.cache.customers; });
}
function vCustomers(app) {
  loading(app);
  Promise.all([loadCustomers(true), api("plans")]).then(function (r) {
    var list = r[0], plans = r[1] || [];
    S.cache.plans = plans;
    var q = S.seg.cq || "";
    var h = '<div class="row" style="margin-top:12px"><input id="cq" class="grow" placeholder="دوّر على زبون أو منطقة" value="' + esc(q) + '" style="border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--surface);min-height:44px"><button class="btn pri" data-act="custNew">+ زبون</button></div>';
    var due = plans.filter(function (p) { return p.active && p.next_date <= addDays(S.today, 30); });
    if (due.length) {
      h += '<h2>صيانات دورية قريبة</h2><div class="card">' + due.map(function (p) {
        return '<div class="li"><div class="m"><div class="t">' + esc(p.title) + '</div><div class="tiny muted">' + esc(p.customer_name || "") + " · كل " + p.every_days + ' يوم</div></div><span class="chip ' + (p.next_date <= S.today ? "or" : "warn") + '">' + dShort(p.next_date) + "</span></div>";
      }).join("") + "</div>";
    }
    h += '<h2>الزبائن <span class="muted small">(' + list.length + ')</span></h2><div class="card" id="clist">' + custRows(list, q) + "</div>";
    app.innerHTML = h;
    $("#cq").addEventListener("input", function (e) { S.seg.cq = e.target.value; $("#clist").innerHTML = custRows(S.cache.customers, e.target.value); });
  }, function (e) { app.innerHTML = '<div class="banner bad">' + esc(e.message) + "</div>"; });
}
function custRows(list, q) {
  var n = normName(q);
  var l = list.filter(function (c) { return !n || normName(c.name + " " + (c.area || "") + " " + (c.phone || "")).indexOf(n) >= 0; });
  if (!l.length) return '<div class="empty">' + (list.length ? "ما في نتيجة" : "<b>ما في زبائن بعد</b>زيد الزبون مع موقعه (رابط خريطة أو GPS) — بيطلع للعامل زر «الموقع».") + "</div>";
  return l.map(function (c) {
    return '<div class="li" data-act="custOpen" data-id="' + c.id + '" style="cursor:pointer"><span class="av">' + esc(initials(c.name)) + '</span><div class="m"><div class="t">' + esc(c.name) + '</div><div class="tiny muted">' +
      esc(c.area || "") + (c.phone ? " · " + esc(c.phone) : "") + "</div></div>" + (mapLink(c) ? '<span class="chip ok">📍</span>' : '<span class="chip warn">بلا موقع</span>') + "</div>";
  }).join("");
}

/* ---------------- daily log (foreman sheet) ---------------- */
function vLog(app) {
  loading(app);
  loadDay().then(function (d) {
    var log = (d.daylogs || []).filter(function (l) { return l.foreman_id === S.me.id; })[0];
    var others = (d.daylogs || []).filter(function (l) { return l.foreman_id !== S.me.id; });
    if (!S.form || S.form._type !== "log" || S.form.date !== S.date) {
      S.form = { _type: "log", date: S.date, mode: log ? log.mode : "paper", sheet: log ? (log.sheet_photos || []) : [], workers: log ? log.workers : [], materials: log ? log.materials : [], payments: log ? log.payments : [], notes: log ? log.notes || "" : "", closed: log ? log.closed : false };
    }
    drawLog(app, others);
  }, function (e) { app.innerHTML = dayBar() + '<div class="banner bad">' + esc(e.message) + "</div>"; });
}
function drawLog(app, others) {
  var F = S.form;
  var h = dayBar();
  if (F.closed) h += '<div class="banner ok">✓ الورقة مسكّرة — بتنتقل لمنصة اليوميات أوتوماتيك. فيك تعدّل وتسكّر من جديد.</div>';
  if (S.me.role === "admin" && others) {
    h += others.map(function (l) { return '<div class="card" style="margin-top:10px"><b>' + esc(uname(l.foreman_id)) + "</b> · " + (l.closed ? "مسكّرة" : "مسودة") + " · " + (l.mode === "paper" ? "ورقة" : "موبايل") + '<div class="thumbs">' + thumbs(l.sheet_photos) + "</div>" + (l.mode === "app" ? logSummary(l) : "") + "</div>"; }).join("");
  }
  if (S.me.role === "admin" && !others.length) h += '<div class="card empty" style="margin-top:10px">ما في ورقة مرفوعة لهالنهار.</div>';
  if (S.me.role === "admin") { app.innerHTML = h; return; }
  h += '<div class="seg"><button data-act="logMode" data-m="paper" class="' + (F.mode === "paper" ? "on" : "") + '">📄 ورقة يدوية + صورة</button><button data-act="logMode" data-m="app" class="' + (F.mode === "app" ? "on" : "") + '">📱 تسجيل من الموبايل</button></div>';
  if (F.mode === "paper") {
    h += '<div class="card" style="margin-top:12px"><b>صوّر الورقة (الوجهين)</b><div class="tiny muted">صورة واضحة، من فوق، كل الورقة بالكادر.</div>' + photoField("sheet", [["sheet", "وجه"], ["sheet", "ضهر"]]) + "</div>";
  } else {
    h += '<div class="sec-h"><h3>العمال</h3><div class="row"><button class="btn sm" data-act="logFill">⤵︎ عبّي من المهام</button><button class="btn sm" data-act="logAdd" data-t="workers">+</button></div></div>';
    h += F.workers.map(function (w, i) {
      var ot = otOf(w);
      return '<div class="logrow"><div class="f2"><label class="f"><span>العامل</span><input list="dl_people" data-lf="workers.' + i + '.name" value="' + esc(w.name) + '"></label><label class="f"><span>الموقع</span><input list="dl_sites" data-lf="workers.' + i + '.site" value="' + esc(w.site) + '"></label></div>' +
        '<div class="f3"><label class="f"><span>بلّش</span><input type="time" data-lf="workers.' + i + '.start" value="' + esc(w.start) + '"></label><label class="f"><span>خلّص</span><input type="time" data-lf="workers.' + i + '.end" value="' + esc(w.end) + '"></label><label class="f"><span>إضافي</span><input inputmode="decimal" data-lf="workers.' + i + '.ot" value="' + esc(w.ot != null && w.ot !== "" ? w.ot : (ot != null ? ot : "")) + '" placeholder="' + (ot != null ? ot : "") + '"></label></div>' +
        '<label class="f"><span>الشغل المنجز</span><input data-lf="workers.' + i + '.work" value="' + esc(w.work) + '"></label><div class="acts"><button class="btn sm danger" data-act="logDel" data-t="workers" data-i="' + i + '">شيل</button></div></div>';
    }).join("") || '<div class="tiny muted">ما في عمال — كبس «عبّي من المهام».</div>';
    h += '<div class="sec-h"><h3>البضاعة المستعملة</h3><button class="btn sm" data-act="logAdd" data-t="materials">+</button></div>';
    h += F.materials.map(function (m, i) {
      return '<div class="logrow"><div class="f2"><label class="f"><span>الصنف</span><input data-lf="materials.' + i + '.item" value="' + esc(m.item) + '"></label><label class="f"><span>الكمية</span><input data-lf="materials.' + i + '.qty" value="' + esc(m.qty) + '"></label></div>' +
        '<div class="f2"><label class="f"><span>المصدر</span><input list="dl_src" data-lf="materials.' + i + '.source" value="' + esc(m.source) + '"></label><label class="f"><span>الموقع</span><input list="dl_sites" data-lf="materials.' + i + '.site" value="' + esc(m.site) + '"></label></div><div class="acts"><button class="btn sm danger" data-act="logDel" data-t="materials" data-i="' + i + '">شيل</button></div></div>';
    }).join("");
    h += '<div class="sec-h"><h3>مصاريف ودفعات</h3><button class="btn sm" data-act="logAdd" data-t="payments">+</button></div><div class="tiny muted">البضاعة والمحروقات اللي انشرت كاش بتنزل من «فاتورة بضاعة/محروقات» مع الصورة.</div>';
    h += F.payments.map(function (p, i) {
      return '<div class="logrow"><label class="f"><span>البيان</span><input data-lf="payments.' + i + '.description" value="' + esc(p.description) + '" placeholder="سلفة يحيى / واصل من زبون…"></label><div class="f3"><label class="f"><span>المبلغ</span><input inputmode="decimal" data-lf="payments.' + i + '.amount" value="' + esc(p.amount) + '"></label><label class="f"><span>العملة</span><select data-lf="payments.' + i + '.currency"><option' + (p.currency !== "LL" ? " selected" : "") + '>$</option><option value="LL"' + (p.currency === "LL" ? " selected" : "") + '>ل.ل</option></select></label><label class="f"><span>مين</span><input data-lf="payments.' + i + '.party" value="' + esc(p.party) + '"></label></div><div class="acts"><button class="btn sm danger" data-act="logDel" data-t="payments" data-i="' + i + '">شيل</button></div></div>';
    }).join("");
  }
  h += '<label class="f"><span>ملاحظات</span><textarea data-lf="notes">' + esc(F.notes) + "</textarea></label>";
  h += '<div class="acts" style="margin-top:14px"><button class="btn block" data-act="logSave" data-close="0">حفظ مسودة</button><button class="btn block or" data-act="logSave" data-close="1">✓ تسكير الورقة وإرسالها</button></div>';
  h += datalists();
  app.innerHTML = h;
}
function logSummary(l) {
  return '<div class="small" style="margin-top:6px">' + (l.workers || []).map(function (w) { return esc(w.name) + " " + esc(w.start || "") + "→" + esc(w.end || "") + " · " + esc(w.site || ""); }).join("<br>") + "</div>";
}
function otOf(w) {
  if (!w.start || !w.end) return null;
  var u = S.users.filter(function (x) { return normName(x.platform_name || x.name) === normName(w.name) || normName(x.name) === normName(w.name); })[0];
  if (u && u.role !== "worker") return null;
  var a = hm(w.start), b = hm(w.end); if (b < a) b += 720;
  var ot = (b - a) / 60 - 9;
  return Math.round(ot * 4) / 4;
}
function datalists() {
  var c = S.cache.customers || [];
  return '<datalist id="dl_people">' + field().map(function (u) { return '<option value="' + esc(u.platform_name || u.name) + '">'; }).join("") + '<option value="شغيل (مياوم)"></datalist>' +
    '<datalist id="dl_sites">' + c.map(function (x) { return '<option value="' + esc(x.platform_name || x.name) + '">'; }).join("") + "</datalist>" +
    '<datalist id="dl_src"><option value="iCOOL"><option value="مشتريات نقدية"><option value="حسن عيد"><option value="صالح"><option value="معتوق ستيل (خليل معتوق)"><option value="خزعل ستيل"><option value="ابراهيم طيراني"></datalist>';
}

/* ---------------- worker account (from منصة يوميات iCOOL) ---------------- */
function vAccount(app, name) {
  if (!name) { app.innerHTML = '<div class="card empty" style="margin-top:14px"><b>حسابك مش مربوط بعد</b>المدير بيربط اسمك باسمك عالمنصة.</div>'; return; }
  loading(app);
  api("balance", isAdmin() ? { name: name } : {}).then(function (j) { app.innerHTML = accountHtml(j.name, j.balance, j.updated_at); }, function (e) { app.innerHTML = '<div class="banner bad">' + esc(e.message) + "</div>"; });
}
function accountHtml(name, b, at) {
  if (!b) return '<div class="card empty" style="margin-top:14px"><b>لسا ما وصل الحساب</b>بينحسب من أوراق ماهر بمنصة اليوميات وبيتحدّث أوتوماتيك.</div>';
  var h = '<div class="card" style="margin-top:14px;text-align:center"><div class="muted small">' + esc(name) + " — " + (b.owed >= 0 ? "إلك" : "عليك") + '</div><div class="big-n ' + (b.owed >= 0 ? "pos" : "neg") + '">' + usd(Math.abs(b.owed)) + '</div><div class="tiny muted">من ' + esc(dShort(b.from)) + " لـ " + esc(dShort(b.to)) + " · آخر تحديث " + (at ? new Date(at).toLocaleString("ar-LB", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }) : "—") + "</div></div>";
  if (b.week) {
    h += '<h2>هالأسبوع</h2><div class="kpis"><div class="kpi"><b>' + (b.week.days || 0) + '</b><span>يوم</span></div><div class="kpi"><b>' + fmtH(b.week.ot || 0).replace(" س", "") + '</b><span>ساعة إضافي</span></div><div class="kpi"><b>' + usd(b.week.earned || 0) + '</b><span>الأسبوعية</span></div><div class="kpi"><b>' + usd(b.week.adv || 0) + "</b><span>سلف</span></div></div>";
  }
  h += '<h2>تفصيل الحساب</h2><div class="card"><table class="tbl"><tbody>';
  if (b.opening) h += '<tr><td>رصيد افتتاحي <span class="tiny muted">' + esc(dShort(b.opening.date)) + '</span></td><td class="n">' + usd(b.opening.owed) + "</td></tr>";
  if (b.monthly) h += "<tr><td>معاش " + (b.months || 0) + ' شهر</td><td class="n">' + usd(b.salary_due || 0) + "</td></tr>";
  else h += "<tr><td>" + (b.days || 0) + " يوم" + (b.half ? " (منهم " + b.half + " نص نهار)" : "") + ' × ' + usd(b.daily) + '</td><td class="n">' + usd(b.wage || 0) + "</td></tr>";
  if (b.ot_hours) h += "<tr><td>إضافي " + fmtH(b.ot_hours) + '</td><td class="n">' + usd(b.ot_pay || 0) + "</td></tr>";
  if (b.allowance) h += '<tr><td>بدل بنزين</td><td class="n">' + usd(b.allowance) + "</td></tr>";
  if (b.extra) h += '<tr><td>مدفوعات من جيبك</td><td class="n">' + usd(b.extra) + "</td></tr>";
  h += '<tr><td>سلف ودفعات قبضتها</td><td class="n">−' + usd(b.adv_total || 0) + "</td></tr>";
  h += '<tr><td><b>الباقي ' + (b.owed >= 0 ? "إلك" : "عليك") + '</b></td><td class="n"><b>' + usd(Math.abs(b.owed)) + "</b></td></tr></tbody></table></div>";
  if (b.advances && b.advances.length) {
    h += '<h2>السلف والدفعات</h2><div class="card"><table class="tbl"><thead><tr><th>التاريخ</th><th>البيان</th><th>المبلغ</th></tr></thead><tbody>' +
      b.advances.slice().reverse().map(function (a) { return '<tr><td class="n">' + dShort(a.date) + "</td><td>" + esc(a.desc || "") + '<div class="tiny muted">' + esc(a.src || "") + '</div></td><td class="n">' + usd(a.usd) + "</td></tr>"; }).join("") + "</tbody></table></div>";
  }
  if (b.lines && b.lines.length) {
    h += '<h2>دوامي</h2><div class="card scroll-x"><table class="tbl"><thead><tr><th>اليوم</th><th>الموقع</th><th>الوقت</th><th>إضافي</th><th>المستحق</th></tr></thead><tbody>' +
      b.lines.slice().reverse().map(function (a) { return '<tr><td class="n">' + esc(wday(a.date).slice(0, 3)) + " " + dShort(a.date) + "</td><td>" + esc(a.site || "") + '</td><td class="n">' + esc((a.start || "") + (a.end ? "–" + a.end : "")) + '</td><td class="n">' + (a.ot ? a.ot : "") + '</td><td class="n">' + usd(a.cost) + "</td></tr>"; }).join("") + "</tbody></table></div>";
  }
  h += '<div class="tiny muted" style="margin-top:10px">الحساب محسوب من أوراق ماهر بمنصة اليوميات (اليومية + الإضافي − السلف). إذا في شي مش مزبوط احكي ماهر أو المهندس.</div>';
  return h;
}

/* ---------------- review (admin) ---------------- */
function vReview(app) {
  var seg = S.seg.review || "money";
  var h = '<div class="seg"><button data-act="seg" data-k="review" data-v="money" class="' + (seg === "money" ? "on" : "") + '">الفواتير</button><button data-act="seg" data-k="review" data-v="prod" class="' + (seg === "prod" ? "on" : "") + '">الإنتاج</button><button data-act="seg" data-k="review" data-v="match" class="' + (seg === "match" ? "on" : "") + '">التطابق</button><button data-act="seg" data-k="review" data-v="acc" class="' + (seg === "acc" ? "on" : "") + '">الحسابات</button></div><div id="rv"><div class="empty"><span class="spin"></span></div></div>';
  app.innerHTML = h;
  var rv = $("#rv");
  if (seg === "money") {
    api("pending").then(function (d) {
      var ex = d.expenses || [], py = d.payments || [];
      var pe = ex.filter(function (e) { return e.status === "pending"; }), pp = py.filter(function (p) { return p.status === "pending"; });
      var x = '<div class="tiny muted" style="margin-top:10px">بانتظار الاعتماد: ' + pe.length + " فاتورة · " + pp.length + " دفعة. البضاعة والمحروقات بلا فاتورة ما بتنزل أصلاً.</div>";
      x += ex.map(function (e) {
        return '<div class="card" style="margin-top:10px"><div class="row between"><b>' + (e.kind === "fuel" ? "⛽ " : "🧾 ") + esc(e.item) + (e.qty ? " × " + esc(e.qty) : "") + '</b><b class="num">' + money(e.amount, e.currency) + '</b></div><div class="tiny muted">' + esc(dLabel(e.date)) + " · " + esc(e.user_name) + " · المصدر: " + esc(e.source) +
          (e.vehicle ? " · " + esc(e.vehicle) : "") + (e.customer_name || e.site ? " · " + esc(e.customer_name || e.site) : "") + (e.paid_by ? " · دفع: " + esc(e.paid_by) : "") + '</div><div class="thumbs">' + thumbs(e.photos) + '</div><div class="acts">' + stChip(e.status) +
          (e.status !== "approved" ? '<button class="btn sm ok" data-act="rv" data-t="expense" data-id="' + e.id + '" data-s="approved">اعتماد</button>' : "") + (e.status !== "rejected" ? '<button class="btn sm danger" data-act="rv" data-t="expense" data-id="' + e.id + '" data-s="rejected">رفض</button>' : "") + "</div></div>";
      }).join("");
      x += py.map(function (p) {
        return '<div class="card" style="margin-top:10px"><div class="row between"><b>💵 ' + esc(PAYK[p.kind]) + " — " + esc(p.party) + '</b><b class="num">' + money(p.amount, p.currency) + '</b></div><div class="tiny muted">' + esc(dLabel(p.date)) + " · " + esc(p.user_name) + (p.note ? " · " + esc(p.note) : "") + '</div><div class="thumbs">' + thumbs(p.photos) + '</div><div class="acts">' + stChip(p.status) +
          (p.status !== "approved" ? '<button class="btn sm ok" data-act="rv" data-t="payment" data-id="' + p.id + '" data-s="approved">اعتماد</button>' : "") + (p.status !== "rejected" ? '<button class="btn sm danger" data-act="rv" data-t="payment" data-id="' + p.id + '" data-s="rejected">رفض</button>' : "") + "</div></div>";
      }).join("");
      if (!ex.length && !py.length) x += '<div class="card empty" style="margin-top:10px">ما في فواتير ولا دفعات بآخر أسبوع.</div>';
      rv.innerHTML = x;
    }, function (e) { rv.innerHTML = '<div class="banner bad">' + esc(e.message) + "</div>"; });
  } else if (seg === "prod" || seg === "match") {
    var to = S.today, from = addDays(to, -6);
    api("range", { date: from, to: to }).then(function (d) {
      if (seg === "prod") rv.innerHTML = prodHtml(d, from, to);
      else rv.innerHTML = matchHtml(d, from, to);
    }, function (e) { rv.innerHTML = '<div class="banner bad">' + esc(e.message) + "</div>"; });
  } else {
    api("balances").then(function (list) {
      if (!list.length) { rv.innerHTML = '<div class="card empty" style="margin-top:10px"><b>لسا ما وصلت الحسابات</b>بتوصل لما تفتح منصة اليوميات (الربط أوتوماتيك).</div>'; return; }
      rv.innerHTML = '<div class="card" style="margin-top:10px">' + list.map(function (x) {
        var b = x.balance || {};
        return '<div class="li" data-act="accOpen" data-n="' + esc(x.name) + '" style="cursor:pointer"><span class="av">' + esc(initials(x.name)) + '</span><div class="m"><div class="t">' + esc(x.name) + '</div><div class="tiny muted">' + (b.monthly ? "معاش" : (b.days || 0) + " يوم · إضافي " + fmtH(b.ot_hours || 0)) + "</div></div><b class=\"num\" style=\"color:var(--" + ((b.owed || 0) >= 0 ? "ok" : "bad") + ')">' + usd(b.owed || 0) + "</b></div>";
      }).join("") + '</div><div class="tiny muted" style="margin-top:6px">موجب = إلو · سالب = عليه. من منصة اليوميات.</div>';
    }, function (e) { rv.innerHTML = '<div class="banner bad">' + esc(e.message) + "</div>"; });
  }
}
function prodHtml(d, from, to) {
  var rows = field().map(function (u) {
    var ts = (d.tasks || []).filter(function (t) { return t.assignees.indexOf(u.id) >= 0; });
    var rs = (d.reports || []).filter(function (r) { return r.user_id === u.id; });
    var days = {}; rs.forEach(function (r) { days[r.date] = 1; });
    var hrs = rs.reduce(function (s, r) { return s + (hoursBetween(r.start_time, r.end_time) || 0); }, 0);
    var ph = rs.reduce(function (s, r) { return s + (r.n_photos || 0); }, 0);
    var ex = (d.expenses || []).filter(function (e) { return e.user_id === u.id; });
    return { u: u, t: ts.length, done: ts.filter(function (t) { return t.status === "done"; }).length, r: rs.length, days: Object.keys(days).length, hrs: hrs, ph: ph, ex: ex.length };
  });
  return '<div class="tiny muted" style="margin-top:10px">' + dShort(from) + " → " + dShort(to) + '</div><div class="card scroll-x" style="margin-top:6px"><table class="tbl"><thead><tr><th>العامل</th><th>مهام</th><th>منجزة</th><th>أيام بتقرير</th><th>ساعات</th><th>صور</th><th>فواتير</th></tr></thead><tbody>' +
    rows.map(function (x) { return "<tr><td><b>" + esc(x.u.name) + '</b></td><td class="n">' + x.t + '</td><td class="n">' + x.done + '</td><td class="n">' + x.days + '</td><td class="n">' + (x.hrs ? Math.round(x.hrs * 10) / 10 : "—") + '</td><td class="n">' + x.ph + '</td><td class="n">' + x.ex + "</td></tr>"; }).join("") +
    "</tbody></table></div>";
}
function matchHtml(d, from, to) {
  var pd = {}; (d.platform || []).forEach(function (x) { pd[x.date] = x.workers; });
  var h = "", n = 0;
  for (var i = 0; i < 7; i++) {
    var day = addDays(to, -i);
    var reps = (d.reports || []).filter(function (r) { return r.date === day; });
    if (!pd[day] && !reps.length) continue;
    var iss = crossIssues(day, pd[day] || [], reps);
    if (!iss.length) continue;
    n++;
    h += '<div class="wk"><span>' + esc(dLabel(day)) + "</span>" + (pd[day] ? "" : '<span class="chip warn">الورقة لسا مش بالمنصة</span>') + '</div><div class="card tight">' + iss.map(function (x) {
      return '<div class="li"><span class="chip ' + x.kind + '">' + (x.kind === "ok" ? "✓" : "!") + '</span><div class="m"><b class="small">' + esc(x.u.name) + '</b> <span class="small muted">' + esc(x.msg) + "</span></div></div>";
    }).join("") + "</div>";
  }
  return '<div class="tiny muted" style="margin-top:10px">ورقة ماهر هي الأساس؛ تقارير العمال للتأكيد. أي اختلاف بيطلع هون.</div>' + (h || '<div class="card empty" style="margin-top:10px">ما في معطيات لآخر أسبوع.</div>');
}

/* ---------------- more / users ---------------- */
function vMore(app) {
  var h = '<div class="card" style="margin-top:14px"><div class="person"><span class="av">' + esc(initials(S.me.name)) + "</span><div><b>" + esc(S.me.name) + '</b><div class="tiny muted">' + esc(ROLE[S.me.role]) + (S.me.platform_name ? " · بالمنصة: " + esc(S.me.platform_name) : "") + "</div></div></div></div>";
  h += '<div class="card" style="margin-top:10px">';
  if (isBoss() && S.me.platform_name) h += '<div class="li" data-act="go" data-v="account" style="cursor:pointer"><span>💵</span><div class="m t">حسابي</div><span>‹</span></div>';
  if (isAdmin()) h += '<div class="li" data-act="go" data-v="users" style="cursor:pointer"><span>👥</span><div class="m t">المستخدمين والرموز</div><span>‹</span></div><a class="li" href="' + esc(C.platformUrl) + '" target="_blank" rel="noopener" style="text-decoration:none;color:inherit"><span>📊</span><div class="m t">منصة يوميات iCOOL</div><span>‹</span></a>';
  h += '<div class="li" data-act="pinChange" style="cursor:pointer"><span>🔑</span><div class="m t">غيّر رمز الدخول</div><span>‹</span></div>';
  h += '<div class="li" data-act="logout" style="cursor:pointer;color:var(--bad)"><span>⎋</span><div class="m t">خروج</div></div></div>';
  if (isBoss()) h += '<div id="syncSt" class="tiny muted" style="margin-top:10px"></div>';
  h += '<div class="card" style="margin-top:10px"><b>تنزيل عالشاشة الرئيسية</b><div class="small muted">آيفون: افتح الرابط بـ Safari ← زر المشاركة ⬆︎ ← «إضافة إلى الشاشة الرئيسية». أندرويد: ⋮ ← «تثبيت التطبيق».</div></div>';
  app.innerHTML = h;
  if (isBoss()) api("sync_status").then(function (s) {
    var el = $("#syncSt"); if (!el) return;
    el.textContent = "آخر ربط مع منصة اليوميات: " + (s.last ? new Date(s.last.at).toLocaleString("ar-LB") : "لسا") + " · أوراق بانتظار النقل: " + (s.pending_days || 0);
  }).catch(function () { });
}
function vUsers(app) {
  if (!isAdmin()) return go("more");
  loading(app);
  api("users").then(function (list) {
    S.cache.userList = list;
    app.innerHTML = '<div class="sec-h"><h2>المستخدمين</h2><button class="btn sm pri" data-act="userEdit">+ مستخدم</button></div><div class="card" style="margin-top:10px">' + list.map(function (u) {
      return '<div class="li" data-act="userEdit" data-id="' + u.id + '" style="cursor:pointer"><span class="av">' + esc(initials(u.name)) + '</span><div class="m"><div class="t">' + esc(u.name) + (u.active ? "" : ' <span class="chip bad">موقّف</span>') + '</div><div class="tiny muted">' + esc(ROLE[u.role]) +
        (u.platform_name ? " · بالمنصة: " + esc(u.platform_name) : "") + " · آخر دخول: " + (u.last_login ? new Date(u.last_login).toLocaleDateString("ar-LB") : "أبداً") + "</div></div><span>‹</span></div>";
    }).join("") + "</div>";
  }, function (e) { app.innerHTML = '<div class="banner bad">' + esc(e.message) + "</div>"; });
}

/* ---------------- bottom sheet ---------------- */
function sheet(html) { $("#sheet").innerHTML = html; $("#sheet").hidden = false; $("#sheetBg").hidden = false; document.body.style.overflow = "hidden"; $("#sheet").scrollTop = 0; }
function closeSheet() { $("#sheet").hidden = true; $("#sheetBg").hidden = true; document.body.style.overflow = ""; if (S.form && S.form._type !== "log") S.form = null; }
function sheetHead(t) { return '<div class="sheet-h"><h2>' + esc(t) + '</h2><button class="btn sm ghost" data-act="closeSheet">إغلاق</button></div>'; }
function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }

/* report form */
function openReport(taskId, repId) {
  var d = S.day || { tasks: [], reports: [] };
  var r = repId ? (d.reports || []).filter(function (x) { return x.id === repId; })[0] : null;
  var mine = (d.tasks || []).filter(function (t) { return isBoss() || t.assignees.indexOf(S.me.id) >= 0; });
  var t0 = taskId || (r && r.task_id) || "";
  var hr = beirutHour();
  S.form = { _type: "report", id: r ? r.id : "", photos: r ? (r.photos || []) : [] };
  var h = sheetHead(r ? "تعديل التقرير" : "تقرير الشغل") + '<div class="tiny muted">' + esc(dLabel(S.date)) + "</div>";
  h += '<label class="f"><span>المهمة</span><select id="r_task"><option value="">— شغل بلا مهمة —</option>' + mine.map(function (t) { return '<option value="' + t.id + '"' + (t.id === t0 ? " selected" : "") + ">" + esc(t.title + (t.customer ? " — " + t.customer.name : "")) + "</option>"; }).join("") + "</select></label>";
  h += '<label class="f" id="r_site_w"' + (t0 ? " hidden" : "") + '><span>الموقع / الزبون</span><input id="r_site" list="dl_sites" value="' + esc(r ? r.site : "") + '" placeholder="وين اشتغلت؟"></label>';
  h += '<div class="f2"><label class="f"><span>بلّشت</span><input id="r_start" type="time" value="' + esc(r ? r.start_time : "08:00") + '"></label><label class="f"><span>خلّصت</span><input id="r_end" type="time" value="' + esc(r ? r.end_time : (hr >= 12 && hr <= 19 ? String(hr).padStart(2, "0") + ":00" : "17:00")) + '"></label></div>';
  h += '<label class="f"><span>شو خلّصت بالتفصيل <b class="req">*</b></span><textarea id="r_work" placeholder="مثلاً: تركيب 2 مكيف 12000 بالصالون وغرفة النوم، تمديد نحاس 8 متر، تجربة وتشغيل">' + esc(r ? r.work : "") + "</textarea></label>";
  h += '<div class="f"><span>صور الشغل <b class="req">* إلزامي</b></span>' + photoField("photos", [["before", "قبل"], ["after", "منجز"]]) + "</div>";
  h += '<div class="sheet-f">' + (r ? '<button class="btn danger" data-act="delItem" data-t="report" data-id="' + r.id + '">حذف</button>' : "") + '<button class="btn pri" data-act="reportSave">حفظ التقرير</button></div>';
  h += datalists();
  sheet(h);
  loadCustomers().then(function () { var dl = document.getElementById("dl_sites"); if (dl) dl.outerHTML = datalists().match(/<datalist id="dl_sites">.*?<\/datalist>/)[0]; }).catch(function () { });
  $("#r_task").addEventListener("change", function (e) { $("#r_site_w").hidden = !!e.target.value; });
}
function saveReport(btn) {
  var F = S.form;
  if (!F.photos.length) return toast("التصوير إلزامي: صوّر الشغل المنجز");
  if (val("r_work").length < 8) return toast("اكتب تفاصيل الشغل المنجز");
  btn.disabled = true;
  api("report_save", { id: F.id, date: S.date, task_id: val("r_task"), site: val("r_site"), start_time: val("r_start"), end_time: val("r_end"), work: val("r_work"), photo_ids: F.photos.map(function (p) { return p.id; }) }).then(function () {
    var tid = val("r_task");
    closeSheet(); toast("انحفظ التقرير ✓");
    if (tid && !isBoss()) {
      var t = (S.day.tasks || []).filter(function (x) { return x.id === tid; })[0];
      if (t && t.status !== "done" && confirm("خلصت هالمهمة؟")) return api("task_status", { id: tid, status: "done" }).then(render, function (e) { fail(e); render(); });
    }
    render();
  }, function (e) { btn.disabled = false; fail(e); });
}

/* expense / payment forms */
function openExpense(kind) {
  S.form = { _type: "expense", kind: kind, photos: [] };
  var fuel = kind === "fuel";
  var h = sheetHead(fuel ? "محروقات" : "فاتورة بضاعة") + '<div class="banner info" style="margin-top:0">بلا صورة فاتورة ومصدر ما في صرف.</div>';
  h += '<div class="f"><span>صورة الفاتورة <b class="req">*</b></span>' + photoField("photos", [[fuel ? "fuel" : "invoice", "الفاتورة"]]) + "</div>";
  if (fuel) h += '<label class="f"><span>للسيارة</span><select id="e_vehicle"><option>فان</option><option>رابيد الفورمان</option><option>رابيد المحل</option><option>بيك أب</option><option>موتير</option><option>غيره</option></select></label>';
  else h += '<div class="f2"><label class="f"><span>الصنف <b class="req">*</b></span><input id="e_item" placeholder="شو اشتريت"></label><label class="f"><span>الكمية</span><input id="e_qty"></label></div>';
  h += '<div class="f2"><label class="f"><span>المبلغ <b class="req">*</b></span><input id="e_amount" inputmode="decimal"></label><label class="f"><span>العملة</span><select id="e_cur"><option value="$">$</option><option value="LL">ل.ل</option></select></label></div>';
  h += '<label class="f"><span>' + (fuel ? "المحطة" : "المصدر (المحل/المورد)") + ' <b class="req">*</b></span><input id="e_source" list="dl_src" placeholder="' + (fuel ? "اسم المحطة والبلدة" : "اسم المحل") + '"></label>';
  h += '<label class="f"><span>للموقع / الزبون</span><input id="e_site" list="dl_sites"></label>';
  h += '<label class="f"><span>مين دفع</span><select id="e_paid"><option value="' + esc(S.me.name) + ' — من جيبه">من جيبي</option><option value="من عهدة ماهر">من عهدة ماهر</option><option value="iCOOL">iCOOL (المهندس)</option><option value="على الحساب">على الحساب (دين)</option></select></label>';
  h += '<div class="sheet-f"><button class="btn pri" data-act="expenseSave">حفظ</button></div>' + datalists();
  sheet(h);
  loadCustomers().catch(function () { });
}
function saveExpense(btn) {
  var F = S.form;
  if (!F.photos.length) return toast("صوّر الفاتورة — بلا فاتورة ما في صرف");
  if (val("e_source").length < 2) return toast("اكتب المصدر");
  if (!(+val("e_amount") > 0)) return toast("اكتب المبلغ");
  btn.disabled = true;
  api("expense_save", { date: S.date, kind: F.kind, item: F.kind === "fuel" ? "بنزين/مازوت " + val("e_vehicle") : val("e_item"), qty: val("e_qty"), amount: val("e_amount"), currency: val("e_cur"), source: val("e_source"), vehicle: val("e_vehicle"), site: val("e_site"), paid_by: val("e_paid"), photo_ids: F.photos.map(function (p) { return p.id; }) })
    .then(function () { closeSheet(); toast("انحفظت ✓ — بانتظار الاعتماد"); render(); }, function (e) { btn.disabled = false; fail(e); });
}
function openPayment() {
  S.form = { _type: "payment", photos: [] };
  var h = sheetHead("دفعة / مقبوض");
  h += '<label class="f"><span>النوع</span><select id="p_kind">' + Object.keys(PAYK).map(function (k) { return '<option value="' + k + '">' + PAYK[k] + "</option>"; }).join("") + "</select></label>";
  h += '<div class="f2"><label class="f"><span>المبلغ <b class="req">*</b></span><input id="p_amount" inputmode="decimal"></label><label class="f"><span>العملة</span><select id="p_cur"><option value="$">$</option><option value="LL">ل.ل</option></select></label></div>';
  h += '<label class="f"><span>من مين / لمين <b class="req">*</b></span><input id="p_party" list="dl_people"></label><label class="f"><span>ملاحظة</span><input id="p_note"></label>';
  h += '<div class="f"><span>صورة (إيصال/تحويل Whish) — إذا في</span>' + photoField("photos", [["payment", "صورة"]]) + "</div>";
  h += '<div class="sheet-f"><button class="btn pri" data-act="paymentSave">حفظ</button></div>' + datalists();
  sheet(h);
}
function savePayment(btn) {
  if (!(+val("p_amount") > 0)) return toast("اكتب المبلغ");
  if (val("p_party").length < 2) return toast("مين قبض/دفع؟");
  btn.disabled = true;
  api("payment_save", { date: S.date, kind: val("p_kind"), amount: val("p_amount"), currency: val("p_cur"), party: val("p_party"), note: val("p_note"), photo_ids: S.form.photos.map(function (p) { return p.id; }) })
    .then(function () { closeSheet(); toast("انحفظت ✓"); render(); }, function (e) { btn.disabled = false; fail(e); });
}

/* task form */
function openTask(id, date) {
  var all = ((S.cache.range && S.cache.range.tasks) || []).concat((S.day && S.day.tasks) || []);
  var t = id ? all.filter(function (x) { return x.id === id; })[0] : null;
  if (id && !t) return toast("ما لقيت المهمة");
  loadCustomers().then(function (cs) {
    S.form = { _type: "task", id: id || "" };
    var people = field();
    var h = sheetHead(t ? "تعديل المهمة" : "مهمة جديدة");
    h += '<label class="f"><span>شو المهمة <b class="req">*</b></span><input id="t_title" value="' + esc(t ? t.title : "") + '" placeholder="مثلاً: تركيب مكيفين 12000"></label>';
    h += '<label class="f"><span>الزبون / الموقع</span><select id="t_cust"><option value="">— اختر —</option>' + cs.map(function (c) { return '<option value="' + c.id + '"' + (t && t.customer_id === c.id ? " selected" : "") + ">" + esc(c.name + (c.area ? " — " + c.area : "")) + "</option>"; }).join("") + '</select></label><button class="btn sm ghost" data-act="custNew" data-back="task">+ زبون جديد</button>';
    h += '<div class="f2"><label class="f"><span>اليوم</span><input id="t_date" type="date" value="' + esc(t ? t.date : (date || S.date || S.today)) + '"></label><label class="f"><span>الساعة</span><input id="t_time" type="time" value="' + esc(t ? t.time || "" : "") + '"></label></div>';
    h += '<label class="f"><span>النوع</span><select id="t_kind">' + Object.keys(KIND).map(function (k) { return '<option value="' + k + '"' + ((t ? t.kind : "work") === k ? " selected" : "") + ">" + KIND[k] + "</option>"; }).join("") + "</select></label>";
    h += '<div class="f"><span>مين رايح</span><div class="pick">' + people.map(function (u) { return '<label><input type="checkbox" name="t_as" value="' + u.id + '"' + (t && t.assignees.indexOf(u.id) >= 0 ? " checked" : "") + "><span>" + esc(u.name) + "</span></label>"; }).join("") + "</div></div>";
    h += '<label class="f"><span>تفاصيل وتعليمات</span><textarea id="t_details" placeholder="المواد اللازمة، شو لازم ينعمل…">' + esc(t ? t.details || "" : "") + "</textarea></label>";
    h += '<div class="pick" style="margin-top:10px"><label><input type="checkbox" id="t_urgent"' + (t && t.priority === "urgent" ? " checked" : "") + "><span>🔴 مستعجل</span></label></div>";
    h += '<div class="sheet-f">' + (t ? '<button class="btn danger" data-act="delItem" data-t="task" data-id="' + t.id + '">حذف</button>' : "") + '<button class="btn pri" data-act="taskSave">حفظ</button></div>';
    sheet(h);
  }, fail);
}
function saveTask(btn) {
  if (!val("t_title")) return toast("اكتب شو المهمة");
  var as = Array.prototype.map.call(document.querySelectorAll('input[name="t_as"]:checked'), function (x) { return x.value; });
  btn.disabled = true;
  api("task_save", { id: S.form.id, title: val("t_title"), customer_id: val("t_cust"), date: val("t_date"), time: val("t_time"), kind: val("t_kind"), assignees: as, details: val("t_details"), priority: $("#t_urgent").checked ? "urgent" : "normal" })
    .then(function () { closeSheet(); toast("انحفظت ✓"); render(); }, function (e) { btn.disabled = false; fail(e); });
}

/* customer form & detail */
function openCustomer(id, back) {
  var c = id ? (S.cache.customers || []).filter(function (x) { return x.id === id; })[0] : null;
  S.form = { _type: "cust", id: id || "", back: back || "" };
  var h = sheetHead(c ? "تعديل الزبون" : "زبون جديد");
  h += '<label class="f"><span>الاسم <b class="req">*</b></span><input id="c_name" value="' + esc(c ? c.name : "") + '"></label>';
  h += '<div class="f2"><label class="f"><span>التلفون</span><input id="c_phone" inputmode="tel" value="' + esc(c ? c.phone || "" : "") + '"></label><label class="f"><span>المنطقة</span><input id="c_area" value="' + esc(c ? c.area || "" : "") + '"></label></div>';
  h += '<label class="f"><span>رابط الموقع (Google Maps) أو إحداثيات</span><input id="c_map" value="' + esc(c ? (c.map_url || (c.lat != null ? c.lat + "," + c.lng : "")) : "") + '" placeholder="الصق رابط الموقع من واتساب"></label>';
  h += '<div class="acts"><button class="btn sm" data-act="gps">📍 موقعي الحالي (إذا إنت بالموقع)</button></div><div class="tiny muted" id="c_gps"></div>';
  h += '<label class="f"><span>العنوان / ملاحظات الوصول</span><input id="c_addr" value="' + esc(c ? c.address || "" : "") + '"></label>';
  h += '<label class="f"><span>الاسم بمنصة اليوميات (للربط بالحسابات)</span><input id="c_pname" list="dl_sites" value="' + esc(c ? c.platform_name || "" : "") + '"></label>';
  h += '<label class="f"><span>ملاحظات</span><textarea id="c_notes">' + esc(c ? c.notes || "" : "") + "</textarea></label>";
  h += '<div class="sheet-f"><button class="btn pri" data-act="custSave">حفظ</button></div>' + datalists();
  sheet(h);
}
function saveCustomer(btn) {
  if (!val("c_name")) return toast("اكتب اسم الزبون");
  var m = val("c_map"), co = parseCoords(m);
  btn.disabled = true;
  var back = S.form.back;
  api("customer_save", { id: S.form.id, name: val("c_name"), phone: val("c_phone"), area: val("c_area"), address: val("c_addr"), map_url: co && !/^https?:/.test(m) ? "" : m, lat: co ? co.lat : (S.form.lat || ""), lng: co ? co.lng : (S.form.lng || ""), platform_name: val("c_pname"), notes: val("c_notes") })
    .then(function () { S.cache.customers = null; closeSheet(); toast("انحفظ ✓"); if (back === "task") openTask(null, S.date); else render(); }, function (e) { btn.disabled = false; fail(e); });
}
function openCustomerDetail(id) {
  api("customer_get", { id: id }).then(function (d) {
    var c = d.customer, ml = mapLink(c), tl = telLink(c.phone);
    var h = sheetHead(c.name) + '<div class="small muted">' + esc(c.area || "") + (c.address ? " · " + esc(c.address) : "") + "</div>";
    h += '<div class="acts">' + (ml ? '<a class="btn sm" href="' + esc(ml) + '" target="_blank" rel="noopener">📍 الموقع</a>' : '<span class="chip warn">بلا موقع</span>') + (tl ? '<a class="btn sm" href="' + esc(tl) + '">📞 ' + esc(c.phone) + "</a>" : "") +
      (c.phone ? '<a class="btn sm" href="https://wa.me/' + waNumber(c.phone) + '" target="_blank" rel="noopener">واتساب</a>' : "") + '<button class="btn sm" data-act="custEdit" data-id="' + c.id + '">تعديل</button><button class="btn sm pri" data-act="taskForCust" data-id="' + c.id + '">+ مهمة</button></div>';
    if (c.notes) h += '<div class="small" style="margin-top:8px;white-space:pre-wrap">' + esc(c.notes) + "</div>";
    h += '<div class="sec-h"><h3>صيانة دورية</h3><button class="btn sm" data-act="planNew" data-c="' + c.id + '">+</button></div>';
    h += (d.plans || []).map(function (p) { return '<div class="li" data-act="planEdit" data-id="' + p.id + '" data-c="' + c.id + '" style="cursor:pointer"><div class="m"><div class="t">' + esc(p.title) + '</div><div class="tiny muted">كل ' + p.every_days + " يوم · الجاية " + dShort(p.next_date) + (p.active ? "" : " · موقّفة") + "</div></div><span>‹</span></div>"; }).join("") || '<div class="tiny muted">ما في. زيد صيانة (مثلاً مكيفات كل 180 يوم) وبتطلع مهمة لحالها.</div>';
    S.cache.custPlans = d.plans || [];
    h += "<h3>الشغل والصور</h3>";
    h += (d.reports || []).map(function (r) { return '<div class="card tight" style="margin-top:8px"><div class="row between"><b class="small">' + esc(uname(r.user_id)) + '</b><span class="tiny muted">' + esc(dLabel(r.date)) + '</span></div><div class="small" style="white-space:pre-wrap">' + esc(r.work) + '</div><div class="thumbs">' + thumbs(r.photos) + "</div></div>"; }).join("") || '<div class="tiny muted">لسا ما في تقارير.</div>';
    h += "<h3>المهام</h3>" + ((d.tasks || []).map(function (t) { var st = ST[t.status] || ST.planned; return '<div class="li"><div class="m"><div class="t small">' + esc(t.title) + '</div><div class="tiny muted">' + esc(dLabel(t.date)) + '</div></div><span class="chip ' + st[1] + '">' + st[0] + "</span></div>"; }).join("") || '<div class="tiny muted">ما في.</div>');
    sheet(h);
  }, fail);
}
function openPlan(cid, pid) {
  var p = pid ? (S.cache.custPlans || []).filter(function (x) { return x.id === pid; })[0] : null;
  S.form = { _type: "plan", id: pid || "", cid: cid };
  var h = sheetHead(p ? "تعديل الصيانة الدورية" : "صيانة دورية");
  h += '<label class="f"><span>شو الصيانة <b class="req">*</b></span><input id="pl_title" value="' + esc(p ? p.title : "صيانة مكيفات") + '"></label>';
  h += '<div class="f2"><label class="f"><span>كل كم يوم</span><select id="pl_every">' + [[30, "شهر"], [60, "شهرين"], [90, "3 أشهر"], [180, "6 أشهر"], [365, "سنة"]].map(function (o) { return '<option value="' + o[0] + '"' + ((p ? p.every_days : 180) === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") +
    '</select></label><label class="f"><span>أول موعد</span><input id="pl_next" type="date" value="' + esc(p ? p.next_date : addDays(S.today, 7)) + '"></label></div>';
  h += '<div class="f"><span>مين بيروح عادة</span><div class="pick">' + field().map(function (u) { return '<label><input type="checkbox" name="pl_as" value="' + u.id + '"' + (p && p.assignees.indexOf(u.id) >= 0 ? " checked" : "") + "><span>" + esc(u.name) + "</span></label>"; }).join("") + "</div></div>";
  h += '<label class="f"><span>ملاحظات (الأجهزة، العدد…)</span><textarea id="pl_notes">' + esc(p ? p.notes || "" : "") + "</textarea></label>";
  if (p) h += '<div class="pick" style="margin-top:10px"><label><input type="checkbox" id="pl_active"' + (p.active ? " checked" : "") + "><span>فعّالة</span></label></div>";
  h += '<div class="sheet-f">' + (p ? '<button class="btn danger" data-act="delItem" data-t="plan" data-id="' + p.id + '">حذف</button>' : "") + '<button class="btn pri" data-act="planSave">حفظ</button></div>';
  sheet(h);
}
function savePlan(btn) {
  if (!val("pl_title")) return toast("اكتب شو الصيانة");
  btn.disabled = true;
  var as = Array.prototype.map.call(document.querySelectorAll('input[name="pl_as"]:checked'), function (x) { return x.value; });
  var cid = S.form.cid;
  api("plan_save", { id: S.form.id, customer_id: cid, title: val("pl_title"), every_days: val("pl_every"), next_date: val("pl_next"), assignees: as, notes: val("pl_notes"), active: $("#pl_active") ? $("#pl_active").checked : true })
    .then(function () { toast("انحفظت ✓ — المهمة بتطلع بالجدول قبل موعدها بأسبوع"); openCustomerDetail(cid); }, function (e) { btn.disabled = false; fail(e); });
}

/* WhatsApp plan */
function openWaPlan(date) {
  api("range", { date: date, to: date }).then(function (d) {
    var ts = d.tasks || [];
    var h = sheetHead("خطة " + dLabel(date));
    if (!ts.length) { sheet(h + '<div class="empty">ما في مهام لهاليوم.</div>'); return; }
    field().forEach(function (u) {
      var mine = ts.filter(function (t) { return t.assignees.indexOf(u.id) >= 0; });
      if (!mine.length) return;
      var msg = "صباح الخير " + u.name + " 👋\nخطة " + dLabel(date) + ":\n" + mine.map(function (t, i) { return (i + 1) + ". " + (t.time ? t.time + " — " : "") + t.title + (t.customer_name ? " — " + t.customer_name : "") + (t.area ? " (" + t.area + ")" : ""); }).join("\n") +
        "\n\nالتفاصيل والموقع بالتطبيق: " + location.origin + "\nلا تنسى تقرير آخر النهار مع الصور 📷\n— iCOOL";
      var wn = waNumber(u.phone);
      h += '<div class="card" style="margin-top:10px"><div class="row between"><b>' + esc(u.name) + '</b><span class="tiny muted">' + mine.length + ' مهمة</span></div><div class="small" style="white-space:pre-wrap;margin-top:6px">' + esc(msg) + '</div><div class="acts">' +
        (wn ? '<a class="btn sm ok" href="https://wa.me/' + wn + "?text=" + encodeURIComponent(msg) + '" target="_blank" rel="noopener">ابعت واتساب</a>' : '<span class="tiny muted">ما في رقم — زيده من المستخدمين</span>') +
        '<button class="btn sm" data-act="copy" data-text="' + esc(msg) + '">نسخ</button></div></div>';
    });
    sheet(h);
  }, fail);
}

function openUser(id) {
  var u = id ? (S.cache.userList || []).filter(function (x) { return x.id === id; })[0] : null;
  S.form = { _type: "user", id: id || "" };
  var h = sheetHead(u ? "تعديل " + u.name : "مستخدم جديد");
  h += '<label class="f"><span>الاسم الكامل</span><input id="u_name" value="' + esc(u ? u.name : "") + '"></label>';
  h += '<label class="f"><span>الدور</span><select id="u_role">' + Object.keys(ROLE).map(function (k) { return '<option value="' + k + '"' + ((u ? u.role : "worker") === k ? " selected" : "") + ">" + ROLE[k] + "</option>"; }).join("") + "</select></label>";
  h += '<label class="f"><span>اسمه بمنصة اليوميات (للحساب والتطابق)</span><input id="u_pname" value="' + esc(u ? u.platform_name || "" : "") + '" placeholder="متل ما بيكتبه ماهر: يحيى، علي…"></label>';
  h += '<label class="f"><span>تلفون (للواتساب)</span><input id="u_phone" inputmode="tel" value="' + esc(u ? u.phone || "" : "") + '"></label>';
  h += '<label class="f"><span>' + (u ? "رمز جديد (اتركه فاضي بلا تغيير)" : "رمز الدخول") + '</span><input id="u_pin" inputmode="numeric" maxlength="6" placeholder="4–6 أرقام"></label>';
  if (u) h += '<div class="pick" style="margin-top:10px"><label><input type="checkbox" id="u_active"' + (u.active ? " checked" : "") + "><span>فعّال</span></label></div>";
  h += '<div class="sheet-f"><button class="btn pri" data-act="userSave">حفظ</button></div>';
  sheet(h);
}

/* ---------------- events ---------------- */
var ACT = {
  reload: function () { location.reload(); },
  pickUser: function (el) { L.user = el.dataset.id || null; L.pin = ""; drawLogin(); },
  pin: function (el) { if (L.pin.length < 6) L.pin += el.dataset.k; drawLogin(); if (L.pin.length === 6) tryLogin(); },
  pinBack: function () { L.pin = L.pin.slice(0, -1); drawLogin(); },
  pinGo: tryLogin,
  go: function (el) { go(el.dataset.v); },
  logout: function () { if (confirm("أكيد بدك تطلع؟")) logout(); },
  day: function (el) { var n = +el.dataset.n; S.date = n === 0 ? S.today : addDays(S.date, n); if (S.form && S.form._type === "log") S.form = null; render(); },
  week: function (el) { var n = +el.dataset.n; S.weekFrom = n === 0 ? S.today : addDays(S.weekFrom, n); render(); },
  seg: function (el) { S.seg[el.dataset.k] = el.dataset.v; render(); },
  closeSheet: closeSheet,
  view: function (el) { $("#viewerImg").src = el.dataset.src; $("#viewer").hidden = false; },
  closeViewer: function () { $("#viewer").hidden = true; $("#viewerImg").src = ""; },
  rmPhoto: function (el) { var k = el.dataset.key; S.form[k].splice(+el.dataset.i, 1); refreshPhotos(k, kindsFor(k)); },
  taskSt: function (el) {
    var s = el.dataset.s;
    if (s === "done" && !confirm("أكّد إنو المهمة خلصت؟")) return;
    api("task_status", { id: el.dataset.id, status: s }).then(function () { toast(s === "done" ? "منجزة ✓" : "بالتوفيق 💪"); render(); }, function (e) { fail(e); if (e.code === "photos") openReport(el.dataset.id); });
  },
  report: function (el) { openReport(el.dataset.task || "", el.dataset.id || ""); },
  reportSave: saveReport,
  expense: function (el) { openExpense(el.dataset.k); },
  expenseSave: saveExpense,
  payment: openPayment,
  paymentSave: savePayment,
  taskNew: function (el) { openTask(null, el.dataset.date || S.date); },
  taskEdit: function (el) { openTask(el.dataset.id); },
  taskSave: saveTask,
  taskForCust: function (el) { var id = el.dataset.id; openTask(null, S.today); setTimeout(function () { var s = $("#t_cust"); if (s) s.value = id; }, 300); },
  custNew: function (el) { openCustomer(null, el.dataset.back); },
  custEdit: function (el) { openCustomer(el.dataset.id); },
  custOpen: function (el) { openCustomerDetail(el.dataset.id); },
  custSave: saveCustomer,
  gps: function () {
    var o = $("#c_gps"); o.textContent = "عم جيب الموقع…";
    if (!navigator.geolocation) { o.textContent = "الموبايل ما بيدعم الموقع"; return; }
    navigator.geolocation.getCurrentPosition(function (p) {
      S.form.lat = +p.coords.latitude.toFixed(6); S.form.lng = +p.coords.longitude.toFixed(6);
      $("#c_map").value = S.form.lat + "," + S.form.lng; o.textContent = "✓ انحفظ موقعك (دقة " + Math.round(p.coords.accuracy) + " م)";
    }, function () { o.textContent = "ما قدرت جيب الموقع — اسمح للموقع من الإعدادات"; }, { enableHighAccuracy: true, timeout: 15000 });
  },
  planNew: function (el) { openPlan(el.dataset.c); },
  planEdit: function (el) { openPlan(el.dataset.c, el.dataset.id); },
  planSave: savePlan,
  waPlan: function (el) { openWaPlan(el.dataset.date); },
  copy: function (el) { var t = el.dataset.text; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast("انتسخ ✓"); }, function () { toast("ما زبط النسخ"); }); },
  delItem: function (el) {
    if (!confirm("أكيد بدك تحذف؟")) return;
    var t = el.dataset.t;
    api("delete", { table: t, id: el.dataset.id }).then(function () { toast("انحذف"); if (t === "plan") { closeSheet(); render(); } else { closeSheet(); render(); } }, fail);
  },
  rv: function (el) { api("review", { table: el.dataset.t, id: el.dataset.id, status: el.dataset.s }).then(function () { toast(el.dataset.s === "approved" ? "اعتُمد ✓" : "انرفض"); render(); }, fail); },
  accOpen: function (el) { var n = el.dataset.n; api("balance", { name: n }).then(function (j) { sheet(sheetHead("حساب " + n) + accountHtml(n, j.balance, j.updated_at)); }, fail); },
  logMode: function (el) { S.form.mode = el.dataset.m; drawLog($("#app"), []); },
  logAdd: function (el) {
    var t = el.dataset.t;
    S.form[t].push(t === "workers" ? { name: "", start: "08:00", end: "17:00", site: "", work: "" } : t === "materials" ? { item: "", qty: "", source: "", site: "" } : { description: "", amount: "", currency: "$", party: "" });
    drawLog($("#app"), []);
  },
  logDel: function (el) { S.form[el.dataset.t].splice(+el.dataset.i, 1); drawLog($("#app"), []); },
  logFill: function () {
    var d = S.day || {}, F = S.form, have = {};
    F.workers.forEach(function (w) { have[normName(w.name)] = 1; });
    field().forEach(function (u) {
      var nm = u.platform_name || u.name; if (have[normName(nm)]) return;
      var ts = (d.tasks || []).filter(function (t) { return t.assignees.indexOf(u.id) >= 0; });
      var rs = (d.reports || []).filter(function (r) { return r.user_id === u.id; });
      if (!ts.length && !rs.length) return;
      var cust = ts[0] && ts[0].customer;
      F.workers.push({ name: nm, start: (rs[0] && rs[0].start_time) || "08:00", end: (rs.length && rs[rs.length - 1].end_time) || "17:00",
        site: cust ? (cust.platform_name || cust.name) : ((rs[0] && rs[0].site) || ""), work: ts.map(function (t) { return t.title; }).join(" + ") || ((rs[0] && rs[0].work) || "") });
    });
    drawLog($("#app"), []);
    toast("انعبّى من المهام والتقارير — راجع الأوقات");
  },
  logSave: function (el) {
    var F = S.form, close = el.dataset.close === "1";
    if (close && F.mode === "paper" && !F.sheet.length) return toast("صوّر الورقة قبل التسكير");
    if (close && F.mode === "app" && !F.workers.length) return toast("زيد العمال قبل التسكير");
    el.disabled = true;
    var workers = F.workers.map(function (w) { var o = Object.assign({}, w); if (o.ot === "" || o.ot == null) o.ot = otOf(w); else o.ot = +o.ot; return o; });
    api("daylog_save", { date: S.date, mode: F.mode, sheet_photo_ids: F.sheet.map(function (p) { return p.id; }), workers: workers, materials: F.materials, payments: F.payments, notes: F.notes, closed: close })
      .then(function () { F.closed = close; toast(close ? "تسكّرت الورقة ✓" : "انحفظت المسودة"); drawLog($("#app"), []); }, function (e) { el.disabled = false; fail(e); });
  },
  pinChange: function () {
    var o = prompt("الرمز القديم"); if (!o) return;
    var n = prompt("الرمز الجديد (4–6 أرقام)"); if (!n) return;
    api("pin_change", { old: o, new: n }).then(function () { toast("تغيّر الرمز ✓"); }, fail);
  },
  userEdit: function (el) { openUser(el.dataset.id); },
  userSave: function (el) {
    if (!val("u_name")) return toast("اكتب الاسم");
    el.disabled = true;
    api("user_save", { id: S.form.id, name: val("u_name"), role: val("u_role"), platform_name: val("u_pname"), phone: val("u_phone"), pin: val("u_pin"), active: $("#u_active") ? $("#u_active").checked : true })
      .then(function () { closeSheet(); toast("انحفظ ✓"); api("boot").then(function (j) { S.users = j.users; }); render(); }, function (e) { el.disabled = false; fail(e); });
  }
};
function kindsFor(k) { return k === "sheet" ? [["sheet", "وجه"], ["sheet", "ضهر"]] : S.form._type === "report" ? [["before", "قبل"], ["after", "منجز"]] : S.form._type === "payment" ? [["payment", "صورة"]] : [[S.form.kind === "fuel" ? "fuel" : "invoice", "الفاتورة"]]; }

document.addEventListener("click", function (e) {
  var el = e.target.closest("[data-act]");
  if (!el) { if (e.target.id === "sheetBg") closeSheet(); return; }
  var f = ACT[el.dataset.act]; if (!f) return;
  if (el.tagName === "A") return;
  e.preventDefault(); f(el, e);
});
document.addEventListener("change", function (e) {
  var el = e.target;
  if (el.dataset && el.dataset.up) {
    var key = el.dataset.up, kind = el.dataset.kind, files = Array.prototype.slice.call(el.files || []);
    if (!files.length || !S.form) return;
    var kinds = kindsFor(key), date = S.date || S.today;
    S.form[key] = S.form[key] || [];
    S.form["_up_" + key] = (S.form["_up_" + key] || 0) + files.length; refreshPhotos(key, kinds);
    files.reduce(function (p, f) {
      return p.then(function () {
        return uploadPhoto(f, kind, date).then(function (ph) { S.form[key].push(ph); }, fail).then(function () { S.form["_up_" + key]--; refreshPhotos(key, kinds); });
      });
    }, Promise.resolve());
    return;
  }
});
document.addEventListener("input", function (e) {
  var el = e.target, k = el.dataset && el.dataset.lf;
  if (!k || !S.form) return;
  var parts = k.split("."), o = S.form;
  for (var i = 0; i < parts.length - 1; i++) o = o[parts[i]];
  o[parts[parts.length - 1]] = el.value;
});
document.addEventListener("keydown", function (e) {
  if (!S.token && L.user && /^\d$/.test(e.key)) { ACT.pin({ dataset: { k: e.key } }); }
  if (!S.token && L.user && e.key === "Enter") tryLogin();
  if (!S.token && L.user && e.key === "Backspace") ACT.pinBack();
  if (e.key === "Escape") { closeSheet(); ACT.closeViewer(); }
});
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "visible" && S.token) {
    var t = beirutToday();
    if (S.today && t !== S.today) { if (S.date === S.today) S.date = t; S.today = t; }
    if (!$("#sheet").hidden) return;
    render();
  }
});

/* ---------------- start ---------------- */
try { var saved = JSON.parse(localStorage.getItem(LS) || "null"); if (saved && saved.token) { S.token = saved.token; S.ticket = saved.ticket; S.me = saved.me; } } catch (e) { }
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(function () { });
if (S.token) boot().catch(function (e) { if (S.token) { $("#app").innerHTML = '<div class="banner bad" style="margin-top:20px">' + esc(e.message) + '</div><button class="btn pri" style="margin-top:12px" data-act="reload">جرّب مرة تانية</button>'; } });
else showLogin();
window.__dr = { S: S, api: api, otOf: otOf, crossIssues: crossIssues, parseCoords: parseCoords };
})();
