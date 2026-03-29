/* ═══════════════════════════════════════
   MaxGIS — Layer Management
   ═══════════════════════════════════════ */

// ── File Drop & Browse ──
const dropZone = $('dropZone');
const fileInput = $('fileIn');

dropZone.onclick = () => fileInput.click();
dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('over'); };
dropZone.ondragleave = () => dropZone.classList.remove('over');
dropZone.ondrop = (e) => {
  e.preventDefault();
  dropZone.classList.remove('over');
  handleFiles(e.dataTransfer.files);
};
fileInput.onchange = (e) => handleFiles(e.target.files);

function handleFiles(files) {
  Array.from(files).forEach(file => {
    const ext = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        let geojson;
        if (ext === 'geojson' || ext === 'json') {
          geojson = JSON.parse(e.target.result);
        } else if (ext === 'kml') {
          geojson = kml2geojson(e.target.result);
        } else if (ext === 'gpx') {
          geojson = gpx2geojson(e.target.result);
        } else if (ext === 'csv') {
          geojson = csv2geojson(e.target.result);
          // Store raw CSV for dashboard
          geojson._rawCSV = e.target.result;
        } else {
          toast('Unsupported format: .' + ext, 'err');
          return;
        }
        addLayer(geojson, file.name.replace(/\.[^.]+$/, ''));
      } catch (err) {
        toast('Parse error: ' + err.message, 'err');
        console.error(err);
      }
    };
    reader.readAsText(file);
  });
}

// ── URL Loader ──
$('btnLoadUrl').onclick = () => {
  const url = $('urlIn').value.trim();
  if (!url) return;
  setStatus('Loading…');
  fetch(url)
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
    .then(text => {
      const geojson = JSON.parse(text);
      const name = url.split('/').pop().replace(/\.[^.]+$/, '') || 'Remote';
      addLayer(geojson, name);
      $('urlIn').value = '';
      setStatus('');
    })
    .catch(e => { toast('Load failed: ' + e.message, 'err'); setStatus(''); });
};

// ── WMS Modal ──
$('btnWMS').onclick = () => {
  modal(`
    <h2>Add WMS Layer</h2>
    <p>Connect to any OGC Web Map Service</p>
    <label>WMS Base URL</label>
    <input id="wmsUrl" placeholder="https://example.com/wms">
    <label>Layer Name(s)</label>
    <input id="wmsLayers" placeholder="layer1,layer2">
    <label>Format</label>
    <select id="wmsFmt"><option>image/png</option><option>image/jpeg</option></select>
    <div class="modal-foot">
      <button class="hbtn" onclick="closeModal()">Cancel</button>
      <button class="sm-btn" onclick="addWMSLayer()">Add WMS</button>
    </div>
  `);
};

function addWMSLayer() {
  const url = $('wmsUrl').value.trim();
  const layers = $('wmsLayers').value.trim();
  if (!url || !layers) { toast('URL and layer name required', 'err'); return; }

  const wms = L.tileLayer.wms(url, {
    layers, format: $('wmsFmt').value,
    transparent: true, version: '1.1.1'
  }).addTo(map);

  const id = ++APP.uid;
  APP.layers.push({
    id, name: 'WMS: ' + layers, layer: wms,
    visible: true, style: { color: '#6ebad9' },
    featureCount: 0, type: 'wms'
  });
  refreshLayers();
  toast('WMS layer added', 'ok');
  closeModal();
}

// ── GitHub Repo Loader ──
$('btnGH').onclick = () => {
  modal(`
    <h2>Load from GitHub</h2>
    <p>Auto-load all GeoJSON files from a repo folder</p>
    <label>GitHub Username</label><input id="ghUser" placeholder="yourusername">
    <label>Repository</label><input id="ghRepo" placeholder="maxgis">
    <label>Branch</label><input id="ghBranch" value="main">
    <label>Folder Path</label><input id="ghPath" value="data">
    <div class="modal-foot">
      <button class="hbtn" onclick="closeModal()">Cancel</button>
      <button class="sm-btn" onclick="loadFromGitHub()">Load All</button>
    </div>
  `);
};

function loadFromGitHub() {
  const user = $('ghUser').value.trim();
  const repo = $('ghRepo').value.trim();
  const branch = $('ghBranch').value.trim();
  const path = $('ghPath').value.trim();
  if (!user || !repo) { toast('Username and repo required', 'err'); return; }

  setStatus('Fetching repo…');
  const apiUrl = `https://api.github.com/repos/${user}/${repo}/contents/${path}?ref=${branch}`;

  fetch(apiUrl)
    .then(r => r.json())
    .then(files => {
      const gjFiles = files.filter(f =>
        f.name.endsWith('.geojson') || f.name.endsWith('.json')
      );
      if (!gjFiles.length) {
        toast('No GeoJSON found in /' + path, 'err');
        setStatus('');
        return;
      }
      let loaded = 0;
      gjFiles.forEach(f => {
        fetch(f.download_url)
          .then(r => r.json())
          .then(data => {
            addLayer(data, f.name.replace(/\.[^.]+$/, ''));
            loaded++;
            if (loaded === gjFiles.length) {
              setStatus('');
              toast(`Loaded ${loaded} files from GitHub`, 'ok');
            }
          })
          .catch(e => console.error(e));
      });
      closeModal();
    })
    .catch(e => { toast('GitHub error: ' + e.message, 'err'); setStatus(''); });
}

// ── Add GeoJSON Layer ──
function addLayer(data, name, customStyle) {
  const id = ++APP.uid;
  const hue = (id * 61) % 360;
  const color = customStyle?.color || `hsl(${hue}, 55%, 55%)`;
  const style = {
    color,
    fillColor: customStyle?.fillColor || color,
    weight: customStyle?.weight || 2,
    opacity: 0.9,
    fillOpacity: customStyle?.fillOpacity || 0.4
  };

  let featureCount = 0;
  const layer = L.geoJSON(data, {
    style: () => ({ ...style }),
    pointToLayer: (f, ll) => L.circleMarker(ll, { ...style, radius: 6 }),
    onEachFeature: (feature, lyr) => {
      featureCount++;
      if (feature.properties && Object.keys(feature.properties).length) {
        let html = `<div class="geo-popup"><h4>${name}</h4><table>`;
        Object.entries(feature.properties).forEach(([k, v]) => {
          if (v != null && v !== '') html += `<tr><td>${k}</td><td>${v}</td></tr>`;
        });
        html += '</table></div>';
        lyr.bindPopup(html, { maxWidth: 300 });
      }
    }
  }).addTo(map);

  const entry = {
    id, name, layer, data, visible: true,
    style, featureCount, type: 'geojson',
    rawCSV: data._rawCSV || null
  };
  APP.layers.push(entry);
  APP.totalFt += featureCount;

  try { map.fitBounds(layer.getBounds(), { padding: [60, 60], maxZoom: 15 }); }
  catch (e) { /* empty layer */ }

  refreshLayers();
  toast(`"${name}" — ${featureCount} features`, 'ok');
}

// ── Layer List Refresh ──
function refreshLayers() {
  $('lyrCount').textContent = APP.layers.length;
  $('ftCount').textContent = 'Features: ' + APP.totalFt;

  const el = $('lyrList');
  if (!APP.layers.length) {
    el.innerHTML = '<div class="empty-msg">No layers loaded yet.<br>Import data above to begin.</div>';
    refreshSelects();
    return;
  }

  el.innerHTML = APP.layers.map(l => `
    <div class="layer-item">
      <input type="checkbox" ${l.visible ? 'checked' : ''} onchange="toggleLayer(${l.id})">
      <div class="ldot" style="background:${l.style.color}"></div>
      <span class="lname" title="${l.name}">${l.name}</span>
      <span class="lcount">${l.featureCount}</span>
      <button class="lbtn" onclick="zoomToLayer(${l.id})" title="Zoom">⊕</button>
      <button class="lbtn del" onclick="removeLayer(${l.id})" title="Remove">✕</button>
    </div>
  `).join('');

  refreshSelects();
}

function toggleLayer(id) {
  const l = APP.layers.find(x => x.id === id);
  if (!l) return;
  l.visible = !l.visible;
  l.visible ? map.addLayer(l.layer) : map.removeLayer(l.layer);
}

function zoomToLayer(id) {
  const l = APP.layers.find(x => x.id === id);
  if (l) {
    try { map.fitBounds(l.layer.getBounds(), { padding: [50, 50] }); }
    catch (e) { toast('Cannot zoom to this layer', 'err'); }
  }
}

function removeLayer(id) {
  const idx = APP.layers.findIndex(x => x.id === id);
  if (idx === -1) return;
  const l = APP.layers[idx];
  map.removeLayer(l.layer);
  APP.totalFt -= l.featureCount;
  APP.layers.splice(idx, 1);
  refreshLayers();
  toast(`Removed "${l.name}"`, 'ok');
}

function clearAll() {
  APP.layers.forEach(l => map.removeLayer(l.layer));
  APP.layers = [];
  APP.totalFt = 0;
  drawnItems.clearLayers();
  refreshLayers();
  toast('All cleared', 'ok');
}

// ── Refresh Select Dropdowns ──
function refreshSelects() {
  const opts = '<option value="">Select layer…</option>' +
    APP.layers.map(l => `<option value="${l.id}">${l.name}</option>`).join('');

  $('styleSel').innerHTML = opts;
  $('attrSel').innerHTML = opts;
  if ($('dashLayerSel')) $('dashLayerSel').innerHTML = opts;

  // Update classify field dropdown when style layer changes
  $('styleSel').onchange = () => {
    const l = APP.layers.find(x => x.id === +$('styleSel').value);
    const cf = $('classField');
    cf.innerHTML = '<option value="">-- none --</option>';
    if (l?.data?.features?.[0]?.properties) {
      Object.keys(l.data.features[0].properties).forEach(k => {
        cf.innerHTML += `<option value="${k}">${k}</option>`;
      });
    }
  };

  $('attrSel').onchange = () => renderAttributeTable();
}

// ── Styling ──
$('sOp').oninput = () => { $('sOpVal').textContent = $('sOp').value; };
$('sWt').oninput = () => { $('sWtVal').textContent = $('sWt').value; };

$('btnApplyStyle').onclick = () => {
  const l = APP.layers.find(x => x.id === +$('styleSel').value);
  if (!l || l.type === 'wms') { toast('Select a vector layer', 'err'); return; }

  const newStyle = {
    fillColor: $('sFill').value,
    color: $('sStroke').value,
    fillOpacity: +$('sOp').value,
    weight: +$('sWt').value,
    opacity: 0.9
  };
  l.style = newStyle;
  l.layer.setStyle(newStyle);
  l.layer.eachLayer(sub => {
    if (sub.setStyle) sub.setStyle(newStyle);
    if (sub.setRadius) sub.setRadius(6);
  });
  refreshLayers();
  toast('Style applied', 'ok');
};

// ── Choropleth Classification ──
$('btnClassify').onclick = () => {
  const l = APP.layers.find(x => x.id === +$('styleSel').value);
  const field = $('classField').value;
  if (!l || !field) { toast('Select layer and field', 'err'); return; }

  const vals = [];
  l.layer.eachLayer(sub => {
    const v = +sub.feature?.properties?.[field];
    if (!isNaN(v)) vals.push(v);
  });
  if (!vals.length) { toast('No numeric values in field', 'err'); return; }

  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const colors = ['#2b4162', '#3e6990', '#5998b5', '#8bbabb', '#bcd4b0', '#d4c98e', '#d9a062', '#c1666b'];

  l.layer.eachLayer(sub => {
    const v = +sub.feature?.properties?.[field];
    if (isNaN(v)) return;
    const norm = (v - min) / range;
    const ci = Math.min(Math.floor(norm * colors.length), colors.length - 1);
    if (sub.setStyle) {
      sub.setStyle({ fillColor: colors[ci], color: '#5a5245', weight: 1, fillOpacity: 0.75 });
    }
  });
  toast(`Classified by "${field}"`, 'ok');
};

// ── Attribute Table ──
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
  if (!l?.data) {
    $('attrBody').innerHTML = '<div style="padding:20px;text-align:center;color:var(--dim)">Select a vector layer</div>';
    return;
  }

  const feats = l.data.features || [];
  if (!feats.length) {
    $('attrBody').innerHTML = '<div style="padding:20px;text-align:center;color:var(--dim)">No features</div>';
    return;
  }

  const keys = [...new Set(feats.flatMap(f => Object.keys(f.properties || {})))];
  let html = '<table><thead><tr><th>#</th>' + keys.map(k => `<th>${k}</th>`).join('') + '</tr></thead><tbody>';
  feats.forEach((f, i) => {
    html += `<tr><td>${i + 1}</td>` + keys.map(k => `<td>${f.properties?.[k] ?? ''}</td>`).join('') + '</tr>';
  });
  html += '</tbody></table>';

  $('attrBody').innerHTML = html;
  $('attrTitle').textContent = l.name + ' — ' + feats.length + ' rows';
}

// ── Init Layer List ──
refreshLayers();
