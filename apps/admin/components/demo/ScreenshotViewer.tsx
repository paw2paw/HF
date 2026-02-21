"use client";

import { useState, useEffect } from "react";
import type { ScreenshotContent, Annotation } from "@/lib/demo/types";

interface ScreenshotViewerProps {
  content: ScreenshotContent;
  /** Called when user clicks a highlighted annotation (advances to next step) */
  onAnnotationClick?: () => void;
}

export function ScreenshotViewer({ content, onAnnotationClick }: ScreenshotViewerProps) {
  const hasClickableAnnotation = content.annotations?.some((a) => a.highlight) && !!onAnnotationClick;
  const [showHint, setShowHint] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(false);

  // Show hint on first render with a clickable annotation, auto-fade after 4s
  useEffect(() => {
    if (hasClickableAnnotation && !hintDismissed) {
      setShowHint(true);
      const timer = setTimeout(() => setShowHint(false), 4000);
      return () => clearTimeout(timer);
    } else {
      setShowHint(false);
    }
  }, [hasClickableAnnotation, hintDismissed]);

  const handleAnnotationClick = () => {
    setHintDismissed(true);
    setShowHint(false);
    onAnnotationClick?.();
  };

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 900, margin: "0 auto" }}>
      {/* Screenshot image */}
      <div
        style={{
          position: "relative",
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid var(--border-default)",
          background: "var(--surface-secondary)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={content.src}
          alt={content.alt}
          style={{
            width: "100%",
            height: "auto",
            display: "block",
          }}
          onError={(e) => {
            // Show placeholder on missing screenshots
            const target = e.target as HTMLImageElement;
            target.style.display = "none";
            const parent = target.parentElement;
            if (parent && !parent.querySelector("[data-placeholder]")) {
              const placeholder = document.createElement("div");
              placeholder.setAttribute("data-placeholder", "true");
              placeholder.style.cssText =
                "padding: 80px 40px; text-align: center; color: var(--text-muted); font-size: 14px;";
              placeholder.innerHTML = `<div style="font-size: 48px; margin-bottom: 16px">📸</div><p>${content.alt}</p><p style="font-size: 12px; margin-top: 8px; opacity: 0.6">Screenshot placeholder — replace with actual screenshot</p>`;
              parent.appendChild(placeholder);
            }
          }}
        />

        {/* Annotation overlays */}
        {content.annotations?.map((annotation, i) => (
          <AnnotationOverlay
            key={i}
            annotation={annotation}
            onClick={annotation.highlight ? handleAnnotationClick : undefined}
          />
        ))}
      </div>

      {/* Click-to-continue hint */}
      {hasClickableAnnotation && (
        <div
          className="demo-click-hint"
          style={{
            textAlign: "center",
            marginTop: 10,
            fontSize: 12,
            color: "var(--text-muted)",
            opacity: showHint ? 1 : 0,
            transition: "opacity 0.5s ease",
            pointerEvents: "none",
          }}
        >
          Click the highlighted area to continue
        </div>
      )}
    </div>
  );
}

function AnnotationOverlay({
  annotation,
  onClick,
}: {
  annotation: Annotation;
  onClick?: () => void;
}) {
  const arrowMap: Record<string, string> = {
    up: "↑",
    down: "↓",
    left: "←",
    right: "→",
  };

  const isClickable = !!onClick;

  return (
    <div
      onClick={onClick}
      style={{
        position: "absolute",
        left: annotation.x,
        top: annotation.y,
        transform: "translate(-50%, -50%)",
        zIndex: 10,
        pointerEvents: isClickable ? "auto" : "none",
        cursor: isClickable ? "pointer" : "default",
      }}
    >
      {/* Pulsing highlight circle */}
      {annotation.highlight && (
        <div
          className="demo-annotation-pulse"
          style={{
            position: "absolute",
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "2px solid var(--accent-primary)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />
      )}

      {/* Label */}
      <div
        style={{
          background: "var(--accent-primary)",
          color: "var(--button-primary-text, #fff)",
          padding: "4px 10px",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: "nowrap",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          display: "flex",
          alignItems: "center",
          gap: 4,
          ...(isClickable
            ? { transition: "transform 0.15s ease, box-shadow 0.15s ease" }
            : {}),
        }}
        className={isClickable ? "demo-annotation-clickable" : undefined}
      >
        {annotation.direction && (
          <span style={{ fontSize: 14 }}>{arrowMap[annotation.direction]}</span>
        )}
        {annotation.label}
      </div>

      <style jsx>{`
        @keyframes demoPulse {
          0% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(2);
            opacity: 0;
          }
        }
        .demo-annotation-pulse {
          animation: demoPulse 1.5s ease-out infinite;
        }
        .demo-annotation-clickable:hover {
          transform: scale(1.05);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
        }
      `}</style>
    </div>
  );
}
