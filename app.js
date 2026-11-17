// TOURFORM editor behaviour: one shared settings object drives the poster,
// the tee and the hoodie, and is saved as the draft in localStorage.

const STORAGE_KEY = 'tourform-draft';
const DRAFT_VERSION = 4;

const PALETTES = ['graphite-lime', 'black-orange', 'red-ink', 'ultraviolet', 'cream-cobalt'];
const TEXT_SIZE = { min: 80, max: 130, step: 5 };

// display = headline / artist name, text = secondary text.
// fallback = what the layout shows when the font is missing (must match styles.css).
const FONT_PAIRS = {
  'rubik-mulish': {
    display: { family: 'Rubik Mono One', fallback: 'Unbounded' },
    text: { family: 'Mulish', fallback: 'Manrope' },
  },
  'marck-mulish': {
    display: { family: 'Marck Script', fallback: 'cursive' },
    text: { family: 'Mulish', fallback: 'Manrope' },
  },
  'minsans-greatvibes': {
    display: { family: 'Min Sans', fallback: 'Manrope' },
    text: { family: 'Great Vibes', fallback: 'cursive' },
  },
  'nauryz-montserrat': {
    display: { family: 'NauryzRedKeds', fallback: 'Unbounded' },
    text: { family: 'Montserrat', fallback: 'Manrope' },
  },
};

// Pairs from the first font list, replaced for license reasons
// (Bups → Rubik Mono One, Ceremonious Two → Marck Script, Snell Roundhand → Great Vibes).
const LEGACY_FONT_PAIRS = {
  'bups-mulish': 'rubik-mulish',
  'ceremonious-mulish': 'marck-mulish',
  'minsans-snell': 'minsans-greatvibes',
};

const DEFAULTS = {
  artist: '',
  tour: '',
  slogan: '',
  audience: '',
  goal: '',
  character: '',
  layout: 'center',
  palette: 'graphite-lime',
  fontPair: 'rubik-mulish',
  textSize: 100,
  cities: [],
};

const FALLBACK_TEXT = { artist: 'Имя артиста', tour: 'Название тура', slogan: 'Громче каждого города' };

const root = document.documentElement;
const form = document.querySelector('#tour-form');
const artistInput = document.querySelector('#artist-name');
const tourInput = document.querySelector('#tour-name');
const briefInputs = Object.fromEntries(['slogan', 'audience', 'goal', 'character'].map((key) => [key, document.querySelector(`#${key}`)]));
const layoutRadios = document.querySelectorAll('input[name="layout"]');
const poster = document.querySelector('#poster-preview');
const saveStatus = document.querySelector('#save-status');
const storageMessage = document.querySelector('#storage-message');
const paletteButtons = document.querySelectorAll('.palette-option[data-palette]');
const fontRadios = document.querySelectorAll('input[name="fontPair"]');
const sizeInput = document.querySelector('#text-size');
const sizeOutput = document.querySelector('#text-size-value');
const sizeWarning = document.querySelector('#size-warning');
const posterCenter = document.querySelector('.poster-center');
const posterRoute = document.querySelector('#poster-route');
const posterCities = document.querySelector('#poster-cities');
const cityInput = document.querySelector('#city-name');
const addCityButton = document.querySelector('#add-city');
const cityList = document.querySelector('#city-list');
const cityEmpty = document.querySelector('#city-empty');
const cityMessage = document.querySelector('#city-message');
const cityWarning = document.querySelector('#city-warning');

const state = { ...DEFAULTS, cities: [] };
let storageAvailable = true;
let statusTimer = 0;

/* ---------- Draft: read, normalise, write ---------- */

function clampSize(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULTS.textSize;
  const stepped = Math.round(number / TEXT_SIZE.step) * TEXT_SIZE.step;
  return Math.min(TEXT_SIZE.max, Math.max(TEXT_SIZE.min, stepped));
}

function resolveFontPair(id) {
  const current = LEGACY_FONT_PAIRS[id] || id;
  return Object.hasOwn(FONT_PAIRS, current) ? current : DEFAULTS.fontPair;
}

// Accepts drafts from the first version ({ artist, tour, palette }) and fills
// every missing or invalid setting with its default.
function normaliseDraft(raw) {
  const draft = raw && typeof raw === 'object' ? raw : {};
  return {
    artist: typeof draft.artist === 'string' ? draft.artist.slice(0, 40) : DEFAULTS.artist,
    tour: typeof draft.tour === 'string' ? draft.tour.slice(0, 60) : DEFAULTS.tour,
    slogan: typeof draft.slogan === 'string' ? draft.slogan.slice(0, 70) : DEFAULTS.slogan,
    audience: typeof draft.audience === 'string' ? draft.audience.slice(0, 100) : DEFAULTS.audience,
    goal: typeof draft.goal === 'string' ? draft.goal.slice(0, 120) : DEFAULTS.goal,
    character: typeof draft.character === 'string' ? draft.character.slice(0, 100) : DEFAULTS.character,
    layout: ['center', 'left'].includes(draft.layout) ? draft.layout : DEFAULTS.layout,
    palette: PALETTES.includes(draft.palette) ? draft.palette : DEFAULTS.palette,
    fontPair: resolveFontPair(draft.fontPair),
    textSize: draft.textSize === undefined ? DEFAULTS.textSize : clampSize(draft.textSize),
    cities: normaliseCities(draft.cities),
  };
}

// Returns null only when storage itself is blocked; a broken draft counts as empty.
function readDraft() {
  let stored;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  try {
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function showStorageProblem() {
  storageAvailable = false;
  if (storageMessage) {
    storageMessage.textContent = 'Сохранение в браузере недоступно (например, в приватном режиме или при запрете cookies). Введённые данные остаются на странице, но после перезагрузки пропадут.';
    storageMessage.hidden = false;
  }
  setStatus('Не сохранено');
}

function saveDraft() {
  const draft = { version: DRAFT_VERSION, ...state };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    if (!storageAvailable && storageMessage) storageMessage.hidden = true;
    storageAvailable = true;
    return true;
  } catch {
    showStorageProblem();
    return false;
  }
}

function setStatus(text, resetAfter = 0) {
  if (!saveStatus) return;
  window.clearTimeout(statusTimer);
  saveStatus.textContent = text;
  if (resetAfter) {
    statusTimer = window.setTimeout(() => { saveStatus.textContent = 'Черновик'; }, resetAfter);
  }
}

/* ---------- Apply settings to the page ---------- */

function renderText() {
  Object.keys(FALLBACK_TEXT).forEach((key) => {
    const text = state[key].trim() || FALLBACK_TEXT[key];
    document.querySelectorAll(`[data-preview="${key}"]`).forEach((node) => {
      node.textContent = text;
    });
  });
}

function applyPalette(name) {
  state.palette = name;
  root.dataset.palette = name;
  poster?.setAttribute('data-palette', name);
  paletteButtons.forEach((button) => {
    const selected = button.dataset.palette === name;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}

function applyFontPair(name) {
  state.fontPair = name;
  root.dataset.fontPair = name;
  fontRadios.forEach((radio) => { radio.checked = radio.value === name; });
}

function applyTextSize(value) {
  state.textSize = clampSize(value);
  root.style.setProperty('--type-scale', String(state.textSize / 100));
  if (sizeInput) sizeInput.value = String(state.textSize);
  if (sizeOutput) sizeOutput.textContent = `${state.textSize}%`;
}

/* ---------- Cities ---------- */

const CITY_LIMIT = { count: 12, length: 30 };

function normaliseCity(value) {
  return String(value).replace(/\s+/g, ' ').trim().slice(0, CITY_LIMIT.length);
}

function normaliseCities(list) {
  if (!Array.isArray(list)) return [];
  const result = [];
  list.forEach((item) => {
    const city = normaliseCity(item ?? '');
    const duplicate = result.some((saved) => saved.toLowerCase() === city.toLowerCase());
    if (city && !duplicate && result.length < CITY_LIMIT.count) result.push(city);
  });
  return result;
}

function showCityMessage(text) {
  showWarning(cityMessage, text);
}

// Editor list: one item per city with its own remove button.
function renderCityEditor() {
  cityList.replaceChildren(...state.cities.map((city, index) => {
    const item = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = city;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'city-remove';
    remove.dataset.index = String(index);
    remove.setAttribute('aria-label', `Удалить город ${city}`);
    remove.textContent = '×';
    item.append(name, remove);
    return item;
  }));
  cityEmpty.hidden = state.cities.length > 0;
  addCityButton.disabled = state.cities.length >= CITY_LIMIT.count;
}

// Poster list: hidden completely when empty, so no empty row or separator remains.
function renderPosterCities() {
  posterCities.replaceChildren(...state.cities.map((city) => {
    const item = document.createElement('li');
    item.textContent = city;
    return item;
  }));
  posterRoute.hidden = state.cities.length === 0;
}

function addCity() {
  const city = normaliseCity(cityInput.value);
  if (!city) {
    showCityMessage('Введите название города.');
  } else if (state.cities.some((saved) => saved.toLowerCase() === city.toLowerCase())) {
    const saved = state.cities.find((item) => item.toLowerCase() === city.toLowerCase());
    showCityMessage(`Город «${saved}» уже есть в списке.`);
  } else if (state.cities.length >= CITY_LIMIT.count) {
    showCityMessage(`Можно добавить не больше ${CITY_LIMIT.count} городов.`);
  } else {
    state.cities.push(city);
    cityInput.value = '';
    showCityMessage(`Добавлено: ${city}. Городов в списке: ${state.cities.length}.`);
    onChange();
  }
  cityInput.focus();
}

function removeCity(index) {
  const [city] = state.cities.splice(index, 1);
  onChange();
  showCityMessage(`Удалено: ${city}.`);
  // Keep keyboard focus in the list: next remove button, otherwise the input.
  const buttons = cityList.querySelectorAll('.city-remove');
  (buttons[Math.min(index, buttons.length - 1)] || cityInput).focus();
}

function renderAll() {
  applyPalette(state.palette);
  applyFontPair(state.fontPair);
  applyTextSize(state.textSize);
  renderText();
  renderCityEditor();
  renderPosterCities();
  root.dataset.layout = state.layout;
  layoutRadios.forEach((radio) => { radio.checked = radio.value === state.layout; });
  renderBrandbook();
  scheduleFitCheck();
}

function renderBrandbook() {
  for (const key of ['audience', 'goal', 'character']) {
    const target = document.querySelector(`[data-brief="${key}"]`);
    if (target) target.textContent = state[key].trim() || 'Не указано';
  }
  const values = {
    'brandbook-cities': state.cities.join(' · ') || 'Не указаны',
    'brandbook-palette': document.querySelector(`.palette-option[data-palette="${state.palette}"]`)?.textContent.trim() || state.palette,
    'brandbook-font': `${FONT_PAIRS[state.fontPair].display.family} + ${FONT_PAIRS[state.fontPair].text.family}`,
    'brandbook-size': `${state.textSize}%`,
    'brandbook-layout': state.layout === 'left' ? 'По левому краю' : 'По центру',
  };
  Object.entries(values).forEach(([id, value]) => {
    const target = document.getElementById(id);
    if (target) target.textContent = value;
  });
  const styles = getComputedStyle(root);
  for (const [id, variable] of [['color-bg', '--poster'], ['color-text', '--poster-ink'], ['color-accent', '--poster-accent']]) {
    const target = document.getElementById(id);
    if (target) target.textContent = styles.getPropertyValue(variable).trim().toUpperCase();
  }
}

/* ---------- Text fit on the layouts ---------- */

const FIT_LABELS = { poster: 'афише', social: 'карточке', tee: 'футболке', hoodie: 'худи' };
const MAX_CITY_LINES = 3;
let fitFrame = 0;

const clipped = (node) => node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1;

// Marks the first city of every wrapped row so CSS hides its leading separator,
// and returns the number of rows the list takes on the poster.
function cityLines() {
  const items = [...posterCities.children];
  // Two passes: hiding a separator can move the next item back to the previous row.
  for (let pass = 0; pass < 2; pass += 1) {
    items.forEach((item) => item.classList.remove('is-row-start'));
    items.forEach((item, index) => {
      const startsRow = index > 0 && item.offsetTop > items[index - 1].offsetTop + 1;
      item.classList.toggle('is-row-start', startsRow);
    });
  }
  return new Set(items.map((item) => Math.round(item.offsetTop))).size;
}

// The poster has a fixed 4:5 format: the centre block (artist + tour) must not be
// clipped, and the city list must stay within MAX_CITY_LINES rows.
function checkPoster() {
  const citiesTooLong = cityLines() > MAX_CITY_LINES || clipped(posterRoute);
  const textTooLong = !citiesTooLong && (clipped(posterCenter) || clipped(poster));
  return { citiesTooLong, textTooLong };
}

function showWarning(node, text) {
  if (!node) return;
  node.textContent = text;
  node.hidden = !text;
}

function checkFit() {
  const overflowing = [];
  const posterFit = checkPoster();
  poster.classList.toggle('is-overflowing', posterFit.citiesTooLong || posterFit.textTooLong);
  if (posterFit.textTooLong) overflowing.push(FIT_LABELS.poster);

  document.querySelectorAll('[data-fit="tee"], [data-fit="hoodie"], [data-fit="social"]').forEach((box) => {
    const tooBig = clipped(box);
    box.classList.toggle('is-overflowing', tooBig);
    if (tooBig) overflowing.push(FIT_LABELS[box.dataset.fit]);
  });

  showWarning(cityWarning, posterFit.citiesTooLong
    ? `Города не помещаются на афишу (больше ${MAX_CITY_LINES} строк). Удалите часть городов, сократите названия (например, «СПб») или уменьшите кегль.`
    : '');

  if (!overflowing.length) {
    showWarning(sizeWarning, '');
    return;
  }
  const where = overflowing.join(', ');
  showWarning(sizeWarning, state.textSize > TEXT_SIZE.min
    ? `Текст не помещается на ${where}. Уменьшите кегль или сократите имя и название.`
    : `Текст не помещается на ${where} даже при минимальном кегле. Сократите имя артиста или название тура.`);
}

// setTimeout instead of requestAnimationFrame: rAF is paused in background tabs,
// so the warning would never appear there.
function scheduleFitCheck() {
  window.clearTimeout(fitFrame);
  fitFrame = window.setTimeout(checkFit, 30);
}

/* ---------- Font availability: never swap a font silently ---------- */

async function isFontAvailable(family) {
  if (!document.fonts?.load) return true; // cannot check, assume the browser handles it
  try {
    const faces = await document.fonts.load(`16px "${family}"`, 'Аа Яя Aa');
    return faces.length > 0;
  } catch {
    return false;
  }
}

async function checkFontPairs() {
  await Promise.all(Object.entries(FONT_PAIRS).map(async ([id, pair]) => {
    const notes = [];
    for (const role of ['display', 'text']) {
      const font = pair[role];
      const available = await isFontAvailable(font.family);
      if (!available) notes.push(`${font.family} не подключён (нет файла шрифта) — на макете показан запасной ${font.fallback}.`);
    }
    const note = document.querySelector(`[data-font-note="${id}"]`);
    if (note) {
      note.textContent = notes.join(' ');
      note.hidden = notes.length === 0;
    }
  }));
  scheduleFitCheck(); // real fonts change text width
}

/* ---------- Events ---------- */

function onChange() {
  renderAll();
  if (saveDraft()) setStatus('Черновик');
}

artistInput?.addEventListener('input', () => {
  state.artist = artistInput.value;
  onChange();
});

tourInput?.addEventListener('input', () => {
  state.tour = tourInput.value;
  onChange();
});

Object.entries(briefInputs).forEach(([key, input]) => {
  input?.addEventListener('input', () => { state[key] = input.value; onChange(); });
});

layoutRadios.forEach((radio) => radio.addEventListener('change', () => {
  if (radio.checked) { state.layout = radio.value; onChange(); }
}));

document.querySelector('#print-brandbook')?.addEventListener('click', () => window.print());

paletteButtons.forEach((button) => {
  button.addEventListener('click', () => {
    state.palette = button.dataset.palette;
    onChange();
  });
});

fontRadios.forEach((radio) => {
  radio.addEventListener('change', () => {
    if (radio.checked) {
      state.fontPair = radio.value;
      onChange();
    }
  });
});

sizeInput?.addEventListener('input', () => {
  state.textSize = clampSize(sizeInput.value);
  onChange();
});

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!saveDraft()) return;
  setStatus('Сохранено локально', 1800);
});

addCityButton?.addEventListener('click', addCity);

// Enter in the city field adds the city instead of submitting the whole form.
cityInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    addCity();
  }
});

cityList?.addEventListener('click', (event) => {
  const button = event.target.closest('.city-remove');
  if (button) removeCity(Number(button.dataset.index));
});

window.addEventListener('resize', scheduleFitCheck);

/* ---------- Start ---------- */

function init() {
  const stored = readDraft();
  Object.assign(state, normaliseDraft(stored));
  if (artistInput) artistInput.value = state.artist;
  if (tourInput) tourInput.value = state.tour;
  Object.entries(briefInputs).forEach(([key, input]) => { if (input) input.value = state[key]; });
  renderAll();
  if (stored === null) showStorageProblem();
  checkFontPairs();
  document.fonts?.ready.then(scheduleFitCheck);
}

init();
