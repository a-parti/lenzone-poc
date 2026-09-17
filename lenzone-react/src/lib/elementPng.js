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

function inlineComputedStyles(root) {
  const elements = [root, ...root.querySelectorAll('*')];
  elements.forEach(element => {
    const computed = window.getComputedStyle(element);
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

function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

export async function elementToPngCanvas(element, theme = 'dark', { padding = 28, maxPixels = 64_000_000, minWidth = 0 } = {}) {
  if (!element) throw new Error('Nothing is available to export.');

  const sourceWidth = Math.ceil(Math.max(minWidth, element.scrollWidth, element.getBoundingClientRect().width));
  const scheme = document.documentElement.getAttribute('data-scheme') || 'accent';
  const background = theme === 'dark' ? '#0b111d' : '#f7f3eb';
  const staging = document.createElement('div');
  const clone = element.cloneNode(true);

  staging.setAttribute('data-mode', theme);
  staging.setAttribute('data-scheme', scheme);
  staging.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  staging.style.cssText = [
    'position:fixed',
    'left:-100000px',
    'top:0',
    `width:${sourceWidth + padding * 2}px`,
    `padding:${padding}px`,
    'box-sizing:border-box',
    `background:${background}`,
    'font-size:18px',
    'z-index:-2147483648'
  ].join(';');
  clone.style.width = `${sourceWidth}px`;
  clone.style.maxWidth = 'none';
  clone.querySelectorAll('[data-export-ignore="true"]').forEach(node => node.remove());
  staging.appendChild(clone);
  document.body.appendChild(staging);

  try {
    await nextFrame();
    await embedImages(staging);
    await nextFrame();
    const width = Math.ceil(staging.scrollWidth);
    const height = Math.ceil(staging.scrollHeight);
    inlineComputedStyles(staging);
    staging.style.position = 'relative';
    staging.style.left = '0';
    staging.style.top = '0';
    staging.style.zIndex = 'auto';
    staging.style.width = `${width}px`;
    staging.style.height = `${height}px`;
    const serialized = new XMLSerializer().serializeToString(staging);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject x="0" y="0" width="100%" height="100%">${serialized}</foreignObject></svg>`;
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    try {
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
      return canvas;
    } finally {
      URL.revokeObjectURL(url);
    }
  } finally {
    staging.remove();
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
