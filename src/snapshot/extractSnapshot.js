const INTERACTIVE_SELECTOR = [
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="link"]',
  '[role="textbox"]',
  '[role="menuitem"]',
].join(',');

function isVisible(el) {
  const style = window.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
}

function isClickable(el) {
  const disabled = el.disabled || el.getAttribute('aria-disabled') === 'true';
  return !disabled;
}

function textOf(el) {
  return (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

function anchorOf(el) {
  return {
    dataTour: el.getAttribute('data-tour') || undefined,
    dataTestid: el.getAttribute('data-testid') || undefined,
    ariaLabel: el.getAttribute('aria-label') || undefined,
    id: el.id || undefined,
  };
}

function bestSelector(el, anchor) {
  if (anchor.dataTour) return `[data-tour="${anchor.dataTour}"]`;
  if (anchor.dataTestid) return `[data-testid="${anchor.dataTestid}"]`;
  if (anchor.ariaLabel) return `[aria-label="${anchor.ariaLabel}"]`;
  if (anchor.id) return `#${CSS.escape(anchor.id)}`;
  const role = el.getAttribute('role') || el.tagName.toLowerCase();
  return `${role}:${textOf(el)}`;
}

export function extractSnapshot({ maxElements = 40 } = {}) {
  const nodes = Array.from(document.querySelectorAll(INTERACTIVE_SELECTOR))
    .filter((el) => isVisible(el) && isClickable(el))
    .slice(0, maxElements);

  const elements = nodes.map((el, i) => {
    const rect = el.getBoundingClientRect();
    const anchor = anchorOf(el);
    return {
      nodeRef: `n_${i}_${Math.abs((bestSelector(el, anchor) || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0))}`,
      role: el.getAttribute('role') || (el.tagName === 'A' ? 'link' : el.tagName.toLowerCase() === 'input' ? 'textbox' : el.tagName.toLowerCase()),
      text: textOf(el),
      value: 'value' in el ? String(el.value || '') : undefined,
      anchor,
      locatorHints: {
        cssPath: bestSelector(el, anchor),
      },
      bounds: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      state: {
        visible: true,
        enabled: !el.disabled,
        clickable: true,
        focusable: typeof el.focus === 'function',
      },
      context: {
        containerTitle: el.closest('[data-section-title]')?.getAttribute('data-section-title') || undefined,
      },
    };
  });

  return {
    meta: {
      platform: 'web',
      appId: 'runtime-ui-snapshot-demo',
      route: window.location.pathname,
      url: window.location.href,
      title: document.title,
      timestamp: new Date().toISOString(),
      viewport: { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio || 1 },
    },
    elements,
  };
}
