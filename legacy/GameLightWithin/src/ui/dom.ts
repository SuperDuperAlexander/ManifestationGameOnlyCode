/** Small helpers so the UI files stay short and readable. */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) node.append(child);
  return node;
}

export function svgEl(tag: string, attrs: Record<string, string> = {}): SVGElement {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

export function button(label: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', { class: cls, type: 'button', 'data-ui': '1' }, label);
  b.addEventListener('click', onClick);
  return b;
}

/** Moves keyboard focus to the first control in a panel. */
export function focusFirst(panel: HTMLElement): void {
  const first = panel.querySelector<HTMLElement>('button, [tabindex="0"], input');
  first?.focus();
}
