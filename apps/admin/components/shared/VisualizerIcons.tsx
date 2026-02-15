"use client";

// Shared icon definitions and rendering for all graph visualisers
// Icons extracted from lucide-react v0.563.0 (24x24 viewBox, stroke-based)

export type IconElement = [string, Record<string, string>];

export const visualizerIcons: Record<string, IconElement[]> = {
  // --- Caller graph types ---
  caller: [
    ["path", { d: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" }],
    ["circle", { cx: "12", cy: "7", r: "4" }],
  ],
  domain: [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["path", { d: "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" }],
    ["path", { d: "M2 12h20" }],
  ],
  paramGroup: [
    ["path", { d: "M12 18V5" }],
    ["path", { d: "M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4" }],
    ["path", { d: "M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5" }],
    ["path", { d: "M17.997 5.125a4 4 0 0 1 2.526 5.77" }],
    ["path", { d: "M18 18a4 4 0 0 0 2-7.464" }],
    ["path", { d: "M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517" }],
    ["path", { d: "M6 18a4 4 0 0 1-2-7.464" }],
    ["path", { d: "M6.003 5.125a4 4 0 0 0-2.526 5.77" }],
  ],
  personality: [
    ["path", { d: "M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" }],
  ],
  memoryGroup: [
    ["path", { d: "M12 18V5" }],
    ["path", { d: "M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4" }],
    ["path", { d: "M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5" }],
    ["path", { d: "M17.997 5.125a4 4 0 0 1 2.526 5.77" }],
    ["path", { d: "M18 18a4 4 0 0 0 2-7.464" }],
    ["path", { d: "M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517" }],
    ["path", { d: "M6 18a4 4 0 0 1-2-7.464" }],
    ["path", { d: "M6.003 5.125a4 4 0 0 0-2.526 5.77" }],
  ],
  memory: [
    ["path", { d: "M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" }],
    ["path", { d: "M9 18h6" }],
    ["path", { d: "M10 22h4" }],
  ],
  call: [
    ["path", { d: "M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" }],
  ],
  goal: [
    ["path", { d: "M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528" }],
  ],
  target: [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["circle", { cx: "12", cy: "12", r: "6" }],
    ["circle", { cx: "12", cy: "12", r: "2" }],
  ],
  identity: [
    ["rect", { x: "2", y: "5", width: "20", height: "14", rx: "2" }],
    ["circle", { cx: "9", cy: "11", r: "2" }],
    ["path", { d: "M6.17 15a3 3 0 0 1 5.66 0" }],
    ["path", { d: "M16 10h2" }],
    ["path", { d: "M16 14h2" }],
  ],

  // --- Taxonomy graph types ---
  playbook: [
    ["path", { d: "M12 7v14" }],
    ["path", { d: "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" }],
  ],
  spec: [
    ["path", { d: "M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z" }],
  ],
  parameter: [
    ["path", { d: "M10 5H3" }],
    ["path", { d: "M12 19H3" }],
    ["path", { d: "M14 3v4" }],
    ["path", { d: "M16 17v4" }],
    ["path", { d: "M21 12h-9" }],
    ["path", { d: "M21 19h-5" }],
    ["path", { d: "M21 5h-7" }],
    ["path", { d: "M8 10v4" }],
    ["path", { d: "M8 12H3" }],
  ],
  trigger: [
    ["path", { d: "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" }],
  ],
  action: [
    ["path", { d: "M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" }],
  ],
  anchor: [
    ["path", { d: "M12 6v16" }],
    ["path", { d: "m19 13 2-1a9 9 0 0 1-18 0l2 1" }],
    ["path", { d: "M9 11h6" }],
    ["circle", { cx: "12", cy: "4", r: "2" }],
  ],
  promptSlug: [
    ["path", { d: "M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" }],
  ],
  behaviorTarget: [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["circle", { cx: "12", cy: "12", r: "6" }],
    ["circle", { cx: "12", cy: "12", r: "2" }],
  ],
  range: [
    ["path", { d: "M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z" }],
    ["path", { d: "m14.5 12.5 2-2" }],
    ["path", { d: "m11.5 9.5 2-2" }],
    ["path", { d: "m8.5 6.5 2-2" }],
    ["path", { d: "m17.5 15.5 2-2" }],
  ],
};

// Render lucide icon elements onto a canvas context (assumes 24x24 viewBox coordinate space)
function renderIconElements(ctx: CanvasRenderingContext2D, elements: IconElement[]) {
  for (const [elType, attrs] of elements) {
    switch (elType) {
      case "path": {
        const p = new Path2D(attrs.d);
        ctx.stroke(p);
        break;
      }
      case "circle": {
        ctx.beginPath();
        ctx.arc(Number(attrs.cx), Number(attrs.cy), Number(attrs.r), 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case "line": {
        ctx.beginPath();
        ctx.moveTo(Number(attrs.x1), Number(attrs.y1));
        ctx.lineTo(Number(attrs.x2), Number(attrs.y2));
        ctx.stroke();
        break;
      }
      case "rect": {
        const rx = Number(attrs.rx || 0);
        ctx.beginPath();
        ctx.roundRect(Number(attrs.x), Number(attrs.y), Number(attrs.width), Number(attrs.height), rx);
        ctx.stroke();
        break;
      }
    }
  }
}

/** Draw a lucide icon node on 2D canvas with background disc and optional ring */
export function drawIconNode(
  ctx: CanvasRenderingContext2D,
  type: string,
  x: number,
  y: number,
  size: number,
  color: string,
  ring?: { color: string; width: number }
) {
  const elements = visualizerIcons[type];
  if (!elements) return;

  const scale = size / 12;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.translate(-12, -12);

  // Background disc
  ctx.beginPath();
  ctx.arc(12, 12, 13, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.globalAlpha *= 0.15;
  ctx.fill();
  ctx.globalAlpha /= 0.15;

  // Ring (drawn on top of disc, behind icon)
  if (ring) {
    ctx.beginPath();
    ctx.arc(12, 12, 13, 0, Math.PI * 2);
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = ring.width;
    ctx.stroke();
  }

  // Icon stroke
  ctx.strokeStyle = color;
  ctx.fillStyle = "none";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  renderIconElements(ctx, elements);

  ctx.restore();
}

/** Render icon to offscreen canvas for 3D sprite textures */
export function renderIconToCanvas(
  type: string,
  color: string,
  resolution = 64,
  ring?: { color: string; width: number }
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = resolution;
  const ctx = canvas.getContext("2d")!;

  const padding = 4;
  const scale = (resolution - padding * 2) / 24;
  ctx.translate(padding, padding);
  ctx.scale(scale, scale);

  // Background disc
  ctx.beginPath();
  ctx.arc(12, 12, 13, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.2;
  ctx.fill();
  ctx.globalAlpha = 1;

  // Ring
  if (ring) {
    ctx.beginPath();
    ctx.arc(12, 12, 13, 0, Math.PI * 2);
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = ring.width;
    ctx.stroke();
  }

  // Icon stroke
  ctx.strokeStyle = color;
  ctx.fillStyle = "none";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  renderIconElements(ctx, visualizerIcons[type] || []);

  return canvas;
}

/** Sprite texture cache — one per type+color combo, shared across all visualisers */
export const spriteTextureCache = new Map<string, any>();

/** React component for icon indicators in UI panels */
export function NodeIcon({ type, color, size = 14 }: { type: string; color: string; size?: number }) {
  const elements = visualizerIcons[type];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="flex-shrink-0">
      {elements?.map(([el, attrs], i) => {
        switch (el) {
          case "path": return <path key={i} d={attrs.d} />;
          case "circle": return <circle key={i} cx={attrs.cx} cy={attrs.cy} r={attrs.r} />;
          case "line": return <line key={i} x1={attrs.x1} y1={attrs.y1} x2={attrs.x2} y2={attrs.y2} />;
          case "rect": return <rect key={i} x={attrs.x} y={attrs.y} width={attrs.width} height={attrs.height} rx={attrs.rx} />;
          default: return null;
        }
      })}
    </svg>
  );
}
