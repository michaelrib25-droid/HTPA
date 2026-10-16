const SVG_NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

function svg(children) {
  const node = el('svg', {
    viewBox: '0 0 24 24', width: '18', height: '18', fill: 'none',
    stroke: 'currentColor', 'stroke-width': '2',
    'stroke-linecap': 'round', 'stroke-linejoin': 'round'
  });
  children.forEach((c) => node.appendChild(c));
  return node;
}

// Hand-rolled to match chart.js's style (inline SVG primitives, no icon
// library/font) rather than emoji, which render inconsistently across
// Android/Chrome and clash with the app's 2-color accent palette.
const ICONS = {
  log: () => svg([
    el('path', { d: 'M4 20h4L19 9l-4-4L4 16v4z' }),
    el('path', { d: 'M13.5 6.5l4 4' })
  ]),
  history: () => svg([
    el('circle', { cx: '12', cy: '12', r: '9' }),
    el('path', { d: 'M12 7v5l4 2' })
  ]),
  progress: () => svg([
    el('polyline', { points: '4,16 9,10 13,13 20,5' }),
    el('polyline', { points: '14,5 20,5 20,11' })
  ]),
  records: () => svg([
    el('path', { d: 'M12 2l2.9 6.3 6.6.6-5 4.6 1.5 6.5L12 16.8 6 20l1.5-6.5-5-4.6 6.6-.6z' })
  ]),
  bodyweight: () => svg([
    el('rect', { x: '3', y: '10', width: '4', height: '4' }),
    el('rect', { x: '17', y: '10', width: '4', height: '4' }),
    el('line', { x1: '7', y1: '12', x2: '17', y2: '12' })
  ])
};

export function createIcon(name) {
  const factory = ICONS[name];
  return factory ? factory() : null;
}
