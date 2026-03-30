/* ═══════════════════════════════════════
   Spectraforte — Layer Management
   Clickable styling, editable tables, vector creation
   ═══════════════════════════════════════ */

const dropZone = $('dropZone'), fileInput = $('fileIn');
dropZone.onclick = () => fileInput.click();
dropZone.ondragover = e => { e.preventDefault(); dropZone.classList.add('over'); };
dropZone.ondragleave = () => dropZone.classList.remove('over');
dropZone.ondrop = e => { e.preventDefault(); dropZone.classList.remove('over'); handleFiles(e.dataTransfer.files); };
fileInput.onchange = e => handleFiles(e.target.files);

function handleFiles(files) {
  Array.from(files).forEach(f => {
    const ext = f.name.split('.').pop().toLowerCase();
    const reader = new FileReader();
    reader.onload = e => {
      try {
        let gj;
        if (ext === 'geojson' || ext === 'json') gj = JSON.parse(e.target.result);
        else if (ext === 'kml') gj = kml2geojson(e.target.result);
        else if (ext === 'gpx') gj = gpx2geojson(e.target.result);
        else if (ext === 'csv') { gj = csv2geojson(e.target.result); gj._rawCSV = e.target.result; }
        else { toast('Unsupported: .' + ext, 'err'); return; }
        addLayer(gj, f.name.replace(/\.[^.]+$/, ''));
      } catch (err) { toast('Parse error: ' + err.message, 'err'); console.error(err); }
    };
    reader.readAsText(f);
  });
}

// URL Loader
$('btnLoadUrl').onclick = () => {
  const url = $('urlIn').value.trim(); if (!url) return;
  setStatus('Loading…');
  fetch(url).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
    .then(t => { addLayer(JSON.parse(t), url.split('/').pop().replace(/\.[^.]+$/, '') || 'Remote'); $('urlIn').value = ''; setStatus(''); })
    .catch(e => { toast('Load failed: ' + e.message, 'err'); setStatus(''); });
};

// WMS
$('btnWMS').onclick = () => {
  modal(`<h2>Add WMS Layer</h2><p>Connect to any OGC Web Map Service</p>
    <label>WMS Base URL</label><input id="wmsUrl" placeholder="https://example.com/wms">
    <label>Layer Name(s)</label><input id="wmsLayers" placeholder="layer1,layer2">
    <label>Format</label><select id="wmsFmt"><option>image/png</option><option>image/jpeg</option></select>
    <div class="modal-foot"><button class="hbtn" onclick="closeModal()">Cancel</button><button class="sm-btn" onclick="addWMSLayer()">Add</button></div>`);
};
function addWMSLayer() {
  const url = $('wmsUrl').value.trim(), layers = $('wmsLayers').value.trim();
  if (!url || !layers) { toast('URL and layer required', 'err'); return; }
  const wms = L.tileLayer.wms(url, { layers, format: $('wmsFmt').value, transparent: true, version: '1.1.1' }).addTo(map);
  APP.layers.push({ id: ++APP.uid, name: 'WMS: ' + layers, layer: wms, visible: true, style: { color: '#2196F3' }, featureCount: 0, type: 'wms' });
  refreshLayers(); toast('WMS added', 'ok'); closeModal();
}

// GitHub
$('btnGH').onclick = () => {
  modal(`<h2>Load from GitHub</h2><p>Auto-load all GeoJSON from a repo folder</p>
    <label>Username</label><input id="ghUser" placeholder="yourusername">
    <label>Repository</label><input id="ghRepo" placeholder="maxgis">
    <label>Branch</label><input id="ghBranch" value="main">
    <label>Folder</label><input id="ghPath" value="data">
    <div class="modal-foot"><button class="hbtn" onclick="closeModal()">Cancel</button><button class="sm-btn" onclick="loadFromGitHub()">Load All</button></div>`);
};
function loadFromGitHub() {
  const u = $('ghUser').value.trim(), r = $('ghRepo').value.trim(), b = $('ghBranch').value.trim(), p = $('ghPath').value.trim();
  if (!u || !r) { toast('Username and repo required', 'err'); return; }
  setStatus('Fetching…');
  fetch(`https://api.github.com/repos/${u}/${r}/contents/${p}?ref=${b}`).then(r => r.json()).then(files => {
    const gj = files.filter(f => f.name.endsWith('.geojson') || f.name.endsWith('.json'));
    if (!gj.length) { toast('No GeoJSON found', 'err'); setStatus(''); return; }
    let n = 0;
    gj.forEach(f => { fetch(f.download_url).then(r => r.json()).then(data => { addLayer(data, f.name.replace(/\.[^.]+$/, '')); if (++n === gj.length) { setStatus(''); toast(`Loaded ${n} files`, 'ok'); } }); });
    closeModal();
  }).catch(e => { toast('GitHub error: ' + e.message, 'err'); setStatus(''); });
}

// ══════════════════════════════════════
//  ADD LAYER
// ══════════════════════════════════════
function addLayer(data, name, customStyle) {
  const id = ++APP.uid;
  const hue = (id * 61) % 360;
  const color = customStyle?.color || `hsl(${hue},55%,55%)`;
  const st = {
    color, fillColor: customStyle?.fillColor || color,
    weight: customStyle?.weight || 2, opacity: 0.9,
    fillOpacity: customStyle?.fillOpacity || 0.4,
    radius: customStyle?.radius || 6,
    dashArray: customStyle?.dashArray || null
  };
  let fc = 0;
  const layer = L.geoJSON(data, {
    style: () => ({ ...st }),
    pointToLayer: (f, ll) => L.circleMarker(ll, { ...st }),
    onEachFeature: (feature, lyr) => {
      fc++;
      if (feature.properties && Object.keys(feature.properties).length) {
        let h = `<div class="geo-popup"><h4>${name}</h4><table>`;
        Object.entries(feature.properties).forEach(([k, v]) => { if (v != null && v !== '') h += `<tr><td>${k}</td><td>${v}</td></tr>`; });
        h += '</table></div>';
        lyr.bindPopup(h, { maxWidth: 300 });
      }
    }
  }).addTo(map);

  const entry = { id, name, layer, data, visible: true, style: st, featureCount: fc, type: 'geojson', rawCSV: data._rawCSV || null, labelField: null };
  APP.layers.push(entry);
  APP.totalFt += fc;
  try { map.fitBounds(layer.getBounds(), { padding: [60, 60], maxZoom: 15 }); } catch (e) {}
  refreshLayers();
  toast(`"${name}" — ${fc} features`, 'ok');
}

// ══════════════════════════════════════
//  LAYER LIST — clickable for styling
// ══════════════════════════════════════
function refreshLayers() {
  $('lyrCount').textContent = APP.layers.length;
  $('ftCount').textContent = 'Features: ' + APP.totalFt;
  const el = $('lyrList');
  if (!APP.layers.length) { el.innerHTML = '<div class="empty-msg">No layers loaded.<br>Import data to begin.</div>'; refreshSelects(); return; }

  el.innerHTML = APP.layers.map(l => `
    <div class="layer-item">
      <input type="checkbox" ${l.visible ? 'checked' : ''} onchange="event.stopPropagation();toggleLayer(${l.id})">
      <div class="ldot" style="background:${l.style.color}" onclick="openLayerStyle(${l.id})" title="Click to style"></div>
      <span class="lname" onclick="openLayerStyle(${l.id})" title="Click to customise">${l.name}</span>
      <span class="lcount">${l.featureCount}</span>
      <button class="lbtn" onclick="event.stopPropagation();zoomToLayer(${l.id})" title="Zoom">⊕</button>
      <button class="lbtn del" onclick="event.stopPropagation();removeLayer(${l.id})" title="Remove">✕</button>
    </div>
  `).join('');
  refreshSelects();
}

function toggleLayer(id) { const l = APP.layers.find(x => x.id === id); if (!l) return; l.visible = !l.visible; l.visible ? map.addLayer(l.layer) : map.removeLayer(l.layer); }
function zoomToLayer(id) { const l = APP.layers.find(x => x.id === id); if (l) try { map.fitBounds(l.layer.getBounds(), { padding: [50, 50] }); } catch (e) { toast('Cannot zoom', 'err'); } }
function removeLayer(id) { const i = APP.layers.findIndex(x => x.id === id); if (i === -1) return; const l = APP.layers[i]; map.removeLayer(l.layer); APP.totalFt -= l.featureCount; APP.layers.splice(i, 1); refreshLayers(); toast(`Removed "${l.name}"`, 'ok'); }
function clearAll() { APP.layers.forEach(l => map.removeLayer(l.layer)); APP.layers = []; APP.totalFt = 0; drawnItems.clearLayers(); refreshLayers(); toast('All cleared', 'ok'); }

// ══════════════════════════════════════
//  LAYER STYLE MODAL — full control
// ══════════════════════════════════════
function openLayerStyle(id) {
  const l = APP.layers.find(x => x.id === id);
  if (!l) return;
  if (l.type === 'wms') { toast('WMS layers cannot be styled locally', 'err'); return; }

  const fields = l.data?.features?.[0]?.properties ? Object.keys(l.data.features[0].properties) : [];
  const fieldOpts = '<option value="">-- none --</option>' + fields.map(f => `<option value="${f}" ${l.labelField === f ? 'selected' : ''}>${f}</option>`).join('');

  modal(`
    <h2>Style: ${l.name}</h2>
    <p>${l.featureCount} features · ${l.type}</p>

    <div class="style-modal-grid">
      <div>
        <label>Fill Color</label>
        <input type="color" id="lsFill" value="${l.style.fillColor || l.style.color}">
      </div>
      <div>
        <label>Stroke Color</label>
        <input type="color" id="lsStroke" value="${l.style.color}">
      </div>
      <div>
        <label>Fill Opacity (${l.style.fillOpacity})</label>
        <input type="range" id="lsOpacity" min="0" max="1" step="0.05" value="${l.style.fillOpacity}">
      </div>
      <div>
        <label>Stroke Weight (${l.style.weight})</label>
        <input type="range" id="lsWeight" min="0.5" max="10" step="0.5" value="${l.style.weight}">
      </div>
      <div>
        <label>Point Radius (${l.style.radius || 6})</label>
        <input type="range" id="lsRadius" min="2" max="20" step="1" value="${l.style.radius || 6}">
      </div>
      <div>
        <label>Line Style</label>
        <select id="lsDash">
          <option value="" ${!l.style.dashArray ? 'selected' : ''}>Solid</option>
          <option value="8 4" ${l.style.dashArray === '8 4' ? 'selected' : ''}>Dashed</option>
          <option value="2 4" ${l.style.dashArray === '2 4' ? 'selected' : ''}>Dotted</option>
          <option value="12 4 4 4" ${l.style.dashArray === '12 4 4 4' ? 'selected' : ''}>Dash-Dot</option>
        </select>
      </div>
    </div>

    <label>Label Field (show on map)</label>
    <select id="lsLabel">${fieldOpts}</select>

    <label>Layer Name</label>
    <input id="lsName" value="${l.name}">

    <div class="modal-foot">
      <button class="hbtn" onclick="closeModal()">Cancel</button>
      <button class="sm-btn" onclick="applyLayerStyle(${l.id})">Apply</button>
    </div>
  `);
}

function applyLayerStyle(id) {
  const l = APP.layers.find(x => x.id === id);
  if (!l) return;

  const ns = {
    fillColor: $('lsFill').value,
    color: $('lsStroke').value,
    fillOpacity: +$('lsOpacity').value,
    weight: +$('lsWeight').value,
    opacity: 0.9,
    radius: +$('lsRadius').value,
    dashArray: $('lsDash').value || null
  };

  l.style = ns;
  l.name = $('lsName').value || l.name;
  l.labelField = $('lsLabel').value || null;

  l.layer.setStyle(ns);
  l.layer.eachLayer(sub => {
    if (sub.setStyle) sub.setStyle(ns);
    if (sub.setRadius) sub.setRadius(ns.radius);
  });

  // Labels
  if (l.labelField) {
    l.layer.eachLayer(sub => {
      if (sub.feature?.properties?.[l.labelField] != null) {
        sub.unbindTooltip();
        sub.bindTooltip(String(sub.feature.properties[l.labelField]), {
          permanent: true, direction: 'center',
          className: 'leaflet-label-custom',
          offset: [0, 0]
        });
      }
    });
  } else {
    l.layer.eachLayer(sub => sub.unbindTooltip());
  }

  refreshLayers();
  toast('Style updated', 'ok');
  closeModal();
}

// ══════════════════════════════════════
//  SELECTS & QUICK STYLE
// ══════════════════════════════════════
function refreshSelects() {
  const opts = '<option value="">Select layer…</option>' + APP.layers.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
  $('styleSel').innerHTML = opts;
  $('attrSel').innerHTML = opts;
  if ($('dashLayerSel')) $('dashLayerSel').innerHTML = opts;
  $('styleSel').onchange = () => {
    const l = APP.layers.find(x => x.id === +$('styleSel').value);
    const cf = $('classField'); cf.innerHTML = '<option value="">-- none --</option>';
    if (l?.data?.features?.[0]?.properties) Object.keys(l.data.features[0].properties).forEach(k => { cf.innerHTML += `<option value="${k}">${k}</option>`; });
  };
  $('attrSel').onchange = () => renderAttributeTable();
}

$('sOp').oninput = () => { $('sOpVal').textContent = $('sOp').value; };
$('sWt').oninput = () => { $('sWtVal').textContent = $('sWt').value; };

$('btnApplyStyle').onclick = () => {
  const l = APP.layers.find(x => x.id === +$('styleSel').value);
  if (!l || l.type === 'wms') { toast('Select a vector layer', 'err'); return; }
  const ns = { fillColor: $('sFill').value, color: $('sStroke').value, fillOpacity: +$('sOp').value, weight: +$('sWt').value, opacity: 0.9 };
  l.style = { ...l.style, ...ns }; l.layer.setStyle(ns);
  l.layer.eachLayer(sub => { if (sub.setStyle) sub.setStyle(ns); if (sub.setRadius) sub.setRadius(l.style.radius || 6); });
  refreshLayers(); toast('Style applied', 'ok');
};

$('btnClassify').onclick = () => {
  const l = APP.layers.find(x => x.id === +$('styleSel').value);
  const field = $('classField').value;
  if (!l || !field) { toast('Select layer and field', 'err'); return; }
  const vals = []; l.layer.eachLayer(sub => { const v = +sub.feature?.properties?.[field]; if (!isNaN(v)) vals.push(v); });
  if (!vals.length) { toast('No numeric values', 'err'); return; }
  const mn = Math.min(...vals), mx = Math.max(...vals), rng = mx - mn || 1;
  const colors = ['#0D47A1', '#1565C0', '#1976D2', '#2196F3', '#42A5F5', '#4FC3F7', '#81D4FA', '#B3E5FC'];
  l.layer.eachLayer(sub => {
    const v = +sub.feature?.properties?.[field]; if (isNaN(v)) return;
    const ci = Math.min(Math.floor(((v - mn) / rng) * colors.length), colors.length - 1);
    if (sub.setStyle) sub.setStyle({ fillColor: colors[ci], color: '#0D47A1', weight: 1, fillOpacity: 0.75 });
  });
  toast(`Classified by "${field}"`, 'ok');
};

// ══════════════════════════════════════
//  EDITABLE ATTRIBUTE TABLE
// ══════════════════════════════════════
$('btnAttr').onclick = () => toggleAttrTable();
$('btnCloseAttr').onclick = () => toggleAttrTable();

function toggleAttrTable() {
  APP.attrOpen = !APP.attrOpen;
  $('attrPanel').classList.toggle('open', APP.attrOpen);
  $('btnAttr').classList.toggle('on', APP.attrOpen);
  if (APP.attrOpen) renderAttributeTable();
}

function renderAttributeTable() {
  const l = APP.layers.find(x => x.id === +$('attrSel').value);
  if (!l?.data) { $('attrBody').innerHTML = '<div style="padding:20px;text-align:center;color:var(--dim)">Select a vector layer</div>'; return; }
  const feats = l.data.features || [];
  if (!feats.length) { $('attrBody').innerHTML = '<div style="padding:20px;text-align:center;color:var(--dim)">No features</div>'; return; }

  const keys = [...new Set(feats.flatMap(f => Object.keys(f.properties || {})))];
  let h = '<table><thead><tr><th>#</th>' + keys.map(k => `<th>${k}</th>`).join('') + '</tr></thead><tbody>';
  feats.forEach((f, i) => {
    h += `<tr><td>${i + 1}</td>` + keys.map(k =>
      `<td contenteditable="true" data-layer="${l.id}" data-feat="${i}" data-key="${k}" onblur="saveEdit(this)">${f.properties?.[k] ?? ''}</td>`
    ).join('') + '</tr>';
  });
  h += '</tbody></table>';
  h += `<div style="padding:8px;display:flex;gap:6px">
    <button class="sm-btn" onclick="saveTableToLayer(${l.id})">Save Changes</button>
    <button class="sm-btn" onclick="exportTableCSV(${l.id})">Export as CSV</button>
    <button class="sm-btn" onclick="addRowToLayer(${l.id})">+ Add Row</button>
  </div>`;

  $('attrBody').innerHTML = h;
  $('attrTitle').textContent = l.name + ' — ' + feats.length + ' rows (editable)';
}

function saveEdit(td) {
  const lid = +td.dataset.layer, fi = +td.dataset.feat, key = td.dataset.key;
  const l = APP.layers.find(x => x.id === lid);
  if (l?.data?.features?.[fi]) {
    const val = td.textContent.trim();
    l.data.features[fi].properties[key] = isNaN(val) || val === '' ? val : +val;
  }
}

function saveTableToLayer(id) {
  const l = APP.layers.find(x => x.id === id);
  if (!l) return;
  // Rebuild the map layer from edited data
  map.removeLayer(l.layer);
  const newLayer = L.geoJSON(l.data, {
    style: () => ({ ...l.style }),
    pointToLayer: (f, ll) => L.circleMarker(ll, { ...l.style }),
    onEachFeature: (feature, lyr) => {
      if (feature.properties && Object.keys(feature.properties).length) {
        let h = `<div class="geo-popup"><h4>${l.name}</h4><table>`;
        Object.entries(feature.properties).forEach(([k, v]) => { if (v != null && v !== '') h += `<tr><td>${k}</td><td>${v}</td></tr>`; });
        h += '</table></div>';
        lyr.bindPopup(h, { maxWidth: 300 });
      }
    }
  }).addTo(map);
  l.layer = newLayer;
  toast('Table saved and layer refreshed', 'ok');
}

function exportTableCSV(id) {
  const l = APP.layers.find(x => x.id === id);
  if (!l?.data) return;
  const csv = geojson2csv(l.data);
  downloadFile(csv, l.name + '_table.csv', 'text/csv');
  toast('Table exported as CSV', 'ok');
}

function addRowToLayer(id) {
  const l = APP.layers.find(x => x.id === id);
  if (!l?.data) return;
  const sample = l.data.features[0];
  if (!sample) return;
  const newProps = {};
  Object.keys(sample.properties || {}).forEach(k => { newProps[k] = ''; });
  // Default coords to map center
  const c = map.getCenter();
  const newFeat = {
    type: 'Feature',
    properties: newProps,
    geometry: { type: 'Point', coordinates: [c.lng, c.lat] }
  };
  l.data.features.push(newFeat);
  l.featureCount++;
  APP.totalFt++;
  renderAttributeTable();
  toast('New row added — edit values and click Save', 'ok');
}

// ══════════════════════════════════════
//  VECTOR CREATION — drawn features → layer
// ══════════════════════════════════════
// Override drawn items to become a proper named layer
function createLayerFromDrawn() {
  const layers = drawnItems.getLayers();
  if (!layers.length) { toast('Draw some features first', 'err'); return; }

  const features = layers.map(l => {
    const gj = l.toGeoJSON();
    if (!gj.properties) gj.properties = {};
    gj.properties.id = Math.random().toString(36).substr(2, 6);
    return gj;
  });

  const name = prompt('Layer name:', 'New Vector Layer') || 'New Vector Layer';
  const geojson = { type: 'FeatureCollection', features };
  addLayer(geojson, name);

  // Clear drawn items since they're now a layer
  drawnItems.clearLayers();
  toast(`Created layer "${name}" with ${features.length} features`, 'ok');
}

// Init
refreshLayers();
