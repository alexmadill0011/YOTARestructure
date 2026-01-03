// Finley.js
// Age Group Swimming – Finley
// Lists swimmers by group in order:
// Silver → Purple → White → Green
// Within each group:
//   Males (Age ↓) then Females (Age ↓)
//
// Columns:
// Name | Gender | Age | Age Group Champs | B | BB | A
//
// Standards logic (per row):
// AG Champs: Time <= Q
// B:         Time <= J
// BB:        Time <= K
// A:         Time <= L

const SHEET_ID = "1xW2U_SlWsOlmEJlWLd-18jBxbreR5sFnMVr42rAosso";
const GID = "0";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}`;

const TARGET_SITE = "Kerr";
const GROUP_ORDER = ["Silver", "Purple", "White", "Green"];

const COL = {
  name: 0, // A
  gender: 1, // B
  age: 2, // C
  site: 3, // D
  group: 4, // E
  event: 5, // F
  time: 6, // G
  bStd: 9, // J
  bbStd: 10, // K
  aStd: 11, // L
  agc: 16, // Q
};

let swimmers = [];

/* ---------- Helpers ---------- */
function normalize(v) {
  return (v ?? "").toString().trim();
}

function parseAge(v) {
  const n = Number(String(v).replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : -1;
}

function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// "m:ss.xx" or "ss.xx" -> seconds (number) or null
function timeToSeconds(t) {
  const s = normalize(t);
  if (!s) return null;

  const cleaned = s.replace(/[^0-9:\.]/g, "");
  if (!cleaned) return null;

  if (cleaned.includes(":")) {
    const [mStr, secStrRaw] = cleaned.split(":");
    const minutes = Number(mStr);
    const seconds = Number(secStrRaw);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
    return minutes * 60 + seconds;
  }

  const seconds = Number(cleaned);
  if (!Number.isFinite(seconds)) return null;
  return seconds;
}

/* ---------- CSV ---------- */
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
      cur = "";
      if (row.length > 1) rows.push(row);
      row = [];
      continue;
    }
    cur += ch;
  }

  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }

  return rows;
}

/* ---------- Build swimmer objects (dedupe Name+Gender, keep max age) ---------- */
function makeKey(name, gender) {
  return `${normalize(name)}||${normalize(gender)}`.toLowerCase();
}

function ensureSwimmer(map, name, gender, age, group) {
  const key = makeKey(name, gender);
  if (!map.has(key)) {
    map.set(key, {
      name,
      gender,
      age,
      ageNum: parseAge(age),
      group,

      // lists for standards
      agcItems: [],
      bItems: [],
      bbItems: [],
      aItems: [],

      // seen sets to avoid duplicate event+time entries
      agcSeen: new Set(),
      bSeen: new Set(),
      bbSeen: new Set(),
      aSeen: new Set(),
    });
  } else {
    const s = map.get(key);
    // keep "max age" (descending sort wants best age)
    const aNum = parseAge(age);
    if (aNum > (s.ageNum ?? -1)) {
      s.ageNum = aNum;
      s.age = age;
    }
    // keep first assigned group if missing; but normally consistent
    if (!s.group) s.group = group;
  }
  return map.get(key);
}

function addCutItem(list, seen, event, timeStr, timeSec) {
  const k = `${event}||${timeStr}`.toLowerCase();
  if (seen.has(k)) return;
  seen.add(k);
  list.push({ event, timeStr, timeSec });
}

function buildSwimmers(rows) {
  const map = new Map();

  for (const r of rows) {
    const site = normalize(r[COL.site]);
    const group = normalize(r[COL.group]);
    const name = normalize(r[COL.name]);
    const gender = normalize(r[COL.gender]);
    const age = normalize(r[COL.age]);

    if (site !== TARGET_SITE) continue;
    if (!GROUP_ORDER.includes(group)) continue;
    if (!name || !gender) continue;

    const event = normalize(r[COL.event]);
    const timeStr = normalize(r[COL.time]);
    const timeSec = timeToSeconds(timeStr);

    const s = ensureSwimmer(map, name, gender, age, group);

    // If row doesn't have an event/time, skip standards checks
    if (!event || timeSec === null) continue;

    // standards seconds
    const agcSec = timeToSeconds(r[COL.agc]);
    const bSec = timeToSeconds(r[COL.bStd]);
    const bbSec = timeToSeconds(r[COL.bbStd]);
    const aSec = timeToSeconds(r[COL.aStd]);

    if (agcSec !== null && agcSec > 0 && timeSec <= agcSec) {
      addCutItem(s.agcItems, s.agcSeen, event, timeStr, timeSec);
    }
    if (bSec !== null && bSec > 0 && timeSec <= bSec) {
      addCutItem(s.bItems, s.bSeen, event, timeStr, timeSec);
    }
    if (bbSec !== null && bbSec > 0 && timeSec <= bbSec) {
      addCutItem(s.bbItems, s.bbSeen, event, timeStr, timeSec);
    }
    if (aSec !== null && aSec > 0 && timeSec <= aSec) {
      addCutItem(s.aItems, s.aSeen, event, timeStr, timeSec);
    }
  }

  // Sort each swimmer's lists by fastest time
  const out = Array.from(map.values());
  for (const s of out) {
    const sorter = (x, y) =>
      x.timeSec - y.timeSec || x.event.localeCompare(y.event);
    s.agcItems.sort(sorter);
    s.bItems.sort(sorter);
    s.bbItems.sort(sorter);
    s.aItems.sort(sorter);
  }

  return out;
}

/* ---------- Sorting within group ---------- */
function sortWithinGroup(list) {
  return list.sort((a, b) => {
    if (a.gender !== b.gender) return a.gender === "Male" ? -1 : 1;
    return b.ageNum - a.ageNum;
  });
}

/* ---------- Render ---------- */
function lines(items, emptyText) {
  if (!items || items.length === 0) {
    return `<span style="color: rgba(255,255,255,0.45); font-style: italic;">${escapeHTML(
      emptyText
    )}</span>`;
  }
  return items
    .map((x) => `<div>${escapeHTML(x.event)} (${escapeHTML(x.timeStr)})</div>`)
    .join("");
}

function render() {
  const container = document.querySelector(".content");
  if (!container) return;

  let html = "";

  GROUP_ORDER.forEach((grp) => {
    const groupSwimmers = sortWithinGroup(
      swimmers.filter((s) => s.group === grp)
    );
    if (!groupSwimmers.length) return;

    html += `
      <section class="card">
        <h3 style="
          margin: 0 0 12px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-size: 0.9rem;
          opacity: 0.85;
        ">
          ${escapeHTML(grp)}
        </h3>

        <div class="table-wrap">
          <table class="ag-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Gender</th>
                <th>Age</th>
                <th>Age Group Champs</th>
                <th>B</th>
                <th>BB</th>
                <th>A</th>
              </tr>
            </thead>
            <tbody>
    `;

    groupSwimmers.forEach((s) => {
      html += `
        <tr>
          <td>${escapeHTML(s.name)}</td>
          <td>${escapeHTML(s.gender)}</td>
          <td>${escapeHTML(s.age)}</td>
          <td>${lines(s.agcItems, "No AG Champs Cuts")}</td>
          <td>${lines(s.bItems, "No B")}</td>
          <td>${lines(s.bbItems, "No BB")}</td>
          <td>${lines(s.aItems, "No A")}</td>
        </tr>
      `;
    });

    html += `
            </tbody>
          </table>
        </div>
      </section>
    `;
  });

  container.innerHTML += html;
}

/* ---------- Load ---------- */
async function loadFinley() {
  const res = await fetch(CSV_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load sheet");
  const text = await res.text();

  const parsed = parseCSV(text);
  const rows = parsed.slice(1);

  swimmers = buildSwimmers(rows);
  render();
}

/* ---------- Init ---------- */
(async function init() {
  try {
    await loadFinley();
  } catch (e) {
    console.error(e);
  }
})();
