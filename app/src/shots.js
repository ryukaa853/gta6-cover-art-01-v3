// Fixed scenes for the entry's screenshots: ?shot=cover renders one exported
// cover alone (the canvas fills the viewport), ?shot=editor shows the editor
// with photos loaded. window.__shotReady is set once the scene has painted.

function defaultPanels(photoA, photoB) {
  return [
    { photo: photoA, zoom: 1.05, dx: 0, dy: 0 },
    { photo: photoB, zoom: 1.1, dx: 0, dy: -0.03 },
    { photo: photoA, zoom: 1.25, dx: 0.05, dy: 0 },
    { photo: photoB, zoom: 1.15, dx: -0.04, dy: 0.02 },
  ];
}

export async function runShot(shot, query, api) {
  const photo = query.get('photo') ?? 'boulevard';
  const other = photo === 'boulevard' ? 'pier' : 'boulevard';
  const layout = query.get('layout') ?? 'hero';
  const grade = query.get('grade') ?? 'sunset';
  const title = query.get('caption') ?? 'Neon Shore';
  const subtitle = query.get('subtitle') ?? 'a Vice Coast story';
  const titleStyle = query.get('style') ?? 'solid';
  const w = Number(query.get('w') ?? 1080);
  const h = Number(query.get('h') ?? 1080);

  await api.loadPhoto(0, `samples/${photo}.jpg`, `${photo} (sample)`);
  await api.loadPhoto(1, `samples/${other}.jpg`, `${other} (sample)`);
  api.setState({
    layout,
    grade,
    title,
    subtitle,
    titleStyle,
    panels: defaultPanels(0, 1),
    exportSize: { name: 'shot', w, h },
    selectedPanel: 0,
  });

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    api.canvas.width = w;
    api.canvas.height = h;
  }
  api.redraw();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
}
