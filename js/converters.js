/* ═══════════════════════════════════════
   MaxGIS — File Format Converters
   Handles: GeoJSON, KML, GPX, CSV, Shapefile
   ═══════════════════════════════════════ */

// ── KML → GeoJSON ──
function kml2geojson(kmlString) {
  const doc = new DOMParser().parseFromString(kmlString, 'text/xml');
  const features = [];

  doc.querySelectorAll('Placemark').forEach(pm => {
    const name = pm.querySelector('name')?.textContent || '';
    const desc = pm.querySelector('description')?.textContent || '';
    const pt = pm.querySelector('Point coordinates');
    const ln = pm.querySelector('LineString coordinates');
    const pg = pm.querySelector('Polygon outerBoundaryIs LinearRing coordinates');

    let geometry = null;
    if (pt) {
      const [x, y] = pt.textContent.trim().split(',').map(Number);
      geometry = { type: 'Point', coordinates: [x, y] };
    } else if (ln) {
      const coords = ln.textContent.trim().split(/\s+/).map(c => {
        const p = c.split(',').map(Number);
        return [p[0], p[1]];
      });
      geometry = { type: 'LineString', coordinates: coords };
    } else if (pg) {
      const coords = pg.textContent.trim().split(/\s+/).map(c => {
        const p = c.split(',').map(Number);
        return [p[0], p[1]];
      });
      geometry = { type: 'Polygon', coordinates: [coords] };
    }

    if (geometry) {
      features.push({
        type: 'Feature',
        properties: { name, description: desc },
        geometry
      });
    }
  });

  return { type: 'FeatureCollection', features };
}

// ── GPX → GeoJSON ──
function gpx2geojson(gpxString) {
  const doc = new DOMParser().parseFromString(gpxString, 'text/xml');
  const features = [];

  // Waypoints
  doc.querySelectorAll('wpt').forEach(w => {
    features.push({
      type: 'Feature',
      properties: { name: w.querySelector('name')?.textContent || 'Waypoint' },
      geometry: {
        type: 'Point',
        coordinates: [+w.getAttribute('lon'), +w.getAttribute('lat')]
      }
    });
  });

  // Tracks
  doc.querySelectorAll('trk').forEach(t => {
    const name = t.querySelector('name')?.textContent || 'Track';
    t.querySelectorAll('trkseg').forEach(seg => {
      const coords = Array.from(seg.querySelectorAll('trkpt')).map(p =>
        [+p.getAttribute('lon'), +p.getAttribute('lat')]
      );
      if (coords.length) {
        features.push({
          type: 'Feature',
          properties: { name },
          geometry: { type: 'LineString', coordinates: coords }
        });
      }
    });
  });

  // Routes
  doc.querySelectorAll('rte').forEach(r => {
    const name = r.querySelector('name')?.textContent || 'Route';
    const coords = Array.from(r.querySelectorAll('rtept')).map(p =>
      [+p.getAttribute('lon'), +p.getAttribute('lat')]
    );
    if (coords.length) {
      features.push({
        type: 'Feature',
        properties: { name },
        geometry: { type: 'LineString', coordinates: coords }
      });
    }
  });

  return { type: 'FeatureCollection', features };
}

// ── CSV → GeoJSON ──
function csv2geojson(csvString) {
  const lines = csvString.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
  const headersLower = headers.map(h => h.toLowerCase());

  const latIdx = headersLower.findIndex(h => /^(lat|latitude|y)$/.test(h));
  const lngIdx = headersLower.findIndex(h => /^(lon|lng|longitude|long|x)$/.test(h));

  if (latIdx === -1 || lngIdx === -1) {
    throw new Error('CSV must contain lat/latitude/y and lon/longitude/lng/x columns');
  }

  const features = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    // Handle quoted CSV fields
    const vals = parseCSVLine(lines[i]);
    const lat = parseFloat(vals[latIdx]);
    const lng = parseFloat(vals[lngIdx]);
    if (isNaN(lat) || isNaN(lng)) continue;

    const props = {};
    headers.forEach((h, j) => {
      if (j !== latIdx && j !== lngIdx) {
        props[h] = isNaN(vals[j]) ? vals[j] : +vals[j];
      }
    });

    features.push({
      type: 'Feature',
      properties: props,
      geometry: { type: 'Point', coordinates: [lng, lat] }
    });
  }

  return { type: 'FeatureCollection', features };
}

// Handle quoted CSV fields properly
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// ══════════════════════════════════════════
//  GeoJSON → Other Formats (Export)
// ══════════════════════════════════════════

// ── GeoJSON → KML ──
function geojson2kml(geojson) {
  let kml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  kml += '<kml xmlns="http://www.opengis.net/kml/2.2">\n<Document>\n';
  kml += '  <name>MaxGIS Export</name>\n';

  const features = geojson.features || [];
  features.forEach((f, i) => {
    const name = f.properties?.name || `Feature ${i + 1}`;
    const desc = f.properties?.description || '';
    kml += `  <Placemark>\n    <name>${escapeXml(name)}</name>\n`;
    if (desc) kml += `    <description>${escapeXml(desc)}</description>\n`;

    const geom = f.geometry;
    if (geom.type === 'Point') {
      kml += `    <Point><coordinates>${geom.coordinates[0]},${geom.coordinates[1]},0</coordinates></Point>\n`;
    } else if (geom.type === 'LineString') {
      kml += '    <LineString><coordinates>\n';
      kml += geom.coordinates.map(c => `      ${c[0]},${c[1]},0`).join('\n');
      kml += '\n    </coordinates></LineString>\n';
    } else if (geom.type === 'Polygon') {
      kml += '    <Polygon><outerBoundaryIs><LinearRing><coordinates>\n';
      kml += geom.coordinates[0].map(c => `      ${c[0]},${c[1]},0`).join('\n');
      kml += '\n    </coordinates></LinearRing></outerBoundaryIs></Polygon>\n';
    }
    kml += '  </Placemark>\n';
  });

  kml += '</Document>\n</kml>';
  return kml;
}

// ── GeoJSON → GPX ──
function geojson2gpx(geojson) {
  let gpx = '<?xml version="1.0" encoding="UTF-8"?>\n';
  gpx += '<gpx version="1.1" creator="MaxGIS" xmlns="http://www.topografix.com/GPX/1/1">\n';

  const features = geojson.features || [];
  features.forEach((f, i) => {
    const name = f.properties?.name || `Feature ${i + 1}`;
    const geom = f.geometry;

    if (geom.type === 'Point') {
      gpx += `  <wpt lat="${geom.coordinates[1]}" lon="${geom.coordinates[0]}">\n`;
      gpx += `    <name>${escapeXml(name)}</name>\n  </wpt>\n`;
    } else if (geom.type === 'LineString') {
      gpx += `  <trk>\n    <name>${escapeXml(name)}</name>\n    <trkseg>\n`;
      geom.coordinates.forEach(c => {
        gpx += `      <trkpt lat="${c[1]}" lon="${c[0]}"></trkpt>\n`;
      });
      gpx += '    </trkseg>\n  </trk>\n';
    }
  });

  gpx += '</gpx>';
  return gpx;
}

// ── GeoJSON → CSV ──
function geojson2csv(geojson) {
  const features = geojson.features || [];
  if (!features.length) return '';

  const allKeys = [...new Set(features.flatMap(f => Object.keys(f.properties || {})))];
  const headers = ['latitude', 'longitude', ...allKeys];

  let csv = headers.join(',') + '\n';
  features.forEach(f => {
    const geom = f.geometry;
    let lat = '', lng = '';
    if (geom.type === 'Point') {
      lat = geom.coordinates[1];
      lng = geom.coordinates[0];
    } else if (geom.type === 'Polygon' || geom.type === 'LineString') {
      // Use centroid
      const coords = geom.type === 'Polygon' ? geom.coordinates[0] : geom.coordinates;
      lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
      lng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
    }

    const vals = [lat, lng, ...allKeys.map(k => {
      const v = f.properties?.[k] ?? '';
      return String(v).includes(',') ? `"${v}"` : v;
    })];
    csv += vals.join(',') + '\n';
  });

  return csv;
}

// ── GeoJSON → Shapefile (using shp-write via CDN) ──
// Note: Requires shp-write library loaded separately
// Fallback: export as zipped GeoJSON
function geojson2shapefile(geojson) {
  if (typeof shpwrite !== 'undefined') {
    return shpwrite.zip(geojson);
  }
  // Fallback: wrap GeoJSON in a zip-like blob
  toast('Shapefile export requires shp-write library. Exporting as GeoJSON instead.', 'err');
  return null;
}

// ── XML Escape Helper ──
function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
