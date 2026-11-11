const form = document.querySelector('#tour-form');
const artistInput = document.querySelector('#artist-name');
const tourInput = document.querySelector('#tour-name');
const artistPreview = document.querySelector('[data-preview="artist"]');
const tourPreview = document.querySelector('[data-preview="tour"]');
const poster = document.querySelector('#poster-preview');
const saveStatus = document.querySelector('#save-status');
const paletteButtons = document.querySelectorAll('.palette-option[data-palette]');

const STORAGE_KEY = 'tourform-draft';

function setPreviewText(input, preview, fallback) {
  if (!input || !preview) return;
  preview.textContent = input.value.trim() || fallback;
}

function saveDraft() {
  const palette = document.documentElement.dataset.palette || 'graphite-lime';
  const draft = {
    artist: artistInput?.value.trim() || '',
    tour: tourInput?.value.trim() || '',
    palette,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    return true;
  } catch {
    if (saveStatus) saveStatus.textContent = 'Не удалось сохранить';
    return false;
  }
}

function applyPalette(name) {
  document.documentElement.dataset.palette = name;
  poster?.setAttribute('data-palette', name);
  paletteButtons.forEach((button) => {
    const selected = button.dataset.palette === name;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}

function restoreDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (draft.artist && artistInput) artistInput.value = draft.artist;
    if (draft.tour && tourInput) tourInput.value = draft.tour;
    applyPalette(draft.palette || 'graphite-lime');
  } catch {
    applyPalette('graphite-lime');
  }
  setPreviewText(artistInput, artistPreview, 'Имя артиста');
  setPreviewText(tourInput, tourPreview, 'Название тура');
}

artistInput?.addEventListener('input', () => {
  setPreviewText(artistInput, artistPreview, 'Имя артиста');
  saveDraft();
});

tourInput?.addEventListener('input', () => {
  setPreviewText(tourInput, tourPreview, 'Название тура');
  saveDraft();
});

paletteButtons.forEach((button) => {
  button.addEventListener('click', () => {
    applyPalette(button.dataset.palette);
    saveDraft();
  });
});

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!saveDraft()) return;
  if (saveStatus) saveStatus.textContent = 'Сохранено локально';
  window.setTimeout(() => {
    if (saveStatus) saveStatus.textContent = 'Черновик';
  }, 1800);
});

restoreDraft();
