(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var DRAFT_KEY = "seo-dashboard-working-copy-v1";
  var data = { site: { name: "" }, months: [] };

  var MAIN = [
    ["clicks", "Organic clicks", "Search Console total clicks"],
    ["brandClicks", "Brand clicks", ""],
    ["nonBrandClicks", "Non-brand clicks", ""],
    ["organicSearchSessions", "Organic search sessions", "Analytics"],
    ["totalOrganicSessions", "Total organic sessions", "Analytics"],
    ["impressions", "Impressions", "Search Console"],
    ["ctr", "Average CTR (%)", "For example 1.6"],
    ["avgPosition", "Average position", "Search Console"],
    ["healthScore", "SEO health score", "Out of 100"]
  ];
  var DEV = [["dev-desktop", "Desktop (%)"], ["dev-mobile", "Mobile (%)"], ["dev-tablet", "Tablet (%)"],
             ["ai-ChatGPT", "ChatGPT referrals"], ["ai-Claude", "Claude referrals"], ["ai-Perplexity", "Perplexity referrals"]];

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function val(id) { var v = $(id).value.trim(); return v === "" ? null : Number(v); }
  function monthLabel(key) {
    var p = key.split("-");
    return new Date(Date.UTC(+p[0], +p[1] - 1, 1)).toLocaleString("en", { month: "long", year: "numeric", timeZone: "UTC" });
  }
  function nextMonth(key) {
    var p = key.split("-"), y = +p[0], m = +p[1] + 1;
    if (m > 12) { m = 1; y++; }
    return y + "-" + (m < 10 ? "0" : "") + m;
  }
  function field(id, label, hint, step) {
    return '<div class="field"><label for="' + id + '">' + esc(label) + '</label><input type="number" id="' + id + '" step="' + (step || "any") + '">' + (hint ? '<span class="hint">' + esc(hint) + "</span>" : "") + "</div>";
  }

  $("f-main").innerHTML = MAIN.map(function (f) { return field("f-" + f[0], f[1], f[2]); }).join("");
  $("f-dev").innerHTML = DEV.map(function (f) { return field(f[0], f[1], ""); }).join("");

  function sortMonths() { data.months.sort(function (a, b) { return a.month < b.month ? -1 : 1; }); }
  function find(key) { for (var i = 0; i < data.months.length; i++) if (data.months[i].month === key) return data.months[i]; return null; }

  function refreshPick(selected) {
    sortMonths();
    $("pick").innerHTML = '<option value="__new">New month</option>' + data.months.slice().reverse().map(function (m) {
      return '<option value="' + esc(m.month) + '">' + esc(m.label) + "</option>";
    }).join("");
    $("pick").value = selected || "__new";
    $("preview").value = JSON.stringify(data, null, 2);
  }

  /* ---- rows ---- */
  function leadRow(name, v) {
    return '<div class="list-row leads"><input type="text" class="l-name" value="' + esc(name) + '" aria-label="Page type" placeholder="Page type">' +
      '<input type="number" class="l-val" step="any" value="' + (v === null || v === undefined ? "" : v) + '" aria-label="Leads">' +
      '<button type="button" class="btn secondary small rm" aria-label="Remove row">Remove</button></div>';
  }
  function kwRow(k, vol, pos) {
    return '<div class="list-row"><input type="text" class="k-name" value="' + esc(k) + '" aria-label="Keyword" placeholder="Keyword">' +
      '<input type="number" class="k-vol" step="any" value="' + (vol === null || vol === undefined ? "" : vol) + '" aria-label="Monthly searches" placeholder="Searches">' +
      '<input type="number" class="k-pos" step="any" value="' + (pos === null || pos === undefined ? "" : pos) + '" aria-label="Position" placeholder="Position">' +
      '<button type="button" class="btn secondary small rm" aria-label="Remove row">Remove</button></div>';
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest(".rm");
    if (b) { b.parentNode.parentNode.removeChild(b.parentNode); checks(); }
  });
  $("add-lead").addEventListener("click", function () { $("lead-rows").insertAdjacentHTML("beforeend", leadRow("", null)); });
  $("add-kw").addEventListener("click", function () { $("kw-rows").insertAdjacentHTML("beforeend", kwRow("", null, null)); });

  /* ---- fill the form ---- */
  function clearForm() {
    document.querySelectorAll(".form-grid input[type=number]").forEach(function (i) { i.value = ""; });
    $("lead-rows").innerHTML = ""; $("kw-rows").innerHTML = ""; $("rankDate").value = "";
  }
  function fill(m) {
    clearForm();
    $("month").value = m.month;
    MAIN.forEach(function (f) { var v = m[f[0]]; $("f-" + f[0]).value = v === null || v === undefined ? "" : v; });
    var d = m.devices || {};
    ["desktop", "mobile", "tablet"].forEach(function (k) { $("dev-" + k).value = d[k] === undefined || d[k] === null ? "" : d[k]; });
    var a = m.aiReferrals || {};
    ["ChatGPT", "Claude", "Perplexity"].forEach(function (k) { $("ai-" + k).value = a[k] === undefined || a[k] === null ? "" : a[k]; });
    $("leadTotal").value = m.leads && m.leads.total !== null ? m.leads.total : "";
    var bp = m.leads ? m.leads.byPage || {} : {};
    $("lead-rows").innerHTML = Object.keys(bp).map(function (k) { return leadRow(k, bp[k]); }).join("");
    var r = m.rankings || { date: "", items: [] };
    $("rankDate").value = r.date || "";
    $("kw-rows").innerHTML = (r.items || []).map(function (i) { return kwRow(i.keyword, i.volume, i.position); }).join("");
    checks();
  }
  function fillNew() {
    clearForm();
    var last = data.months.length ? data.months[data.months.length - 1] : null;
    $("month").value = last ? nextMonth(last.month) : "";
    if (last) {
      var bp = last.leads ? last.leads.byPage || {} : {};
      $("lead-rows").innerHTML = Object.keys(bp).map(function (k) { return leadRow(k, null); }).join("");
      $("kw-rows").innerHTML = ((last.rankings && last.rankings.items) || []).map(function (i) { return kwRow(i.keyword, i.volume, null); }).join("");
    } else {
      ["Blogs", "Home page", "Service pages", "Pricing page", "Contact page"].forEach(function (k) { $("lead-rows").insertAdjacentHTML("beforeend", leadRow(k, null)); });
    }
    checks();
  }
  $("pick").addEventListener("change", function () {
    var m = this.value === "__new" ? null : find(this.value);
    if (m) fill(m); else fillNew();
  });

  /* ---- read the form ---- */
  function readForm() {
    var key = $("month").value;
    if (!/^\d{4}-\d{2}$/.test(key)) return null;
    var m = { month: key, label: monthLabel(key) };
    MAIN.forEach(function (f) { m[f[0]] = val("f-" + f[0]); });
    var dv = { desktop: val("dev-desktop"), mobile: val("dev-mobile"), tablet: val("dev-tablet") };
    m.devices = (dv.desktop === null && dv.mobile === null && dv.tablet === null) ? null : dv;
    var ai = { ChatGPT: val("ai-ChatGPT"), Claude: val("ai-Claude"), Perplexity: val("ai-Perplexity") };
    m.aiReferrals = (ai.ChatGPT === null && ai.Claude === null && ai.Perplexity === null) ? null : ai;
    var byPage = {};
    document.querySelectorAll("#lead-rows .list-row").forEach(function (r) {
      var nm = r.querySelector(".l-name").value.trim(), v = r.querySelector(".l-val").value.trim();
      if (nm && v !== "") byPage[nm] = Number(v);
    });
    m.leads = { total: val("leadTotal"), byPage: byPage };
    var items = [];
    document.querySelectorAll("#kw-rows .list-row").forEach(function (r) {
      var k = r.querySelector(".k-name").value.trim(), v = r.querySelector(".k-vol").value.trim(), p = r.querySelector(".k-pos").value.trim();
      if (k && p !== "") items.push({ keyword: k, volume: v === "" ? null : Number(v), position: Number(p) });
    });
    m.rankings = { date: $("rankDate").value || null, items: items };
    return m;
  }

  function checks() {
    var m = readForm();
    $("warn-main").innerHTML = ""; $("warn-leads").innerHTML = "";
    if (!m) return;
    if (m.clicks !== null && m.brandClicks !== null && m.nonBrandClicks !== null && m.brandClicks + m.nonBrandClicks !== m.clicks) {
      $("warn-main").innerHTML = '<div class="warn">Brand + non-brand clicks add up to ' + (m.brandClicks + m.nonBrandClicks) + ", but total clicks is " + m.clicks + ". Check these three figures.</div>";
    }
    var sum = 0, cnt = 0;
    Object.keys(m.leads.byPage).forEach(function (k) { sum += m.leads.byPage[k]; cnt++; });
    if (cnt && m.leads.total !== null && sum !== m.leads.total) {
      $("warn-leads").innerHTML = '<div class="warn">The page rows add up to ' + sum + ", but the reported total is " + m.leads.total + ". Fix the rows or the total before saving.</div>";
    }
  }
  document.addEventListener("input", checks);

  /* ---- save / download ---- */
  function persist() { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch (e) {} }
  function status(html, cls) { $("status").innerHTML = '<div class="' + (cls || "ok") + '">' + html + "</div>"; }
  $("save").addEventListener("click", function () {
    var m = readForm();
    if (!m) { status("Choose a month first.", "warn"); return; }
    var old = find(m.month);
    if (old) data.months[data.months.indexOf(old)] = m; else data.months.push(m);
    sortMonths(); persist(); refreshPick(m.month);
    status(m.label + " saved to the working copy. Now download months.json and upload it to your server.");
  });
  $("download").addEventListener("click", function () {
    var blob = new Blob([JSON.stringify(data, null, 2) + "\n"], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "months.json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });
  $("load").addEventListener("change", function () {
    var f = this.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      try { var j = JSON.parse(rd.result); if (!j.months) throw new Error("no months"); data = j; persist(); refreshPick(); fillNew(); status("Loaded " + data.months.length + " months from " + esc(f.name) + "."); }
      catch (err) { status("That file isn't a valid months.json.", "warn"); }
    };
    rd.readAsText(f);
  });

  /* ---- start ---- */
  function start(serverData) {
    data = serverData;
    var draft = null;
    try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch (e) {}
    if (draft && draft.months && JSON.stringify(draft) !== JSON.stringify(serverData)) {
      data = draft;
      $("draft").innerHTML = '<div class="warn">Showing a working copy that differs from the server file. <button type="button" class="btn secondary small" id="discard">Discard it and use the server file</button></div>';
      $("discard").addEventListener("click", function () {
        try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
        $("draft").innerHTML = ""; data = serverData; refreshPick(); fillNew();
      });
    }
    refreshPick(); fillNew();
  }
  fetch("data/months.json?_=" + Date.now(), { cache: "no-store" })
    .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
    .then(start)
    .catch(function () { start({ site: { name: "" }, months: [] }); status("Could not load data/months.json. Open this page through a web server, or load the file above.", "warn"); });
})();
