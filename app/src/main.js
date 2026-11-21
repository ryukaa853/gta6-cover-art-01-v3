// Vice Coast Cover Studio — wires the editor page: photo slots, layout and
// grade pickers, caption fields, per-panel crop controls, and PNG export.
// Photos are read on the user's own machine and never uploaded.
import { drawCover, exportCover, panelRects, LAYOUTS, GRADES, TITLE_STYLES } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('preview');
const statusEl = document.getElementById('status');
const sizeLabel = document.getElementById('sizeLabel');

const EXPORT_SIZES = [
  { name: 'Square', w: 1080, h: 1080 },
  { name: 'Portrait', w: 1080, h: 1350 },
  { name: 'Wide', w: 1920, h: 1080 },
];

const state = {
  photos: [null, null, null],
  photoNames: ['', '', ''],
  panels: [
    { photo: 0, zoom: 1, dx: 0, dy: 0 },
    { photo: 1, zoom: 1, dx: 0, dy: 0 },
    { photo: 0, zoom: 1, dx: 0, dy: 0 },
    { photo: 1, zoom: 1, dx: 0, dy: 0 },
  ],
  layout: 'hero',
  grade: 'sunset',
  title: 'Neon Shore',
  subtitle: 'a Vice Coast story',
  titleStyle: 'solid',
  exportSize: EXPORT_SIZES[0],
  selectedPanel: 0,
};

function setStatus(text) {
  statusEl.textContent = text;
}

function redraw() {
  const { w, h } = state.exportSize;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  drawCover(canvas, state);
  sizeLabel.textContent = `${w} x ${h}`;
  syncPanelControls();
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${url}`));
    img.src = url;
  });
}

async function loadPhotoIntoSlot(slot, fileOrUrl, name) {
  const url = typeof fileOrUrl === 'string' ? fileOrUrl : URL.createObjectURL(fileOrUrl);
  const img = await loadImage(url);
  state.photos[slot] = img;
  state.photoNames[slot] = name || `Photo ${slot + 1}`;
  document.getElementById(`slotName${slot}`).textContent = state.photoNames[slot];
  redraw();
  setStatus(`${state.photoNames[slot]} loaded into slot ${slot + 1}.`);
}

function buildPicker(containerId, entries, current, onPick) {
  const box = document.getElementById(containerId);
  box.innerHTML = '';
  Object.entries(entries).forEach(([key, value]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pick' + (key === current ? ' active' : '');
    btn.textContent = value.name;
    btn.addEventListener('click', () => {
      onPick(key);
      box.querySelectorAll('.pick').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
    box.appendChild(btn);
  });
}

buildPicker('layoutPicker', LAYOUTS, state.layout, (key) => {
  state.layout = key;
  const count = LAYOUTS[key].panels;
  if (state.selectedPanel >= count) state.selectedPanel = 0;
  redraw();
});
buildPicker('gradePicker', GRADES, state.grade, (key) => {
  state.grade = key;
  redraw();
});
buildPicker('stylePicker', TITLE_STYLES, state.titleStyle, (key) => {
  state.titleStyle = key;
  redraw();
});

const sizeBox = document.getElementById('sizePicker');
EXPORT_SIZES.forEach((size, i) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pick' + (i === 0 ? ' active' : '');
  btn.textContent = `${size.name} ${size.w}x${size.h}`;
  btn.addEventListener('click', () => {
    state.exportSize = size;
    sizeBox.querySelectorAll('.pick').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    redraw();
  });
  sizeBox.appendChild(btn);
});

// Photo slots: file inputs plus the two kit sample photos.
for (let slot = 0; slot < 3; slot++) {
  document.getElementById(`photo${slot}`).addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await loadPhotoIntoSlot(slot, file, file.name);
    } catch {
      setStatus('That file could not be read as an image.');
    }
  });
}
document.getElementById('sampleBoulevard').addEventListener('click', () => {
  loadPhotoIntoSlot(0, 'samples/boulevard.jpg', 'Boulevard (sample)').catch(() => setStatus('Sample photo failed to load.'));
});
document.getElementById('samplePier').addEventListener('click', () => {
  loadPhotoIntoSlot(1, 'samples/pier.jpg', 'Pier (sample)').catch(() => setStatus('Sample photo failed to load.'));
});
document.getElementById('fillAll').addEventListener('click', () => {
  const panel = state.panels[state.selectedPanel];
  state.panels.forEach((p) => { p.photo = panel.photo; });
  redraw();
  setStatus(`All panels now use slot ${panel.photo + 1}.`);
});

// Caption fields.
document.getElementById('title').addEventListener('input', (e) => {
  state.title = e.target.value;
  redraw();
});
document.getElementById('subtitle').addEventListener('input', (e) => {
  state.subtitle = e.target.value;
  redraw();
});

// Per-panel crop controls for the selected panel.
const zoomInput = document.getElementById('zoom');
const panXInput = document.getElementById('panX');
const panYInput = document.getElementById('panY');
const panelPhotoSelect = document.getElementById('panelPhoto');
for (let slot = 0; slot < 3; slot++) {
  const opt = document.createElement('option');
  opt.value = String(slot);
  opt.textContent = `Slot ${slot + 1}`;
  panelPhotoSelect.appendChild(opt);
}
function syncPanelControls() {
  const panel = state.panels[state.selectedPanel];
  zoomInput.value = String(panel.zoom);
  panXInput.value = String(panel.dx);
  panYInput.value = String(panel.dy);
  panelPhotoSelect.value = String(panel.photo);
  document.getElementById('panelLabel').textContent = `Panel ${state.selectedPanel + 1} of ${LAYOUTS[state.layout].panels}`;
}
panelPhotoSelect.addEventListener('change', (e) => {
  state.panels[state.selectedPanel].photo = Number(e.target.value);
  redraw();
});
zoomInput.addEventListener('input', (e) => {
  state.panels[state.selectedPanel].zoom = Number(e.target.value);
  redraw();
});
panXInput.addEventListener('input', (e) => {
  state.panels[state.selectedPanel].dx = Number(e.target.value);
  redraw();
});
panYInput.addEventListener('input', (e) => {
  state.panels[state.selectedPanel].dy = Number(e.target.value);
  redraw();
});

// Click a panel to select it; drag to move its photo, wheel to zoom it.
function panelAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * canvas.width;
  const y = ((clientY - rect.top) / rect.height) * canvas.height;
  const rects = panelRects(state.layout, canvas.width, canvas.height);
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}
let dragging = false;
let lastX = 0;
let lastY = 0;
canvas.addEventListener('pointerdown', (e) => {
  const i = panelAt(e.clientX, e.clientY);
  if (i < 0) return;
  state.selectedPanel = i;
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
  syncPanelControls();
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const rect = canvas.getBoundingClientRect();
  const panel = state.panels[state.selectedPanel];
  panel.dx += ((e.clientX - lastX) / rect.width) * (canvas.width / panelRects(state.layout, canvas.width, canvas.height)[state.selectedPanel].w);
  panel.dy += ((e.clientY - lastY) / rect.height) * (canvas.height / panelRects(state.layout, canvas.width, canvas.height)[state.selectedPanel].h);
  panel.dx = Math.max(-0.6, Math.min(0.6, panel.dx));
  panel.dy = Math.max(-0.6, Math.min(0.6, panel.dy));
  lastX = e.clientX;
  lastY = e.clientY;
  redraw();
});
canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const panel = state.panels[state.selectedPanel];
  panel.zoom = Math.max(1, Math.min(3, panel.zoom * (e.deltaY < 0 ? 1.08 : 0.92)));
  redraw();
}, { passive: false });

// Export the current cover at the chosen size as a PNG download.
document.getElementById('export').addEventListener('click', () => {
  const { w, h } = state.exportSize;
  const out = exportCover(state, w, h);
  out.toBlob((blob) => {
    if (!blob) {
      setStatus('Export failed — please try again.');
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-coast-cover-${w}x${h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    setStatus(`Saved vice-coast-cover-${w}x${h}.png`);
  }, 'image/png');
});

// Screenshot scenes (?shot=cover or ?shot=editor) for the entry's own shots.
const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), {
    loadPhoto: loadPhotoIntoSlot,
    setState(patch) {
      Object.assign(state, patch);
      if (patch.panels) state.panels = patch.panels;
    },
    state,
    redraw,
    canvas,
  });
} else {
  // Load the samples so the first paint already shows a cover.
  Promise.all([
    loadPhotoIntoSlot(0, 'samples/boulevard.jpg', 'Boulevard (sample)'),
    loadPhotoIntoSlot(1, 'samples/pier.jpg', 'Pier (sample)'),
  ]).catch(() => setStatus('Sample photos failed to load — pick your own photos.'));
  redraw();
}

// Re-draw once the display fonts arrive so the caption uses them.
if (document.fonts) {
  document.fonts.load('400 100px Anton').then(redraw).catch(() => {});
  document.fonts.load('400 60px Pacifico').then(redraw).catch(() => {});
  document.fonts.ready.then(redraw).catch(() => {});
}
