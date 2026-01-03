// ES1.js / WS1.js
// East/West Senior I roster with:
// - Short Course YNATS (time <= cut P)
// - 3% near-misses (100.01% to 100.3% of cut P)
// - AAA (time <= AAA standard N)
// - 200 IM / 400 IM best times
// - Next Up: 5 closest misses to YNAT (time > cut), sorted by smallest add
// Sections: MALES (Age ↓) then FEMALES (Age ↓)

const SHEET_ID = "1xW2U_SlWsOlmEJlWLd-18jBxbreR5sFnMVr42rAosso";
const GID = "0";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}`;

// CHANGE THIS IN WS1.js ONLY:
const TARGET_SITE = "East";
const TARGET_GROUP = "Senior I";

// 3% band: 100.01% to 100.3% of cut
const NEAR_MIN = 1.0001;
const NEAR_MAX = 1.003;

const COL = {
  name: 0, // A
  gender: 1, // B
  age: 2, // C
  site: 3, // D
  group: 4, // E
  event: 5, // F
  time: 6, // G
  aaa: 13, // N (J=9 ... N=13)
  ynat: 15, // P (SC YNAT Cut)
};

const IM_EVENTS = new Set(["200 IM SCY", "400 IM SCY"]);

let roster = [];

/* ---------- Helpers ---------- */
function normalize(v) {
  return (v ?? "").toString().trim();
}

function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseAge(v) {
  const n = Number(String(v).replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : -1;
}

// Converts "m:ss.xx" or "ss.xx" to seconds. Returns null if invalid.
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

// Formats seconds as m:ss.xx (or 0:ss.xx). Always 2 decimals.
function secondsToTime(sec) {
  if (!Number.isFinite(sec)) return "";
  const abs = Math.abs(sec);

  const minutes = Math.floor(abs / 60);
  const rem = abs - minutes * 60;

  // rem as xx.xx with leading zero if needed
  const remStr = rem.toFixed(2).padStart(5, "0"); // "ss.xx" (at least 5 chars)

  return minutes > 0 ? `${minutes}:${remStr}` : remStr; // if 0 minutes, show "ss.xx"
}

function mutedText(txt) {
  return `<span style="color: rgba(255,255,255,0.45); font-style: italic;">${escapeHTML(
    txt
  )}</span>`;
}

/* ---------- CSV Parser ---------- */
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

/* ---------- Filter ---------- */
function rowMatchesFilter(r) {
  return (
    normalize(r[COL.site]) === TARGET_SITE &&
    normalize(r[COL.group]) === TARGET_GROUP
  );
}

/* ---------- Build swimmer map ---------- */
function makeKey(name, gender) {
  return `${normalize(name)}||${normalize(gender)}`.toLowerCase();
}

function addUniqueItem(list, seenSet, event, timeStr, timeSec, extra = {}) {
  const k = `${event}||${timeStr}`.toLowerCase();
  if (seenSet.has(k)) return;
  seenSet.add(k);
  list.push({ event, timeStr, timeSec, ...extra });
}

function buildRosterFromRows(rows) {
  const map = new Map();

  for (const r of rows) {
    const name = normalize(r[COL.name]);
    const gender = normalize(r[COL.gender]);
    const age = normalize(r[COL.age]);
    if (!name || !gender) continue;

    const key = makeKey(name, gender);

    if (!map.has(key)) {
      map.set(key, {
        name,
        gender,
        age,
        ageNum: parseAge(age),

        ynatItems: [],
        ynatSeen: new Set(),

        nearItems: [],
        nearSeen: new Set(),

        aaaItems: [],
        aaaSeen: new Set(),

        // Next Up: misses closest to YNAT
        nextUpItems: [],
        nextUpSeen: new Set(),

        best200IM: null,
        best400IM: null,
      });
    } else {
      const obj = map.get(key);
      const ageNum = parseAge(age);
      if (ageNum > (obj.ageNum ?? -1)) {
        obj.ageNum = ageNum;
        obj.age = age;
      }
    }

    const obj = map.get(key);

    const event = normalize(r[COL.event]);
    const timeStr = normalize(r[COL.time]);
    const ynatStr = normalize(r[COL.ynat]);
    const aaaStr = normalize(r[COL.aaa]);

    const timeSec = timeToSeconds(timeStr);
    if (!event || timeSec === null) continue;

    /* ----- AAA qualification: time <= AAA (N) ----- */
    const aaaSec = timeToSeconds(aaaStr);
    if (aaaSec !== null && aaaSec > 0 && timeSec <= aaaSec) {
      addUniqueItem(obj.aaaItems, obj.aaaSeen, event, timeStr, timeSec);
    }

    /* ----- YNAT / Near / NextUp based on Cut (P) ----- */
    const ynatSec = timeToSeconds(ynatStr);
    if (ynatSec !== null && ynatSec > 0) {
      if (timeSec <= ynatSec) {
        // Qualify
        addUniqueItem(obj.ynatItems, obj.ynatSeen, event, timeStr, timeSec);
      } else {
        // Miss
        const ratio = timeSec / ynatSec;

        // Near miss band (100.01%–100.3%)
        if (ratio >= NEAR_MIN && ratio <= NEAR_MAX) {
          addUniqueItem(obj.nearItems, obj.nearSeen, event, timeStr, timeSec, {
            ratio,
          });
        }

        // Next Up: ANY miss (time > cut), keep the closest 5 later
        const diffSec = timeSec - ynatSec; // positive = how far over
        const deltaSec = ynatSec - timeSec; // negative (YNAT - TIME), as requested
        addUniqueItem(
          obj.nextUpItems,
          obj.nextUpSeen,
          event,
          timeStr,
          timeSec,
          {
            diffSec,
            deltaSec,
          }
        );
      }
    }

    /* ----- 200 IM / 400 IM best times ----- */
    if (IM_EVENTS.has(event)) {
      if (event === "200 IM SCY") {
        if (!obj.best200IM || timeSec < obj.best200IM.timeSec) {
          obj.best200IM = { event, timeStr, timeSec };
        }
      }
      if (event === "400 IM SCY") {
        if (!obj.best400IM || timeSec < obj.best400IM.timeSec) {
          obj.best400IM = { event, timeStr, timeSec };
        }
      }
    }
  }

  const roster = Array.from(map.values());

  // Sort lists (fastest / closest first)
  for (const s of roster) {
    s.ynatItems.sort(
      (a, b) => a.timeSec - b.timeSec || a.event.localeCompare(b.event)
    );
    s.nearItems.sort(
      (a, b) => a.timeSec - b.timeSec || a.event.localeCompare(b.event)
    );
    s.aaaItems.sort(
      (a, b) => a.timeSec - b.timeSec || a.event.localeCompare(b.event)
    );

    // Next Up: closest misses first (smallest diffSec), keep top 5
    s.nextUpItems.sort(
      (a, b) => a.diffSec - b.diffSec || a.event.localeCompare(b.event)
    );
    s.nextUpItems = s.nextUpItems.slice(0, 5);
  }

  return roster;
}

/* ---------- Sort roster ---------- */
function sortRoster(rows) {
  return rows.sort((a, b) => {
    if (a.gender !== b.gender) return a.gender === "Male" ? -1 : 1;
    return (b.ageNum ?? -1) - (a.ageNum ?? -1);
  });
}

/* ---------- Cell builders ---------- */
function listLines(items, emptyLabel) {
  if (!items || items.length === 0) return mutedText(emptyLabel);
  return items
    .map((x) => `<div>${escapeHTML(x.event)} (${escapeHTML(x.timeStr)})</div>`)
    .join("");
}

function imCell(best200, best400) {
  const lines = [];
  lines.push(
    best200
      ? `<div>${escapeHTML(best200.event)} (${escapeHTML(
          best200.timeStr
        )})</div>`
      : `<div>${mutedText("200 IM SCY —")}</div>`
  );
  lines.push(
    best400
      ? `<div>${escapeHTML(best400.event)} (${escapeHTML(
          best400.timeStr
        )})</div>`
      : `<div>${mutedText("400 IM SCY —")}</div>`
  );
  return lines.join("");
}

function nextUpCell(items) {
  if (!items || items.length === 0) return mutedText("No Next Up Events");
  return items
    .map((x) => {
      // requested: (YNAT - TIME) => negative value
      const deltaStr = "-" + secondsToTime(x.diffSec);
      return `<div>${escapeHTML(x.event)} (${escapeHTML(
        x.timeStr
      )}) | (${escapeHTML(deltaStr)})</div>`;
    })
    .join("");
}

/* ---------- Render ---------- */
function render(rows) {
  const tbody = document.getElementById("rowsBody");
  const pill = document.getElementById("countPill");
  if (!tbody) return;

  if (pill) pill.textContent = `${rows.length} swimmers`;

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="muted" style="padding:18px">
          No swimmers found for Site = ${escapeHTML(
            TARGET_SITE
          )} and Group = ${escapeHTML(TARGET_GROUP)}.
        </td>
      </tr>
    `;
    return;
  }

  let html = "";
  let currentSection = null;

  rows.forEach((r) => {
    if (currentSection !== r.gender) {
      html += `
        <tr>
          <td colspan="8" style="
            padding: 14px 18px;
            background: rgba(185,150,255,0.14);
            border-top: 1px solid rgba(185,150,255,0.35);
            border-bottom: 1px solid rgba(185,150,255,0.35);
            font-weight: 600;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          ">
            ${r.gender === "Male" ? "MALES" : "FEMALES"}
          </td>
        </tr>
      `;
      currentSection = r.gender;
    }

    const ynatHTML = listLines(r.ynatItems, "No Short Course YNAT Cuts");
    const nearHTML = listLines(r.nearItems, "No 3% Near-Misses");
    const aaaHTML = listLines(r.aaaItems, "No AAA Times");
    const imHTML = imCell(r.best200IM, r.best400IM);
    const nextHTML = nextUpCell(r.nextUpItems);

    html += `
      <tr>
        <td>${escapeHTML(r.name)}</td>
        <td>${escapeHTML(r.gender)}</td>
        <td>${escapeHTML(r.age)}</td>
        <td>${ynatHTML}</td>
        <td>${nearHTML}</td>
        <td>${aaaHTML}</td>
        <td>${imHTML}</td>
        <td>${nextHTML}</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

/* ---------- Search ---------- */
function applySearch(q) {
  const query = normalize(q).toLowerCase();
  if (!query) return render(roster);

  const filtered = roster.filter((r) => {
    const yn = (r.ynatItems || [])
      .map((x) => `${x.event} (${x.timeStr})`)
      .join(" ");
    const near = (r.nearItems || [])
      .map((x) => `${x.event} (${x.timeStr})`)
      .join(" ");
    const aaa = (r.aaaItems || [])
      .map((x) => `${x.event} (${x.timeStr})`)
      .join(" ");
    const im = `${
      r.best200IM ? `${r.best200IM.event} (${r.best200IM.timeStr})` : ""
    } ${r.best400IM ? `${r.best400IM.event} (${r.best400IM.timeStr})` : ""}`;
    const nxt = (r.nextUpItems || [])
      .map((x) => `${x.event} (${x.timeStr}) ${-x.diffSec}`)
      .join(" ");

    const hay =
      `${r.name} ${r.gender} ${r.age} ${yn} ${near} ${aaa} ${im} ${nxt}`.toLowerCase();
    return hay.includes(query);
  });

  render(filtered);
}

/* ---------- Load ---------- */
async function loadRoster() {
  const tbody = document.getElementById("rowsBody");
  const pill = document.getElementById("countPill");
  if (tbody)
    tbody.innerHTML = `<tr><td colspan="8" class="muted" style="padding:18px">Loading…</td></tr>`;
  if (pill) pill.textContent = "Loading…";

  const res = await fetch(CSV_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const text = await res.text();

  const parsed = parseCSV(text);
  const dataRows = parsed.slice(1);

  const filteredRows = dataRows.filter(rowMatchesFilter);

  roster = sortRoster(buildRosterFromRows(filteredRows));
  render(roster);
}

/* ---------- UI ---------- */
function wireUI() {
  document
    .getElementById("searchInput")
    ?.addEventListener("input", (e) => applySearch(e.target.value));

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    const s = document.getElementById("searchInput");
    if (s) s.value = "";
    render(roster);
  });

  document.getElementById("refreshBtn")?.addEventListener("click", async () => {
    try {
      await loadRoster();
      applySearch(document.getElementById("searchInput")?.value || "");
    } catch (e) {
      console.error(e);
      alert("Could not refresh. Check the sheet sharing settings.");
    }
  });
}

(async function init() {
  wireUI();
  try {
    await loadRoster();
  } catch (e) {
    console.error(e);
    const tbody = document.getElementById("rowsBody");
    const pill = document.getElementById("countPill");
    if (pill) pill.textContent = "Error";
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="muted" style="padding: 18px">
            Could not load roster. Make sure the Google Sheet is shared as “Anyone with the link can view”.
          </td>
        </tr>
      `;
    }
  }
})();
