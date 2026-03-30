/* ═══════════════════════════════════════
   Spectraforte — Export System
   Data: GeoJSON, KML, GPX, CSV
   Visual: Map screenshot, Dashboard PNGs
   ═══════════════════════════════════════ */

$('btnExport').onclick = () => {
  const vectorLayers = APP.layers.filter(l => l.type === 'geojson');
  const hasDrawn = drawnItems.getLayers().length > 0;
  const hasDashCharts = typeof dashCharts !== 'undefined' && dashCharts.length > 0;

  const layerOpts = vectorLayers.map(l =>
    `<option value="${l.id}">${l.name} (${l.featureCount})</option>`
  ).join('');

  modal(`
    <h2>Export</h2>
    <p>Download your data and visuals</p>

    <div style="border-bottom:1px solid var(--border);padding-bottom:16px;margin-bottom:16px">
      <h3 style="font-size:13px;color:var(--cyan);margin-bottom:10px">📄 Export Data</h3>

      <label>Layer</label>
      <select id="exportLayer">
        <option value="all">All layers + drawn features</option>
        ${layerOpts}
        ${hasDrawn ? '<option value="drawn">Drawn features only</option>' : ''}
      </select>

      <label>Format</label>
      <select id="exportFormat">
        <option value="geojson">GeoJSON (.geojson)</option>
        <option value="kml">KML (.kml) — Google Earth</option>
        <option value="gpx">GPX (.gpx) — GPS devices</option>
        <option value="csv">CSV (.csv) — Spreadsheets</option>
      </select>

      <label>Coordinate System</label>
      <select id="exportCRS">
        <option value="4326">WGS 84 (EPSG:4326) — Lat/Lng</option>
        <option value="3857">Web Mercator (EPSG:3857) — Meters</option>
        <option value="32632">UTM Zone 32N (EPSG:32632)</option>
        <option value="32631">UTM Zone 31N (EPSG:32631)</option>
      </select>

      <label>Filename</label>
      <input id="exportName" value="spectraforte_export" placeholder="filename (no extension)">

      <div style="margin-top:10px">
        <button class="sm-btn" onclick="executeExport()">Download Data</button>
      </div>
    </div>

    <div style="border-bottom:1px solid var(--border);padding-bottom:16px;margin-bottom:16px">
      <h3 style="font-size:13px;color:var(--green);margin-bottom:10px">🗺️ Export Map View</h3>
      <p style="font-size:11px;color:var(--dim);margin-bottom:8px">
        Captures the current map view as a PNG image.
      </p>
      <button class="sm-btn" onclick="exportMapPNG()">Download Map as PNG</button>
    </div>

    <div>
      <h3 style="font-size:13px;color:var(--orange);margin-bottom:10px">📊 Export Dashboard Charts</h3>
      <p style="font-size:11px;color:var(--dim);margin-bottom:8px">
        ${hasDashCharts ? 'Export all dashboard charts as individual PNG files.' : 'Open the Dashboard and load data first.'}
      </p>
      <button class="sm-btn" onclick="exportAllDashboard()" ${hasDashCharts ? '' : 'disabled style="opacity:0.4"'}>Download All Charts</button>
    </div>

    <div class="modal-foot">
      <button class="hbtn" onclick="closeModal()">Close</button>
    </div>
  `);
};

function executeExport() {
  const layerId = $('exportLayer').value;
  const format = $('exportFormat').value;
  const filename = $('exportName').value.trim() || 'spectraforte_export';
  const targetCRS = $('exportCRS').value;

  const features = [];
  if (layerId === 'all') {
    APP.layers.forEach(l => {
      if (l.type === 'geojson') l.layer.eachLayer(sub => { if (sub.feature) features.push(JSON.parse(JSON.stringify(sub.feature))); });
    });
    drawnItems.eachLayer(l => { const gj = l.toGeoJSON?.(); if (gj) features.push(gj); });
  } else if (layerId === 'drawn') {
    drawnItems.eachLayer(l => { const gj = l.toGeoJSON?.(); if (gj) features.push(gj); });
  } else {
    const l = APP.layers.find(x => x.id === +layerId);
    if (l) l.layer.eachLayer(sub => { if (sub.feature) features.push(JSON.parse(JSON.stringify(sub.feature))); });
  }

  if (!features.length) { toast('No features to export', 'err'); return; }

  // Transform coordinates if needed
  if (targetCRS !== '4326') {
    features.forEach(f => {
      transformGeometry(f.geometry, targetCRS);
    });
  }

  const geojson = { type: 'FeatureCollection', features };
  let content, mimeType, extension;

  switch (format) {
    case 'geojson':
      content = JSON.stringify(geojson, null, 2);
      mimeType = 'application/json'; extension = '.geojson'; break;
    case 'kml':
      content = geojson2kml(geojson);
      mimeType = 'application/vnd.google-earth.kml+xml'; extension = '.kml'; break;
    case 'gpx':
      content = geojson2gpx(geojson);
      mimeType = 'application/gpx+xml'; extension = '.gpx'; break;
    case 'csv':
      content = geojson2csv(geojson);
      mimeType = 'text/csv'; extension = '.csv'; break;
    default: toast('Unknown format', 'err'); return;
  }

  downloadFile(content, filename + extension, mimeType);
  toast(`Exported ${features.length} features as ${format.toUpperCase()}`, 'ok');
  closeModal();
}

// ── Coordinate Transformation ──
// Simple WGS84 to Web Mercator and UTM
function transformGeometry(geom, targetCRS) {
  if (!geom) return;
  const transform = (coords) => {
    if (typeof coords[0] === 'number') {
      const [lng, lat] = coords;
      let result;
      if (targetCRS === '3857') {
        result = toWebMercator(lng, lat);
      } else if (targetCRS === '32632' || targetCRS === '32631') {
        const zone = targetCRS === '32632' ? 32 : 31;
        result = toUTM(lng, lat, zone);
      } else {
        result = [lng, lat];
      }
      coords[0] = +result[0].toFixed(2);
      coords[1] = +result[1].toFixed(2);
    } else {
      coords.forEach(c => transform(c));
    }
  };
  if (geom.coordinates) transform(geom.coordinates);
}

function toWebMercator(lng, lat) {
  const x = lng * 20037508.34 / 180;
  let y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180);
  y = y * 20037508.34 / 180;
  return [x, y];
}

function toUTM(lng, lat, zone) {
  const a = 6378137;
  const f = 1 / 298.257223563;
  const k0 = 0.9996;
  const e = Math.sqrt(2 * f - f * f);
  const e2 = e * e / (1 - e * e);
  const n = a / Math.sqrt(1 - e * e * Math.sin(lat * Math.PI / 180) ** 2);
  const t = Math.tan(lat * Math.PI / 180) ** 2;
  const c = e2 * Math.cos(lat * Math.PI / 180) ** 2;
  const A = Math.cos(lat * Math.PI / 180) * ((lng - (zone * 6 - 183)) * Math.PI / 180);
  const M = a * ((1 - e * e / 4 - 3 * e ** 4 / 64) * (lat * Math.PI / 180)
    - (3 * e * e / 8 + 3 * e ** 4 / 32) * Math.sin(2 * lat * Math.PI / 180)
    + (15 * e ** 4 / 256) * Math.sin(4 * lat * Math.PI / 180));
  const x = k0 * n * (A + (1 - t + c) * A ** 3 / 6) + 500000;
  const y = k0 * (M + n * Math.tan(lat * Math.PI / 180) * (A * A / 2 + (5 - t + 9 * c + 4 * c * c) * A ** 4 / 24));
  return [x, lat < 0 ? y + 10000000 : y];
}

// ── Map Screenshot ──
function exportMapPNG() {
  const mapEl = $('map');
  const canvas = document.createElement('canvas');
  const rect = mapEl.getBoundingClientRect();
  canvas.width = rect.width * 2;
  canvas.height = rect.height * 2;
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);

  // Capture all tile images
  const tiles = mapEl.querySelectorAll('.leaflet-tile-loaded');
  const mapPane = mapEl.querySelector('.leaflet-map-pane');
  const transform = window.getComputedStyle(mapPane).transform;
  let dx = 0, dy = 0;
  if (transform && transform !== 'none') {
    const m = transform.match(/matrix.*\((.+)\)/);
    if (m) {
      const vals = m[1].split(',').map(Number);
      dx = vals[4] || 0;
      dy = vals[5] || 0;
    }
  }

  // Background
  ctx.fillStyle = APP.theme === 'dark' ? '#121212' : '#E3F2FD';
  ctx.fillRect(0, 0, rect.width, rect.height);

  // Draw tiles
  const promises = [];
  tiles.forEach(tile => {
    const tileRect = tile.getBoundingClientRect();
    const x = tileRect.left - rect.left;
    const y = tileRect.top - rect.top;
    try { ctx.drawImage(tile, x, y, tileRect.width, tileRect.height); }
    catch (e) { /* CORS tile */ }
  });

  // Add attribution text
  ctx.fillStyle = APP.theme === 'dark' ? '#E0E0E0' : '#1A2634';
  ctx.font = '12px Inter, sans-serif';
  ctx.fillText('Spectraforte — Maps. Data. Insight.', 10, rect.height - 10);

  // Download
  const link = document.createElement('a');
  link.download = `spectraforte_map_${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  toast('Map exported as PNG', 'ok');
  closeModal();
}

// ── Generic File Download ──
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
