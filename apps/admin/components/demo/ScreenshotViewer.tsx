"use client";

import type { ScreenshotContent, Annotation } from "@/lib/demo/types";

interface ScreenshotViewerProps {
  content: ScreenshotContent;
}

export function ScreenshotViewer({ content }: ScreenshotViewerProps) {
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
          <AnnotationOverlay key={i} annotation={annotation} />
        ))}
      </div>
    </div>
  );
}

function AnnotationOverlay({ annotation }: { annotation: Annotation }) {
  const arrowMap: Record<string, string> = {
    up: "↑",
    down: "↓",
    left: "←",
    right: "→",
  };

  return (
    <div
      style={{
        position: "absolute",
        left: annotation.x,
        top: annotation.y,
        transform: "translate(-50%, -50%)",
        zIndex: 10,
        pointerEvents: "none",
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
          color: "#fff",
          padding: "4px 10px",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: "nowrap",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
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
      `}</style>
    </div>
  );
}
