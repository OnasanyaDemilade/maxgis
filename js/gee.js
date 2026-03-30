/* ═══════════════════════════════════════
   MaxGIS — Google Earth Engine Integration
   
   NOTE: Full GEE requires a backend (Python/Node)
   to authenticate and run server-side analyses.
   
   This module provides:
   1. GEE tile layer integration (public datasets)
   2. Analysis request builder UI
   3. Integration with GEE Apps/REST endpoints
   
   For full functionality, deploy a companion
   GEE backend using earthengine-api.
   ═══════════════════════════════════════ */

// ── GEE Public Tile Layers ──
// These work without authentication via Google's public tile endpoints

const GEE_DATASETS = {
  'NDVI (Vegetation)': {
    tiles: 'https://earthengine.googleapis.com/v1/projects/earthengine-legacy/maps/{mapid}/tiles/{z}/{x}/{y}',
    description: 'Normalized Difference Vegetation Index from MODIS',
    analysis: 'ndvi'
  },
  'Land Cover (ESA)': {
    description: 'ESA WorldCover 10m land classification',
    analysis: 'landcover'
  },
  'Night Lights': {
    description: 'VIIRS nighttime lights composite',
    analysis: 'nightlights'
  },
  'Elevation (SRTM)': {
    description: 'Shuttle Radar Topography Mission 30m DEM',
    analysis: 'elevation'
  },
  'Surface Water': {
    description: 'JRC Global Surface Water occurrence',
    analysis: 'water'
  }
};

// ── GEE Analysis Modal ──
$('btnGEE').onclick = () => {
  modal(`
    <h2>Earth Engine Analysis</h2>
    <p>Run geospatial analysis using satellite data. Draw an area of interest on the map first, or select a loaded layer boundary.</p>

    <label>Analysis Type</label>
    <select id="geeAnalysis">
      <option value="lulc">Land Use / Land Cover Classification</option>
      <option value="ndvi">NDVI Vegetation Index</option>
      <option value="flood">Flood Vulnerability Assessment</option>
      <option value="urban">Urban Expansion Analysis</option>
      <option value="water">Surface Water Detection</option>
    </select>

    <label>Area of Interest</label>
    <select id="geeAOI">
      <option value="view">Current map view</option>
      <option value="drawn">Drawn features</option>
      ${APP.layers.filter(l => l.type === 'geojson').map(l =>
        `<option value="${l.id}">Layer: ${l.name}</option>`
      ).join('')}
    </select>

    <label>Year / Time Period</label>
    <select id="geeYear">
      <option value="2024">2024</option>
      <option value="2023">2023</option>
      <option value="2022">2022</option>
      <option value="2020">2020</option>
      <option value="2015">2015</option>
      <option value="2010">2010</option>
    </select>

    <div id="geeParams"></div>

    <div style="margin-top:12px;padding:10px;background:var(--surface2);border-radius:6px;font-size:11px;color:var(--dim)">
      <b style="color:var(--yellow)">How this works:</b><br>
      Option A: If you have a GEE backend running, enter its URL below and MaxGIS will send the analysis request to it.<br>
      Option B: Without a backend, MaxGIS will generate a GEE Python script you can run in Google Colab.
    </div>

    <label>GEE Backend URL (optional)</label>
    <input id="geeBackend" placeholder="https://your-gee-api.com/analyze" value="">

    <div class="modal-foot">
      <button class="hbtn" onclick="closeModal()">Cancel</button>
      <button class="sm-btn" onclick="generateGEEScript()">Generate Script</button>
      <button class="sm-btn" onclick="runGEEAnalysis()">Run Analysis</button>
    </div>
  `);

  // Show extra params for flood analysis
  $('geeAnalysis').onchange = () => {
    const type = $('geeAnalysis').value;
    let extra = '';
    if (type === 'flood') {
      extra = `
        <label>Rainfall Threshold (mm)</label>
        <input id="geeRainfall" type="number" value="100">
        <label>Elevation Threshold (m)</label>
        <input id="geeElevation" type="number" value="50">
      `;
    } else if (type === 'ndvi') {
      extra = `
        <label>Cloud Cover Max (%)</label>
        <input id="geeCloud" type="number" value="20">
      `;
    }
    $('geeParams').innerHTML = extra;
  };
};

// ── Get AOI as GeoJSON ──
function getAOI() {
  const sel = $('geeAOI').value;

  if (sel === 'view') {
    const bounds = map.getBounds();
    return {
      type: 'Polygon',
      coordinates: [[
        [bounds.getWest(), bounds.getSouth()],
        [bounds.getEast(), bounds.getSouth()],
        [bounds.getEast(), bounds.getNorth()],
        [bounds.getWest(), bounds.getNorth()],
        [bounds.getWest(), bounds.getSouth()]
      ]]
    };
  }

  if (sel === 'drawn') {
    const layers = drawnItems.getLayers();
    if (!layers.length) { toast('Draw an area on the map first', 'err'); return null; }
    return layers[0].toGeoJSON().geometry;
  }

  // Layer boundary
  const l = APP.layers.find(x => x.id === +sel);
  if (l) {
    const bounds = l.layer.getBounds();
    return {
      type: 'Polygon',
      coordinates: [[
        [bounds.getWest(), bounds.getSouth()],
        [bounds.getEast(), bounds.getSouth()],
        [bounds.getEast(), bounds.getNorth()],
        [bounds.getWest(), bounds.getNorth()],
        [bounds.getWest(), bounds.getSouth()]
      ]]
    };
  }
  return null;
}

// ── Generate Python Script for Google Colab ──
function generateGEEScript() {
  const type = $('geeAnalysis').value;
  const year = $('geeYear').value;
  const aoi = getAOI();
  if (!aoi) return;

  const aoiStr = JSON.stringify(aoi.coordinates);
  let script = `# Spectraforte Earth Engine Analysis Script\n`;
  script += `# Run this in Google Colab with: pip install earthengine-api\n\n`;
  script += `import ee\nee.Authenticate()\nee.Initialize(project='your-project-id')\n\n`;
  script += `aoi = ee.Geometry.Polygon(${aoiStr})\n\n`;

  switch (type) {
    case 'lulc':
      script += `# Land Use / Land Cover from ESA WorldCover\n`;
      script += `lulc = ee.ImageCollection('ESA/WorldCover/v200').first().clip(aoi)\n`;
      script += `# Classes: 10=Tree, 20=Shrub, 30=Grass, 40=Crop, 50=Built, 60=Bare, 80=Water\n\n`;
      script += `# Calculate area per class\n`;
      script += `area = ee.Image.pixelArea().addBands(lulc).reduceRegion(\n`;
      script += `    reducer=ee.Reducer.sum().group(groupField=1),\n`;
      script += `    geometry=aoi, scale=10, maxPixels=1e10\n`;
      script += `)\nprint(area.getInfo())\n`;
      break;

    case 'ndvi':
      script += `# NDVI from Sentinel-2\n`;
      script += `s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')\\\n`;
      script += `    .filterBounds(aoi).filterDate('${year}-01-01', '${year}-12-31')\\\n`;
      script += `    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))\n\n`;
      script += `ndvi = s2.median().normalizedDifference(['B8', 'B4']).rename('NDVI').clip(aoi)\n`;
      script += `# Export: ee.batch.Export.image.toDrive(ndvi, 'ndvi_export', region=aoi, scale=10)\n`;
      break;

    case 'flood':
      script += `# Flood Vulnerability Assessment\n`;
      script += `dem = ee.Image('USGS/SRTMGL1_003').clip(aoi)\n`;
      script += `slope = ee.Terrain.slope(dem)\n`;
      script += `water = ee.Image('JRC/GSW1_4/GlobalSurfaceWater').select('occurrence').clip(aoi)\n\n`;
      script += `# Low elevation + flat + near water = high vulnerability\n`;
      script += `elev_risk = dem.lt(${$('geeElevation')?.value || 50}).rename('elev_risk')\n`;
      script += `slope_risk = slope.lt(5).rename('slope_risk')\n`;
      script += `water_risk = water.gt(20).rename('water_risk')\n\n`;
      script += `vulnerability = elev_risk.add(slope_risk).add(water_risk).rename('flood_risk')\n`;
      script += `# 0=low, 1=moderate, 2=high, 3=very high\n`;
      break;

    case 'urban':
      script += `# Urban Expansion using built-up area\n`;
      script += `ghsl = ee.ImageCollection('JRC/GHSL/P2023A/GHS_BUILT_S')\n`;
      script += `built_old = ghsl.filter(ee.Filter.eq('system:index', '2000')).first().clip(aoi)\n`;
      script += `built_new = ghsl.filter(ee.Filter.eq('system:index', '${year}')).first().clip(aoi)\n`;
      script += `expansion = built_new.subtract(built_old).rename('urban_growth')\n`;
      break;

    case 'water':
      script += `# Surface Water Detection\n`;
      script += `water = ee.Image('JRC/GSW1_4/GlobalSurfaceWater')\n`;
      script += `occurrence = water.select('occurrence').clip(aoi)\n`;
      script += `change = water.select('change_abs').clip(aoi)\n`;
      break;
  }

  script += `\n# To export results as GeoJSON for Spectraforte:\n`;
  script += `# Save to Drive, download, then import into MaxGIS\n`;

  // Download the script
  downloadFile(script, `maxgis_${type}_analysis.py`, 'text/x-python');
  toast('Python script downloaded — run in Google Colab', 'ok');
  closeModal();
}

// ── Run via Backend API ──
async function runGEEAnalysis() {
  const backend = $('geeBackend').value.trim();
  if (!backend) {
    toast('No backend URL — use "Generate Script" for Colab instead', 'err');
    return;
  }

  const aoi = getAOI();
  if (!aoi) return;

  const payload = {
    analysis: $('geeAnalysis').value,
    year: $('geeYear').value,
    aoi: aoi,
    params: {}
  };

  // Collect extra params
  if ($('geeRainfall')) payload.params.rainfall = +$('geeRainfall').value;
  if ($('geeElevation')) payload.params.elevation = +$('geeElevation').value;
  if ($('geeCloud')) payload.params.cloudCover = +$('geeCloud').value;

  setStatus('Running GEE analysis…');
  try {
    const res = await fetch(backend, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (result.tileUrl) {
      // Add as tile layer
      const tile = L.tileLayer(result.tileUrl, { opacity: 0.7 }).addTo(map);
      const id = ++APP.uid;
      APP.layers.push({
        id, name: `GEE: ${$('geeAnalysis').value}`,
        layer: tile, visible: true,
        style: { color: '#22d3ee' }, featureCount: 0, type: 'gee'
      });
      refreshLayers();
    }

    if (result.geojson) {
      addLayer(result.geojson, `GEE: ${$('geeAnalysis').value} Result`);
    }

    if (result.stats) {
      console.log('GEE Stats:', result.stats);
    }

    toast('GEE analysis complete', 'ok');
  } catch (e) {
    toast('GEE backend error: ' + e.message, 'err');
  }
  setStatus('');
  closeModal();
}
