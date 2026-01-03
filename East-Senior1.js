// East-Senior1.js
// Pulls sheet -> filters Site=East & Group=Senior I -> sorts Name A-Z then Age desc

const SHEET_ID = "1xW2U_SlWsOlmEJlWLd-18jBxbreR5sFnMVr42rAosso";
const GID = "0";

// CSV export endpoint (no auth required if the sheet is viewable)
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}`;

const TARGET_SITE = "East";
const TARGET_GROUP = "Senior I";

// Column mapping (0-indexed)
const COL = {
  name: 0, // A
  gender: 1, // B
  age: 2, // C
  site: 3, // D
  group: 4, // E
  event: 5, // F
  time: 6, // G
  // motivational J-O are 9-14 if you need later
  ynat: 15, // P
  agchamps: 16, // Q
};

let allFilteredRows = [];

function normalize(s) {
  return (s ?? "").toString().trim();
}

function parseAge(v) {
  const n = Number(String(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : -1;
}

/**
 * Simple CSV parser that supports quoted fields with commas.
 * Assumes well-formed CSV from Google Sheets export.
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
      cur = "";
      // avoid pushing a final empty line
      if (row.length > 1 || (row.length === 1 && row[0] !== "")) rows.push(row);
      row = [];
      continue;
    }

    cur += ch;
  }

  // last cell
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }

  return rows;
}

function compareNames(aName, bName) {
  // Use localeCompare for clean alphabetical sorting
  return aName.localeCompare(bName, undefined, { sensitivity: "base" });
}

function sortRows(rows) {
  return rows.sort((a, b) => {
    const an = normalize(a[COL.name]);
    const bn = normalize(b[COL.name]);
    const nameCmp = compareNames(an, bn);
    if (nameCmp !== 0) return nameCmp;

    // Same name -> age descending
    const aa = parseAge(a[COL.age]);
    const ba = parseAge(b[COL.age]);
    return ba - aa;
  });
}

function rowMatches(r) {
  const site = normalize(r[COL.site]);
  const group = normalize(r[COL.group]);
  return site === TARGET_SITE && group === TARGET_GROUP;
}

function renderRows(rows) {
  const tbody = document.getElementById("rowsBody");
  const countPill = document.getElementById("countPill");
  if (!tbody) return;

  countPill.textContent = `${rows.length} rows`;

  if (rows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="muted" style="padding: 18px">
          No rows found for Site = ${TARGET_SITE} and Group = ${TARGET_GROUP}.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows
    .map((r) => {
      const name = normalize(r[COL.name]);
      const gender = normalize(r[COL.gender]);
      const age = normalize(r[COL.age]);
      const event = normalize(r[COL.event]);
      const time = normalize(r[COL.time]);
      const ynat = normalize(r[COL.ynat]);
      const ag = normalize(r[COL.agchamps]);

      return `
        <tr>
          <td>${escapeHTML(name)}</td>
          <td>${escapeHTML(gender)}</td>
          <td>${escapeHTML(age)}</td>
          <td>${escapeHTML(event)}</td>
          <td>${escapeHTML(time)}</td>
          <td>${escapeHTML(ynat)}</td>
          <td>${escapeHTML(ag)}</td>
        </tr>
      `;
    })
    .join("");
}

function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function applySearchFilter(q) {
  const query = normalize(q).toLowerCase();
  if (!query) {
    renderRows(allFilteredRows);
    return;
  }

  const filtered = allFilteredRows.filter((r) => {
    const hay = [
      r[COL.name],
      r[COL.gender],
      r[COL.age],
      r[COL.event],
      r[COL.time],
      r[COL.ynat],
      r[COL.agchamps],
    ]
      .map((x) => normalize(x).toLowerCase())
      .join(" | ");

    return hay.includes(query);
  });

  renderRows(filtered);
}

async function loadSheet() {
  const tbody = document.getElementById("rowsBody");
  const countPill = document.getElementById("countPill");
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="muted" style="padding: 18px">Loading…</td>
      </tr>
    `;
  }
  if (countPill) countPill.textContent = "Loading…";

  const res = await fetch(CSV_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const text = await res.text();

  const parsed = parseCSV(text);
  if (parsed.length === 0) {
    allFilteredRows = [];
    renderRows(allFilteredRows);
    return;
  }

  // First row is headers
  const dataRows = parsed.slice(1);

  const filtered = dataRows.filter(rowMatches);
  allFilteredRows = sortRows(filtered);

  renderRows(allFilteredRows);
}

function wireUI() {
  const search = document.getElementById("searchInput");
  const clearBtn = document.getElementById("clearBtn");
  const refreshBtn = document.getElementById("refreshBtn");

  if (search) {
    search.addEventListener("input", (e) => applySearchFilter(e.target.value));
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (search) search.value = "";
      renderRows(allFilteredRows);
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      try {
        await loadSheet();
        const q = document.getElementById("searchInput")?.value || "";
        applySearchFilter(q);
      } catch (err) {
        console.error(err);
        alert("Could not refresh. Check the sheet sharing settings.");
      }
    });
  }
}

(async function init() {
  wireUI();
  try {
    await loadSheet();
  } catch (err) {
    console.error(err);
    const tbody = document.getElementById("rowsBody");
    const countPill = document.getElementById("countPill");
    if (countPill) countPill.textContent = "Error";
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="muted" style="padding: 18px">
            Could not load sheet data. Make sure the Google Sheet is shared as “Anyone with the link can view”.
          </td>
        </tr>
      `;
    }
  }
})();
