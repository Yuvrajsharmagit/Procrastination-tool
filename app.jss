// Config
const TOTAL_YEARS = 80;
const WEEKS_PER_YEAR = 52;
const TOTAL_WEEKS = TOTAL_YEARS * WEEKS_PER_YEAR; // 4160
const WEEKS_LIVED = 884; // given
const CURRENT_WEEK = WEEKS_LIVED + 1;

const STORAGE_KEYS = {
  GOALS: 'liw-goalWeeks',
  NOTES: 'liw-notes'
};

let storageOK = true;
try {
  const t = '__liw__';
  localStorage.setItem(t, '1');
  localStorage.removeItem(t);
} catch {
  storageOK = false;
  document.getElementById('storage-warning').hidden = false;
}

// State
let goalWeeks = new Set();
let notes = {}; // { [weekIndex:number]: string }

// Load persisted data
if (storageOK) {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.GOALS);
    if (raw) goalWeeks = new Set(JSON.parse(raw));
  } catch {}
  try {
    const rawN = localStorage.getItem(STORAGE_KEYS.NOTES);
    if (rawN) notes = JSON.parse(rawN) || {};
  } catch {}
}

// DOM refs
const ageCol = document.getElementById('age-labels');
const years = document.getElementById('years');
const tt = document.getElementById('tooltip');

// Stats
const elLived = document.getElementById('weeks-lived');
const elRemain = document.getElementById('weeks-remaining');
const elPercent = document.getElementById('life-percent');
const elGoals = document.getElementById('goal-count');

// Dates for tooltip: approximate birth date from weeks lived
const msPerWeek = 7 * 24 * 60 * 60 * 1000;
const today = new Date();
const approxBirth = new Date(today.getTime() - WEEKS_LIVED * msPerWeek);

// Helpers
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const weekToYearIndex = (w) => Math.floor((w - 1) / WEEKS_PER_YEAR);
const weekOfYear = (w) => ((w - 1) % WEEKS_PER_YEAR) + 1;
const ageAtWeek = (w) => weekToYearIndex(w);
const dateForWeek = (w) => new Date(approxBirth.getTime() + (w - 1) * msPerWeek);

function save() {
  if (!storageOK) return;
  try {
    localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify([...goalWeeks]));
  } catch {}
  try {
    localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
  } catch {}
}

function fmtPercent(n) {
  return `${(n * 100).toFixed(1)}%`;
}

function updateStats() {
  const remaining = clamp(TOTAL_WEEKS - WEEKS_LIVED, 0, TOTAL_WEEKS);
  elLived.textContent = WEEKS_LIVED.toLocaleString();
  elRemain.textContent = remaining.toLocaleString();
  elPercent.textContent = fmtPercent(WEEKS_LIVED / TOTAL_WEEKS);
  elGoals.textContent = `${goalWeeks.size}`;
}

// Build age labels
(function buildAges(){
  const frag = document.createDocumentFragment();
  for (let a = 0; a < TOTAL_YEARS; a++){
    const d = document.createElement('div');
    d.className = 'age';
    d.textContent = `Age ${a}`;
    frag.appendChild(d);
  }
  ageCol.appendChild(frag);
})();

// Build grid by years (80 rows × 52 columns)
(function buildGrid(){
  const yFrag = document.createDocumentFragment();
  let weekIndex = 1;

  for (let y = 0; y < TOTAL_YEARS; y++){
    const row = document.createElement('div');
    row.className = 'year-row';
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', `Year ${y}`);

    for (let w = 0; w < WEEKS_PER_YEAR; w++){
      const idx = weekIndex++;

      const cell = document.createElement('div');
      cell.className = 'week';
      cell.dataset.week = String(idx);
      cell.dataset.age = String(y);
      cell.dataset.woy = String(w + 1);

      // Base state coloring
      if (idx <= WEEKS_LIVED) {
        cell.classList.add('past');
      } else if (idx === CURRENT_WEEK) {
        cell.classList.add('current');
      } else {
        cell.classList.add('future');
      }

      // Goal override
      if (goalWeeks.has(idx)) {
        cell.classList.remove('past', 'current', 'future');
        cell.classList.add('goal');
      }

      // A11y label
      const d = dateForWeek(idx);
      const label = [
        `Week ${idx}`,
        `Age ${ageAtWeek(idx)}`,
        `Week-of-year ${weekOfYear(idx)}`,
        `${d.toLocaleDateString()}`
      ].join(', ');
      cell.setAttribute('aria-label', label);

      row.appendChild(cell);
    }

    yFrag.appendChild(row);
  }

  years.appendChild(yFrag);
  updateStats();
})();

// Event delegation: click to toggle goal
years.addEventListener('click', (e) => {
  const cell = e.target.closest('.week');
  if (!cell) return;

  const idx = Number(cell.dataset.week);

  // Toggle goal
  if (cell.classList.contains('goal')) {
    // If has note, ask whether to keep note
    if (notes[idx]) {
      const keep = confirm('Remove goal color but keep note?\nPress OK to keep note, Cancel to delete note.');
      if (!keep) delete notes[idx];
    }
    cell.classList.remove('goal');
    // Restore base coloring
    if (idx <= WEEKS_LIVED) cell.classList.add('past');
    else if (idx === CURRENT_WEEK) cell.classList.add('current');
    else cell.classList.add('future');
    goalWeeks.delete(idx);
  } else {
    // Become goal; ask for optional note
    cell.classList.remove('past', 'current', 'future');
    cell.classList.add('goal');
    goalWeeks.add(idx);

    const existing = notes[idx] || '';
    const txt = prompt('Add a note for this goal week (optional):', existing);
    if (txt !== null) {
      const trimmed = txt.trim();
      if (trimmed) notes[idx] = trimmed;
      else delete notes[idx];
    }
  }

  save();
  updateStats();
});

// Context menu to edit note on goal weeks
years.addEventListener('contextmenu', (e) => {
  const cell = e.target.closest('.week');
  if (!cell) return;
  e.preventDefault();

  const idx = Number(cell.dataset.week);
  if (!goalWeeks.has(idx)) {
    alert('Set as goal first (left click) to add or edit a note.');
    return;
  }

  const existing = notes[idx] || '';
  const txt = prompt('Edit note (leave empty to remove):', existing);
  if (txt === null) return;
  const trimmed = txt.trim();
  if (trimmed) notes[idx] = trimmed;
  else delete notes[idx];
  save();
});

// Tooltip: hover info
let ttVisible = false;
years.addEventListener('mousemove', (e) => {
  const cell = e.target.closest('.week');
  if (!cell) { hideTT(); return; }

  const idx = Number(cell.dataset.week);
  const age = Number(cell.dataset.age);
  const woy = Number(cell.dataset.woy);
  const d = dateForWeek(idx);
  const note = notes[idx];

  tt.innerHTML = `
    <div><strong>Week</strong> ${idx}</div>
    <div><strong>Age</strong> ${age}</div>
    <div><strong>Week of year</strong> ${woy}</div>
    <div><strong>Date</strong> ${d.toLocaleDateString()}</div>
    ${note ? `<div style="margin-top:4px"><strong>Note</strong> ${escapeHTML(note)}</div>` : ''}
  `;
  positionTT(e.clientX, e.clientY);
  showTT();
});

years.addEventListener('mouseleave', hideTT);

function positionTT(x, y){
  const pad = 10;
  const rect = tt.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let tx = x + pad;
  let ty = y + pad;
  if (tx + rect.width > vw) tx = x - rect.width - pad;
  if (ty + rect.height > vh) ty = y - rect.height - pad;
  tt.style.left = `${tx}px`;
  tt.style.top = `${ty}px`;
}

function showTT(){
  if (ttVisible) return;
  tt.hidden = false;
  ttVisible = true;
}
function hideTT(){
  if (!ttVisible) return;
  tt.hidden = true;
  ttVisible = false;
}
function escapeHTML(s){
  return s.replace(/[&<>"']/g, ch =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])
  );
}

// Keyboard accessibility (optional)
years.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const cell = e.target.closest('.week');
  if (!cell) return;
  e.preventDefault();
  cell.click();
});

// Make weeks focusable for keyboard nav
Array.from(document.querySelectorAll('.week')).forEach(el => el.tabIndex = 0);
