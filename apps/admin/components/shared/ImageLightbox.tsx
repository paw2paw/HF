"use client";

import { useCallback, useEffect } from "react";

interface ImageLightboxProps {
  src: string;
  alt: string;
  caption?: string;
  onClose: () => void;
}

/**
 * Full-screen image lightbox overlay.
 * Dark backdrop, centered image with aspect-ratio preservation.
 * Close via X button, Escape key, or clicking the backdrop.
 */
export default function ImageLightbox({ src, alt, caption, onClose }: ImageLightboxProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="hf-lightbox-backdrop" onClick={onClose}>
      <div className="hf-lightbox-content" onClick={(e) => e.stopPropagation()}>
        <button className="hf-lightbox-close" onClick={onClose} aria-label="Close">
          &times;
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="hf-lightbox-image" />
        {caption && <div className="hf-lightbox-caption">{caption}</div>}
      </div>
    </div>
  );
}
