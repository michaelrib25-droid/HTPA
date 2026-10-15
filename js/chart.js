const WIDTH = 320;
const HEIGHT = 160;
const PADDING = 24;

export function renderLineChart(container, points, color = '#4f6df5') {
  container.innerHTML = '';

  const xStep = points.length > 1 ? (WIDTH - PADDING * 2) / (points.length - 1) : 0;
  const values = points.map((p) => p.y);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal;

  function scaleY(value) {
    if (range === 0) return HEIGHT / 2;
    return HEIGHT - PADDING - ((value - minVal) / range) * (HEIGHT - PADDING * 2);
  }

  const coords = points.map((p, i) => ({
    x: PADDING + i * xStep,
    y: scaleY(p.y)
  }));

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${WIDTH} ${HEIGHT}`);
  svg.setAttribute('class', 'trend-chart-svg');

  if (coords.length > 1) {
    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('points', coords.map((c) => `${c.x},${c.y}`).join(' '));
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', color);
    polyline.setAttribute('stroke-width', '2');
    svg.appendChild(polyline);
  }

  coords.forEach((c, i) => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', c.x);
    circle.setAttribute('cy', c.y);
    circle.setAttribute('r', '4');
    circle.setAttribute('fill', color);

    // <title> only shows on hover, which doesn't exist on a touchscreen —
    // kept for desktop/mouse use, but the visible text labels below are
    // what actually make the values readable on the target device (phone).
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = points[i].tooltip;
    circle.appendChild(title);

    svg.appendChild(circle);
  });

  if (range > 0) {
    const maxLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    maxLabel.setAttribute('x', PADDING);
    maxLabel.setAttribute('y', 12);
    maxLabel.setAttribute('fill', '#a0a0b0');
    maxLabel.setAttribute('font-size', '10');
    maxLabel.textContent = String(maxVal);
    svg.appendChild(maxLabel);

    const minLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    minLabel.setAttribute('x', PADDING);
    minLabel.setAttribute('y', HEIGHT - 6);
    minLabel.setAttribute('fill', '#a0a0b0');
    minLabel.setAttribute('font-size', '10');
    minLabel.textContent = String(minVal);
    svg.appendChild(minLabel);
  } else {
    const valueLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    valueLabel.setAttribute('x', PADDING);
    valueLabel.setAttribute('y', 12);
    valueLabel.setAttribute('fill', '#a0a0b0');
    valueLabel.setAttribute('font-size', '10');
    valueLabel.textContent = String(maxVal);
    svg.appendChild(valueLabel);
  }

  container.appendChild(svg);

  const labels = document.createElement('div');
  labels.className = 'trend-chart-labels';
  const first = document.createElement('span');
  first.textContent = points[0].x;
  const last = document.createElement('span');
  last.textContent = points[points.length - 1].x;
  labels.appendChild(first);
  labels.appendChild(last);
  container.appendChild(labels);
}
