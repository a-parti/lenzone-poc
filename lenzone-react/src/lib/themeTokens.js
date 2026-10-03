// Reads the real palette tokens (index.css) for a given mode, so PNG exports -- which have to
// bake in fixed colors -- always match what the site actually shows. The [data-mode] selectors in
// index.css apply to any element, so a hidden probe element with data-mode set resolves them.
const TOKENS = ['bg', 'surface', 'surface2', 'border', 'border2', 'text', 'text2', 'muted', 'accent', 'coral', 'pos', 'neg', 'proj', 'live', 'afc', 'nfc'];

export function readThemeTokens(mode) {
  const probe = document.createElement('div');
  probe.setAttribute('data-mode', mode);
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const style = getComputedStyle(probe);
  const tokens = {};
  TOKENS.forEach(name => { tokens[name] = style.getPropertyValue(`--${name}`).trim(); });
  probe.remove();
  return tokens;
}

// Maps "var(--x)" strings used in live SVG fills to the resolved hex for export.
export function varResolver(tokens) {
  const map = {};
  Object.entries(tokens).forEach(([name, value]) => { map[`var(--${name})`] = value; });
  return (color) => map[color] || color;
}
