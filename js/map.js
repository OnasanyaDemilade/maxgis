/* ═══════════════════════════════════════
   MaxGIS → Core Map & UI Controller
   (Spectraforte — Maps. Data. Insight.)
   ═══════════════════════════════════════ */

// ── Global State ──
const APP = {
  layers: [],
  basemap: 'CartoDB Voyager',
  panelOpen: true,
  measuring: false,
  mPts: [], mLine: null, mMarkers: [],
  totalFt: 0,
  uid: 0,
  attrOpen: false,
  dashOpen: false,
  theme: localStorage.getItem('maxgis-theme') || 'dark'
};

// Shorthand
const $ = (id) => document.getElementById(id);

// ── Apply saved theme ──
document.body.setAttribute('data-theme', APP.theme);

// ── Basemap Definitions ──
const BASEMAPS = {
  'CartoDB Voyager': { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attr: 'CartoDB', grad: 'linear-gradient(135deg,#f5efe0,#e8e2d6,#d5cfc2)' },
  'CartoDB Light':   { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attr: 'CartoDB', grad: 'linear-gradient(135deg,#e8e4de,#f0ece6,#faf6f0)' },
  'CartoDB Dark':    { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attr: 'CartoDB', grad: 'linear-gradient(135deg,#1a1a2e,#16213e)' },
  'OSM':             { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attr: 'OSM', grad: 'linear-gradient(135deg,#c8dbb3,#aed6f1,#fae5d3)' },
  'Satellite':       { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: 'Esri', grad: 'linear-gradient(135deg,#1a3a1a,#2a5a2f,#0a1a0a)' },
  'Topo':            { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', attr: 'Esri', grad: 'linear-gradient(135deg,#f5e6c8,#d4a76a,#8b6b3d)' },
  'Terrain':         { url: 'https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.png', attr: 'Stadia', grad: 'linear-gradient(135deg,#cdb99c,#a8bf8f,#6b7a50)' },
  'Ocean':           { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', attr: 'Esri', grad: 'linear-gradient(135deg,#023e8a,#0077b6,#90e0ef)' },
  'Dark Matter':     { url: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', attr: 'CartoDB', grad: 'linear-gradient(135deg,#0d0d0d,#1a1a1a)' },
};

// ── Initialize Map ──
const map = L.map('map', {
  center: [9.06, 7.49],
  zoom: 6,
  zoomControl: false,
  attributionControl: false
});

L.control.zoom({ position: 'topright' }).addTo(map);
L.control.scale({ position: 'bottomright', imperial: false }).addTo(map);
L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);

let basemapLayer = L.tileLayer(BASEMAPS[APP.basemap].url, {
  attribution: BASEMAPS[APP.basemap].attr,
  maxZoom: 20
}).addTo(map);

const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// ── Render Basemap Grid ──
function renderBasemaps() {
  const grid = $('bmGrid');
  grid.innerHTML = '';
  Object.entries(BASEMAPS).forEach(([name, cfg]) => {
    const card = document.createElement('div');
    card.className = 'bm-card' + (APP.basemap === name ? ' on' : '');
    card.innerHTML = `<div class="bm-thumb" style="background:${cfg.grad}"></div><div class="bm-name">${name}</div>`;
    card.onclick = () => switchBasemap(name);
    grid.appendChild(card);
  });
}

function switchBasemap(name) {
  map.removeLayer(basemapLayer);
  basemapLayer = L.tileLayer(BASEMAPS[name].url, {
    attribution: BASEMAPS[name].attr, maxZoom: 20
  }).addTo(map);
  basemapLayer.setZIndex(0);
  APP.basemap = name;
  renderBasemaps();
  toast(name, 'ok');
}

// ── Map Events ──
map.on('mousemove', (e) => {
  $('coords').textContent = `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
});
map.on('zoomend', () => {
  $('zLvl').textContent = map.getZoom();
});

// ── Panel Toggle ──
$('btnPanel').onclick = () => {
  APP.panelOpen = !APP.panelOpen;
  $('sidebar').classList.toggle('hide', !APP.panelOpen);
  $('infoBox').classList.toggle('shifted', APP.panelOpen);
  $('btnPanel').classList.toggle('on', APP.panelOpen);
};

// ── Theme Toggle ──
$('btnTheme').onclick = () => {
  APP.theme = APP.theme === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', APP.theme);
  localStorage.setItem('maxgis-theme', APP.theme);
  toast(`${APP.theme.charAt(0).toUpperCase() + APP.theme.slice(1)} mode`, 'ok');
};

// ── Fullscreen ──
$('btnFS').onclick = () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else document.exitFullscreen();
};

// ── Search ──
let searchTimeout;
$('btnSearch').onclick = () => {
  $('searchWrap').classList.toggle('show');
  if ($('searchWrap').classList.contains('show')) $('searchIn').focus();
};
$('searchIn').oninput = (e) => {
  clearTimeout(searchTimeout);
  const q = e.target.value.trim();
  if (q.length < 3) { $('srList').style.display = 'none'; return; }
  searchTimeout = setTimeout(() => {
    fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(results => {
        if (!results.length) { $('srList').style.display = 'none'; return; }
        $('srList').style.display = 'block';
        $('srList').innerHTML = results.map(r =>
          `<div class="sr-item" onclick="flyToResult(${r.lat},${r.lon},'${r.display_name.replace(/'/g, "&#39;").substring(0, 50)}')">${r.display_name.substring(0, 80)}</div>`
        ).join('');
      });
  }, 350);
};

function flyToResult(lat, lng, name) {
  map.flyTo([lat, lng], 14);
  L.marker([lat, lng]).addTo(map).bindPopup(name).openPopup();
  $('srList').style.display = 'none';
  $('searchWrap').classList.remove('show');
}

// ── Keyboard Shortcuts ──
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    $('searchWrap').classList.remove('show');
    if (APP.measuring) {
      APP.measuring = false;
      clearMeasure();
      $('btnMeasure').classList.remove('on');
      map.getContainer().style.cursor = '';
    }
  }
  if (e.ctrlKey && e.key === 'f') {
    e.preventDefault();
    $('btnSearch').click();
  }
});

// ── Utility Functions (global) ──
function setStatus(msg) { $('statusMsg').textContent = msg; }

function toast(msg, type = 'ok') {
  const t = $('toast');
  t.className = 'toast ' + type;
  t.textContent = (type === 'ok' ? '✓ ' : '⚠ ') + msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3200);
}

function modal(html) {
  $('modalBox').innerHTML = html;
  $('modalBg').classList.add('show');
}

function closeModal() { $('modalBg').classList.remove('show'); }
$('modalBg').onclick = (e) => { if (e.target === e.currentTarget) closeModal(); };

// ── Initialize ──
renderBasemaps();
