(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var nf = new Intl.NumberFormat("en-IN");
  var data = null;
  var kwFilter = "all";

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function has(v) { return v !== null && v !== undefined && v !== ""; }
  function n(v) { return has(v) ? nf.format(v) : "—"; }
  function compact(v) {
    if (!has(v)) return "—";
    if (v >= 1e6) return (v / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M";
    if (v >= 1000) return (v / 1000).toFixed(v >= 100000 ? 0 : 1).replace(/\.0$/, "") + "K";
    return String(v);
  }
  function pct(cur, prev) {
    if (!has(cur) || !has(prev) || prev === 0) return null;
    return (cur - prev) / prev * 100;
  }
  function pill(cls, text) { return '<span class="pill ' + cls + '">' + text + "</span>"; }
  /* good/bad colour comes from whether the move helps, the arrow shows the direction of the number */
  function deltaPill(diff, text, lowerBetter) {
    if (diff === null) return "";
    if (Math.abs(diff) < 0.005) return pill("flat", "— 0");
    var up = diff > 0;
    var good = lowerBetter ? !up : up;
    return pill(good ? "up" : "down", (up ? "▲ " : "▼ ") + text);
  }
  function pctPill(cur, prev, lowerBetter) {
    var p = pct(cur, prev);
    return p === null ? "" : deltaPill(p, Math.abs(p).toFixed(2) + "%", lowerBetter);
  }
  function monthShort(key) {
    var p = key.split("-");
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, 1));
    return d.toLocaleString("en", { month: "short", timeZone: "UTC" }) + " '" + p[0].slice(2);
  }
  function dayLabel(iso) {
    if (!iso) return "";
    var p = iso.split("-");
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return d.toLocaleString("en", { day: "numeric", month: "short", timeZone: "UTC" });
  }

  function load() {
    fetch("data/months.json?_=" + Date.now(), { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) {
        data = j;
        data.months = (j.months || []).slice().sort(function (a, b) { return a.month < b.month ? -1 : 1; });
        init();
      })
      .catch(function () {
        $("title").textContent = "Data file not found";
        $("lede").textContent = "Could not load data/months.json. Open this page through a web server (for example: python3 -m http.server) instead of double-clicking the file.";
      });
  }

  function currentIndex() {
    var h = (location.hash || "").replace("#", "");
    for (var i = 0; i < data.months.length; i++) if (data.months[i].month === h) return i;
    return data.months.length - 1;
  }

  function init() {
    if (!data.months.length) {
      $("title").textContent = "No months yet";
      $("lede").innerHTML = 'Add your first month in <a href="admin.html">the entry page</a>.';
      return;
    }
    $("month").innerHTML = data.months.slice().reverse().map(function (m) {
      return '<option value="' + esc(m.month) + '">' + esc(m.label) + "</option>";
    }).join("");
    $("month").addEventListener("change", function () { location.hash = this.value; });
    window.addEventListener("hashchange", render);
    $("chips").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-f]");
      if (!b) return;
      kwFilter = b.getAttribute("data-f");
      render();
    });
    $("history").addEventListener("click", function (e) {
      var tr = e.target.closest("tr[data-m]");
      if (tr) { location.hash = tr.getAttribute("data-m"); window.scrollTo({ top: 0 }); }
    });
    var tip = $("tip");
    document.addEventListener("mousemove", function (e) {
      var t = e.target.closest ? e.target.closest("[data-tip]") : null;
      if (!t) { tip.style.opacity = 0; return; }
      tip.textContent = t.getAttribute("data-tip");
      tip.style.opacity = 1;
      tip.style.left = Math.min(e.clientX + 12, window.innerWidth - 250) + "px";
      tip.style.top = (e.clientY + 14) + "px";
    });
    render();
  }

  function render() {
    var idx = currentIndex();
    var cur = data.months[idx];
    var prev = idx > 0 ? data.months[idx - 1] : null;
    var site = (data.site && data.site.name) || "";
    document.title = (site ? site + " " : "") + "SEO Dashboard";
    $("month").value = cur.month;
    $("eyebrow").textContent = (site ? site + " · SEO · " : "SEO · ") + cur.label + (prev ? " vs " + prev.label : "");
    $("title").textContent = cur.label + " organic search";
    $("lede").textContent = headline(cur, prev);

    kpis(cur, prev);
    mix(cur, prev);
    devices(cur);
    ai(cur);
    charts(idx);
    keywords(cur, prev);
    leads(cur, prev);
    history(cur);
    $("foot").textContent = "Data from data/months.json. Months in file: " + data.months.length + ".";
  }

  function headline(cur, prev) {
    if (!prev) return "First month on record. Comparisons appear once a second month is added.";
    var parts = [];
    var c = pct(cur.clicks, prev.clicks);
    if (c !== null) parts.push("Organic clicks " + (c < 0 ? "fell " : "rose ") + Math.abs(c).toFixed(1) + "% (" + n(prev.clicks) + " to " + n(cur.clicks) + ")");
    var nb = pct(cur.nonBrandClicks, prev.nonBrandClicks), b = pct(cur.brandClicks, prev.brandClicks);
    if (nb !== null && b !== null) parts.push("non-brand " + (nb < 0 ? "down " : "up ") + Math.abs(nb).toFixed(1) + "%, brand " + (b < 0 ? "down " : "up ") + Math.abs(b).toFixed(1) + "%");
    var l = cur.leads && prev.leads ? pct(cur.leads.total, prev.leads.total) : null;
    if (l !== null) parts.push("organic leads " + (l < 0 ? "down " : "up ") + Math.abs(l).toFixed(1) + "%");
    return parts.length ? parts.join("; ") + " compared with " + prev.label + "." : "";
  }

  function kpiTile(k, cur, prev, cmpLabel) {
    var v = k.get(cur), pv = prev ? k.get(prev) : null;
    var d = "";
    if (prev && has(v) && has(pv)) d = k.abs ? deltaPill(v - pv, Math.abs(v - pv).toFixed(1), k.lowerBetter) : pctPill(v, pv, k.lowerBetter);
    var cmp = prev && has(pv) ? d + (k.fmt(pv)) + " in " + esc(prev.label.split(" ")[0]) : (k.note || "");
    return '<div class="kpi"><span class="label">' + k.label + '</span><span class="value num">' + k.fmt(v, true) + '</span><span class="cmp">' + cmp + "</span></div>";
  }

  function kpis(cur, prev) {
    var main = [
      { label: "Organic clicks", get: function (m) { return m.clicks; }, fmt: n },
      { label: "Organic search sessions", get: function (m) { return m.organicSearchSessions; }, fmt: n },
      { label: "Total organic sessions", get: function (m) { return m.totalOrganicSessions; }, fmt: n },
      { label: "Organic leads", get: function (m) { return m.leads ? m.leads.total : null; }, fmt: n }
    ];
    var second = [
      { label: "Impressions", get: function (m) { return m.impressions; }, fmt: compact },
      { label: "Click-through rate", get: function (m) { return m.ctr; }, fmt: function (v) { return has(v) ? v + "%" : "—"; }, abs: true },
      { label: "Average position (lower is better)", get: function (m) { return m.avgPosition; }, fmt: function (v) { return has(v) ? String(v) : "—"; }, abs: true, lowerBetter: true },
      { label: "SEO health score", get: function (m) { return m.healthScore; }, fmt: function (v, big) { return has(v) ? (big ? v + "<small> / 100</small>" : v) : "—"; }, abs: true }
    ];
    $("kpi-main").innerHTML = main.map(function (k) { return kpiTile(k, cur, prev); }).join("");
    $("kpi-gsc").innerHTML = second.map(function (k) { return kpiTile(k, cur, prev); }).join("");
  }

  function barLine(name, period, val, color, max, unit) {
    var w = Math.max(val / max * 100, 0.4);
    return '<div class="bar-line"><div class="track"><div class="fill" data-tip="' + esc(name + ", " + period + ": " + nf.format(val) + unit) +
      '" style="width:' + w + "%;background:" + color + '"></div></div><div class="bar-val num">' + nf.format(val) + "</div></div>";
  }
  function barGroups(rows, cur, prev, unit) {
    var max = 0;
    rows.forEach(function (r) { max = Math.max(max, r.cur || 0, r.prev || 0); });
    if (!max) return '<p class="empty">No data for this month.</p>';
    return rows.map(function (r) {
      var d = prev && has(r.prev) && has(r.cur) ? pctPill(r.cur, r.prev) : "";
      return '<div><div class="grp-title"><span>' + esc(r.name) + "</span>" + d + "</div>" +
        (prev && has(r.prev) ? barLine(r.name, prev.label, r.prev, "var(--s1)", max, unit) : "") +
        (has(r.cur) ? barLine(r.name, cur.label, r.cur, "var(--s2)", max, unit) : "") + "</div>";
    }).join("");
  }
  function legend(cur, prev) {
    return (prev ? '<span><i class="sw" style="background:var(--s1)"></i>' + esc(prev.label) + "</span>" : "") +
      '<span><i class="sw" style="background:var(--s2)"></i>' + esc(cur.label) + "</span>";
  }

  function mix(cur, prev) {
    var rows = [
      { name: "Non-brand search", cur: cur.nonBrandClicks, prev: prev ? prev.nonBrandClicks : null },
      { name: "Brand search", cur: cur.brandClicks, prev: prev ? prev.brandClicks : null }
    ];
    $("mix").innerHTML = barGroups(rows, cur, prev, " clicks");
    $("mix-legend").innerHTML = legend(cur, prev);
    var share = function (m) { return m && m.clicks ? Math.round(m.nonBrandClicks / m.clicks * 100) + "%" : "—"; };
    $("mix-note").innerHTML = "Non-brand share of clicks: " + (prev ? "<b class=\"num\">" + share(prev) + "</b> in " + esc(prev.label.split(" ")[0]) + ", " : "") + "<b class=\"num\">" + share(cur) + "</b> in " + esc(cur.label.split(" ")[0]) + ".";
  }

  function devices(cur) {
    $("dev-sub").textContent = "Share of organic traffic, " + cur.label;
    var d = cur.devices;
    if (!d) { $("dev").innerHTML = '<p class="empty">No device data for this month.</p>'; return; }
    var items = [["Desktop", d.desktop, "var(--s1)"], ["Mobile", d.mobile, "var(--s2)"], ["Tablet", d.tablet, "var(--s3)"]]
      .filter(function (x) { return has(x[1]); });
    $("dev").innerHTML = '<div class="stack" role="img">' + items.map(function (x) {
      return '<div data-tip="' + x[0] + ": " + x[1] + '%" style="flex:' + Math.max(x[1], 0.01) + ";background:" + x[2] + '"></div>';
    }).join("") + '</div><div class="dev-list">' + items.map(function (x) {
      return '<div><i class="sw" style="background:' + x[2] + '"></i>' + x[0] + '<b class="num">' + Number(x[1]).toFixed(1) + "%</b></div>";
    }).join("") + "</div>";
  }

  function ai(cur) {
    $("ai-sub").textContent = "Sessions, " + cur.label;
    var a = cur.aiReferrals;
    if (!a) { $("ai").innerHTML = '<p class="empty">No AI referral data for this month.</p>'; return; }
    $("ai").innerHTML = '<div class="ai">' + Object.keys(a).map(function (k) {
      return '<div><div class="v num">' + n(a[k]) + '</div><div class="l">' + esc(k) + "</div></div>";
    }).join("") + "</div>";
  }

  /* ---- line charts ---- */
  function niceMax(v) {
    if (v <= 0) return 1;
    var p = Math.pow(10, Math.floor(Math.log(v) / Math.LN10)), f = v / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  }
  function lineChart(title, labels, series) {
    var W = 520, H = 210, L = 46, R = 16, T = 12, B = 28;
    var max = 0;
    series.forEach(function (s) { s.values.forEach(function (v) { if (has(v) && v > max) max = v; }); });
    var top = niceMax(max);
    var x = function (i) { return labels.length < 2 ? L + (W - L - R) / 2 : L + i * (W - L - R) / (labels.length - 1); };
    var y = function (v) { return T + (H - T - B) * (1 - v / top); };
    var g = "";
    for (var t = 0; t <= 4; t++) {
      var val = top * t / 4, yy = y(val);
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" stroke="var(--grid)" stroke-width="1"/>' +
        '<text x="' + (L - 8) + '" y="' + (yy + 4) + '" text-anchor="end">' + compact(val) + "</text>";
    }
    var step = Math.ceil(labels.length / 7);
    labels.forEach(function (lb, i) {
      if (i % step === 0 || i === labels.length - 1) g += '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(lb) + "</text>";
    });
    series.forEach(function (s) {
      var pts = [], dots = "";
      s.values.forEach(function (v, i) {
        if (!has(v)) return;
        pts.push(x(i) + "," + y(v));
        dots += '<circle cx="' + x(i) + '" cy="' + y(v) + '" r="4" fill="' + s.color + '" stroke="var(--surface)" stroke-width="2"/>' +
          '<circle cx="' + x(i) + '" cy="' + y(v) + '" r="12" fill="transparent" data-tip="' + esc(s.name + ", " + labels[i] + ": " + nf.format(v)) + '"/>';
      });
      if (pts.length > 1) g += '<polyline points="' + pts.join(" ") + '" fill="none" stroke="' + s.color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
      g += dots;
    });
    var lg = series.length > 1 ? '<div class="legend">' + series.map(function (s) { return '<span><i class="sw" style="background:' + s.color + '"></i>' + esc(s.name) + "</span>"; }).join("") + "</div>" : "";
    return '<div class="chart"><h2>' + title + "</h2>" + lg + '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(title) + '">' + g + "</svg></div>";
  }
  function charts(idx) {
    var ms = data.months.slice(0, idx + 1);
    var labels = ms.map(function (m) { return monthShort(m.month); });
    var col = function (f) { return ms.map(f); };
    $("charts").innerHTML =
      lineChart("Organic clicks", labels, [
        { name: "Brand", color: "var(--s1)", values: col(function (m) { return m.brandClicks; }) },
        { name: "Non-brand", color: "var(--s2)", values: col(function (m) { return m.nonBrandClicks; }) }
      ]) +
      lineChart("Organic sessions", labels, [
        { name: "Search sessions", color: "var(--s1)", values: col(function (m) { return m.organicSearchSessions; }) },
        { name: "Total organic sessions", color: "var(--s2)", values: col(function (m) { return m.totalOrganicSessions; }) }
      ]) +
      lineChart("Organic leads", labels, [
        { name: "Leads", color: "var(--s1)", values: col(function (m) { return m.leads ? m.leads.total : null; }) }
      ]);
  }

  /* ---- keywords ---- */
  function keywords(cur, prev) {
    var r = cur.rankings;
    if (!r || !r.items || !r.items.length) {
      $("kw-head").innerHTML = ""; $("kw").innerHTML = '<tr><td class="empty">No ranking data for this month.</td></tr>'; $("chips").innerHTML = ""; return;
    }
    var pr = prev && prev.rankings ? prev.rankings : null;
    var pmap = {};
    if (pr) pr.items.forEach(function (i) { pmap[i.keyword.toLowerCase()] = i.position; });
    var rows = r.items.map(function (i) {
      var p = pr ? pmap[i.keyword.toLowerCase()] : undefined;
      return { kw: i.keyword, vol: i.volume, now: i.position, prev: has(p) ? p : null, ch: has(p) ? p - i.position : null };
    }).sort(function (a, b) { return (b.vol || 0) - (a.vol || 0); });
    var filters = [
      { id: "all", label: "All", test: function () { return true; } },
      { id: "up", label: "Improved", test: function (k) { return k.ch !== null && k.ch > 0; } },
      { id: "down", label: "Declined", test: function (k) { return k.ch !== null && k.ch < 0; } },
      { id: "flat", label: "Unchanged", test: function (k) { return k.ch === 0; } }
    ];
    if (!pr) filters = filters.slice(0, 1);
    if (!filters.some(function (f) { return f.id === kwFilter; })) kwFilter = "all";
    $("chips").innerHTML = filters.map(function (f) {
      return '<button type="button" class="chip" data-f="' + f.id + '" aria-pressed="' + (f.id === kwFilter) + '">' + f.label + " · " + rows.filter(f.test).length + "</button>";
    }).join("");
    $("kw-sub").textContent = "Google position on " + dayLabel(r.date) + (pr ? " compared with " + dayLabel(pr.date) : "") + ". Lower is better. Sorted by monthly search volume.";
    $("kw-head").innerHTML = "<tr><th>Keyword</th><th class=\"r\">Monthly searches</th>" + (pr ? '<th class="r">' + esc(dayLabel(pr.date)) + "</th>" : "") +
      '<th class="r">' + esc(dayLabel(r.date)) + "</th>" + (pr ? '<th class="r">Change</th>' : "") + "</tr>";
    var f = filters.filter(function (x) { return x.id === kwFilter; })[0];
    $("kw").innerHTML = rows.filter(f.test).map(function (k) {
      var chg = "";
      if (pr) chg = k.ch === null ? pill("flat", "new") : k.ch > 0 ? pill("up", "▲ +" + k.ch) : k.ch < 0 ? pill("down", "▼ " + k.ch) : pill("flat", "— 0");
      return '<tr><td class="kw">' + esc(k.kw) + '</td><td class="r num">' + n(k.vol) + "</td>" + (pr ? '<td class="r num">' + (k.prev === null ? "—" : k.prev) + "</td>" : "") +
        '<td class="r num"><b>' + k.now + "</b></td>" + (pr ? '<td class="r">' + chg + "</td>" : "") + "</tr>";
    }).join("");
  }

  /* ---- leads ---- */
  function leads(cur, prev) {
    var c = cur.leads ? cur.leads.byPage || {} : {}, p = prev && prev.leads ? prev.leads.byPage || {} : {};
    var names = Object.keys(c);
    Object.keys(p).forEach(function (k) { if (names.indexOf(k) < 0) names.push(k); });
    var rows = names.map(function (k) { return { name: k, cur: has(c[k]) ? c[k] : 0, prev: prev ? (has(p[k]) ? p[k] : 0) : null }; });
    $("leads").innerHTML = rows.length ? barGroups(rows, cur, prev, " leads") : '<p class="empty">No lead data for this month.</p>';
    $("leads-legend").innerHTML = legend(cur, prev);
    var sum = rows.reduce(function (a, r) { return a + r.cur; }, 0);
    var tot = cur.leads ? cur.leads.total : null;
    $("leads-note").textContent = has(tot) && rows.length && sum !== tot ? "Page rows add up to " + sum + " but the reported total is " + tot + "." : "";
  }

  function history(cur) {
    $("history").innerHTML = data.months.slice().reverse().map(function (m) {
      return '<tr class="pick' + (m.month === cur.month ? " cur" : "") + '" data-m="' + esc(m.month) + '"><td>' + esc(m.label) + '</td><td class="r num">' + n(m.clicks) +
        '</td><td class="r num">' + n(m.brandClicks) + '</td><td class="r num">' + n(m.nonBrandClicks) + '</td><td class="r num">' + n(m.organicSearchSessions) +
        '</td><td class="r num">' + n(m.leads ? m.leads.total : null) + '</td><td class="r num">' + compact(m.impressions) + '</td><td class="r num">' + (has(m.avgPosition) ? m.avgPosition : "—") + "</td></tr>";
    }).join("");
  }

  load();
})();
