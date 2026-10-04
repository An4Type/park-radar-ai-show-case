const elements = {
  vision: document.querySelector('#visionFrame'),
  raw: document.querySelector('#rawFrame'),
  placeholder: document.querySelector('#framePlaceholder'),
  placeholderText: document.querySelector('#placeholderText'),
  stage: document.querySelector('#stage'),
  modeLabel: document.querySelector('#modeLabel'),
  toggle: document.querySelector('#sourceToggle'),
  toggleTitle: document.querySelector('#toggleTitle'),
  refresh: document.querySelector('#refreshButton'),
  frameState: document.querySelector('#frameState'),
  topStatus: document.querySelector('#topStatus'),
  liveDot: document.querySelector('#liveDot'),
  capturedAt: document.querySelector('#capturedAt'),
  areaChips: document.querySelector('#areaChips'),
  areasCount: document.querySelector('#areasCount'),
  intervalLabel: document.querySelector('#intervalLabel'),
  captureInterval: document.querySelector('#captureInterval'),
};

let latestVersion = 0;
let showingVision = true;
let lastState = null;
let refreshRequested = false;

function formatTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value));
}

function statusText(state) {
  if (state.status === 'ready') return 'Camera online';
  if (state.status === 'refreshing') return 'Refreshing';
  if (state.status === 'error') return 'Camera unavailable';
  return 'Connecting';
}

function intervalText(intervalMs) {
  if (intervalMs === 60000) return '1 min';
  return `${Math.round((intervalMs ?? 60000) / 1000)}s`;
}

function renderAreas(areas = []) {
  elements.areasCount.textContent = `${areas.length} ${areas.length === 1 ? 'zone' : 'zones'}`;
  elements.areaChips.replaceChildren(...areas.map((area) => {
    const chip = document.createElement('span');
    chip.className = 'area-chip';
    chip.append(document.createTextNode(area.id));
    if (area.capacity) {
      const capacity = document.createElement('small');
      capacity.textContent = `max ${area.capacity}`;
      chip.append(capacity);
    }
    return chip;
  }));
}

function updateSelectedFrame() {
  if (!latestVersion) return;
  const kind = showingVision ? 'vision' : 'raw';
  elements.vision.classList.add('frame-enter');
  elements.vision.src = `/api/frame/${kind}?v=${latestVersion}`;
  elements.vision.alt = showingVision
    ? 'Camera frame with highlighted parking areas'
    : 'Original camera frame before masking';
  elements.modeLabel.textContent = showingVision ? 'VISION MASK' : 'ORIGINAL FRAME';
  elements.toggleTitle.textContent = showingVision ? 'Show original' : 'Show vision mask';
  elements.toggle.setAttribute('aria-pressed', String(!showingVision));
  window.setTimeout(() => elements.vision.classList.remove('frame-enter'), 20);
}

function updateFrame(version) {
  latestVersion = version;
  elements.raw.src = `/api/frame/raw?v=${version}`;
  elements.raw.hidden = false;
  updateSelectedFrame();
}

function renderState(state) {
  lastState = state;
  const text = statusText(state);
  elements.topStatus.textContent = text;
  elements.frameState.textContent = state.status === 'ready' ? 'Frame ready' : state.status === 'error' ? 'Camera error' : 'Loading';
  elements.frameState.classList.toggle('is-error', state.status === 'error');
  elements.liveDot.classList.toggle('is-error', state.status === 'error');
  elements.liveDot.classList.toggle('is-waiting', !['ready', 'error'].includes(state.status));
  elements.capturedAt.textContent = formatTime(state.capturedAt);
  elements.placeholderText.textContent = state.message || 'Loading first frame…';
  const interval = intervalText(state.intervalMs);
  elements.intervalLabel.textContent = `${interval} refresh`;
  elements.captureInterval.textContent = interval === '1 min' ? 'Every minute' : `Every ${interval}`;
  renderAreas(state.areas);
  if (state.version && state.version !== latestVersion) updateFrame(state.version);
  const ready = Boolean(state.version);
  elements.vision.hidden = !ready;
  elements.placeholder.hidden = ready;
  elements.refresh.disabled = refreshRequested || state.status === 'refreshing';
}

async function poll() {
  try {
    const response = await fetch('/api/status', { cache: 'no-store' });
    if (!response.ok) throw new Error('Server unavailable');
    renderState(await response.json());
  } catch (error) {
    renderState({
      status: 'error', version: latestVersion, message: `Could not load status: ${error.message}`, areas: lastState?.areas ?? [], capturedAt: lastState?.capturedAt,
    });
  }
}

elements.toggle.addEventListener('click', () => {
  showingVision = !showingVision;
  updateSelectedFrame();
});

elements.refresh.addEventListener('click', async () => {
  refreshRequested = true;
  elements.refresh.disabled = true;
  try {
    await fetch('/api/refresh', { method: 'POST', cache: 'no-store' });
  } finally {
    window.setTimeout(() => { refreshRequested = false; }, 650);
    window.setTimeout(poll, 250);
  }
});

void poll();
window.setInterval(poll, 1000);
