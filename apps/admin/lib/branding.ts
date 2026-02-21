/**
 * Institution Branding Utilities
 *
 * Types, defaults, and DOM helpers for applying institutional branding
 * (logo, colors, name) via CSS variable overrides.
 */

export interface InstitutionBranding {
  name: string;
  typeName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  welcomeMessage: string | null;
}

export const DEFAULT_BRANDING: InstitutionBranding = {
  name: "HumanFirst Foundation",
  typeName: null,
  logoUrl: null,
  primaryColor: null, // use CSS defaults
  secondaryColor: null,
  welcomeMessage: null,
};

/**
 * Apply institution branding to the DOM via CSS variable overrides.
 * Follows the PaletteContext pattern (document.documentElement.style.setProperty).
 */
export function applyBrandingToDOM(branding: InstitutionBranding | null) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const brand = branding ?? DEFAULT_BRANDING;

  if (brand.primaryColor) {
    root.style.setProperty("--accent-primary", brand.primaryColor);
    root.style.setProperty("--button-primary-bg", brand.primaryColor);
  } else {
    root.style.removeProperty("--accent-primary");
    root.style.removeProperty("--button-primary-bg");
  }

  if (brand.secondaryColor) {
    root.style.setProperty("--accent-primary-hover", brand.secondaryColor);
  } else {
    root.style.removeProperty("--accent-primary-hover");
  }
}

/**
 * Clear all branding CSS variable overrides (reset to stylesheet defaults).
 */
export function clearBrandingFromDOM() {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.style.removeProperty("--accent-primary");
  root.style.removeProperty("--button-primary-bg");
  root.style.removeProperty("--accent-primary-hover");
}
