// RosterFit.js
// Lists all athletes sorted by Site -> Group -> Name (A-Z) -> Age (desc)

const SHEET_ID = "1xW2U_SlWsOlmEJlWLd-18jBxbreR5sFnMVr42rAosso";
const GID = "0";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}`;

// Columns (0-indexed)
const COL = {
  name: 0, // A
  age: 2, // C
  site: 3, // D
  group: 4, // E
};

let roster = [];

function normalize(v) {
  return (v ?? "").toString().trim();
}

function parseAge(v) {
  const n = Number(String(v).replace(/[^\d.]/g, ""));
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
      if (row.length > 1 || (row.length === 1 && row[0] !== "")) rows.push(row);
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

function sortRoster(rows) {
  return rows.sort((a, b) => {
    const as = normalize(a.site).toLowerCase();
    const bs = normalize(b.site).toLowerCase();
    if (as !== bs) return as.localeCompare(bs);

    const ag = normalize(a.group).toLowerCase();
    const bg = normalize(b.group).toLowerCase();
    if (ag !== bg) return ag.localeCompare(bg);

    const an = normalize(a.name);
    const bn = normalize(b.name);
    const nameCmp = an.localeCompare(bn, undefined, { sensitivity: "base" });
    if (nameCmp !== 0) return nameCmp;

    return (b.ageNum ?? -1) - (a.ageNum ?? -1);
  });
}

function dedupeByNameSiteGroup(rows) {
  // If the sheet has multiple rows per swimmer (different events),
  // this reduces to one row per (Site, Group, Name) keeping the max age found.
  const map = new Map();
  for (const r of rows) {
    const key = `${r.site}||${r.group}||${r.name}`.toLowerCase();
    if (!map.has(key)) map.set(key, r);
    else {
      const prev = map.get(key);
      if ((r.ageNum ?? -1) > (prev.ageNum ?? -1)) map.set(key, r);
    }
  }
  return Array.from(map.values());
}

function render(rows) {
  const tbody = document.getElementById("rowsBody");
  const pill = document.getElementById("countPill");
  if (!tbody) return;

  if (pill) pill.textContent = `${rows.length} athletes`;

  if (rows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="muted" style="padding: 18px">
          No athletes found.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows
    .map(
      (r) => `
    <tr>
      <td>${escapeHTML(r.site)}</td>
      <td>${escapeHTML(r.group)}</td>
      <td>${escapeHTML(r.name)}</td>
      <td>${escapeHTML(r.age)}</td>
    </tr>`
    )
    .join("");
}

function applySearch(q) {
  const query = normalize(q).toLowerCase();
  if (!query) return render(roster);

  const filtered = roster.filter((r) => {
    const hay = `${r.site} ${r.group} ${r.name} ${r.age}`.toLowerCase();
    return hay.includes(query);
  });

  render(filtered);
}

async function loadRoster() {
  const tbody = document.getElementById("rowsBody");
  const pill = document.getElementById("countPill");
  if (tbody)
    tbody.innerHTML = `<tr><td colspan="4" class="muted" style="padding:18px">Loading…</td></tr>`;
  if (pill) pill.textContent = "Loading…";

  const res = await fetch(CSV_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const text = await res.text();

  const parsed = parseCSV(text);
  const dataRows = parsed.slice(1); // skip header

  const rows = dataRows
    .map((r) => ({
      site: normalize(r[COL.site]),
      group: normalize(r[COL.group]),
      name: normalize(r[COL.name]),
      age: normalize(r[COL.age]),
      ageNum: parseAge(r[COL.age]),
    }))
    .filter((r) => r.name && r.site && r.group); // basic sanity

  // likely multiple rows per swimmer due to events -> dedupe for roster view
  const unique = dedupeByNameSiteGroup(rows);

  roster = sortRoster(unique);
  render(roster);
}

function wireUI() {
  const search = document.getElementById("searchInput");
  const clearBtn = document.getElementById("clearBtn");
  const refreshBtn = document.getElementById("refreshBtn");

  if (search)
    search.addEventListener("input", (e) => applySearch(e.target.value));

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (search) search.value = "";
      render(roster);
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      try {
        await loadRoster();
        applySearch(document.getElementById("searchInput")?.value || "");
      } catch (e) {
        console.error(e);
        alert("Could not refresh. Check the sheet sharing settings.");
      }
    });
  }
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
          <td colspan="4" class="muted" style="padding: 18px">
            Could not load roster. Make sure the Google Sheet is shared as “Anyone with the link can view”.
          </td>
        </tr>
      `;
    }
  }
})();
