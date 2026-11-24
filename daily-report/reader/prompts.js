// Handwriting rules for iCOOL paper sheets (used by reader/index.html, the claude.ai reader) — condensed from منصة يوميات iCOOL (config/analysis_prompt + config/foreman,
// verified on Maher's sheets). Keep in step with the platform when its lessons change.

const RULES = `FOREMAN / CREW HANDWRITING RULES (iCOOL, verified on Maher's sheets)
DIGITS: 5 looks like S (S4=54, 1S=15); 2 has a flat base; 7 always has a middle bar (no bar = 3); 00 = two joined loops or raised oo (15oo=1500; count loops: 100 vs 1000); ':' in times may be written '/' (9/0=9:00); wavy zeros (8:10 may be 8:00) but a clear 8:10/8:30 is real; "01:00" may mean 10:00.
DASH = DECIMAL: 3-5=3.5, 26-5=26.5, 1-70=1.70 m; time 10-5=10:30; OT 1-20 = 1h20m.
TIMES: end times are PM (5:30 = 17:30). Workday 8:00-17:00. OT = (end - start) - 9h for workers; the foreman (ماهر) never has OT.
MONEY: $ = S with 1-2 strokes, usually before the number ($25 can look 525/825), sometimes after (16$). Lira in thousands: '300 ل' = 300,000 LL (keep written value, currency LL, note x1000). Bare number in the qty of a cash line = $ price. Saturday advances without symbol = $.
UNITS: 'م' after a size = mm (looks like 9: 20م~920); مر/مثر = متر; Ø = mm; inch = apostrophe; برمة/ربطة = whole coil; 'ك' on an install line = كامل.
DITTO '——' or " = same as the row above (in the item column only the new size is written).
DOUBLE ENTRY: the same expense may be written twice; a crossed line (big X) is rewritten below — mark crossed_out.
TYPICAL $: van fuel 20-30, Rapid fuel 40-57 (70-80 long trips), generator diesel 10, AC wash 15, day labourer 25, advances 20-300. Re-check any number outside these ranges.
VOCABULARY: مبروم (looks هيبرو/صبروم) = multicore, 4-1-5 = 4x1.5; مفرد = single-core; شيب = شيب كوشوك; رول بولت; مسيفور = MC4; اسبيدي = SPD; بيفسي = PVC; الضوية = lamp; HISEP = HISENSE; جوان; سوتش; كاش كابل = lug; دجنتير = breaker; تابلو; قرل/قطل = قسطل; كات 6 = كابل 6مم; ستانلس; رديتير; جوهرة; صاج; كوع قائم.
NAMES: «علي» can look like «دكي/كلي»; main electrical supplier is حسن عيد (looks علي عيد); صالح = MS supplier; حمادة = Jomaa; محل / احمد ناصر = iCOOL stock; مشتريات = cash purchase.
CREW: ماهر (foreman), يحيى (Yahya Halaqi), يحيى غندور (foreman), علي, حسن, مخلص, عبد الفتاح (فتاح), شغيل = day labourer.
QUALITY: never invent. Unreadable or doubtful → keep your best reading, set "uncertain" with the alternatives. Read text outside the tables too.`;

const SITE = `Read the photo(s) of ONE handwritten iCOOL «ورقة الموقع اليومية» (site daily sheet, Arabic, right-to-left, A4).
Printed layout: header (date, customer, site, phone, address) · table الفريق (worker | وصل | طلع | توقيع) · الشغل المنجز (free lines) ·
table البضاعة (الصنف | الكمية | استلام / استعمال / باقي | المكان | المصدر) · table مصاريف (البيان | المبلغ | مين دفع | فاتورة؟) ·
table دفعات ومقبوضات (البيان | المبلغ | من / إلى) · footer notes (missing customer info) + signature.
Context from the app (customer/site the sheet was opened for): {{HINT}}

${RULES}

Map each goods line: kind = "received" (استلام/استلمنا/وصل) | "used" (استعمال/استعملنا/ركّبنا) | "left" (باقي/بقي/مرتجع بالسيارة).
place must be one of: "بالموقع", "بالفان", "برابيد الفورمان", "برابيد المحل", "بالبيك أب", "بالمحل / المستودع" (map فان→بالفان, رابيد ماهر→برابيد الفورمان, محل/مستودع→بالمحل / المستودع; unknown → "بالموقع").
Expense kind: "fuel" (بنزين/مازوت/محروقات), "repair" (تصليح/زيت/دولاب/كراج), "goods" (بضاعة/مشتريات), "other".
paid_by: as written («من عهدة ماهر», «من جيبه», «iCOOL», «على الحساب»…). Payment kind: "advance" (سلفة/دفعة لعامل), "customer_receipt" (واصل/قبضنا من الزبون), "wage" (يومية/أجرة شغيل), "other".

OUTPUT: ONLY one JSON object, no prose, no code fence:
{"date":"YYYY-MM-DD or null","customer":"as written or null","site":"as written or null","phone":"or null","address":"or null",
 "crew":[{"name":"","arrive":"HH:MM","leave":"HH:MM","uncertain":null}],
 "work":"the work-done lines joined with ' — '",
 "materials":[{"item":"","qty":"","unit":null,"kind":"used","place":"بالموقع","source":null,"crossed_out":false,"uncertain":null}],
 "expenses":[{"kind":"fuel","item":"","amount":"","currency":"$","paid_by":null,"has_invoice":null,"uncertain":null}],
 "payments":[{"kind":"other","description":"","amount":"","currency":"$","party":"","uncertain":null}],
 "notes":"footer notes or null","confidence":"high|medium|low","doubts":["short Arabic notes on anything unsure"]}`;

const DAYLOG = `Read the photo(s) of ONE handwritten iCOOL daily log sheet «جدول يومية» by foreman Maher (Arabic, right-to-left).
LAYOUT: top-left weekday + date D/M/YYYY (day first). TOP TABLE (workers), right→left: # | name | start | end | site | work done | OT (اضافي);
rows 5-8 and the space below often hold cash expenses, not workers. BOTTOM: two tables # | item | qty | source | site (right mostly materials,
left cash lines: بنزين، دفعة، واصل، غسيل، فعلة). Read writing outside the tables too. Date hint: {{HINT}}

${RULES}

Workers: one entry per name (ماهر first). Times as written. Expand ditto. The OT column is often half a row off: OT numbers go to the non-Maher workers in order; check each with end-start-9h.
Materials: one entry per written row (crossed rows too, crossed_out:true). Rows under a written site inherit it. Empty source stays null.
Payments: every money line (fuel, diesel, repair, wash, tip, wage, دفعة, واصل, any $ or ل amount without goods) → payments, never materials.

OUTPUT: ONLY one JSON object, no prose, no code fence:
{"date":"YYYY-MM-DD or null","weekday":"","workers":[{"name":"","start":"8:00","end":"5:00","site":"","work":"","ot":null,"uncertain":null}],
 "materials":[{"item":"","qty":"","source":null,"site":null,"crossed_out":false,"uncertain":null}],
 "payments":[{"description":"","amount":"","currency":"$","party":"","crossed_out":false,"uncertain":null}],
 "notes":null,"confidence":"high|medium|low","doubts":["short Arabic notes on anything unsure"]}`;

module.exports = { SITE, DAYLOG };
