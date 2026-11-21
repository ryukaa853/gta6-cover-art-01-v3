// Vice Coast Cover Studio — the cover engine.
// Draws a GTA-style multi-panel poster onto any 2D canvas: panels filled with
// the user's own photos (crop and position per panel), a Vice City sunset or
// neon colour grade, and bold original lettering. Everything is drawn from the
// state object; the same function renders the live preview and the exported PNG.

export const LAYOUTS = {
  hero: { name: 'Hero + Three', panels: 4 },
  grid: { name: 'Four Panel', panels: 4 },
  bleed: { name: 'Full Bleed', panels: 1 },
  trio: { name: 'Three Strips', panels: 3 },
};

export const GRADES = {
  sunset: { name: 'Neon Sunset', top: 'rgba(255,170,60,0)', bottom: 'rgba(255,60,120,0.55)', wash: 'rgba(255,120,60,0.30)', accent: '#ffd166', filter: 'saturate(1.18) contrast(1.06)' },
  neon: { name: 'Neon Nights', top: 'rgba(0,229,192,0.14)', bottom: 'rgba(255,46,136,0.60)', wash: 'rgba(0,229,192,0.22)', accent: '#00e5c0', filter: 'saturate(1.25) contrast(1.08)' },
  teal: { name: 'Vice Teal', top: 'rgba(0,200,200,0.10)', bottom: 'rgba(0,60,90,0.55)', wash: 'rgba(0,180,180,0.22)', accent: '#7ef0d4', filter: 'saturate(1.12) contrast(1.05)' },
  gold: { name: 'Golden Hour', top: 'rgba(255,220,120,0.10)', bottom: 'rgba(200,110,20,0.50)', wash: 'rgba(255,200,90,0.25)', accent: '#ffe9a8', filter: 'saturate(1.15) contrast(1.05)' },
  noir: { name: 'Noir', top: 'rgba(255,255,255,0)', bottom: 'rgba(0,0,0,0.35)', wash: 'rgba(255,255,255,0.08)', accent: '#ffffff', filter: 'grayscale(1) contrast(1.22) brightness(1.06)' },
};

export const TITLE_STYLES = {
  solid: { name: 'Solid', outline: false, glow: false },
  outline: { name: 'Outline', outline: true, glow: false },
  neon: { name: 'Neon Glow', outline: false, glow: true },
};

/** Returns the panel rectangles for a layout, in canvas pixels. */
export function panelRects(layout, w, h) {
  const g = Math.max(4, Math.round(w * 0.012));
  if (layout === 'bleed') return [{ x: 0, y: 0, w, h }];
  if (layout === 'grid') {
    const pw = (w - g) / 2;
    const ph = (h - g) / 2;
    return [
      { x: 0, y: 0, w: pw, h: ph },
      { x: pw + g, y: 0, w: pw, h: ph },
      { x: 0, y: ph + g, w: pw, h: ph },
      { x: pw + g, y: ph + g, w: pw, h: ph },
    ];
  }
  if (layout === 'trio') {
    const pw = (w - 2 * g) / 3;
    return [
      { x: 0, y: 0, w: pw, h },
      { x: pw + g, y: 0, w: pw, h },
      { x: 2 * (pw + g), y: 0, w: pw, h },
    ];
  }
  // hero: one big panel on the left, three stacked on the right.
  const heroW = Math.round(w * 0.60);
  const sideW = w - heroW - g;
  const sideH = (h - 2 * g) / 3;
  return [
    { x: 0, y: 0, w: heroW, h },
    { x: heroW + g, y: 0, w: sideW, h: sideH },
    { x: heroW + g, y: sideH + g, w: sideW, h: sideH },
    { x: heroW + g, y: 2 * (sideH + g), w: sideW, h: sideH },
  ];
}

/** Cover-fits `img` into `rect`, honouring a panel's zoom and pan. */
function drawPhoto(ctx, img, rect, panel, filter) {
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const scale = base * (panel.zoom || 1);
  const pw = img.naturalWidth * scale;
  const ph = img.naturalHeight * scale;
  const cx = rect.x + rect.w / 2 + (panel.dx || 0) * rect.w;
  const cy = rect.y + rect.h / 2 + (panel.dy || 0) * rect.h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.filter = filter || 'none';
  ctx.drawImage(img, cx - pw / 2, cy - ph / 2, pw, ph);
  ctx.filter = 'none';
  ctx.restore();
}

/** Applies a grade's colour wash over one panel rectangle. */
function applyGrade(ctx, rect, grade) {
  const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  grad.addColorStop(0, grade.top);
  grad.addColorStop(1, grade.bottom);
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = grad;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = grade.wash;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

/** A deterministic speckled grain tile, seeded so every export matches. */
let grainTile = null;
function getGrainTile() {
  if (grainTile) return grainTile;
  const tile = document.createElement('canvas');
  tile.width = 160;
  tile.height = 160;
  const tctx = tile.getContext('2d');
  const data = tctx.createImageData(160, 160);
  let seed = 20261119;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.floor(next() * 255);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  tctx.putImageData(data, 0, 0);
  grainTile = tile;
  return tile;
}

/** Fits `text` to `maxWidth` by shrinking the font, returns the chosen size. */
function fitFont(ctx, text, startSize, maxWidth, family, weight) {
  let size = startSize;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > 10 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

/** Draws the caption band: script subtitle over the big block title. */
function drawCaption(ctx, state, w, h) {
  const grade = GRADES[state.grade] || GRADES.sunset;
  const style = TITLE_STYLES[state.titleStyle] || TITLE_STYLES.solid;
  const bandH = Math.round(h * 0.27);
  const bandY = h - bandH;
  const scrim = ctx.createLinearGradient(0, bandY - bandH * 0.35, 0, h);
  scrim.addColorStop(0, 'rgba(12,7,20,0)');
  scrim.addColorStop(1, 'rgba(12,7,20,0.88)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, bandY - bandH * 0.35, w, h - (bandY - bandH * 0.35));

  const title = (state.title || '').trim().toUpperCase();
  const subtitle = (state.subtitle || '').trim();
  const cx = w / 2;
  let titleBaseline = h - Math.round(h * 0.055);

  if (subtitle) {
    const subSize = fitFont(ctx, subtitle, Math.round(h * 0.045), w * 0.8, 'Pacifico, cursive', 400);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = grade.accent;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = subSize * 0.25;
    const subY = titleBaseline - Math.round(h * 0.115);
    ctx.fillText(subtitle, cx, subY);
    ctx.shadowBlur = 0;
  }
  if (!title) return;
  // The outline style's stroke spills past the fill, so it gets a narrower box.
  const titleMax = style.outline ? w * 0.86 : w * 0.92;
  const size = fitFont(ctx, title, Math.round(h * 0.115), titleMax, 'Anton, "Arial Black", sans-serif', 400);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const grad = ctx.createLinearGradient(0, titleBaseline - size, 0, titleBaseline);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#ffe9a8');
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = size * 0.16;
  if (style.glow) {
    ctx.shadowColor = grade.accent;
    ctx.shadowBlur = size * 0.35;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title, cx, titleBaseline);
    ctx.fillText(title, cx, titleBaseline);
  } else if (style.outline) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, size * 0.06);
    ctx.strokeText(title, cx, titleBaseline);
    ctx.fillStyle = 'rgba(20,10,30,0.55)';
    ctx.fillText(title, cx, titleBaseline);
  } else {
    ctx.fillStyle = grad;
    ctx.fillText(title, cx, titleBaseline);
  }
  ctx.shadowBlur = 0;
  // A short accent rule under the title.
  const ruleW = Math.round(w * 0.16);
  const ruleGrad = ctx.createLinearGradient(cx - ruleW / 2, 0, cx + ruleW / 2, 0);
  ruleGrad.addColorStop(0, 'rgba(255,255,255,0)');
  ruleGrad.addColorStop(0.5, grade.accent);
  ruleGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = ruleGrad;
  ctx.fillRect(cx - ruleW / 2, titleBaseline + Math.round(h * 0.018), ruleW, Math.max(3, Math.round(h * 0.006)));
}

/** Draws the poster's white frame and the small corner badge. */
function drawFrame(ctx, w, h) {
  const inset = Math.max(3, Math.round(w * 0.008));
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = Math.max(2, Math.round(w * 0.004));
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
  const badgeSize = Math.max(11, Math.round(h * 0.022));
  ctx.font = `400 ${badgeSize}px Anton, "Arial Black", sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const label = 'VICE COAST';
  const pad = Math.round(badgeSize * 0.55);
  const tw = ctx.measureText(label).width;
  const bx = inset + Math.round(w * 0.02);
  const by = inset + Math.round(h * 0.018);
  ctx.fillStyle = 'rgba(12,7,20,0.72)';
  ctx.fillRect(bx - pad, by - pad * 0.7, tw + pad * 2, badgeSize + pad * 1.4);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, bx, by);
}

/**
 * Draws the whole cover onto `canvas` (its own width/height) from `state`:
 * photos: HTMLImageElement|null per slot; panels: {photo, zoom, dx, dy} per
 * panel index; layout, grade, title, subtitle, titleStyle.
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const grade = GRADES[state.grade] || GRADES.sunset;
  ctx.fillStyle = '#160a24';
  ctx.fillRect(0, 0, w, h);
  const rects = panelRects(state.layout, w, h);
  rects.forEach((rect, i) => {
    const panel = state.panels[i] || { photo: 0, zoom: 1, dx: 0, dy: 0 };
    const img = state.photos[panel.photo];
    if (img) {
      drawPhoto(ctx, img, rect, panel, grade.filter);
    } else {
      const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
      g.addColorStop(0, '#3a1c4d');
      g.addColorStop(1, '#160a24');
      ctx.fillStyle = g;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    applyGrade(ctx, rect, grade);
  });
  drawCaption(ctx, state, w, h);
  // Grain, then vignette, then the frame.
  const tile = getGrainTile();
  const pattern = ctx.createPattern(tile, 'repeat');
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.34)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  drawFrame(ctx, w, h);
}

/** Renders the cover at export size on a fresh offscreen canvas. */
export function exportCover(state, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  drawCover(canvas, state);
  return canvas;
}
