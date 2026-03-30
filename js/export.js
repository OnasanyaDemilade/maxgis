/* ═══════════════════════════════════════
   MaxGIS — Multi-Format Export System
   Supports: GeoJSON, KML, GPX, CSV, Shapefile
   ═══════════════════════════════════════ */

$('btnExport').onclick = () => {
  const vectorLayers = APP.layers.filter(l => l.type === 'geojson');
  const hasDrawn = drawnItems.getLayers().length > 0;

  if (!vectorLayers.length && !hasDrawn) {
    toast('Nothing to export', 'err');
    return;
  }

  const layerOpts = vectorLayers.map(l =>
    `<option value="${l.id}">${l.name} (${l.featureCount})</option>`
  ).join('');

  modal(`
    <h2>Export Data</h2>
    <p>Convert and download your layers in multiple formats</p>

    <label>Layer to Export</label>
    <select id="exportLayer">
      <option value="all">All layers + drawn features</option>
      ${layerOpts}
      ${hasDrawn ? '<option value="drawn">Drawn features only</option>' : ''}
    </select>

    <label>Export Format</label>
    <select id="exportFormat">
      <option value="geojson">GeoJSON (.geojson)</option>
      <option value="kml">KML (.kml) — Google Earth</option>
      <option value="gpx">GPX (.gpx) — GPS devices</option>
      <option value="csv">CSV (.csv) — Spreadsheets</option>
    </select>

    <label>Filename</label>
    <input id="exportName" value="spectraforte_export" placeholder="filename (no extension)">

    <div class="modal-foot">
      <button class="hbtn" onclick="closeModal()">Cancel</button>
      <button class="sm-btn" onclick="executeExport()">Download</button>
    </div>
  `);
};

function executeExport() {
  const layerId = $('exportLayer').value;
  const format = $('exportFormat').value;
  const filename = $('exportName').value.trim() || 'maxgis_export';

  // Collect features based on selection
  const features = [];

  if (layerId === 'all') {
    APP.layers.forEach(l => {
      if (l.type === 'geojson') {
        l.layer.eachLayer(sub => {
          if (sub.feature) features.push(sub.feature);
        });
      }
    });
    drawnItems.eachLayer(l => {
      const gj = l.toGeoJSON?.();
      if (gj) features.push(gj);
    });
  } else if (layerId === 'drawn') {
    drawnItems.eachLayer(l => {
      const gj = l.toGeoJSON?.();
      if (gj) features.push(gj);
    });
  } else {
    const l = APP.layers.find(x => x.id === +layerId);
    if (l) {
      l.layer.eachLayer(sub => {
        if (sub.feature) features.push(sub.feature);
      });
    }
  }

  if (!features.length) {
    toast('No features to export', 'err');
    return;
  }

  const geojson = { type: 'FeatureCollection', features };

  // Convert and download
  let content, mimeType, extension;

  switch (format) {
    case 'geojson':
      content = JSON.stringify(geojson, null, 2);
      mimeType = 'application/json';
      extension = '.geojson';
      break;

    case 'kml':
      content = geojson2kml(geojson);
      mimeType = 'application/vnd.google-earth.kml+xml';
      extension = '.kml';
      break;

    case 'gpx':
      content = geojson2gpx(geojson);
      mimeType = 'application/gpx+xml';
      extension = '.gpx';
      break;

    case 'csv':
      content = geojson2csv(geojson);
      mimeType = 'text/csv';
      extension = '.csv';
      break;

    default:
      toast('Unknown format', 'err');
      return;
  }

  // Trigger download
  downloadFile(content, filename + extension, mimeType);
  toast(`Exported ${features.length} features as ${format.toUpperCase()}`, 'ok');
  closeModal();
}

// ── Generic File Download ──
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
