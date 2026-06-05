// dashboard.js — métricas y gráficas (Chart.js vía CDN -> window.Chart)
// Recibe el set de noticias YA filtrado (getVisibleNoticias) para que el
// dashboard refleje exactamente lo que el usuario ve en el panel.

// Colores sólidos por categoría (guía de marca / docs backend)
const CAT_COLOR = {
  Convocatoria:  '#3B82F6',
  Investigacion: '#22C55E',
  Tecnologia:    '#F59E0B',
  Cultura:       '#EF4444',
  Deporte:       '#64748B',
  Institucional: '#A855F7',
  Obituario:     '#64748B',
  'Política':    '#F59E0B',
  Otro:          '#94A3B8',
};

const REL = {
  alta:  { color: '#22C55E', label: 'Alta'  },
  media: { color: '#F59E0B', label: 'Media' },
  baja:  { color: '#94A3B8', label: 'Baja'  },
};

const DAY = 86_400_000;
const charts = {};

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function destroyCharts() {
  Object.keys(charts).forEach(k => {
    if (charts[k]) { charts[k].destroy(); charts[k] = null; }
  });
}

function countBy(arr, keyFn, fallback = 'Otro') {
  const out = {};
  arr.forEach(item => {
    const k = keyFn(item) || fallback;
    out[k] = (out[k] || 0) + 1;
  });
  return out;
}

function fmtDay(iso) {
  // iso = 'YYYY-MM-DD' -> 'DD/MM'
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export function renderDashboard(noticias) {
  const C = window.Chart;
  if (!C) return;

  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  C.defaults.color = dark ? '#A0A0CC' : '#475569';
  C.defaults.font.family = 'Nunito, sans-serif';
  const gridColor = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const legendCfg = { labels: { boxWidth: 12, padding: 12, font: { size: 11 } } };

  // ── KPIs ──────────────────────────────────────────────────────────────
  const total = noticias.length;
  const unis  = new Set(noticias.map(n => n.university_name).filter(Boolean)).size;
  const now   = Date.now();
  const last7 = noticias.filter(n => {
    const t = new Date(n.published_date).getTime();
    return !isNaN(t) && now - t <= 7 * DAY;
  }).length;
  const alta    = noticias.filter(n => n.relevance === 'alta').length;
  const pctAlta = total ? Math.round((alta / total) * 100) : 0;

  setText('kpi-total', total);
  setText('kpi-unis',  unis);
  setText('kpi-7d',    last7);
  setText('kpi-alta',  pctAlta + '%');

  destroyCharts();

  // ── Línea: noticias por día (últimos 30 con datos) ──────────────────────
  const byDate = {};
  noticias.forEach(n => {
    if (!n.published_date) return;
    const k = String(n.published_date).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(k)) byDate[k] = (byDate[k] || 0) + 1;
  });
  const days = Object.keys(byDate).sort().slice(-30);
  charts.timeline = new C(document.getElementById('chart-timeline'), {
    type: 'line',
    data: {
      labels: days.map(fmtDay),
      datasets: [{
        data: days.map(k => byDate[k]),
        borderColor: '#3300FF',
        backgroundColor: 'rgba(51,0,255,0.12)',
        fill: true,
        tension: 0.35,
        pointRadius: 2,
        pointHoverRadius: 4,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: gridColor }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } },
        y: { grid: { color: gridColor }, beginAtZero: true, ticks: { precision: 0 } },
      },
    },
  });

  // ── Barras horizontales: top 10 universidades ───────────────────────────
  const byUni = countBy(noticias, n => n.university_name, '—');
  const topUni = Object.entries(byUni).sort((a, b) => b[1] - a[1]).slice(0, 10);
  charts.unis = new C(document.getElementById('chart-unis'), {
    type: 'bar',
    data: {
      labels: topUni.map(([k]) => k.length > 28 ? k.slice(0, 27) + '…' : k),
      datasets: [{
        data: topUni.map(([, v]) => v),
        backgroundColor: '#3300FF',
        borderRadius: 4,
        maxBarThickness: 18,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: gridColor }, beginAtZero: true, ticks: { precision: 0 } },
        y: { grid: { display: false }, ticks: { font: { size: 10 } } },
      },
    },
  });

  // ── Dona: por categoría ─────────────────────────────────────────────────
  const byCat = countBy(noticias, n => n.category, 'Otro');
  const catKeys = Object.keys(byCat);
  charts.category = new C(document.getElementById('chart-category'), {
    type: 'doughnut',
    data: {
      labels: catKeys,
      datasets: [{
        data: catKeys.map(k => byCat[k]),
        backgroundColor: catKeys.map(k => CAT_COLOR[k] || '#94A3B8'),
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '60%',
      plugins: { legend: { position: 'right', ...legendCfg } },
    },
  });

  // ── Dona: por relevancia ────────────────────────────────────────────────
  const relOrder = ['alta', 'media', 'baja'];
  const byRel = countBy(noticias, n => n.relevance, 'baja');
  charts.relevance = new C(document.getElementById('chart-relevance'), {
    type: 'doughnut',
    data: {
      labels: relOrder.map(k => REL[k].label),
      datasets: [{
        data: relOrder.map(k => byRel[k] || 0),
        backgroundColor: relOrder.map(k => REL[k].color),
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '60%',
      plugins: { legend: { position: 'right', ...legendCfg } },
    },
  });
}
