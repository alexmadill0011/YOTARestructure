const SWIMMER_SHEET_ID = "1xW2U_SlWsOlmEJlWLd-18jBxbreR5sFnMVr42rAosso";
const SWIMMER_GID = "0";
const SWIMMER_CSV = `https://docs.google.com/spreadsheets/d/${SWIMMER_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SWIMMER_GID}`;

async function loadSwimmerCount() {
  try {
    const res = await fetch(SWIMMER_CSV);
    const text = await res.text();

    const rows = text.split("\n").slice(1);
    const swimmers = new Set();

    rows.forEach((row) => {
      const cols = row.split(",");
      const name = cols[0]?.replace(/"/g, "").trim(); // Column B
      if (name) swimmers.add(name);
    });

    document.getElementById("swimmerCount").textContent = swimmers.size;
  } catch (err) {
    console.error("Swimmer count failed:", err);
    document.getElementById("swimmerCount").textContent = "—";
  }
}

loadSwimmerCount();

async function loadNav() {
  const container = document.getElementById("nav-container");
  if (!container) return;

  try {
    const res = await fetch("nav.html");
    const html = await res.text();
    container.innerHTML = html;

    // Active link styling
    const current = location.pathname.split("/").pop() || "index.html";
    const links = container.querySelectorAll("a[href]");
    links.forEach((a) => {
      const href = a.getAttribute("href");
      if (href === current) a.classList.add("active");
    });
  } catch (e) {
    console.error("Failed to load nav:", e);
  }
}

function setYear() {
  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
}

loadNav();
setYear();
