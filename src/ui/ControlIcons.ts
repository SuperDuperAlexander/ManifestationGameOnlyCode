export type ControlIconName = 'walk' | 'breathe' | 'push' | 'look-within';

const PATHS: Record<ControlIconName, string> = {
  walk: '<path d="M12 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/><path d="m9 11 3-1 3 2 2 1M10 12l-2 4 3 2-1 3m3-9 1 4-2 2 2 3"/>',
  breathe: '<path d="M12 3v3"/><path d="M12 6a6 6 0 1 0 6 6"/><path d="M14 12h7m-3-3 3 3-3 3"/>',
  push: '<path d="M8 12V7a1.5 1.5 0 0 1 3 0v4-6a1.5 1.5 0 0 1 3 0v6-4a1.5 1.5 0 0 1 3 0v5-2a1.5 1.5 0 0 1 3 0v5c0 4-2.5 6-6 6h-1c-2.5 0-4-1.2-5-3l-2-3a1.5 1.5 0 0 1 2.5-1.5L10 15"/>',
  'look-within': '<path d="m12 2 10 10-10 10L2 12 12 2Z"/><circle cx="12" cy="12" r="2.5"/>',
};

/** Create a small, decorative vector icon that inherits its colour from CSS. */
export function createControlIcon(name: ControlIconName, className = 'control-icon'): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', `${className} control-icon-${name}`);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.innerHTML = PATHS[name];
  return svg;
}
