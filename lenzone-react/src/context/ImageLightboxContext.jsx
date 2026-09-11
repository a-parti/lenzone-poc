import React, { createContext, useContext, useEffect, useState } from 'react';

const ImageLightboxContext = createContext({ open: () => {} });

export function ImageLightboxProvider({ children }) {
  const [src, setSrc] = useState(null);
  const [alt, setAlt] = useState('');

  const open = (imgSrc, imgAlt = '') => {
    if (!imgSrc) return;
    setSrc(imgSrc);
    setAlt(imgAlt);
  };
  const close = () => setSrc(null);

  useEffect(() => {
    if (!src) return;
    const handler = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [src]);

  return (
    <ImageLightboxContext.Provider value={{ open }}>
      {children}
      {src && (
        <div
          className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 cursor-zoom-out"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label={alt ? `Enlarged image: ${alt}` : "Enlarged image"}
        >
          <img src={src} alt={alt} className="max-w-full max-h-full rounded-xl shadow-2xl object-contain" />
        </div>
      )}
    </ImageLightboxContext.Provider>
  );
}

export function useImageLightbox() {
  return useContext(ImageLightboxContext);
}

// Drop-in replacement for a plain <img> that opens a full-size view on click. Pass the same
// src/alt/className you'd give an <img>; `zoomSrc` optionally points to a higher-res version to
// show in the lightbox instead of upscaling the small thumbnail.
export function Zoomable({ src, zoomSrc, alt = '', className = '', onError }) {
  const { open } = useImageLightbox();
  if (!src) return null;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); open(zoomSrc || src, alt); }}
      className="cursor-zoom-in shrink-0"
      title="Click to enlarge"
      aria-label={alt ? `Enlarge image: ${alt}` : "Enlarge image"}
    >
      <img src={src} alt={alt} className={className} onError={onError} />
    </button>
  );
}
