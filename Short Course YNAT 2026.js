// Short Course YNAT 2026.js

document.addEventListener("DOMContentLoaded", () => {
  // Load sidebar nav
  fetch("nav.html")
    .then((res) => res.text())
    .then((html) => {
      const nav = document.getElementById("nav-container");
      if (nav) nav.innerHTML = html;
    });

  // Default closed
  document.getElementById("qualifierBody").style.display = "none";
  document.getElementById("bubbleBody").style.display = "none";

  const SHEET_ID = "1xW2U_SlWsOlmEJlWLd-18jBxbreR5sFnMVr42rAosso";
  const GID = "0";
  const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}`;

  fetch(CSV_URL)
    .then((res) => res.text())
    .then((csv) => {
      const table = parseCSV(csv);
      if (!table.length) return;

      const rows = table.slice(1);

      // Qualifiers map: name -> Set(events)
      const qualifiersMap = new Map();

      // Bubble map: name -> Set(events)
      const bubbleMap = new Map();

      rows.forEach((row) => {
        const name = (row[0] || "").trim(); // ✅ Col A (Name)
        const event = (row[5] || "").trim(); // Col F (Event)
        const time = parseTime(row[6]); // Col G (Time)
        const cut = parseTime(row[15]); // Col P (YNAT Cut)

        if (!name || !event || time == null || cut == null || cut === 0) return;

        // ✅ Qualifier: time <= cut
        if (time <= cut) {
          if (!qualifiersMap.has(name)) qualifiersMap.set(name, new Set());
          qualifiersMap.get(name).add(event);
        }

        // ✅ Bubble: 100.01%–103% of cut
        const ratio = time / cut;
        if (ratio > 1.0001 && ratio <= 1.03) {
          if (!bubbleMap.has(name)) bubbleMap.set(name, new Set());
          bubbleMap.get(name).add(event);
        }
      });

      // KPI counts (top cards)
      const qualifierCountEl = document.getElementById("qualifierCount");
      if (qualifierCountEl)
        qualifierCountEl.textContent = `${qualifiersMap.size}`;

      const bubbleCountEl = document.getElementById("bubbleCount");
      if (bubbleCountEl) bubbleCountEl.textContent = `${bubbleMap.size}`;

      // Toggle summaries
      const qualifierSummaryEl = document.getElementById("qualifierSummary");
      if (qualifierSummaryEl)
        qualifierSummaryEl.textContent = `${qualifiersMap.size} swimmers`;

      const bubbleSummaryEl = document.getElementById("bubbleSummary");
      if (bubbleSummaryEl)
        bubbleSummaryEl.textContent = `${bubbleMap.size} swimmers`;

      // Render lists
      renderGroupedList(qualifiersMap, "qualifierList");
      renderGroupedList(bubbleMap, "bubbleList");
    })
    .catch(() => {
      const q = document.getElementById("qualifierList");
      if (q) q.textContent = "Could not load data.";
      const b = document.getElementById("bubbleList");
      if (b) b.textContent = "Could not load data.";
    });
});

// Toggle handlers (called by inline onclick)
function toggleQualifiers() {
  toggleBlock("qualifierBody", ".qual-toggle", "qualifierChevron");
}
function toggleBubble() {
  toggleBlock("bubbleBody", ".bubble-toggle", "bubbleChevron");
}

function toggleBlock(bodyId, btnSelector, chevId) {
  const body = document.getElementById(bodyId);
  const btn = document.querySelector(btnSelector);
  const chev = document.getElementById(chevId);
  if (!body || !btn || !chev) return;

  const isOpen = body.style.display !== "none";
  body.style.display = isOpen ? "none" : "block";
  btn.setAttribute("aria-expanded", String(!isOpen));
  chev.textContent = isOpen ? "▸" : "▾";
}

/**
 * Renders swimmers grouped by name, with events listed downward (one per line).
 */
function renderGroupedList(map, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!map || map.size === 0) {
    container.textContent = "None found (or missing data).";
    return;
  }

  const names = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));

  const wrap = document.createElement("div");
  wrap.style.display = "grid";
  wrap.style.gap = "12px";

  names.forEach((name) => {
    const events = Array.from(map.get(name)).sort((a, b) => a.localeCompare(b));

    const block = document.createElement("div");
    block.className = "card";
    block.style.padding = "12px";

    const title = document.createElement("div");
    title.innerHTML = `<strong>${escapeHTML(name)}</strong>`;
    block.appendChild(title);

    const ul = document.createElement("ul");
    ul.style.margin = "8px 0 0";
    ul.style.paddingLeft = "18px";

    events.forEach((ev) => {
      const li = document.createElement("li");
      li.textContent = ev;
      ul.appendChild(li);
    });

    block.appendChild(ul);
    wrap.appendChild(block);
  });

  container.innerHTML = "";
  container.appendChild(wrap);
}

/**
 * Converts mm:ss.xx or ss.xx into seconds
 */
function parseTime(t) {
  if (!t) return null;
  t = String(t).replace(/"/g, "").trim();
  if (!t) return null;

  if (!t.includes(":")) {
    const v = parseFloat(t);
    return Number.isFinite(v) ? v : null;
  }

  const [m, s] = t.split(":");
  const mm = parseInt(m, 10);
  const ss = parseFloat(s);
  if (!Number.isFinite(mm) || !Number.isFinite(ss)) return null;
  return mm * 60 + ss;
}

/**
 * Robust CSV parser for quoted values
 */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(cur);
      cur = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cur);
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
      cur = "";
      continue;
    }

    cur += ch;
  }

  row.push(cur);
  if (row.some((c) => c !== "")) rows.push(row);

  return rows;
}

function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// === Standards + Counts tables (Men/Women) with "NEW ROW" after each event ===
(function loadStandardsAndCounts() {
  const SHEET_ID = "1xW2U_SlWsOlmEJlWLd-18jBxbreR5sFnMVr42rAosso";

  // Standards tab
  const STANDARDS_GID = "550985665";
  const STANDARDS_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${STANDARDS_GID}`;

  // Swims/results tab (for counts)
  const SWIMS_GID = "0";
  const SWIMS_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SWIMS_GID}`;

  // Required event order (exactly as you listed)
  const EVENT_ORDER = [
    "50 Free SCY",
    "100 Free SCY",
    "200 Free SCY",
    "500 Free SCY",
    "1000 Free SCY",
    "1650 Free SCY",
    "100 Back SCY",
    "200 Back SCY",
    "100 Breast SCY",
    "200 Breast SCY",
    "100 Fly SCY",
    "200 Fly SCY",
    "200 IM SCY",
    "400 IM SCY",
  ];

  const EVENT_SET = new Set(EVENT_ORDER);

  document.addEventListener("DOMContentLoaded", () => {
    Promise.all([
      fetch(STANDARDS_CSV_URL).then((r) => r.text()),
      fetch(SWIMS_CSV_URL).then((r) => r.text()),
    ])
      .then(([standardsCSV, swimsCSV]) => {
        const standardsTable = parseCSV(standardsCSV);
        const swimsTable = parseCSV(swimsCSV);

        if (!standardsTable || standardsTable.length < 2) {
          setBodyMessage("menStandardsBody", "No standards data found.");
          setBodyMessage("womenStandardsBody", "No standards data found.");
          return;
        }
        if (!swimsTable || swimsTable.length < 2) {
          setBodyMessage("menStandardsBody", "No swims data found.");
          setBodyMessage("womenStandardsBody", "No swims data found.");
          return;
        }

        // --- Build standards maps (Men/Women) from the standards tab ---
        // drop header row
        const standardsData = standardsTable.slice(1);

        let inWomen = false;
        const menStandardsRaw = [];
        const womenStandardsRaw = [];

        for (const r of standardsData) {
          const ev = (r[0] || "").replace(/"/g, "").trim();

          if (/^womens$/i.test(ev) || /^women$/i.test(ev)) {
            inWomen = true;
            continue;
          }

          if (!EVENT_SET.has(ev)) continue;

          if (!inWomen) menStandardsRaw.push(r);
          else womenStandardsRaw.push(r);
        }

        const menStandards = orderByEventList(menStandardsRaw);
        const womenStandards = orderByEventList(womenStandardsRaw);

        // --- Build "best time per swimmer per event per gender" from swims tab ---
        // swims columns:
        // Name = A (0)
        // Gender = B (1)
        // Event = F (5)
        // Time = G (6)
        const swimsData = swimsTable.slice(1);

        // structure: bestTimes[genderKey][event][name] = bestSeconds
        const bestTimes = {
          M: new Map(), // event -> Map(name -> bestSec)
          F: new Map(),
        };

        for (const row of swimsData) {
          const name = (row[0] || "").trim();
          const genderRaw = (row[1] || "").trim();
          const event = (row[5] || "").trim();
          const tSec = parseTime(row[6]);

          if (!name || !genderRaw || !event || tSec == null) continue;
          if (!EVENT_SET.has(event)) continue; // only events we care about

          const g = normalizeGender(genderRaw);
          if (!g) continue;

          if (!bestTimes[g].has(event)) bestTimes[g].set(event, new Map());
          const evMap = bestTimes[g].get(event);

          const prev = evMap.get(name);
          if (prev == null || tSec < prev) evMap.set(name, tSec);
        }

        // --- Render tables with extra data row after each event ---
        fillStandardsBodyWithCounts(
          "menStandardsBody",
          menStandards,
          bestTimes.M
        );
        fillStandardsBodyWithCounts(
          "womenStandardsBody",
          womenStandards,
          bestTimes.F
        );
      })
      .catch(() => {
        setBodyMessage("menStandardsBody", "Could not load standards/swims.");
        setBodyMessage("womenStandardsBody", "Could not load standards/swims.");
      });
  });

  function normalizeGender(g) {
    const s = String(g).toLowerCase();
    if (s.startsWith("m")) return "M"; // "M", "Male"
    if (s.startsWith("b")) return "M"; // sometimes "Boy(s)"
    if (s.startsWith("f")) return "F"; // "F", "Female"
    if (s.startsWith("g")) return "F"; // sometimes "Girl(s)"
    return null;
  }

  function orderByEventList(rows) {
    const map = new Map(); // event -> row
    rows.forEach((r) => {
      const ev = (r[0] || "").replace(/"/g, "").trim();
      if (EVENT_SET.has(ev)) map.set(ev, r);
    });
    return EVENT_ORDER.map((ev) => map.get(ev)).filter(Boolean);
  }

  function fillStandardsBodyWithCounts(
    tbodyId,
    standardsRows,
    genderBestTimesMap
  ) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    tbody.innerHTML = "";

    if (!standardsRows || standardsRows.length === 0) {
      setBodyMessage(tbodyId, "No standards rows found.");
      return;
    }

    standardsRows.forEach((r) => {
      const event = (r[0] || "").trim(); // Col A
      const cutStr = (r[1] || "").trim(); // Col B
      const bStr = (r[2] || "").trim(); // Col C
      const aStr = (r[3] || "").trim(); // Col D

      const cut = parseTime(cutStr);
      const bFinal = parseTime(bStr);
      const aFinal = parseTime(aStr);

      // ---------- Row 1: Standards ----------
      const tr1 = document.createElement("tr");
      tr1.innerHTML = `
        <td>${escapeHTML(event || "—")}</td>
        <td>${escapeHTML(cutStr || "—")}</td>
        <td>${escapeHTML(bStr || "—")}</td>
        <td>${escapeHTML(aStr || "—")}</td>
        <td>—</td>
      `;
      tbody.appendChild(tr1);

      // ---------- Row 2: Swimmer lists ----------
      const swimmersMap = genderBestTimesMap.get(event) || new Map();

      const cutNames = [];
      const bNames = [];
      const aNames = [];
      const bubbleNames = [];

      for (const [name, bestSec] of swimmersMap.entries()) {
        if (cut != null && bestSec <= cut) cutNames.push(name);
        if (bFinal != null && bestSec <= bFinal) bNames.push(name);
        if (aFinal != null && bestSec <= aFinal) aNames.push(name);

        if (cut != null && cut > 0) {
          const ratio = bestSec / cut;
          if (ratio > 1.0001 && ratio <= 1.03) bubbleNames.push(name);
        }
      }

      // Alphabetical, vertical display
      const formatList = (arr) =>
        arr.length
          ? `<div style="display:flex; flex-direction:column; gap:2px; white-space:nowrap;">
               ${arr
                 .sort()
                 .map((n) => `<span>${escapeHTML(n)}</span>`)
                 .join("")}
             </div>`
          : "—";

      const tr2 = document.createElement("tr");
      tr2.innerHTML = `
        <td></td>
        <td>${formatList(cutNames)}</td>
        <td>${formatList(bNames)}</td>
        <td>${formatList(aNames)}</td>
        <td>${formatList(bubbleNames)}</td>
      `;

      // subtle visual separation for the data row
      tr2.style.opacity = "0.9";
      tbody.appendChild(tr2);
    });
  }

  function setBodyMessage(tbodyId, msg) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" class="muted">${escapeHTML(
      msg
    )}</td></tr>`;
  }
})();
