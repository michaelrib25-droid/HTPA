const SVG_NS = 'http://www.w3.org/2000/svg';

const WIDTH = 320;
const HEIGHT = 200;
const PADDING_LEFT = 38;
const PADDING_RIGHT = 12;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 26;
const MAX_X_LABELS = 5;
const GRID_TICKS = 4;

function el(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

// Rounds a raw step (range / tickCount) up to a "nice" 1/2/5/10 × 10^n value,
// so grid lines land on round numbers (e.g. 20kg) instead of awkward ones (e.g. 17.3kg).
function niceStep(rawStep) {
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep || 1)));
  const residual = rawStep / magnitude;
  let niceResidual;
  if (residual > 5) niceResidual = 10;
  else if (residual > 2) niceResidual = 5;
  else if (residual > 1) niceResidual = 2;
  else niceResidual = 1;
  return niceResidual * magnitude;
}

function niceScale(min, max, tickCount) {
  if (min === max) {
    const pad = min === 0 ? 1 : Math.abs(min) * 0.1;
    min -= pad;
    max += pad;
  }
  const step = niceStep((max - min) / tickCount);
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = niceMin; v <= niceMax + step / 2; v += step) {
    ticks.push(Math.round(v * 100) / 100);
  }
  return { min: niceMin, max: niceMax, ticks };
}

function pickLabelIndices(n, maxLabels) {
  if (n <= maxLabels) return [...Array(n).keys()];
  const idx = new Set();
  for (let i = 0; i < maxLabels; i++) {
    idx.add(Math.round((i * (n - 1)) / (maxLabels - 1)));
  }
  return [...idx].sort((a, b) => a - b);
}

function formatTick(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function renderLineChart(container, points, options = {}) {
  // `secondary` overlays a second, dashed, fill-less/point-less line on the
  // same x/y scale (e.g. a moving average alongside the raw series) — kept
  // optional so the single-series callers (Progress, session trends) are
  // unaffected.
  const { color = '#4f6df5', unit = '', secondary = null } = options;
  container.innerHTML = '';
  if (points.length === 0) return;

  const plotWidth = WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const xStep = points.length > 1 ? plotWidth / (points.length - 1) : 0;
  const baselineY = PADDING_TOP + plotHeight;

  const values = points.map((p) => p.y).concat(secondary ? secondary.points.map((p) => p.y) : []);
  const { min: scaleMin, max: scaleMax, ticks } = niceScale(Math.min(...values), Math.max(...values), GRID_TICKS);
  const range = scaleMax - scaleMin || 1;

  // A single point used to be centered (xStep=0 made that the "obvious"
  // special case), but a lone data point should still read as sitting at
  // the start of the timeline, not floating in the middle of the axis.
  const scaleX = (i) => PADDING_LEFT + i * xStep;
  const scaleY = (value) => PADDING_TOP + plotHeight - ((value - scaleMin) / range) * plotHeight;

  const coords = points.map((p, i) => ({ x: scaleX(i), y: scaleY(p.y) }));

  const svg = el('svg', { viewBox: `0 0 ${WIDTH} ${HEIGHT}`, class: 'trend-chart-svg' });

  const gradientId = `trend-fill-${Math.random().toString(36).slice(2, 9)}`;
  const defs = el('defs', {});
  const gradient = el('linearGradient', { id: gradientId, x1: '0', y1: '0', x2: '0', y2: '1' });
  const stopTop = el('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': '0.35' });
  const stopBottom = el('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': '0' });
  gradient.appendChild(stopTop);
  gradient.appendChild(stopBottom);
  defs.appendChild(gradient);
  svg.appendChild(defs);

  // Horizontal grid lines + value labels, at "nice" round numbers rather than raw min/max.
  ticks.forEach((t) => {
    const y = scaleY(t);
    svg.appendChild(el('line', {
      x1: PADDING_LEFT, y1: y, x2: WIDTH - PADDING_RIGHT, y2: y,
      stroke: 'rgba(255,255,255,0.08)', 'stroke-width': '1'
    }));
    const label = el('text', {
      x: PADDING_LEFT - 6, y: y + 3, fill: '#a0a0b0', 'font-size': '9', 'text-anchor': 'end'
    });
    label.textContent = formatTick(t);
    svg.appendChild(label);
  });

  // Unit label, top-left — makes the y-axis quantity explicit at a glance.
  if (unit) {
    const unitLabel = el('text', { x: 4, y: 10, fill: '#6c6c8a', 'font-size': '9', 'font-weight': '600' });
    unitLabel.textContent = unit;
    svg.appendChild(unitLabel);
  }

  // Area fill under the line, for a less flat/empty look.
  if (coords.length > 1) {
    const first = coords[0];
    const last = coords[coords.length - 1];
    const d = `M${first.x},${baselineY} ` +
      coords.map((c) => `L${c.x},${c.y}`).join(' ') +
      ` L${last.x},${baselineY} Z`;
    svg.appendChild(el('path', { d, fill: `url(#${gradientId})`, stroke: 'none' }));
  }

  if (secondary && secondary.points.length > 1) {
    const secCoords = secondary.points.map((p, i) => ({ x: scaleX(i), y: scaleY(p.y) }));
    svg.appendChild(el('polyline', {
      points: secCoords.map((c) => `${c.x},${c.y}`).join(' '),
      fill: 'none', stroke: secondary.color || '#a0a0b0', 'stroke-width': '1.5',
      'stroke-dasharray': '4,3', 'stroke-linejoin': 'round', 'stroke-linecap': 'round'
    }));
  }

  if (coords.length > 1) {
    const polyline = el('polyline', {
      points: coords.map((c) => `${c.x},${c.y}`).join(' '),
      fill: 'none', stroke: color, 'stroke-width': '2.5',
      'stroke-linejoin': 'round', 'stroke-linecap': 'round'
    });
    svg.appendChild(polyline);
  }

  coords.forEach((c, i) => {
    // A point can override the line's color (e.g. progressView colors points
    // by RPE) without affecting the line/area, which always stay `color`.
    const circle = el('circle', {
      cx: c.x, cy: c.y, r: '3.5', fill: points[i].pointColor || color, stroke: '#1a1a2e', 'stroke-width': '1.5'
    });
    // <title> only shows on hover, which doesn't exist on a touchscreen —
    // kept for desktop/mouse use, but the visible text labels below are
    // what actually make the values readable on the target device (phone).
    const title = el('title', {});
    title.textContent = points[i].tooltip;
    circle.appendChild(title);
    svg.appendChild(circle);
  });

  // X-axis date labels — a bounded subset so long date strings don't overlap on narrow screens.
  pickLabelIndices(points.length, MAX_X_LABELS).forEach((i) => {
    const anchor = i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle';
    const label = el('text', {
      x: coords[i].x, y: HEIGHT - 6, fill: '#a0a0b0', 'font-size': '9', 'text-anchor': anchor
    });
    label.textContent = points[i].x;
    svg.appendChild(label);
  });

  container.appendChild(svg);
}
