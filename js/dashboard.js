/* ═══════════════════════════════════════
   MaxGIS — Data Dashboard
   Visualise CSV data with Chart.js
   ═══════════════════════════════════════ */

let dashCharts = []; // track chart instances for cleanup

$('btnDash').onclick = () => toggleDashboard();
$('btnCloseDash').onclick = () => toggleDashboard();

function toggleDashboard() {
  APP.dashOpen = !APP.dashOpen;
  $('dashPanel').classList.toggle('open', APP.dashOpen);
  $('btnDash').classList.toggle('on', APP.dashOpen);
}

// Watch for layer selection changes in dashboard
if ($('dashLayerSel')) {
  $('dashLayerSel').onchange = () => buildDashboard();
}

function buildDashboard() {
  const layerId = +$('dashLayerSel').value;
  const layer = APP.layers.find(l => l.id === layerId);
  const body = $('dashBody');

  // Cleanup previous charts
  dashCharts.forEach(c => c.destroy());
  dashCharts = [];

  if (!layer?.data?.features?.length) {
    body.innerHTML = '<div class="empty-msg">Select a layer with data to visualise</div>';
    return;
  }

  const features = layer.data.features;
  const allProps = [...new Set(features.flatMap(f => Object.keys(f.properties || {})))];

  // Separate numeric and categorical fields
  const numericFields = [];
  const catFields = [];

  allProps.forEach(key => {
    const sampleValues = features.slice(0, 20).map(f => f.properties?.[key]).filter(v => v != null);
    const numCount = sampleValues.filter(v => !isNaN(+v) && v !== '').length;
    if (numCount > sampleValues.length * 0.6) {
      numericFields.push(key);
    } else {
      catFields.push(key);
    }
  });

  let html = '';

  // ── Summary Stats ──
  html += '<div class="stat-grid">';
  html += `<div class="stat-card"><div class="val">${features.length}</div><div class="lbl">Total Features</div></div>`;
  html += `<div class="stat-card"><div class="val">${allProps.length}</div><div class="lbl">Fields</div></div>`;
  if (numericFields.length) {
    const firstNum = numericFields[0];
    const vals = features.map(f => +f.properties?.[firstNum]).filter(v => !isNaN(v));
    const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : 'N/A';
    html += `<div class="stat-card"><div class="val">${avg}</div><div class="lbl">Avg ${firstNum}</div></div>`;
    const sum = vals.reduce((a, b) => a + b, 0);
    html += `<div class="stat-card"><div class="val">${sum > 1000 ? (sum/1000).toFixed(1)+'k' : sum.toFixed(0)}</div><div class="lbl">Sum ${firstNum}</div></div>`;
  }
  html += '</div>';

  // ── Pie Chart for first categorical field ──
  if (catFields.length) {
    html += `<div class="chart-card"><h4>${catFields[0]} Distribution</h4><canvas id="dashPie"></canvas></div>`;
  }

  // ── Bar Chart for first numeric field ──
  if (numericFields.length && catFields.length) {
    html += `<div class="chart-card"><h4>${numericFields[0]} by ${catFields[0]}</h4><canvas id="dashBar"></canvas></div>`;
  }

  // ── Histogram for numeric field ──
  if (numericFields.length) {
    html += `<div class="chart-card"><h4>${numericFields[0]} Histogram</h4><canvas id="dashHist"></canvas></div>`;
  }

  // ── Line chart if there's a second numeric ──
  if (numericFields.length >= 2) {
    html += `<div class="chart-card"><h4>${numericFields[0]} vs ${numericFields[1]}</h4><canvas id="dashScatter"></canvas></div>`;
  }

  body.innerHTML = html;

  // ── Render Charts ──
  const isDark = APP.theme === 'dark';
  const textColor = isDark ? '#c8bfb0' : '#4a4030';
  const gridColor = isDark ? 'rgba(194,170,130,0.1)' : 'rgba(0,0,0,0.08)';
  const palette = ['#c2aa82', '#6ebad9', '#d97c6e', '#7ec88b', '#d4b96a', '#a88bc4', '#e8a87c', '#85c1e9'];

  Chart.defaults.color = textColor;
  Chart.defaults.borderColor = gridColor;

  // Pie Chart
  if (catFields.length && $('dashPie')) {
    const counts = {};
    features.forEach(f => {
      const val = f.properties?.[catFields[0]] || 'Unknown';
      counts[val] = (counts[val] || 0) + 1;
    });
    const labels = Object.keys(counts).slice(0, 10);
    const data = labels.map(l => counts[l]);

    dashCharts.push(new Chart($('dashPie'), {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: palette.slice(0, labels.length), borderWidth: 0 }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, padding: 8, font: { size: 10 } } }
        }
      }
    }));
  }

  // Bar Chart
  if (numericFields.length && catFields.length && $('dashBar')) {
    const grouped = {};
    features.forEach(f => {
      const cat = f.properties?.[catFields[0]] || 'Unknown';
      const val = +f.properties?.[numericFields[0]];
      if (isNaN(val)) return;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(val);
    });
    const labels = Object.keys(grouped).slice(0, 12);
    const data = labels.map(l => {
      const arr = grouped[l];
      return (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2);
    });

    dashCharts.push(new Chart($('dashBar'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Avg ' + numericFields[0],
          data,
          backgroundColor: 'rgba(194, 170, 130, 0.6)',
          borderColor: '#c2aa82',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { maxRotation: 45, font: { size: 10 } } },
          y: { beginAtZero: true }
        }
      }
    }));
  }

  // Histogram
  if (numericFields.length && $('dashHist')) {
    const vals = features.map(f => +f.properties?.[numericFields[0]]).filter(v => !isNaN(v));
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

    dashCharts.push(new Chart($('dashHist'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: numericFields[0],
          data: bins,
          backgroundColor: 'rgba(110, 186, 217, 0.5)',
          borderColor: '#6ebad9',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    }));
  }

  // Scatter Plot
  if (numericFields.length >= 2 && $('dashScatter')) {
    const data = features.map(f => ({
      x: +f.properties?.[numericFields[0]],
      y: +f.properties?.[numericFields[1]]
    })).filter(d => !isNaN(d.x) && !isNaN(d.y)).slice(0, 500);

    dashCharts.push(new Chart($('dashScatter'), {
      type: 'scatter',
      data: {
        datasets: [{
          label: `${numericFields[0]} vs ${numericFields[1]}`,
          data,
          backgroundColor: 'rgba(194, 170, 130, 0.5)',
          borderColor: '#c2aa82',
          pointRadius: 3
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { title: { display: true, text: numericFields[0] } },
          y: { title: { display: true, text: numericFields[1] } }
        }
      }
    }));
  }
}
