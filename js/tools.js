/* ═══════════════════════════════════════
   MaxGIS — Drawing & Analysis Tools
   ═══════════════════════════════════════ */

// ── Populate Tools Grid ──
const TOOLS = [
  { id: 'marker',    icon: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>', label: 'Marker' },
  { id: 'polyline',  icon: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>', label: 'Line' },
  { id: 'polygon',   icon: '<polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5"/>', label: 'Polygon' },
  { id: 'circle',    icon: '<circle cx="12" cy="12" r="10"/>', label: 'Circle' },
  { id: 'rectangle', icon: '<rect x="3" y="3" width="18" height="18" rx="2"/>', label: 'Rectangle' },
  { id: 'buffer',    icon: '<circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/>', label: 'Buffer' },
  { id: 'centroid',  icon: '<circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="6"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>', label: 'Centroid' },
  { id: 'bbox',      icon: '<rect x="4" y="4" width="16" height="16" rx="1" stroke-dasharray="4 3"/><circle cx="4" cy="4" r="1.5" fill="currentColor"/><circle cx="20" cy="4" r="1.5" fill="currentColor"/><circle cx="4" cy="20" r="1.5" fill="currentColor"/><circle cx="20" cy="20" r="1.5" fill="currentColor"/>', label: 'BBox' },
  { id: 'clear',     icon: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>', label: 'Clear All' },
];

$('toolsGrid').innerHTML = TOOLS.map(t => `
  <div class="tool" onclick="handleTool('${t.id}')">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${t.icon}</svg>
    ${t.label}
  </div>
`).join('');

function handleTool(id) {
  switch (id) {
    case 'marker':
    case 'polyline':
    case 'polygon':
    case 'circle':
    case 'rectangle':
      drawTool(id);
      break;
    case 'buffer':   runBuffer(); break;
    case 'centroid':  runCentroid(); break;
    case 'bbox':      runBBox(); break;
    case 'clear':     clearAll(); break;
  }
}

// ── Draw Tools ──
function drawTool(type) {
  const shapeOpts = {
    shapeOptions: {
      color: '#c2aa82', fillColor: '#c2aa82',
      fillOpacity: 0.2, weight: 2
    }
  };
  const handlers = {
    marker: L.Draw.Marker,
    polyline: L.Draw.Polyline,
    polygon: L.Draw.Polygon,
    circle: L.Draw.Circle,
    rectangle: L.Draw.Rectangle
  };
  const Handler = handlers[type];
  if (Handler) new Handler(map, type === 'marker' ? {} : shapeOpts).enable();
}

map.on(L.Draw.Event.CREATED, (e) => {
  drawnItems.addLayer(e.layer);
  const gj = e.layer.toGeoJSON?.();
  let info = 'Drawn feature';
  if (gj?.geometry?.type === 'Point') {
    info = `Point: ${gj.geometry.coordinates[1].toFixed(5)}, ${gj.geometry.coordinates[0].toFixed(5)}`;
  }
  e.layer.bindPopup(`<b>${info}</b>`);
  toast('Feature drawn', 'ok');
});

// ── Measure Tool ──
$('btnMeasure').onclick = () => {
  APP.measuring = !APP.measuring;
  $('btnMeasure').classList.toggle('on', APP.measuring);
  if (!APP.measuring) clearMeasure();
  map.getContainer().style.cursor = APP.measuring ? 'crosshair' : '';
};

map.on('click', (e) => {
  if (!APP.measuring) return;
  APP.mPts.push(e.latlng);
  APP.mMarkers.push(
    L.circleMarker(e.latlng, {
      radius: 4, color: '#d4b96a', fillColor: '#d4b96a',
      fillOpacity: 1, weight: 0
    }).addTo(map)
  );

  if (APP.mPts.length > 1) {
    if (APP.mLine) map.removeLayer(APP.mLine);
    APP.mLine = L.polyline(APP.mPts, {
      color: '#d4b96a', weight: 2, dashArray: '6 4'
    }).addTo(map);

    let dist = 0;
    for (let i = 1; i < APP.mPts.length; i++) {
      dist += APP.mPts[i - 1].distanceTo(APP.mPts[i]);
    }
    const label = dist > 1000
      ? (dist / 1000).toFixed(2) + ' km'
      : dist.toFixed(1) + ' m';
    setStatus('Distance: ' + label);
  }
});

function clearMeasure() {
  APP.mPts = [];
  APP.mMarkers.forEach(m => map.removeLayer(m));
  APP.mMarkers = [];
  if (APP.mLine) { map.removeLayer(APP.mLine); APP.mLine = null; }
  setStatus('');
}

// ── Buffer Analysis ──
function runBuffer() {
  const vectorLayers = APP.layers.filter(l => l.type !== 'wms');
  if (!vectorLayers.length) { toast('Load a point layer first', 'err'); return; }

  modal(`
    <h2>Buffer Analysis</h2>
    <p>Create buffer zones around point features</p>
    <label>Layer</label>
    <select id="bufLyr">${vectorLayers.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}</select>
    <label>Radius (meters)</label>
    <input id="bufR" type="number" value="1000" min="50">
    <div class="modal-foot">
      <button class="hbtn" onclick="closeModal()">Cancel</button>
      <button class="sm-btn" onclick="executeBuffer()">Create</button>
    </div>
  `);
}

function executeBuffer() {
  const l = APP.layers.find(x => x.id === +$('bufLyr').value);
  const radius = +$('bufR').value;
  if (!l) return;

  const group = L.layerGroup();
  let count = 0;
  l.layer.eachLayer(sub => {
    if (sub.getLatLng) {
      L.circle(sub.getLatLng(), {
        radius, color: '#d4b96a', fillColor: '#d4b96a',
        fillOpacity: 0.1, weight: 1
      }).addTo(group);
      count++;
    }
  });

  if (!count) { toast('No point features found', 'err'); closeModal(); return; }

  group.addTo(map);
  const id = ++APP.uid;
  APP.layers.push({
    id, name: l.name + ' buffer', layer: group,
    visible: true, style: { color: '#d4b96a' },
    featureCount: count, type: 'buffer'
  });
  refreshLayers();
  toast(`${count} buffers created`, 'ok');
  closeModal();
}

// ── Centroid Extraction ──
function runCentroid() {
  if (!APP.layers.length) { toast('Load a layer first', 'err'); return; }
  const l = APP.layers[APP.layers.length - 1];
  if (l.type === 'wms') { toast('Select a vector layer', 'err'); return; }

  const features = [];
  l.layer.eachLayer(sub => {
    if (!sub.feature) return;
    const bounds = sub.getBounds?.();
    if (bounds) {
      const center = bounds.getCenter();
      features.push({
        type: 'Feature',
        properties: { ...sub.feature.properties, source: l.name },
        geometry: { type: 'Point', coordinates: [center.lng, center.lat] }
      });
    }
  });

  if (!features.length) { toast('No features to compute centroids', 'err'); return; }
  addLayer({ type: 'FeatureCollection', features }, l.name + ' centroids');
}

// ── Bounding Box ──
function runBBox() {
  if (!APP.layers.length) { toast('Load a layer first', 'err'); return; }
  const l = APP.layers[APP.layers.length - 1];

  try {
    const bounds = l.layer.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const box = [
      [sw.lat, sw.lng], [ne.lat, sw.lng],
      [ne.lat, ne.lng], [sw.lat, ne.lng],
      [sw.lat, sw.lng]
    ];
    L.polygon(box, {
      color: '#6ebad9', fillColor: '#6ebad9',
      fillOpacity: 0.06, weight: 2, dashArray: '8 4'
    }).addTo(map).bindPopup(
      `<b>BBox: ${l.name}</b><br>` +
      `SW: ${sw.lat.toFixed(4)}, ${sw.lng.toFixed(4)}<br>` +
      `NE: ${ne.lat.toFixed(4)}, ${ne.lng.toFixed(4)}`
    );
    toast('Bounding box added', 'ok');
  } catch (e) {
    toast('Cannot compute bounds', 'err');
  }
}
