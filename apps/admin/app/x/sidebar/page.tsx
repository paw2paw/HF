"use client";

import { useState, useRef, useEffect } from "react";
import { Monitor, Smartphone, Tablet, Maximize } from "lucide-react";
import { FancySelect } from "@/components/shared/FancySelect";

/**
 * Responsive Design Viewer
 *
 * Allows developers to preview the app in different device sizes/modes
 * Useful for testing mobile responsive design without switching devices
 */

type DevicePreset = {
  id: string;
  name: string;
  width: number;
  height: number;
  icon: typeof Smartphone;
  category: "phone" | "tablet" | "desktop";
};

const DEVICE_PRESETS: DevicePreset[] = [
  // Phones
  { id: "iphone-se", name: "iPhone SE", width: 375, height: 667, icon: Smartphone, category: "phone" },
  { id: "iphone-14", name: "iPhone 14", width: 390, height: 844, icon: Smartphone, category: "phone" },
  { id: "iphone-14-pro-max", name: "iPhone 14 Pro Max", width: 430, height: 932, icon: Smartphone, category: "phone" },
  { id: "pixel-7", name: "Pixel 7", width: 412, height: 915, icon: Smartphone, category: "phone" },
  { id: "samsung-s21", name: "Samsung S21", width: 360, height: 800, icon: Smartphone, category: "phone" },

  // Tablets
  { id: "ipad-mini", name: "iPad Mini", width: 768, height: 1024, icon: Tablet, category: "tablet" },
  { id: "ipad-air", name: "iPad Air", width: 820, height: 1180, icon: Tablet, category: "tablet" },
  { id: "ipad-pro-11", name: "iPad Pro 11\"", width: 834, height: 1194, icon: Tablet, category: "tablet" },
  { id: "ipad-pro-13", name: "iPad Pro 13\"", width: 1024, height: 1366, icon: Tablet, category: "tablet" },

  // Desktop
  { id: "laptop", name: "Laptop", width: 1366, height: 768, icon: Monitor, category: "desktop" },
  { id: "desktop", name: "Desktop", width: 1920, height: 1080, icon: Monitor, category: "desktop" },
  { id: "desktop-4k", name: "4K Desktop", width: 2560, height: 1440, icon: Monitor, category: "desktop" },
];

const ROUTES_TO_TEST = [
  { path: "/x/playground", label: "Playground" },
  { path: "/x/callers", label: "Callers" },
  { path: "/x/specs", label: "Specs" },
  { path: "/x/domains", label: "Domains" },
];

export default function ResponsiveViewerPage() {
  const [selectedDevice, setSelectedDevice] = useState<DevicePreset>(DEVICE_PRESETS[1]); // iPhone 14
  const [currentRoute, setCurrentRoute] = useState(ROUTES_TO_TEST[0].path);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [customWidth, setCustomWidth] = useState("");
  const [customHeight, setCustomHeight] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const currentWidth = orientation === "portrait" ? selectedDevice.width : selectedDevice.height;
  const currentHeight = orientation === "portrait" ? selectedDevice.height : selectedDevice.width;

  const actualWidth = showCustom && customWidth ? parseInt(customWidth) : currentWidth;
  const actualHeight = showCustom && customHeight ? parseInt(customHeight) : currentHeight;

  // Navigate iframe without reloading
  useEffect(() => {
    if (iframeRef.current) {
      try {
        iframeRef.current.contentWindow?.location.replace(currentRoute);
      } catch {
        // Fallback if cross-origin
      }
    }
  }, [currentRoute]);

  const toggleOrientation = () => {
    setOrientation(orientation === "portrait" ? "landscape" : "portrait");
  };

  const getBreakpointLabel = (width: number) => {
    if (width < 768) return "Mobile (< 768px)";
    if (width < 1024) return "Tablet (768px - 1023px)";
    return "Desktop (≥ 1024px)";
  };

  const Icon = selectedDevice.icon;

  // Device options for FancySelect
  const deviceOptions = DEVICE_PRESETS.map((device) => ({
    value: device.id,
    label: `${device.name} (${device.width}×${device.height})`,
    category: device.category === "phone" ? "📱 Phones" : device.category === "tablet" ? "📱 Tablets" : "🖥️ Desktop",
  }));

  // Route options for FancySelect
  const routeOptions = ROUTES_TO_TEST.map((route) => ({
    value: route.path,
    label: route.label,
  }));

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--surface-primary)" }}>
      {/* Header */}
      <div className="border-b" style={{ borderColor: "var(--border-default)", background: "var(--surface-secondary)" }}>
        <div className="px-6 py-4">
          <a href="/x/settings" style={{ fontSize: 13, color: "var(--accent-primary)", textDecoration: "none" }}>&larr; Back to Settings</a>
          <h1 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)", marginTop: 4 }}>
            Responsive Design Viewer
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Preview the app in different device sizes and orientations
          </p>
        </div>

        {/* Controls */}
        <div className="px-6 pb-4 flex justify-center">
          <div className="flex items-end gap-4 flex-wrap">
            {/* Device selector */}
            <div className="flex flex-col">
              <label className="text-xs font-semibold mb-1.5 h-[18px] flex items-center" style={{ color: "var(--text-secondary)" }}>
                Device Preset
              </label>
              <FancySelect
                value={selectedDevice.id}
                onChange={(value) => {
                  const device = DEVICE_PRESETS.find((d) => d.id === value);
                  if (device) {
                    setSelectedDevice(device);
                    setShowCustom(false);
                  }
                }}
                options={deviceOptions}
              />
            </div>

            {/* Route selector */}
            <div className="flex flex-col">
              <label className="text-xs font-semibold mb-1.5 h-[18px] flex items-center" style={{ color: "var(--text-secondary)" }}>
                Page to Preview
              </label>
              <FancySelect value={currentRoute} onChange={setCurrentRoute} options={routeOptions} />
            </div>

            {/* Orientation toggle */}
            <div className="flex flex-col">
              <label className="text-xs font-semibold mb-1.5 h-[18px] flex items-center" style={{ color: "var(--text-secondary)" }}>
                Orientation
              </label>
              <div className="flex gap-2 h-[42px]">
                <button
                  onClick={() => setOrientation("portrait")}
                  className="px-3 rounded-lg border transition-all flex items-center justify-center"
                  style={{
                    borderColor: orientation === "portrait" ? "var(--accent-primary)" : "var(--border-default)",
                    background: orientation === "portrait" ? "rgba(99, 102, 241, 0.1)" : "var(--surface-primary)",
                    color: orientation === "portrait" ? "var(--accent-primary)" : "var(--text-secondary)",
                  }}
                  title="Portrait"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="7" y="3" width="10" height="18" rx="1.5" />
                    <line x1="9.5" y1="18" x2="14.5" y2="18" strokeLinecap="round" />
                  </svg>
                </button>
                <button
                  onClick={() => setOrientation("landscape")}
                  className="px-3 rounded-lg border transition-all flex items-center justify-center"
                  style={{
                    borderColor: orientation === "landscape" ? "var(--accent-primary)" : "var(--border-default)",
                    background: orientation === "landscape" ? "rgba(99, 102, 241, 0.1)" : "var(--surface-primary)",
                    color: orientation === "landscape" ? "var(--accent-primary)" : "var(--text-secondary)",
                  }}
                  title="Landscape"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="7" width="18" height="10" rx="1.5" />
                    <line x1="15.5" y1="9.5" x2="15.5" y2="14.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Custom size button */}
            <div className="flex flex-col">
              <label className="text-xs font-semibold mb-1.5 h-[18px] flex items-center" style={{ color: "var(--text-secondary)" }}>
                Custom Size
              </label>
              <button
                onClick={() => setCustomModalOpen(true)}
                className="h-[42px] px-4 rounded-lg border font-semibold text-sm flex items-center gap-2 transition-all"
                style={{
                  borderColor: showCustom ? "var(--accent-primary)" : "var(--border-default)",
                  background: showCustom ? "rgba(99, 102, 241, 0.1)" : "var(--surface-primary)",
                  color: showCustom ? "var(--accent-primary)" : "var(--text-primary)",
                }}
              >
                <Maximize className="w-4 h-4" />
                {showCustom ? `${actualWidth}×${actualHeight}` : "Custom"}
              </button>
            </div>
          </div>
        </div>

        {/* Info bar */}
        <div
          className="px-6 py-3 border-t flex flex-wrap items-center justify-between gap-4"
          style={{ borderColor: "var(--border-default)", background: "rgba(99, 102, 241, 0.05)" }}
        >
          <div className="flex items-center gap-6 text-sm flex-wrap">
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4" style={{ color: "var(--accent-primary)" }} />
              <span style={{ color: "var(--text-secondary)" }}>
                <strong style={{ color: "var(--text-primary)" }}>{selectedDevice.name}</strong>
              </span>
            </div>
            <div style={{ color: "var(--text-secondary)" }}>
              Viewport:{" "}
              <strong style={{ color: "var(--text-primary)" }}>
                {actualWidth}×{actualHeight}px
              </strong>
            </div>
            <div
              className="px-3 py-1 rounded-full text-xs font-semibold"
              style={{ background: "var(--accent-primary)", color: "white" }}
            >
              {getBreakpointLabel(actualWidth)}
            </div>
          </div>
        </div>
      </div>

      {/* Viewer */}
      <div
        className="flex-1 overflow-auto flex items-start justify-center p-8"
        style={{ background: "var(--surface-tertiary)" }}
      >
        <div
          className="shadow-2xl border transition-all duration-300"
          style={{
            width: actualWidth,
            height: actualHeight,
            borderColor: "var(--border-default)",
            background: "var(--surface-primary)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <iframe
            ref={iframeRef}
            key={`${actualWidth}-${actualHeight}-${orientation}`}
            src={currentRoute}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
            }}
            title="Responsive Preview"
          />
        </div>
      </div>

      {/* Footer info */}
      <div
        className="border-t px-6 py-3"
        style={{ borderColor: "var(--border-default)", background: "var(--surface-secondary)" }}
      >
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          💡 <strong>Tip:</strong> The iframe shows the actual app as it would appear on the selected device. Mobile
          pages (&lt; 768px) show simplified layouts with hamburger menu. Toggle Desktop Mode within the iframe to see
          the full UI with horizontal scroll.
        </p>
      </div>

      {/* Custom Size Modal */}
      {customModalOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setCustomModalOpen(false)}
            style={{ backdropFilter: "blur(4px)" }}
          />
          <div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md rounded-xl border shadow-2xl"
            style={{
              background: "var(--surface-primary)",
              borderColor: "var(--border-default)",
            }}
          >
            <div className="px-6 py-4 border-b" style={{ borderColor: "var(--border-default)" }}>
              <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                Custom Viewport Size
              </h3>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                Enter custom width and height in pixels
              </p>
            </div>

            <div className="px-6 py-6 space-y-4">
              <div>
                <label className="text-sm font-semibold mb-2 block" style={{ color: "var(--text-secondary)" }}>
                  Width (px)
                </label>
                <input
                  type="number"
                  value={customWidth}
                  onChange={(e) => setCustomWidth(e.target.value)}
                  placeholder={String(currentWidth)}
                  className="w-full px-4 py-2.5 rounded-lg border text-base font-mono"
                  style={{
                    borderColor: "var(--border-default)",
                    background: "var(--surface-secondary)",
                    color: "var(--text-primary)",
                  }}
                  min="320"
                  max="3840"
                />
              </div>

              <div>
                <label className="text-sm font-semibold mb-2 block" style={{ color: "var(--text-secondary)" }}>
                  Height (px)
                </label>
                <input
                  type="number"
                  value={customHeight}
                  onChange={(e) => setCustomHeight(e.target.value)}
                  placeholder={String(currentHeight)}
                  className="w-full px-4 py-2.5 rounded-lg border text-base font-mono"
                  style={{
                    borderColor: "var(--border-default)",
                    background: "var(--surface-secondary)",
                    color: "var(--text-primary)",
                  }}
                  min="240"
                  max="2160"
                />
              </div>

              <div className="pt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                💡 Common sizes: 375×667 (iPhone SE), 1920×1080 (Desktop), 768×1024 (iPad)
              </div>
            </div>

            <div
              className="px-6 py-4 border-t flex items-center justify-end gap-3"
              style={{ borderColor: "var(--border-default)", background: "var(--surface-secondary)" }}
            >
              <button
                onClick={() => {
                  setCustomWidth("");
                  setCustomHeight("");
                  setShowCustom(false);
                  setCustomModalOpen(false);
                }}
                className="px-4 py-2 rounded-lg border font-semibold text-sm transition-colors"
                style={{
                  borderColor: "var(--border-default)",
                  background: "var(--surface-primary)",
                  color: "var(--text-secondary)",
                }}
              >
                Reset
              </button>
              <button
                onClick={() => {
                  if (customWidth || customHeight) {
                    setShowCustom(true);
                  }
                  setCustomModalOpen(false);
                }}
                className="px-4 py-2 rounded-lg font-semibold text-sm text-white transition-colors"
                style={{
                  background: "var(--accent-primary)",
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
