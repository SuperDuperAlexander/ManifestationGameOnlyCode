export type ControlIconName = 'walk' | 'breathe' | 'push' | 'collect' | 'look-within';

const PATHS: Record<ControlIconName, string> = {
  walk: '<path d="M12 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/><path d="m9 11 3-1 3 2 2 1M10 12l-2 4 3 2-1 3m3-9 1 4-2 2 2 3"/>',
  breathe: '<path d="m12 2 2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2Z"/>',
  push: '<path d="M8 12V7a1.5 1.5 0 0 1 3 0v4-6a1.5 1.5 0 0 1 3 0v6-4a1.5 1.5 0 0 1 3 0v5-2a1.5 1.5 0 0 1 3 0v5c0 4-2.5 6-6 6h-1c-2.5 0-4-1.2-5-3l-2-3a1.5 1.5 0 0 1 2.5-1.5L10 15"/>',
  collect: '<path d="M12 10c-2-2-5-1-5 2 0 3 2.2 5 5 5s5-2 5-5c0-3-3-4-5-2Z"/><path d="M12 10c-.4-2 0-3 2-4m0 0c1.4-.7 2.5-.4 3 .2-1.4.8-2.4.7-3-.2ZM4 15h16l-1.5 7h-13L4 15Z"/><path d="M8 17v3m4-3v3m4-3v3"/>',
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
