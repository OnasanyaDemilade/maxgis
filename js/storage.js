/* ═══════════════════════════════════════
   MaxGIS — Cloud Storage Integration
   Uses Google Drive Picker API or
   jsonbin.io as free alternative
   ═══════════════════════════════════════ */

// ═══════════════════════════════════════
//  OPTION 1: JSONBin.io (Free, no auth)
//  Great for storing/sharing GeoJSON
// ═══════════════════════════════════════

const JSONBIN_API = 'https://api.jsonbin.io/v3';

// Save current layers to JSONBin (free tier, no key needed for public bins)
async function saveToCloud() {
  const features = [];
  APP.layers.forEach(l => {
    if (l.type === 'geojson') {
      l.layer.eachLayer(sub => {
        if (sub.feature) features.push(sub.feature);
      });
    }
  });

  if (!features.length) {
    toast('No layers to save', 'err');
    return;
  }

  const payload = {
    type: 'FeatureCollection',
    features,
    _maxgis: {
      savedAt: new Date().toISOString(),
      layerCount: APP.layers.length,
      center: [map.getCenter().lat, map.getCenter().lng],
      zoom: map.getZoom()
    }
  };

  setStatus('Saving to cloud…');
  try {
    const res = await fetch(JSONBIN_API + '/b', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.metadata?.id) {
      const binId = data.metadata.id;
      const shareUrl = `${window.location.origin}${window.location.pathname}?bin=${binId}`;
      prompt('Data saved! Share this link to load your data anywhere:', shareUrl);
      toast('Saved to cloud', 'ok');
    }
  } catch (e) {
    toast('Cloud save failed: ' + e.message, 'err');
  }
  setStatus('');
}

// Load from JSONBin by ID
async function loadFromCloud(binId) {
  setStatus('Loading from cloud…');
  try {
    const res = await fetch(`${JSONBIN_API}/b/${binId}/latest`);
    const data = await res.json();
    const record = data.record;

    if (record?.type === 'FeatureCollection') {
      addLayer(record, 'Cloud Data');
      // Restore view if saved
      if (record._maxgis?.center) {
        map.setView(record._maxgis.center, record._maxgis.zoom || 10);
      }
      toast('Loaded from cloud', 'ok');
    }
  } catch (e) {
    toast('Cloud load failed: ' + e.message, 'err');
  }
  setStatus('');
}

// ═══════════════════════════════════════
//  OPTION 2: Google Drive Picker
//  (Requires Google API key setup)
// ═══════════════════════════════════════

$('btnGDrive').onclick = () => {
  modal(`
    <h2>Cloud Storage</h2>
    <p>Save your data to the cloud or load from a shared link</p>

    <div style="margin-bottom:16px">
      <h3 style="font-size:13px;color:var(--accent-bright);margin-bottom:8px">Save Current Layers</h3>
      <p style="font-size:11px">Saves all your loaded vector layers to a free cloud bin.
      You get a shareable link to load the data from any browser.</p>
      <button class="sm-btn" onclick="saveToCloud(); closeModal();" style="margin-top:6px">
        Save to Cloud
      </button>
    </div>

    <div style="border-top:1px solid var(--border);padding-top:16px">
      <h3 style="font-size:13px;color:var(--accent-bright);margin-bottom:8px">Load from Cloud</h3>
      <label>Bin ID or Full URL</label>
      <input id="cloudBinId" placeholder="Paste bin ID or MaxGIS share link">
      <div class="modal-foot" style="margin-top:10px">
        <button class="hbtn" onclick="closeModal()">Cancel</button>
        <button class="sm-btn" onclick="loadCloudFromInput()">Load</button>
      </div>
    </div>

    <div style="border-top:1px solid var(--border);padding-top:16px;margin-top:16px">
      <h3 style="font-size:13px;color:var(--accent-bright);margin-bottom:8px">Google Drive (Public Files)</h3>
      <p style="font-size:11px">Paste a Google Drive share link to a GeoJSON file.
      The file must be shared as "Anyone with the link can view".</p>
      <label>Google Drive Share Link</label>
      <input id="gdriveUrl" placeholder="https://drive.google.com/file/d/...">
      <div class="modal-foot" style="margin-top:10px">
        <button class="sm-btn" onclick="loadFromGDrive()">Load from Drive</button>
      </div>
    </div>
  `);
};

function loadCloudFromInput() {
  let val = $('cloudBinId').value.trim();
  // Extract bin ID from URL if needed
  const match = val.match(/[?&]bin=([a-f0-9]+)/i);
  if (match) val = match[1];
  if (!val) { toast('Enter a bin ID', 'err'); return; }
  loadFromCloud(val);
  closeModal();
}

function loadFromGDrive() {
  const url = $('gdriveUrl').value.trim();
  if (!url) { toast('Enter a Google Drive link', 'err'); return; }

  // Extract file ID from Google Drive URL
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) { toast('Invalid Google Drive URL', 'err'); return; }

  const fileId = match[1];
  const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

  setStatus('Loading from Google Drive…');
  fetch(directUrl)
    .then(r => r.text())
    .then(text => {
      const geojson = JSON.parse(text);
      addLayer(geojson, 'Google Drive Data');
      setStatus('');
      closeModal();
    })
    .catch(e => {
      toast('Failed to load from Drive: ' + e.message, 'err');
      setStatus('');
    });
}

// ═══════════════════════════════════════
//  Auto-load from URL parameter
// ═══════════════════════════════════════
(function checkUrlParams() {
  const params = new URLSearchParams(window.location.search);

  // Load from cloud bin
  const binId = params.get('bin');
  if (binId) loadFromCloud(binId);

  // Load from direct GeoJSON URL
  const dataUrl = params.get('data');
  if (dataUrl) {
    fetch(dataUrl)
      .then(r => r.json())
      .then(gj => addLayer(gj, 'Linked Data'))
      .catch(e => console.error('URL data load failed:', e));
  }
})();
