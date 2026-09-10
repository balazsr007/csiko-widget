// ======================================================================
// Csiko Widget - PWA
// ======================================================================

const GESZTACIOS_NAPOK = 336;
const TRIMESZTER_NAPOK = Math.floor(GESZTACIOS_NAPOK / 3);
const STORAGE_KEY = "csikoWidgetData";

const TRIMESZTER_SZINEK = ["#4caf50", "#ff9800", "#e53935"];
const TRIMESZTER_ROVID_CIMKE = ["Hasznalhato", "Korlatozottan hasznalhato", "Nem hasznalhato"];
const TRIMESZTER_JAVASLAT = [
  "Lovagolhato, hasznalhato",
  "Korlatozottan hasznalhato",
  "Csak futoszar / szoron, vagta nelkul",
];

const TASKS = [
  { id: "uh18", num: "1.", label: "Vemhessegi / ikervemhessegi UH", kind: "days", value: 18 },
  { id: "uh30", num: "2.", label: "30. napos UH", kind: "days", value: 30 },
  { id: "uh100", num: "3.", label: "100. napos UH", kind: "days", value: 100 },
  { id: "herpesz1", num: "4.", label: "1. herpesz injekcio (5 honap)", kind: "months", value: 5 },
  { id: "herpesz2", num: "5.", label: "2. herpesz injekcio (7 honap)", kind: "months", value: 7 },
  { id: "herpesz3", num: "6.", label: "3. herpesz injekcio (9 honap)", kind: "months", value: 9 },
  { id: "kobi", num: "7.", label: "Kombinalt oltas + vervetel (10 honap)", kind: "months", value: 10 },
  { id: "uh300", num: "8.", label: "300. napos UH (csiko befordult-e)", kind: "days", value: 300 },
  { id: "feregh", num: "9.", label: "Fereghajtas", kind: "days", value: 300 },
  { id: "patko", num: "10.", label: "Patko levetele", kind: "days", value: 310 },
  {
    id: "ellesi_csomag", num: "11.", label: "Ellesi csomag osszekeszitese",
    kind: "days", value: GESZTACIOS_NAPOK - 20,
    subItems: [
      "Friss torolkozo",
      "Fertotlenitett ollo",
      "Clorexyderm gel",
      "IKEA-s csomaglezaro (koldokzsinorhoz, ha el kell vagni)",
      "Beontes eszkozei",
    ],
  },
];

// ---------------------------------------------------------------------
// Datum-segedfuggvenyek
// ---------------------------------------------------------------------
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}
function computeDueDate(fedezes, task) {
  return task.kind === "days" ? addDays(fedezes, task.value) : addMonths(fedezes, task.value);
}
function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}.`;
}
function daysBetween(a, b) {
  const MS = 24 * 60 * 60 * 1000;
  return Math.round((b - a) / MS);
}
function computeTrimeszter(eltelt) {
  const clipped = Math.max(0, Math.min(eltelt, GESZTACIOS_NAPOK - 1));
  const tri = Math.min(Math.floor(clipped / TRIMESZTER_NAPOK), 2);
  const napATriben = clipped - tri * TRIMESZTER_NAPOK + 1;
  return { tri: tri + 1, nap: napATriben };
}

// ---------------------------------------------------------------------
// Adattarolas (localStorage) - kesobb backendre is csereheto/bovitheto
// ---------------------------------------------------------------------
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error("Betoltesi hiba:", e);
  }
  return { mares: [], activeIndex: 0 };
}
function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadData();

// --- Kancaregiszter (kisberifelver.hu evenkenti nyilvantartasabol importalva) ---
let kancaRegiszter = [];
async function loadKancaRegiszter() {
  try {
    const resp = await fetch("./kancaregiszter.json");
    kancaRegiszter = await resp.json();
  } catch (e) {
    console.error("Nem sikerult betolteni a kancaregisztert:", e);
    kancaRegiszter = [];
  }
}

function getActiveMare() {
  if (!state.mares.length) return null;
  state.activeIndex = Math.max(0, Math.min(state.activeIndex, state.mares.length - 1));
  return state.mares[state.activeIndex];
}
function taskIsChecked(mare, task) {
  const cl = mare.checklist || {};
  if (task.subItems) {
    return task.subItems.every((_, i) => !!cl[`${task.id}__${i}`]);
  }
  return !!cl[task.id];
}
function countUrgent(mare) {
  const fedezes = new Date(mare.fedezesDatum);
  const today = new Date();
  let count = 0;
  for (const task of TASKS) {
    if (taskIsChecked(mare, task)) continue;
    const due = computeDueDate(fedezes, task);
    if (daysBetween(today, due) <= 5) count++;
  }
  return count;
}

// ---------------------------------------------------------------------
// Egyszeru modal rendszer (input / action sheet), sotet temaban
// ---------------------------------------------------------------------
function closeModal() {
  const el = document.getElementById("modal-root");
  el.innerHTML = "";
  el.classList.add("hidden");
}
function showInputModal({ title, placeholder = "", initialValue = "", onSubmit }) {
  const root = document.getElementById("modal-root");
  root.classList.remove("hidden");
  root.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal-sheet">
        <h3>${title}</h3>
        <input id="modal-input" type="text" placeholder="${placeholder}" value="${initialValue}" />
        <div class="btn-row">
          <button class="btn secondary" id="modal-cancel">Megse</button>
          <button class="btn" id="modal-ok">OK</button>
        </div>
      </div>
    </div>`;
  const input = document.getElementById("modal-input");
  input.focus();
  input.addEventListener("focus", () => {
    setTimeout(() => input.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
  });
  document.getElementById("modal-cancel").onclick = closeModal;
  document.getElementById("modal-backdrop").onclick = (e) => {
    if (e.target.id === "modal-backdrop") closeModal();
  };
  document.getElementById("modal-ok").onclick = () => {
    const val = input.value.trim();
    closeModal();
    if (val) onSubmit(val);
  };
}
function showActionSheet({ title, actions }) {
  const root = document.getElementById("modal-root");
  root.classList.remove("hidden");
  const buttons = actions
    .map(
      (a, i) =>
        `<button class="${a.danger ? "danger" : ""}" data-idx="${i}">${a.label}</button>`
    )
    .join("");
  root.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal-sheet">
        <h3>${title}</h3>
        <div class="action-list">${buttons}</div>
      </div>
    </div>`;
  document.getElementById("modal-backdrop").onclick = (e) => {
    if (e.target.id === "modal-backdrop") closeModal();
  };
  root.querySelectorAll(".action-list button").forEach((btn) => {
    btn.onclick = () => {
      const idx = parseInt(btn.dataset.idx, 10);
      closeModal();
      actions[idx].onClick();
    };
  });
}

// onSelect(record) - record = kivalasztott kancaregiszter-sor, vagy null ha
// a felhasznalo inkabb kezzel adja meg a nevet (nincs a nyilvantartasban).
function showMareSearchModal(onSelect) {
  const root = document.getElementById("modal-root");
  root.classList.remove("hidden");
  root.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal-sheet">
        <h3>Kanca keresese a nyilvantartasban</h3>
        <input id="mare-search-input" type="text" placeholder="Kezdj el gepelni a nevehez..." />
        <div class="search-hint">${
          kancaRegiszter.length
            ? `${kancaRegiszter.length} kanca a 2026-os kisberifelver.hu nyilvantartasbol`
            : "A nyilvantartas jelenleg nem erheto el - adj meg egyeni nevet."
        }</div>
        <div class="search-results" id="mare-search-results"></div>
        <div class="btn-row">
          <button class="btn secondary" id="modal-cancel">Megse</button>
          <button class="btn" id="manual-entry-btn">Egyeni nev megadasa</button>
        </div>
      </div>
    </div>`;

  const input = document.getElementById("mare-search-input");
  const resultsEl = document.getElementById("mare-search-results");
  input.focus();
  input.addEventListener("focus", () => {
    setTimeout(() => input.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
  });

  function renderResults(query) {
    const q = query.trim().toLowerCase();
    if (!q) {
      resultsEl.innerHTML = "";
      return;
    }
    const matches = kancaRegiszter
      .filter((m) => m.nev.toLowerCase().includes(q))
      .slice(0, 30);
    if (!matches.length) {
      resultsEl.innerHTML = `<div class="search-empty">Nincs talalat - probald az "Egyeni nev megadasa" gombot.</div>`;
      return;
    }
    resultsEl.innerHTML = matches
      .map(
        (m, i) => `
      <div class="search-item" data-idx="${i}">
        <div class="search-item-name">${m.nev}</div>
        <div class="search-item-meta">${m.szuletes} \u00b7 ${m.tenyeszto}</div>
      </div>`
      )
      .join("");
    resultsEl.querySelectorAll(".search-item").forEach((el, i) => {
      el.onclick = () => {
        closeModal();
        onSelect(matches[i]);
      };
    });
  }

  input.oninput = () => renderResults(input.value);
  document.getElementById("modal-cancel").onclick = closeModal;
  document.getElementById("manual-entry-btn").onclick = () => {
    closeModal();
    onSelect(null);
  };
  document.getElementById("modal-backdrop").onclick = (e) => {
    if (e.target.id === "modal-backdrop") closeModal();
  };
}

function askDate(defaultVal, onSubmit) {
  showInputModal({
    title: "Utolso sikeres fedeztetes datuma",
    placeholder: "EEEE-HH-NN, pl. 2026-01-15",
    initialValue: defaultVal || "",
    onSubmit: (val) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(val) || isNaN(new Date(val).getTime())) {
        alert("Hibas format! EEEE-HH-NN alakban add meg, pl. 2026-01-15.");
        return;
      }
      onSubmit(val);
    },
  });
}

// ---------------------------------------------------------------------
// Kanca-kezeles
// ---------------------------------------------------------------------
function addMare() {
  showMareSearchModal((selected) => {
    if (selected) {
      askDate("", (date) => {
        state.mares.push({
          name: selected.nev,
          fedezesDatum: date,
          checklist: {},
          registryId: selected.azonosito,
        });
        state.activeIndex = state.mares.length - 1;
        saveData();
        renderAll();
      });
    } else {
      showInputModal({
        title: "Kanca neve",
        placeholder: "pl. Csillag",
        onSubmit: (name) => {
          askDate("", (date) => {
            state.mares.push({ name, fedezesDatum: date, checklist: {} });
            state.activeIndex = state.mares.length - 1;
            saveData();
            renderAll();
          });
        },
      });
    }
  });
}
function renameMare() {
  const mare = getActiveMare();
  if (!mare) return;
  showInputModal({
    title: "Kanca atnevezese",
    initialValue: mare.name,
    onSubmit: (name) => {
      mare.name = name;
      saveData();
      renderAll();
    },
  });
}
function changeDate() {
  const mare = getActiveMare();
  if (!mare) return;
  askDate(mare.fedezesDatum, (date) => {
    mare.fedezesDatum = date;
    saveData();
    renderAll();
  });
}
function deleteMare() {
  const mare = getActiveMare();
  if (!mare) return;
  if (!confirm(`Biztosan torlod "${mare.name}" kancat, az osszes teendojevel egyutt?`)) return;
  state.mares.splice(state.activeIndex, 1);
  state.activeIndex = Math.max(0, state.activeIndex - 1);
  saveData();
  if (!state.mares.length) return firstRunSetup();
  renderAll();
}
function resetChecklist() {
  const mare = getActiveMare();
  if (!mare) return;
  if (!confirm("Biztosan torlod az osszes kipipalast ennel a kancanal?")) return;
  mare.checklist = {};
  saveData();
  renderAll();
}
function switchMare(delta) {
  if (!state.mares.length) return;
  state.activeIndex = (state.activeIndex + delta + state.mares.length) % state.mares.length;
  saveData();
  renderAll();
}
function openMenu() {
  showActionSheet({
    title: "Kanca / beallitasok",
    actions: [
      { label: "Uj kanca hozzaadasa", onClick: addMare },
      { label: "Kanca atnevezese", onClick: renameMare },
      { label: "Fedeztetes datumanak modositasa", onClick: changeDate },
      { label: "Teendok visszaallitasa", onClick: resetChecklist },
      { label: "Kanca torlese", danger: true, onClick: deleteMare },
    ],
  });
}
function firstRunSetup() {
  showMareSearchModal((selected) => {
    if (selected) {
      askDate("", (date) => {
        state.mares = [
          { name: selected.nev, fedezesDatum: date, checklist: {}, registryId: selected.azonosito },
        ];
        state.activeIndex = 0;
        saveData();
        renderAll();
      });
    } else {
      showInputModal({
        title: "Uj vemhes kanca neve",
        placeholder: "pl. Csillag",
        onSubmit: (name) => {
          askDate("", (date) => {
            state.mares = [{ name, fedezesDatum: date, checklist: {} }];
            state.activeIndex = 0;
            saveData();
            renderAll();
          });
        },
      });
    }
  });
}

// ---------------------------------------------------------------------
// SVG gyuru rajzolasa (trimeszter-szinek + ivelt feliratok + mutato ek)
// ---------------------------------------------------------------------
function polar(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)];
}
function arcPath(cx, cy, r, startDeg, extentDeg) {
  const [x1, y1] = polar(cx, cy, r, startDeg);
  const [x2, y2] = polar(cx, cy, r, startDeg + extentDeg);
  const largeArc = Math.abs(extentDeg) > 180 ? 1 : 0;
  const sweep = extentDeg < 0 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} ${sweep} ${x2} ${y2}`;
}

function renderRingSVG(mare) {
  const cx = 100, cy = 100, r = 66, ringW = 15;
  const fedezes = new Date(mare.fedezesDatum);
  const varhato = addDays(fedezes, GESZTACIOS_NAPOK);
  const today = new Date();
  const eltelt = daysBetween(fedezes, today);
  const hatra = daysBetween(today, varhato);
  const elteltClip = Math.max(0, Math.min(eltelt, GESZTACIOS_NAPOK));
  const arany = elteltClip / GESZTACIOS_NAPOK;

  let svg = `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">`;

  // hatter: 3 trimeszter-szakasz
  for (let i = 0; i < 3; i++) {
    const start = 90 - i * 120;
    svg += `<path d="${arcPath(cx, cy, r, start, -120)}" fill="none" stroke="${TRIMESZTER_SZINEK[i]}" stroke-width="${ringW}" />`;
  }
  // elvalaszto vagasok
  for (const hatarArany of [1 / 3, 2 / 3]) {
    const start = 90 - 360 * hatarArany - 1.4;
    svg += `<path d="${arcPath(cx, cy, r, start, -2.8)}" fill="none" stroke="#1a1a1a" stroke-width="${ringW + 3}" />`;
  }

  // ivelt feliratok - lathatatlan guide-path + textPath a gyuru kulso oldalan
  const cimkeSugar = r + 19;
  for (let i = 0; i < 3; i++) {
    const midSzog = 90 - (i * 120 + 60);
    // felteken (also iven) forditva rajzoljuk a guide-path-ot, hogy ne alljon fejre a szoveg
    const flip = Math.sin((midSzog * Math.PI) / 180) < -0.3;
    const span = 100; // fokban, mennyit fogjon at a felirat utja
    const a1 = flip ? midSzog - span / 2 : midSzog + span / 2;
    const a2 = flip ? midSzog + span / 2 : midSzog - span / 2;
    const pid = `curve-${i}`;
    svg += `<path id="${pid}" d="${arcPath(cx, cy, cimkeSugar, a1, a2 - a1)}" fill="none" stroke="none" />`;
    svg += `<text font-size="9" font-weight="700" fill="${TRIMESZTER_SZINEK[i]}">
      <textPath href="#${pid}" startOffset="50%" text-anchor="middle">${TRIMESZTER_ROVID_CIMKE[i]}</textPath>
    </text>`;
  }

  // mutato ek - a belso kor oldalan, a mai naphoz tartozo szognel
  const mutSzog = 90 - 360 * arany;
  const tipR = r - 6, alapR = r - 22, felSzel = 7;
  const [tx, ty] = polar(cx, cy, tipR, mutSzog);
  const radDir = (mutSzog * Math.PI) / 180;
  const radial = [Math.cos(radDir), -Math.sin(radDir)];
  const tangent = [-Math.sin(radDir), -Math.cos(radDir)];
  const [acx, acy] = polar(cx, cy, alapR, mutSzog);
  const bx1 = acx + felSzel * tangent[0], by1 = acy + felSzel * tangent[1];
  const bx2 = acx - felSzel * tangent[0], by2 = acy - felSzel * tangent[1];
  svg += `<polygon points="${tx},${ty} ${bx1},${by1} ${bx2},${by2}" fill="#ffffff" stroke="#1a1a1a" stroke-width="1" />`;

  svg += `</svg>`;
  return { svg, hatra, eltelt: elteltClip, fedezes, varhato };
}

// ---------------------------------------------------------------------
// Renderelo fuggvenyek
// ---------------------------------------------------------------------
function renderNav(mare) {
  const nameEl = document.getElementById("mare-name");
  const idxTxt = state.mares.length > 1 ? ` (${state.activeIndex + 1}/${state.mares.length})` : "";
  nameEl.textContent = mare ? `${mare.name}${idxTxt}` : "Nincs kanca";
}

function renderRing(mare) {
  const wrap = document.getElementById("ring-wrap");
  const centerDays = document.getElementById("ring-days");
  const centerLabel = document.getElementById("ring-days-label");
  const badge = document.getElementById("urgent-badge");

  if (!mare) {
    wrap.querySelector("svg")?.remove();
    centerDays.textContent = "-";
    centerLabel.textContent = "adj hozza egy kancat";
    badge.classList.add("hidden");
    return;
  }

  const { svg, hatra } = renderRingSVG(mare);
  wrap.querySelector("svg")?.remove();
  wrap.insertAdjacentHTML("afterbegin", svg);

  if (hatra > 0) {
    centerDays.textContent = hatra;
    centerLabel.textContent = "nap van hatra";
  } else if (hatra === 0) {
    centerDays.textContent = "MA!";
    centerLabel.textContent = "varhato a csiko";
  } else {
    centerDays.textContent = "Esedekes";
    centerLabel.textContent = `${-hatra} napja`;
  }

  const urgent = countUrgent(mare);
  badge.textContent = "!";
  badge.classList.toggle("hidden", urgent === 0);
}

function renderInfo(mare) {
  const box = document.getElementById("info-box");
  if (!mare) {
    box.innerHTML = "";
    return;
  }
  const fedezes = new Date(mare.fedezesDatum);
  const varhato = addDays(fedezes, GESZTACIOS_NAPOK);
  const today = new Date();
  const eltelt = Math.max(0, Math.min(daysBetween(fedezes, today), GESZTACIOS_NAPOK - 1));
  const { tri, nap } = computeTrimeszter(eltelt);
  const triSzin = TRIMESZTER_SZINEK[tri - 1];
  const triJavaslat = TRIMESZTER_JAVASLAT[tri - 1];

  box.innerHTML = `
    <div>
      <div class="label">Utolso sikeres fedeztetes</div>
      <div class="value">${fmtDate(fedezes)}</div>
    </div>
    <div>
      <div class="label">Varhato elles</div>
      <div class="value">${fmtDate(varhato)}</div>
    </div>
    <div>
      <div class="label">Trimeszter / nap</div>
      <div class="value" style="color:${triSzin}">${tri}/3 (${nap}. nap)</div>
    </div>
    <div class="trimeszter-advice" style="color:${triSzin}">${triJavaslat}</div>
  `;
}

let checklistExpanded = false;
let expandedSubtasks = new Set();

function renderChecklistToggle(mare) {
  const btn = document.getElementById("checklist-toggle");
  const arrow = checklistExpanded ? "\u25b2" : "\u25bc";
  if (!mare) {
    btn.textContent = `Teendok ${arrow}`;
    btn.classList.add("calm");
    return;
  }
  const urgent = countUrgent(mare);
  btn.textContent = urgent > 0 ? `Teendok ${arrow} \u2014 ${urgent} surgos!` : `Teendok ${arrow}`;
  btn.classList.toggle("calm", urgent === 0);
}

function statusFor(due, checked, today) {
  const daysLeft = daysBetween(today, due);
  if (checked) return { text: `Kesz \u2713 (${fmtDate(due)})`, color: "#4caf50", done: true };
  if (daysLeft < 0) return { text: `LEJART! (${fmtDate(due)})`, color: "#e53935", done: false };
  if (daysLeft <= 5) return { text: `${daysLeft} nap mulva!`, color: "#ff9800", done: false };
  return { text: fmtDate(due), color: "#999", done: false };
}

function renderChecklist(mare) {
  const list = document.getElementById("checklist");
  list.innerHTML = "";
  list.classList.toggle("hidden", !checklistExpanded);
  if (!mare || !checklistExpanded) return;

  const fedezes = new Date(mare.fedezesDatum);
  const today = new Date();
  const checklist = (mare.checklist = mare.checklist || {});

  TASKS.forEach((task) => {
    const due = computeDueDate(fedezes, task);
    const checked = taskIsChecked(mare, task);
    const st = statusFor(due, checked, today);

    const row = document.createElement("div");
    row.className = "task-row";

    if (task.subItems) {
      const isOpen = expandedSubtasks.has(task.id);
      row.innerHTML = `
        <span class="expand-arrow" data-task="${task.id}">${isOpen ? "\u25bc" : "\u25b6"}</span>
        <span class="txt ${st.done ? "done" : ""}" data-task="${task.id}">${task.num} ${task.label}</span>
        <span class="status" style="color:${st.color}">${st.text}</span>
      `;
      row.querySelector(".expand-arrow").onclick = () => toggleSubExpand(task.id);
      row.querySelector(".txt").onclick = () => toggleSubExpand(task.id);
    } else {
      row.innerHTML = `
        <input type="checkbox" class="chk" ${checked ? "checked" : ""} />
        <span class="txt ${st.done ? "done" : ""}">${task.num} ${task.label}</span>
        <span class="status" style="color:${st.color}">${st.text}</span>
      `;
      row.querySelector(".chk").onchange = (e) => onCheck(task, e.target.checked);
    }
    list.appendChild(row);

    if (task.subItems && expandedSubtasks.has(task.id)) {
      const subWrap = document.createElement("div");
      subWrap.className = "sub-list";
      task.subItems.forEach((label, i) => {
        const subChecked = !!checklist[`${task.id}__${i}`];
        const subRow = document.createElement("div");
        subRow.className = "sub-row";
        subRow.innerHTML = `
          <input type="checkbox" class="chk" ${subChecked ? "checked" : ""} />
          <span class="txt ${subChecked ? "done" : ""}">${label}</span>
        `;
        subRow.querySelector(".chk").onchange = (e) => onCheckSub(task, i, e.target.checked);
        subWrap.appendChild(subRow);
      });
      list.appendChild(subWrap);
    }
  });
}

function toggleSubExpand(taskId) {
  if (expandedSubtasks.has(taskId)) expandedSubtasks.delete(taskId);
  else expandedSubtasks.add(taskId);
  renderAll();
}
function onCheck(task, value) {
  const mare = getActiveMare();
  if (!mare) return;
  mare.checklist[task.id] = value;
  saveData();
  renderAll();
}
function onCheckSub(task, index, value) {
  const mare = getActiveMare();
  if (!mare) return;
  mare.checklist[`${task.id}__${index}`] = value;
  saveData();
  renderAll();
}
function toggleChecklistPanel() {
  checklistExpanded = !checklistExpanded;
  renderAll();
}

function renderAll() {
  const mare = getActiveMare();
  renderNav(mare);
  renderRing(mare);
  renderInfo(mare);
  renderChecklistToggle(mare);
  renderChecklist(mare);
}

// ======================================================================
// PUSH-ERTESITESEK
// ======================================================================
// Ez a resz mar keszen all a push fogadasara (a service worker "push"
// esemenykezeloje mukodokepes), de a TENYLEGES kuldeshez kell egy
// hatterszerver + VAPID kulcspar - ez a kovetkezo lepesben keszul el
// (Raspberry Pi -> szerver -> push). Amig az nincs kesz, a "Teszt-
// ertesites" gombbal helyben, szerver nelkul is kiprobalhato, hogy a
// telefon/bongeszo kepes-e ertesitest megjeleniteni.
//
// Ha mar kesz a szerver: illeszd be ide a VAPID public key-t, es a
// PUSH_SERVER_URL-t, majd hivd meg a subscribeToPush() fuggvenyt (pl.
// az "Ertesitesek engedelyezese" gomb mar meg is teszi automatikusan,
// ha ezt a ket erteket kitoltod).
const VAPID_PUBLIC_KEY = ""; // <-- ide kerul majd a szerver VAPID kulcsa
const PUSH_SERVER_URL = ""; // <-- ide kerul majd pl. "https://sajat-szerver.hu/subscribe"

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("./sw.js");
}

async function enableNotifications() {
  const statusEl = document.getElementById("push-status");
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    statusEl.textContent = "A bongesződ nem tamogatja az ertesiteseket.";
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    statusEl.textContent = "Nincs engedelyezve. Ertesitesek nelkul nem kapsz riasztast.";
    return;
  }
  const reg = await registerServiceWorker();

  if (VAPID_PUBLIC_KEY && PUSH_SERVER_URL && "PushManager" in window) {
    try {
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      await fetch(PUSH_SERVER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      statusEl.textContent = "Ertesitesek engedelyezve es osszekotve a szerverrel.";
    } catch (e) {
      console.error(e);
      statusEl.textContent = "Engedelyezve, de a szerver-osszekotes nem sikerult.";
    }
  } else {
    statusEl.textContent =
      "Ertesitesek engedelyezve ezen a keszuleken. A push-szerver meg nincs beallitva - egyelore a 'Teszt-ertesites' gombbal probalhato ki.";
  }
  document.getElementById("test-notif-btn").disabled = false;
}

async function sendTestNotification() {
  const reg = await registerServiceWorker();
  if (!reg) return;
  reg.showNotification("Csiko Widget - teszt", {
    body: "Ha ezt latod, mukodik az ertesites ezen a keszuleken.",
    icon: "icons/icon-192.png",
    vibrate: [200, 100, 200],
  });
}

// ======================================================================
// Inditas
// ======================================================================
async function init() {
  document.getElementById("nav-prev").onclick = () => switchMare(-1);
  document.getElementById("nav-next").onclick = () => switchMare(1);
  document.getElementById("nav-menu").onclick = openMenu;
  document.getElementById("checklist-toggle").onclick = toggleChecklistPanel;
  document.getElementById("enable-push-btn").onclick = enableNotifications;
  document.getElementById("test-notif-btn").onclick = sendTestNotification;

  registerServiceWorker();
  await loadKancaRegiszter();

  if (!state.mares.length) {
    firstRunSetup();
  } else {
    renderAll();
  }
}

// ======================================================================
// Mobil billentyuzet-kezeles: a modal-ablakok a lathato (billentyuzet
// feletti) teruletet kovessek, ne a teljes, billentyuzet altal reszben
// eltakart kepernyot.
// ======================================================================
function setupViewportHeightFix() {
  function update() {
    const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty("--vvh", `${h}px`);
  }
  update();
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", update);
    window.visualViewport.addEventListener("scroll", update);
  }
  window.addEventListener("resize", update);
}
setupViewportHeightFix();

document.addEventListener("DOMContentLoaded", init);
