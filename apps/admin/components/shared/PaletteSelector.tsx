"use client";

import { usePalette } from "@/contexts";
import { useTheme } from "@/contexts";

export function PaletteSelector() {
  const { lightPalette, darkPalette, setLightPalette, setDarkPalette, lightPresets, darkPresets } = usePalette();
  const { resolvedTheme } = useTheme();

  return (
    <div className="space-y-6">
      {/* Light Mode Palettes */}
      <div>
        <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
          Light Mode Palette
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {lightPresets.map((preset) => {
            const isSelected = lightPalette === preset.id;
            const isActive = resolvedTheme === "light" && isSelected;
            return (
              <button
                key={preset.id}
                onClick={() => setLightPalette(preset.id)}
                className={`
                  relative rounded-lg p-3 text-left transition-all
                  ${isSelected
                    ? "ring-2 ring-indigo-500 dark:ring-indigo-400"
                    : "ring-1 ring-neutral-200 dark:ring-neutral-700 hover:ring-neutral-300 dark:hover:ring-neutral-600"
                  }
                `}
                style={{ backgroundColor: preset.light.surfacePrimary }}
              >
                {/* Color swatches */}
                <div className="flex gap-1 mb-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: preset.light.background }}
                    title="Background"
                  />
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: preset.light.surfacePrimary }}
                    title="Surface"
                  />
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: preset.light.surfaceSecondary }}
                    title="Secondary"
                  />
                  <div
                    className="w-4 h-4 rounded border border-neutral-300"
                    style={{ backgroundColor: preset.light.surfaceTertiary }}
                    title="Tertiary"
                  />
                </div>
                <div className="text-xs font-medium" style={{ color: "#374151" }}>
                  {preset.name}
                </div>
                <div className="text-[10px]" style={{ color: "#6b7280" }}>
                  {preset.description}
                </div>
                {isActive && (
                  <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-green-500" title="Currently active" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dark Mode Palettes */}
      <div>
        <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
          Dark Mode Palette
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {darkPresets.map((preset) => {
            const isSelected = darkPalette === preset.id;
            const isActive = resolvedTheme === "dark" && isSelected;
            const colors = preset.dark!;
            return (
              <button
                key={preset.id}
                onClick={() => setDarkPalette(preset.id)}
                className={`
                  relative rounded-lg p-3 text-left transition-all
                  ${isSelected
                    ? "ring-2 ring-indigo-500 dark:ring-indigo-400"
                    : "ring-1 ring-neutral-600 hover:ring-neutral-500"
                  }
                `}
                style={{ backgroundColor: colors.surfacePrimary }}
              >
                {/* Color swatches */}
                <div className="flex gap-1 mb-2">
                  <div
                    className="w-4 h-4 rounded border border-neutral-600"
                    style={{ backgroundColor: colors.background }}
                    title="Background"
                  />
                  <div
                    className="w-4 h-4 rounded border border-neutral-600"
                    style={{ backgroundColor: colors.surfacePrimary }}
                    title="Surface"
                  />
                  <div
                    className="w-4 h-4 rounded border border-neutral-600"
                    style={{ backgroundColor: colors.surfaceSecondary }}
                    title="Secondary"
                  />
                  <div
                    className="w-4 h-4 rounded border border-neutral-600"
                    style={{ backgroundColor: colors.surfaceTertiary }}
                    title="Tertiary"
                  />
                </div>
                <div className="text-xs font-medium" style={{ color: "#e5e7eb" }}>
                  {preset.name}
                </div>
                <div className="text-[10px]" style={{ color: "#9ca3af" }}>
                  {preset.description}
                </div>
                {isActive && (
                  <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-green-500" title="Currently active" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Compact version for sidebar or quick access
export function PaletteSelectorCompact() {
  const { lightPalette, darkPalette, setLightPalette, setDarkPalette, lightPresets, darkPresets } = usePalette();
  const { resolvedTheme } = useTheme();

  const currentPresets = resolvedTheme === "dark" ? darkPresets : lightPresets;
  const currentPalette = resolvedTheme === "dark" ? darkPalette : lightPalette;
  const setCurrentPalette = resolvedTheme === "dark" ? setDarkPalette : setLightPalette;

  return (
    <div className="flex gap-1.5">
      {currentPresets.map((preset) => {
        const isSelected = currentPalette === preset.id;
        const colors = resolvedTheme === "dark" && preset.dark ? preset.dark : preset.light;
        return (
          <button
            key={preset.id}
            onClick={() => setCurrentPalette(preset.id)}
            className={`
              w-6 h-6 rounded transition-all
              ${isSelected ? "ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-neutral-900" : "hover:scale-110"}
            `}
            style={{ backgroundColor: colors.surfacePrimary }}
            title={`${preset.name}: ${preset.description}`}
          />
        );
      })}
    </div>
  );
}
