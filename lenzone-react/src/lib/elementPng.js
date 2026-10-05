const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function embedImages(root) {
  const images = [...root.querySelectorAll('img')];
  await Promise.all(images.map(async image => {
    const url = image.currentSrc || image.src;
    if (!url || url.startsWith('data:')) return;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      image.src = await blobToDataUrl(await response.blob());
    } catch {
      try {
        image.src = await new Promise((resolve, reject) => {
          const source = new Image();
          source.crossOrigin = 'anonymous';
          source.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = source.naturalWidth || 64;
              canvas.height = source.naturalHeight || 64;
              canvas.getContext('2d').drawImage(source, 0, 0);
              resolve(canvas.toDataURL('image/png'));
            } catch (error) {
              reject(error);
            }
          };
          source.onerror = reject;
          source.src = `${url}${url.includes('?') ? '&' : '?'}_export=1`;
        });
      } catch {
        image.src = TRANSPARENT_PIXEL;
      }
    }
  }));
}

function inlineComputedStyles(root, view = window) {
  const elements = [root, ...root.querySelectorAll('*')];
  elements.forEach(element => {
    const computed = view.getComputedStyle(element);
    const values = [];
    for (let index = 0; index < computed.length; index += 1) {
      const property = computed[index];
      values.push([property, computed.getPropertyValue(property), computed.getPropertyPriority(property)]);
    }
    values.forEach(([property, value, priority]) => element.style.setProperty(property, value, priority));
    element.style.setProperty('animation', 'none', 'important');
    element.style.setProperty('transition', 'none', 'important');
    element.style.setProperty('caret-color', 'transparent', 'important');
  });
}

// An SVG rendered as an <img> can't load web fonts, so text would re-flow in a fallback font and
// clip/overflow. Embed the Google Fonts faces the export actually uses as data URLs instead.
const fontTextCache = new Map();
const fontDataCache = new Map();

async function cachedFetch(cache, url, read) {
  if (!cache.has(url)) cache.set(url, fetch(url).then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return read(res); }).catch(() => null));
  return cache.get(url);
}

function collectUsedFonts(root, view) {
  const used = new Map();
  [root, ...root.querySelectorAll('*')].forEach(element => {
    const style = view.getComputedStyle(element);
    const family = style.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase();
    if (!family) return;
    if (!used.has(family)) used.set(family, new Set());
    used.get(family).add(Number(style.fontWeight) || 400);
  });
  return used;
}

async function buildFontCss(root, view) {
  const used = collectUsedFonts(root, view);
  const links = [...document.querySelectorAll('link[rel="stylesheet"][href*="fonts.googleapis.com"]')];
  const css = await Promise.all(links.map(link => cachedFetch(fontTextCache, link.href, res => res.text())));
  const faces = [];
  css.filter(Boolean).forEach(text => {
    for (const match of text.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g)) {
      const [, subset, body] = match;
      if (subset !== 'latin') continue;
      const family = /font-family:\s*['"]?([^;'"]+)['"]?/.exec(body)?.[1]?.trim().toLowerCase();
      const weightText = /font-weight:\s*([\d\s]+);/.exec(body)?.[1]?.trim();
      const url = /url\(([^)]+)\)/.exec(body)?.[1];
      if (!family || !weightText || !url || !used.has(family)) continue;
      const [min, max = min] = weightText.split(/\s+/).map(Number);
      if (![...used.get(family)].some(weight => weight >= min && weight <= max)) continue;
      faces.push({ body, url: url.replace(/^["']|["']$/g, '') });
    }
  });
  const rules = await Promise.all(faces.map(async ({ body, url }) => {
    const dataUrl = await cachedFetch(fontDataCache, url, async res => blobToDataUrl(await res.blob()));
    return dataUrl ? `@font-face{${body.replace(/src:[^;]+;/, `src:url(${dataUrl}) format('woff2');`)}}` : '';
  }));
  return rules.join('\n');
}

function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

// Responsive (md:/lg:) styles key off the viewport, so a phone would export its mobile layout
// stretched wide. Rendering the copy in an iframe as wide as the export makes them resolve at that width.
async function createExportFrame(width) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = `position:fixed;left:-100000px;top:0;width:${width}px;height:1200px;border:0;visibility:hidden;pointer-events:none`;
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const source = document.documentElement;
  [...source.attributes].forEach(attr => doc.documentElement.setAttribute(attr.name, attr.value));
  const base = doc.createElement('base');
  base.href = document.baseURI;
  doc.head.appendChild(base);
  const pending = [];
  document.head.querySelectorAll('link[rel="stylesheet"], style').forEach(node => {
    const copy = node.cloneNode(true);
    if (copy.tagName === 'LINK') {
      pending.push(new Promise(resolve => {
        copy.onload = resolve;
        copy.onerror = resolve;
        setTimeout(resolve, 3000);
      }));
    }
    doc.head.appendChild(copy);
  });
  doc.body.style.cssText = 'margin:0;padding:0';
  await Promise.all(pending);
  return frame;
}

function trimBottom(canvas, background, keep) {
  const context = canvas.getContext('2d');
  const target = [1, 3, 5].map(i => parseInt(background.slice(i, i + 2), 16));
  const { width, height } = canvas;
  let last = height - 1;
  for (; last > 0; last -= 1) {
    const row = context.getImageData(0, last, width, 1).data;
    let differs = false;
    for (let x = 0; x < width * 4; x += 4) {
      if (Math.abs(row[x] - target[0]) > 6 || Math.abs(row[x + 1] - target[1]) > 6 || Math.abs(row[x + 2] - target[2]) > 6) { differs = true; break; }
    }
    if (differs) break;
  }
  const trimmedHeight = Math.min(height, last + 1 + keep);
  if (trimmedHeight >= height) return canvas;
  const trimmed = document.createElement('canvas');
  trimmed.width = width;
  trimmed.height = trimmedHeight;
  trimmed.getContext('2d').drawImage(canvas, 0, 0);
  return trimmed;
}

export async function elementToPngCanvas(element, theme = 'dark', { padding = 28, maxPixels = 64_000_000, minWidth = 0 } = {}) {
  if (!element) throw new Error('Nothing is available to export.');

  const sourceWidth = Math.ceil(Math.max(minWidth, element.scrollWidth, element.getBoundingClientRect().width));
  const scheme = document.documentElement.getAttribute('data-scheme') || 'accent';
  const background = theme === 'dark' ? '#0b111d' : '#f7f3eb';
  const frame = await createExportFrame(sourceWidth + padding * 2);
  const frameDoc = frame.contentDocument;
  const frameView = frame.contentWindow;
  const holder = frameDoc.createElement('div');
  const staging = frameDoc.createElement('div');
  const clone = element.cloneNode(true);

  staging.setAttribute('data-mode', theme);
  staging.setAttribute('data-scheme', scheme);
  staging.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  staging.style.cssText = [
    `width:${sourceWidth + padding * 2}px`,
    `padding:${padding}px`,
    'box-sizing:border-box',
    `background:${background}`,
    'font-size:18px'
  ].join(';');
  clone.style.width = `${sourceWidth}px`;
  clone.style.maxWidth = 'none';
  clone.querySelectorAll('[data-export-ignore="true"]').forEach(node => node.remove());
  // Show the whole thing: no scroll containers/clipping, and no lazy images (an off-screen lazy
  // <img> never loads, which leaves its logo blank in the export).
  clone.querySelectorAll('img[loading]').forEach(img => img.setAttribute('loading', 'eager'));
  staging.appendChild(clone);
  holder.appendChild(staging);
  frameDoc.body.appendChild(holder);
  [clone, ...clone.querySelectorAll('*')].forEach(node => {
    const { overflowX, overflowY } = frameView.getComputedStyle(node);
    if (/auto|scroll/.test(overflowX + overflowY)) {
      node.style.setProperty('overflow', 'visible', 'important');
      node.style.setProperty('max-height', 'none', 'important');
    }
    // Long names wrap in the image instead of being cut with an ellipsis.
    if (frameView.getComputedStyle(node).textOverflow === 'ellipsis') {
      node.style.setProperty('overflow', 'visible', 'important');
      node.style.setProperty('text-overflow', 'clip', 'important');
      node.style.setProperty('white-space', 'normal', 'important');
      node.style.setProperty('overflow-wrap', 'anywhere', 'important');
    }
  });

  try {
    await nextFrame();
    await embedImages(staging);
    await frameDoc.fonts?.ready;
    await nextFrame();
    const width = Math.ceil(staging.scrollWidth);
    const measuredHeight = Math.ceil(staging.scrollHeight);
    // The image can lay out taller than the live page, so render with spare room and trim it after.
    const height = Math.ceil(measuredHeight * 1.6);
    const fontCss = await buildFontCss(staging, frameView);
    inlineComputedStyles(staging, frameView);
    // Computed styles freeze every element's height, but the image can wrap text onto an extra line.
    // Turn each frozen height into a minimum so text can grow while bars, cells and logos keep their size.
    const fixedKinds = new Set(['svg', 'img', 'canvas', 'video', 'iframe']);
    [staging, ...staging.querySelectorAll('*')].forEach(el => {
      if (el === staging || fixedKinds.has(el.tagName.toLowerCase()) || el.closest('svg')) return;
      // Grid tracks were frozen to pixel sizes too; let the rows size to their content again.
      if (/grid/.test(el.style.display)) el.style.setProperty('grid-template-rows', 'none', 'important');
      const h = parseFloat(el.style.height);
      if (!(h > 0)) return;
      el.style.setProperty('min-height', `${h}px`, 'important');
      el.style.removeProperty('height');
      el.style.removeProperty('block-size');
      el.style.removeProperty('max-height');
    });
    if (fontCss) {
      const fontStyle = frameDoc.createElement('style');
      fontStyle.textContent = fontCss;
      staging.insertBefore(fontStyle, staging.firstChild);
    }
    staging.style.width = `${width}px`;
    staging.style.height = `${height}px`;
    const serialized = new XMLSerializer().serializeToString(staging);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject x="0" y="0" width="100%" height="100%">${serialized}</foreignObject></svg>`;
    // A data: URL, not a blob: URL -- Chromium taints the canvas when a foreignObject SVG is drawn
    // from a blob: URL, which then blocks toDataURL/toBlob (copy and download).
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('The export image could not be rendered.'));
        img.src = url;
      });
      const scale = Math.min(2, Math.sqrt(maxPixels / (width * height)));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(width * scale));
      canvas.height = Math.max(1, Math.floor(height * scale));
      const context = canvas.getContext('2d');
      context.fillStyle = background;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return trimBottom(canvas, background, Math.round(padding * scale));
    }
  } finally {
    frame.remove();
  }
}

export function downloadCanvas(canvas, filename) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export async function copyCanvas(canvas) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('Image clipboard access is not available in this browser.');
  }
  const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG creation failed.')), 'image/png'));
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
