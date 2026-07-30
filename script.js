/* ==========================================================================
   Gamescom 2026 Side Events — garna.io
   Loads events from a Google Sheet at runtime. Editing a row in the sheet
   updates the page — no deploy needed.
   Falls back to the bundled snapshot (events-data.js) if the fetch fails.
   ========================================================================== */

(function () {
  "use strict";

  /* ---------------------------------------------------------------- config */

  var CONFIG = {
    // Google Sheet must be shared as "Anyone with the link — Viewer".
    sheetId: "1W6bDYdlw_PkTakAaE8MEJHmF57ucJwYo5xmKfZSJ3NE",
    // Only days inside this window are shown. Multi-day events are clamped to it.
    windowStart: "2026-08-23",
    windowEnd: "2026-08-30",
    fetchTimeoutMs: 8000
  };

  /* Access type -> badge label, badge modifier, CTA label. */
  var ACCESS = {
    free:        { label: "Free",                 mod: "badge-free",    cta: "Register" },
    paid:        { label: "Paid",                 mod: "",              cta: "Get tickets" },
    application: { label: "Apply",                mod: "",              cta: "Apply" },
    invite:      { label: "Invite only",          mod: "",              cta: "Details" },
    badge:       { label: "With gamescom badge",  mod: "",              cta: "Details" },
    open:        { label: "Open entry",           mod: "badge-open",    cta: "Details" },
    tba:         { label: "TBA",                  mod: "",              cta: "Details" },
    closed:      { label: "Closed",               mod: "badge-closed",  cta: "Details" }
  };
  var ACCESS_FALLBACK = { label: "Details", mod: "", cta: "Details" };

  var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS = ["January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"];

  /* ------------------------------------------------------------- utilities */

  function $(sel, root) { return (root || document).querySelector(sel); }

  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* Only allow http(s) links through to href. */
  function safeUrl(url) {
    var u = String(url || "").trim();
    return /^https?:\/\//i.test(u) ? u : "";
  }

  function toDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "").trim());
    return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  }

  function toIso(date) {
    return date.toISOString().slice(0, 10);
  }

  function dayId(iso) { return "day-" + iso; }

  /* "17:00–21:00" / "From 13:00" -> minutes since midnight. All-day -> -1. */
  function startMinutes(time) {
    var m = /(\d{1,2}):(\d{2})/.exec(String(time || ""));
    return m ? (+m[1]) * 60 + (+m[2]) : -1;
  }

  /* ----------------------------------------------------------- data loading */

  /* gviz encodes date cells as the string "Date(2026,7,23)" (month is 0-based). */
  function normalizeCell(cell) {
    if (!cell) return "";
    var v = cell.v;
    if (v == null) return cell.f != null ? String(cell.f) : "";
    if (typeof v === "string") {
      var d = /^Date\((\d+),(\d+),(\d+)/.exec(v);
      if (d) {
        return toIso(new Date(Date.UTC(+d[1], +d[2], +d[3])));
      }
      return v;
    }
    if (v instanceof Date) return toIso(v);
    return String(v);
  }

  function parseGviz(text) {
    var start = text.indexOf("{");
    var end = text.lastIndexOf("}");
    if (start < 0 || end < 0) throw new Error("Unexpected gviz payload");
    var payload = JSON.parse(text.slice(start, end + 1));
    var table = payload.table;
    if (!table || !table.rows) throw new Error("No table in gviz payload");

    // Map columns by header label so column order can shift without breaking.
    var index = {};
    (table.cols || []).forEach(function (col, i) {
      var key = String(col.label || col.id || "").trim().toLowerCase().replace(/\s+/g, "_");
      if (key) index[key] = i;
    });

    function pick(row, key, position) {
      var i = index.hasOwnProperty(key) ? index[key] : position;
      return normalizeCell(row.c && row.c[i]).trim();
    }

    return table.rows.map(function (row) {
      return {
        date: pick(row, "date", 0),
        end_date: pick(row, "end_date", 1),
        name: pick(row, "name", 2),
        time: pick(row, "time", 3),
        description: pick(row, "description", 4),
        location: pick(row, "location", 5),
        access: pick(row, "access", 6).toLowerCase(),
        access_note: pick(row, "access_note", 7),
        link: pick(row, "link", 8),
        featured: pick(row, "featured", 9) === "1" || pick(row, "featured", 9).toLowerCase() === "true",
        score: parseInt(pick(row, "priority_score", 10), 10) || 0
      };
    }).filter(function (e) { return e.name; });
  }

  function loadFromSheet() {
    var url = "https://docs.google.com/spreadsheets/d/" + CONFIG.sheetId +
              "/gviz/tq?tqx=out:json&t=" + Date.now();

    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = controller && setTimeout(function () { controller.abort(); }, CONFIG.fetchTimeoutMs);

    return fetch(url, controller ? { signal: controller.signal } : undefined)
      .then(function (res) {
        if (timer) clearTimeout(timer);
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(parseGviz)
      .then(function (rows) {
        if (!rows.length) throw new Error("Sheet returned no rows");
        return { events: rows, live: true };
      });
  }

  function loadSnapshot() {
    var snap = window.GC_EVENTS_SNAPSHOT || [];
    return { events: snap, live: false };
  }

  /* ------------------------------------------------------------- day model */

  /* Expand multi-day events so they appear on every day they run. */
  function buildDays(events) {
    var winStart = toDate(CONFIG.windowStart);
    var winEnd = toDate(CONFIG.windowEnd);
    var buckets = {};
    var tba = [];

    events.forEach(function (ev) {
      var start = toDate(ev.date);
      if (!start) { tba.push(ev); return; }

      var end = toDate(ev.end_date) || start;
      if (end < start) end = start;

      // clamp to the window we display
      var from = start < winStart ? winStart : start;
      var to = end > winEnd ? winEnd : end;
      if (from > winEnd || to < winStart) return;

      var multi = toIso(start) !== toIso(end);
      for (var d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
        var iso = toIso(d);
        (buckets[iso] = buckets[iso] || []).push({ ev: ev, multi: multi });
      }
    });

    var days = Object.keys(buckets).sort().map(function (iso) {
      var items = buckets[iso].sort(function (a, b) {
        var am = startMinutes(a.ev.time), bm = startMinutes(b.ev.time);
        if (am !== bm) return am - bm;
        return b.ev.score - a.ev.score;
      });
      var date = toDate(iso);
      return {
        iso: iso,
        date: date,
        weekday: WEEKDAYS[date.getUTCDay()],
        dayNum: date.getUTCDate(),
        month: MONTHS[date.getUTCMonth()],
        items: items
      };
    });

    if (tba.length) {
      days.push({
        iso: "tba",
        date: null,
        weekday: "Date",
        dayNum: "TBA",
        month: "",
        items: tba.map(function (ev) { return { ev: ev, multi: false }; })
      });
    }

    return days;
  }

  /* ---------------------------------------------------------------- render */

  var ICON_PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';
  var ICON_CAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>';

  function renderDayNav(days, activeIso) {
    return days.map(function (day) {
      var isTba = day.iso === "tba";
      var top = isTba ? "TBA" : day.weekday + " " + day.dayNum;
      var count = day.items.length + (day.items.length === 1 ? " event" : " events");
      return '<button type="button" class="day-btn' + (day.iso === activeIso ? " is-active" : "") + '"' +
             ' data-day="' + esc(day.iso) + '"' +
             ' aria-pressed="' + (day.iso === activeIso ? "true" : "false") + '">' +
             '<span class="d-day">' + esc(top) + '</span>' +
             '<span class="d-count">' + esc(count) + '</span>' +
             '</button>';
    }).join("");
  }

  function renderEvent(item) {
    var ev = item.ev;
    var access = ACCESS[ev.access] || ACCESS_FALLBACK;
    var url = safeUrl(ev.link);
    var classes = ["event-card"];
    if (ev.featured) classes.push("is-featured");
    if (ev.access === "closed") classes.push("is-closed");

    var facts = "";
    if (ev.location) {
      facts += '<span class="fact">' + ICON_PIN + esc(ev.location) + "</span>";
    }
    if (item.multi) {
      facts += '<span class="fact">' + ICON_CAL + "Runs across several days</span>";
    }
    facts += '<span class="badge ' + access.mod + '">' + esc(access.label) + "</span>";
    if (ev.access_note) {
      facts += '<span class="fact">' + esc(ev.access_note) + "</span>";
    }

    var cta = url
      ? '<a class="btn btn-primary btn-sm" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' +
        esc(access.cta) + "</a>"
      : '<span class="btn btn-secondary btn-sm" aria-disabled="true">No link yet</span>';

    return '<article class="event-row reveal">' +
             '<div class="event-time">' + esc(ev.time || "Time TBA") + "</div>" +
             '<div class="' + classes.join(" ") + '">' +
               '<div class="event-main">' +
                 '<div class="event-title">' +
                   "<h3>" + esc(ev.name) + "</h3>" +
                   (ev.featured ? '<span class="pick">Worth your time</span>' : "") +
                 "</div>" +
                 (ev.description ? '<p class="event-desc">' + esc(ev.description) + "</p>" : "") +
                 '<div class="event-facts">' + facts + "</div>" +
               "</div>" +
               '<div class="event-cta">' + cta + "</div>" +
             "</div>" +
           "</article>";
  }

  function renderDay(day) {
    if (!day) {
      return '<div class="empty-state"><h3>Nothing scheduled here yet</h3>' +
             "<p>Pick another day above. We keep this page updated through the show.</p></div>";
    }

    var title, sub;
    if (day.iso === "tba") {
      title = "Date to be announced";
      sub = day.items.length + (day.items.length === 1 ? " event" : " events") +
            ", organisers haven't announced a date yet";
    } else {
      title = day.weekday + ", " + day.dayNum + " " + day.month;
      sub = day.items.length + (day.items.length === 1 ? " event" : " events");
    }

    return '<div class="day-heading"><h2 id="' + esc(dayId(day.iso)) + '">' + esc(title) + "</h2>" +
           '<span class="day-sub">' + esc(sub) + "</span></div>" +
           '<div class="event-list">' + day.items.map(renderEvent).join("") + "</div>";
  }

  /* ------------------------------------------------------------- reveal obs */

  var observer = null;
  function observeReveals(root) {
    var nodes = root.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(nodes, function (n) { n.classList.add("is-visible"); });
      return;
    }
    if (!observer) {
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      }, { rootMargin: "0px 0px -40px 0px", threshold: 0.05 });
    }
    Array.prototype.forEach.call(nodes, function (n) { observer.observe(n); });
  }

  /* ------------------------------------------------------------------ boot */

  function pickInitialDay(days) {
    var fromHash = (location.hash || "").replace(/^#day-/, "");
    if (fromHash && days.some(function (d) { return d.iso === fromHash; })) return fromHash;

    var today = toIso(new Date());
    if (days.some(function (d) { return d.iso === today; })) return today;

    var firstDated = days.filter(function (d) { return d.iso !== "tba"; })[0];
    return firstDated ? firstDated.iso : (days[0] && days[0].iso);
  }

  function init(data) {
    var events = data.events;
    var days = buildDays(events);

    var navEl = $("#dayNav");
    var listEl = $("#eventsBody");
    var noteEl = $("#sourceNote");
    var statEvents = $("#statEvents");
    var statDays = $("#statDays");

    if (statEvents) statEvents.textContent = events.length;
    if (statDays) statDays.textContent = days.filter(function (d) { return d.iso !== "tba"; }).length;

    if (!days.length) {
      if (listEl) {
        listEl.innerHTML = '<div class="empty-state"><h3>No events loaded</h3>' +
          "<p>The schedule didn't come through. A refresh usually fixes it.</p></div>";
      }
      return;
    }

    var activeIso = pickInitialDay(days);

    function paint(iso, shouldScroll) {
      activeIso = iso;
      var day = days.filter(function (d) { return d.iso === iso; })[0];
      if (navEl) navEl.innerHTML = renderDayNav(days, iso);
      if (listEl) {
        listEl.innerHTML = renderDay(day);
        observeReveals(listEl);
      }
      if (history.replaceState) {
        history.replaceState(null, "", "#" + dayId(iso));
      }
      if (shouldScroll && listEl) {
        var top = listEl.getBoundingClientRect().top + window.pageYOffset;
        var offset = (document.querySelector(".day-nav") || { offsetHeight: 0 }).offsetHeight + 90;
        window.scrollTo({ top: Math.max(0, top - offset), behavior: "smooth" });
      }
    }

    if (navEl) {
      navEl.addEventListener("click", function (e) {
        var btn = e.target.closest ? e.target.closest(".day-btn") : null;
        if (!btn) return;
        paint(btn.getAttribute("data-day"), true);
      });
    }

    paint(activeIso, false);

    if (noteEl) {
      noteEl.textContent = data.live
        ? "The schedule is read from our events sheet every time this page loads, so it is always the current one."
        : "We couldn't reach the live sheet, so this is the last saved copy of the schedule.";
    }
  }

  function start() {
    var listEl = $("#eventsBody");
    if (listEl) listEl.innerHTML = '<div class="loading">Loading the schedule…</div>';

    loadFromSheet()
      .catch(function (err) {
        if (window.console) console.warn("[gamescom] falling back to snapshot:", err && err.message);
        return loadSnapshot();
      })
      .then(init)
      .catch(function (err) {
        if (window.console) console.error("[gamescom] render failed:", err);
        if (listEl) {
          listEl.innerHTML = '<div class="empty-state"><h3>Something broke</h3>' +
            "<p>The schedule didn't render. A refresh usually fixes it.</p></div>";
        }
      });

    // Header: mobile menu
    var menuBtn = $(".menu-btn");
    var mobileNav = $(".mobile-nav");
    if (menuBtn && mobileNav) {
      menuBtn.addEventListener("click", function () {
        var open = mobileNav.hasAttribute("hidden");
        if (open) mobileNav.removeAttribute("hidden");
        else mobileNav.setAttribute("hidden", "");
        menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }

    // Reveal for static sections
    observeReveals(document);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
