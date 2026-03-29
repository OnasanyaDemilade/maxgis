/* ═══════════════════════════════════════
   MaxGIS — Live Map Sharing System
   
   Creates shareable links that encode:
   - Map center & zoom
   - Basemap selection
   - Loaded data URLs
   - Cloud-stored data references
   
   For real-time collaboration, uses
   URL hash state + JSONBin for data.
   ═══════════════════════════════════════ */

$('btnShare').onclick = () => {
  modal(`
    <h2>Share Map</h2>
    <p>Create a shareable link to your current map session</p>

    <div style="margin-bottom:14px">
      <h3 style="font-size:13px;color:var(--accent-bright);margin-bottom:6px">Quick Link (View Only)</h3>
      <p style="font-size:11px;color:var(--dim);margin-bottom:8px">
        Shares your current map position, basemap, and theme. Viewers see the same map location.
      </p>
      <div class="url-row">
        <input id="shareViewLink" readonly style="font-size:11px">
        <button class="sm-btn" onclick="copyShareLink('shareViewLink')">Copy</button>
      </div>
    </div>

    <div style="border-top:1px solid var(--border);padding-top:14px;margin-bottom:14px">
      <h3 style="font-size:13px;color:var(--accent-bright);margin-bottom:6px">Share with Data</h3>
      <p style="font-size:11px;color:var(--dim);margin-bottom:8px">
        Saves all your layers to the cloud and generates a link that loads them for the viewer.
      </p>
      <button class="sm-btn" onclick="shareWithData()">Generate Data Link</button>
      <div class="url-row" style="margin-top:6px">
        <input id="shareDataLink" readonly placeholder="Click above to generate…" style="font-size:11px">
        <button class="sm-btn" onclick="copyShareLink('shareDataLink')">Copy</button>
      </div>
    </div>

    <div style="border-top:1px solid var(--border);padding-top:14px">
      <h3 style="font-size:13px;color:var(--accent-bright);margin-bottom:6px">Embed Map</h3>
      <p style="font-size:11px;color:var(--dim);margin-bottom:8px">
        Get an iframe embed code for websites and blogs.
      </p>
      <div class="url-row">
        <input id="shareEmbed" readonly style="font-size:10px">
        <button class="sm-btn" onclick="copyShareLink('shareEmbed')">Copy</button>
      </div>
    </div>

    <div class="modal-foot">
      <button class="hbtn" onclick="closeModal()">Close</button>
    </div>
  `);

  // Generate view-only link
  generateViewLink();
  generateEmbedCode();
};

function generateViewLink() {
  const center = map.getCenter();
  const zoom = map.getZoom();
  const base = encodeURIComponent(APP.basemap);
  const theme = APP.theme;

  const params = new URLSearchParams({
    lat: center.lat.toFixed(5),
    lng: center.lng.toFixed(5),
    z: zoom,
    bm: base,
    t: theme
  });

  const url = `${window.location.origin}${window.location.pathname}?${params}`;
  if ($('shareViewLink')) $('shareViewLink').value = url;
}

async function shareWithData() {
  const features = [];
  APP.layers.forEach(l => {
    if (l.type === 'geojson') {
      l.layer.eachLayer(sub => {
        if (sub.feature) features.push(sub.feature);
      });
    }
  });

  if (!features.length) {
    toast('No vector data to share', 'err');
    return;
  }

  const center = map.getCenter();
  const payload = {
    type: 'FeatureCollection',
    features,
    _maxgis: {
      center: [center.lat, center.lng],
      zoom: map.getZoom(),
      basemap: APP.basemap,
      theme: APP.theme,
      sharedAt: new Date().toISOString()
    }
  };

  setStatus('Uploading data…');
  try {
    const res = await fetch('https://api.jsonbin.io/v3/b', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.metadata?.id) {
      const url = `${window.location.origin}${window.location.pathname}?bin=${data.metadata.id}`;
      if ($('shareDataLink')) $('shareDataLink').value = url;
      toast('Share link generated!', 'ok');
    }
  } catch (e) {
    toast('Upload failed: ' + e.message, 'err');
  }
  setStatus('');
}

function generateEmbedCode() {
  const center = map.getCenter();
  const params = `lat=${center.lat.toFixed(4)}&lng=${center.lng.toFixed(4)}&z=${map.getZoom()}&t=${APP.theme}`;
  const url = `${window.location.origin}${window.location.pathname}?${params}`;
  const embed = `<iframe src="${url}" width="800" height="500" style="border:1px solid #ccc;border-radius:8px" allowfullscreen></iframe>`;
  if ($('shareEmbed')) $('shareEmbed').value = embed;
}

function copyShareLink(inputId) {
  const input = $(inputId);
  if (!input?.value) { toast('Nothing to copy', 'err'); return; }
  navigator.clipboard.writeText(input.value)
    .then(() => toast('Copied to clipboard!', 'ok'))
    .catch(() => {
      input.select();
      document.execCommand('copy');
      toast('Copied!', 'ok');
    });
}

// ═══════════════════════════════════════
//  Restore shared state from URL params
// ═══════════════════════════════════════
(function restoreSharedState() {
  const params = new URLSearchParams(window.location.search);

  // Restore map position
  const lat = parseFloat(params.get('lat'));
  const lng = parseFloat(params.get('lng'));
  const zoom = parseInt(params.get('z'));
  if (!isNaN(lat) && !isNaN(lng)) {
    map.setView([lat, lng], isNaN(zoom) ? 10 : zoom);
  }

  // Restore basemap
  const bm = params.get('bm');
  if (bm) {
    const decoded = decodeURIComponent(bm);
    if (BASEMAPS[decoded]) {
      switchBasemap(decoded);
    }
  }

  // Restore theme
  const theme = params.get('t');
  if (theme === 'light' || theme === 'dark') {
    APP.theme = theme;
    document.body.setAttribute('data-theme', theme);
  }
})();
