/* ═══════════════════════════════════════
   Spectraforte — Enhanced Data Dashboard
   Chart type control, color editing, PNG export
   ═══════════════════════════════════════ */

let dashCharts = [];

$('btnDash').onclick = () => toggleDashboard();
$('btnCloseDash').onclick = () => toggleDashboard();

function toggleDashboard() {
  APP.dashOpen = !APP.dashOpen;
  $('dashPanel').classList.toggle('open', APP.dashOpen);
  $('btnDash').classList.toggle('on', APP.dashOpen);
}

if ($('dashLayerSel')) {
  $('dashLayerSel').onchange = () => buildDashboard();
}

function buildDashboard() {
  const layerId = +$('dashLayerSel').value;
  const layer = APP.layers.find(l => l.id === layerId);
  const body = $('dashBody');

  dashCharts.forEach(c => c.destroy());
  dashCharts = [];

  if (!layer?.data?.features?.length) {
    body.innerHTML = '<div class="empty-msg">Select a layer with data to visualise</div>';
    return;
  }

  const features = layer.data.features;
  const allProps = [...new Set(features.flatMap(f => Object.keys(f.properties || {})))];

  const numericFields = [];
  const catFields = [];
  allProps.forEach(key => {
    const samples = features.slice(0, 30).map(f => f.properties?.[key]).filter(v => v != null);
    const numCount = samples.filter(v => !isNaN(+v) && v !== '').length;
    if (numCount > samples.length * 0.6) numericFields.push(key);
    else catFields.push(key);
  });

  const fieldOpts = (fields) => fields.map(f => `<option value="${f}">${f}</option>`).join('');

  let html = '';

  // ── Summary Stats ──
  html += '<div class="stat-grid">';
  html += `<div class="stat-card"><div class="val">${features.length}</div><div class="lbl">Features</div></div>`;
  html += `<div class="stat-card"><div class="val">${allProps.length}</div><div class="lbl">Fields</div></div>`;
  if (numericFields.length) {
    const vals = features.map(f => +f.properties?.[numericFields[0]]).filter(v => !isNaN(v));
    const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : 'N/A';
    const sum = vals.reduce((a, b) => a + b, 0);
    html += `<div class="stat-card"><div class="val">${avg}</div><div class="lbl">Avg ${numericFields[0]}</div></div>`;
    html += `<div class="stat-card"><div class="val">${sum > 1e6 ? (sum/1e6).toFixed(1)+'M' : sum > 1000 ? (sum/1000).toFixed(1)+'K' : sum.toFixed(0)}</div><div class="lbl">Sum ${numericFields[0]}</div></div>`;
  }
  html += '</div>';

  // ── Chart 1: Category distribution ──
  if (catFields.length) {
    html += buildChartCard('chart1', 'Category Distribution', {
      chartTypes: ['doughnut', 'pie', 'bar', 'polarArea'],
      catFields, numericFields, defaultCat: catFields[0], defaultType: 'doughnut'
    });
  }

  // ── Chart 2: Numeric by category ──
  if (numericFields.length && catFields.length) {
    html += buildChartCard('chart2', 'Numeric by Category', {
      chartTypes: ['bar', 'line', 'radar'],
      catFields, numericFields, defaultCat: catFields[0], defaultNum: numericFields[0], defaultType: 'bar'
    });
  }

  // ── Chart 3: Histogram ──
  if (numericFields.length) {
    html += buildChartCard('chart3', 'Distribution', {
      chartTypes: ['bar', 'line'],
      numericFields, defaultNum: numericFields[0], defaultType: 'bar', isHist: true
    });
  }

  // ── Chart 4: Scatter ──
  if (numericFields.length >= 2) {
    html += buildChartCard('chart4', 'Scatter Plot', {
      chartTypes: ['scatter', 'bubble'],
      numericFields, defaultX: numericFields[0], defaultY: numericFields[1], defaultType: 'scatter'
    });
  }

  body.innerHTML = html;

  // Render all charts
  if (catFields.length) renderChart1(features, catFields, numericFields);
  if (numericFields.length && catFields.length) renderChart2(features, catFields, numericFields);
  if (numericFields.length) renderChart3(features, numericFields);
  if (numericFields.length >= 2) renderChart4(features, numericFields);
}

function buildChartCard(id, title, opts) {
  const typeOpts = opts.chartTypes.map(t => `<option value="${t}" ${t === opts.defaultType ? 'selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('');
  const catSel = opts.catFields ? `<select id="${id}_cat" class="dash-ctrl" onchange="refreshChart('${id}')">${opts.catFields.map(f => `<option value="${f}" ${f === opts.defaultCat ? 'selected' : ''}>${f}</option>`).join('')}</select>` : '';
  const numSel = opts.numericFields ? `<select id="${id}_num" class="dash-ctrl" onchange="refreshChart('${id}')">${opts.numericFields.map(f => `<option value="${f}" ${f === (opts.defaultNum || opts.defaultX) ? 'selected' : ''}>${f}</option>`).join('')}</select>` : '';
  const numSel2 = (opts.defaultY) ? `<select id="${id}_num2" class="dash-ctrl" onchange="refreshChart('${id}')">${opts.numericFields.map(f => `<option value="${f}" ${f === opts.defaultY ? 'selected' : ''}>${f}</option>`).join('')}</select>` : '';

  return `
    <div class="chart-card" id="${id}_card">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;flex-wrap:wrap">
        <h4 style="flex:1;margin:0">${title}</h4>
        <select id="${id}_type" class="dash-ctrl" onchange="refreshChart('${id}')">${typeOpts}</select>
        ${catSel}${numSel}${numSel2}
        <input type="color" id="${id}_color" value="#4FC3F7" class="dash-color" onchange="refreshChart('${id}')" title="Chart color">
        <button class="lbtn" onclick="exportChart('${id}')" title="Export as PNG" style="font-size:11px">📥</button>
      </div>
      <canvas id="${id}"></canvas>
    </div>`;
}

// ── Chart Theme ──
function chartColors() {
  const dark = APP.theme === 'dark';
  return {
    text: dark ? '#B0BEC5' : '#37474F',
    grid: dark ? 'rgba(100,181,246,0.08)' : 'rgba(0,0,0,0.06)',
    palette: ['#4FC3F7', '#4CAF50', '#FF9800', '#EF5350', '#AB47BC', '#26C6DA', '#FF7043', '#66BB6A', '#42A5F5', '#FFA726']
  };
}

// ── Export Chart as PNG ──
function exportChart(id) {
  const canvas = $(id);
  if (!canvas) { toast('Chart not found', 'err'); return; }

  // Create a new canvas with white/dark background
  const w = canvas.width;
  const h = canvas.height;
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = w;
  exportCanvas.height = h;
  const ctx = exportCanvas.getContext('2d');

  // Background
  ctx.fillStyle = APP.theme === 'dark' ? '#1E1E1E' : '#FFFFFF';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(canvas, 0, 0);

  const link = document.createElement('a');
  link.download = `spectraforte_${id}_${Date.now()}.png`;
  link.href = exportCanvas.toDataURL('image/png');
  link.click();
  toast('Chart exported as PNG', 'ok');
}

// ── Export All Dashboard as PNG ──
function exportAllDashboard() {
  const body = $('dashBody');
  if (!body) return;
  const canvases = body.querySelectorAll('canvas');
  canvases.forEach((c, i) => {
    setTimeout(() => {
      const exp = document.createElement('canvas');
      exp.width = c.width; exp.height = c.height;
      const ctx = exp.getContext('2d');
      ctx.fillStyle = APP.theme === 'dark' ? '#1E1E1E' : '#FFFFFF';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(c, 0, 0);
      const link = document.createElement('a');
      link.download = `spectraforte_chart${i + 1}_${Date.now()}.png`;
      link.href = exp.toDataURL('image/png');
      link.click();
    }, i * 300);
  });
  toast(`Exporting ${canvases.length} charts`, 'ok');
}

// ── Refresh a specific chart ──
function refreshChart(id) {
  const layerId = +$('dashLayerSel').value;
  const layer = APP.layers.find(l => l.id === layerId);
  if (!layer?.data?.features) return;
  const features = layer.data.features;
  const allProps = [...new Set(features.flatMap(f => Object.keys(f.properties || {})))];
  const numericFields = [];
  const catFields = [];
  allProps.forEach(key => {
    const samples = features.slice(0, 30).map(f => f.properties?.[key]).filter(v => v != null);
    if (samples.filter(v => !isNaN(+v) && v !== '').length > samples.length * 0.6) numericFields.push(key);
    else catFields.push(key);
  });

  // Destroy existing chart for this canvas
  dashCharts = dashCharts.filter(c => {
    if (c.canvas?.id === id) { c.destroy(); return false; }
    return true;
  });

  if (id === 'chart1') renderChart1(features, catFields, numericFields);
  if (id === 'chart2') renderChart2(features, catFields, numericFields);
  if (id === 'chart3') renderChart3(features, numericFields);
  if (id === 'chart4') renderChart4(features, numericFields);
}

// ══════════════════════════════════════
//  Individual Chart Renderers
// ══════════════════════════════════════

function renderChart1(features, catFields, numericFields) {
  const canvas = $('chart1');
  if (!canvas) return;
  const type = $('chart1_type')?.value || 'doughnut';
  const catField = $('chart1_cat')?.value || catFields[0];
  const userColor = $('chart1_color')?.value || '#4FC3F7';
  const colors = chartColors();

  const counts = {};
  features.forEach(f => {
    const val = f.properties?.[catField] || 'Unknown';
    counts[val] = (counts[val] || 0) + 1;
  });
  const labels = Object.keys(counts).slice(0, 12);
  const data = labels.map(l => counts[l]);

  // Generate palette from user color
  const pal = generatePalette(userColor, labels.length);

  Chart.defaults.color = colors.text;
  Chart.defaults.borderColor = colors.grid;

  const chart = new Chart(canvas, {
    type: type,
    data: {
      labels,
      datasets: [{ data, backgroundColor: pal, borderWidth: type === 'bar' ? 1 : 0, borderColor: userColor }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 6, font: { size: 10 } } } },
      scales: type === 'bar' ? { y: { beginAtZero: true } } : {}
    }
  });
  dashCharts.push(chart);
}

function renderChart2(features, catFields, numericFields) {
  const canvas = $('chart2');
  if (!canvas) return;
  const type = $('chart2_type')?.value || 'bar';
  const catField = $('chart2_cat')?.value || catFields[0];
  const numField = $('chart2_num')?.value || numericFields[0];
  const userColor = $('chart2_color')?.value || '#4FC3F7';
  const colors = chartColors();

  const grouped = {};
  features.forEach(f => {
    const cat = f.properties?.[catField] || 'Unknown';
    const val = +f.properties?.[numField];
    if (isNaN(val)) return;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(val);
  });
  const labels = Object.keys(grouped).slice(0, 15);
  const data = labels.map(l => {
    const arr = grouped[l];
    return +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2);
  });

  Chart.defaults.color = colors.text;
  Chart.defaults.borderColor = colors.grid;

  const chart = new Chart(canvas, {
    type: type,
    data: {
      labels,
      datasets: [{
        label: 'Avg ' + numField,
        data,
        backgroundColor: userColor + '99',
        borderColor: userColor,
        borderWidth: type === 'line' ? 2 : 1,
        fill: type === 'line' ? true : undefined,
        tension: 0.3,
        pointRadius: type === 'line' ? 3 : undefined
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: type !== 'radar' ? {
        x: { ticks: { maxRotation: 45, font: { size: 9 } } },
        y: { beginAtZero: true }
      } : {}
    }
  });
  dashCharts.push(chart);
}

function renderChart3(features, numericFields) {
  const canvas = $('chart3');
  if (!canvas) return;
  const type = $('chart3_type')?.value || 'bar';
  const numField = $('chart3_num')?.value || numericFields[0];
  const userColor = $('chart3_color')?.value || '#4FC3F7';
  const colors = chartColors();

  const vals = features.map(f => +f.properties?.[numField]).filter(v => !isNaN(v));
  if (!vals.length) return;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const binCount = Math.min(15, Math.ceil(Math.sqrt(vals.length)));
  const binSize = (max - min) / binCount || 1;
  const bins = Array(binCount).fill(0);
  vals.forEach(v => {
    const idx = Math.min(Math.floor((v - min) / binSize), binCount - 1);
    bins[idx]++;
  });
  const labels = bins.map((_, i) => (min + i * binSize).toFixed(1));

  Chart.defaults.color = colors.text;
  Chart.defaults.borderColor = colors.grid;

  const chart = new Chart(canvas, {
    type: type,
    data: {
      labels,
      datasets: [{
        label: numField,
        data: bins,
        backgroundColor: userColor + '80',
        borderColor: userColor,
        borderWidth: type === 'line' ? 2 : 1,
        fill: type === 'line',
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
  dashCharts.push(chart);
}

function renderChart4(features, numericFields) {
  const canvas = $('chart4');
  if (!canvas) return;
  const type = $('chart4_type')?.value || 'scatter';
  const xField = $('chart4_num')?.value || numericFields[0];
  const yField = $('chart4_num2')?.value || numericFields[1];
  const userColor = $('chart4_color')?.value || '#4FC3F7';
  const colors = chartColors();

  const data = features.map(f => ({
    x: +f.properties?.[xField],
    y: +f.properties?.[yField],
    r: type === 'bubble' ? 5 : undefined
  })).filter(d => !isNaN(d.x) && !isNaN(d.y)).slice(0, 500);

  Chart.defaults.color = colors.text;
  Chart.defaults.borderColor = colors.grid;

  const chart = new Chart(canvas, {
    type: type,
    data: {
      datasets: [{
        label: `${xField} vs ${yField}`,
        data,
        backgroundColor: userColor + '80',
        borderColor: userColor,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: xField, font: { size: 11 } } },
        y: { title: { display: true, text: yField, font: { size: 11 } } }
      }
    }
  });
  dashCharts.push(chart);
}

// ── Generate color palette from a base color ──
function generatePalette(hex, count) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const palette = [];
  for (let i = 0; i < count; i++) {
    const hueShift = (i * (360 / Math.max(count, 1))) % 360;
    const nr = Math.round((r + hueShift * 0.7) % 256);
    const ng = Math.round((g + hueShift * 1.1) % 256);
    const nb = Math.round((b + hueShift * 0.5) % 256);
    palette.push(`rgb(${nr},${ng},${nb})`);
  }
  return palette;
}
