"use client";

import { useState, useEffect } from "react";
import { FieldHint } from "@/components/shared/FieldHint";
import { WIZARD_HINTS } from "@/lib/wizard-hints";
import { StepFooter } from "@/components/wizards/StepFooter";
import { applyBrandingToDOM, clearBrandingFromDOM } from "@/lib/branding";
import type { StepRenderProps } from "@/components/wizards/types";

export function BrandingStep({ getData, setData, onNext, onPrev }: StepRenderProps) {
  const institutionName = getData<string>("institutionName") ?? "";
  // Initialise from data bag — IdentityStep may have pre-filled these via URL import
  const [logoUrl, setLogoUrl] = useState(getData<string>("logoUrl") ?? "");
  const [primaryColor, setPrimaryColor] = useState(getData<string>("primaryColor") ?? "");
  const [secondaryColor, setSecondaryColor] = useState(getData<string>("secondaryColor") ?? "");

  // Live DOM preview — apply when colours change, clean up on unmount
  useEffect(() => {
    if (!primaryColor && !secondaryColor) return;
    applyBrandingToDOM({
      name: institutionName || "Preview",
      typeName: null,
      logoUrl: logoUrl || null,
      primaryColor: primaryColor || null,
      secondaryColor: secondaryColor || null,
      welcomeMessage: null,
    });
    return () => {
      clearBrandingFromDOM();
    };
  }, [primaryColor, secondaryColor, logoUrl, institutionName]);

  const handleContinue = () => {
    setData("logoUrl", logoUrl);
    setData("primaryColor", primaryColor);
    setData("secondaryColor", secondaryColor);
    onNext();
  };

  return (
    <div className="iw-branding-grid">
      <div>
        <FieldHint label="Logo URL" hint={WIZARD_HINTS["institution.logo"]} />
        <div className="iw-logo-preview">
          <div className="iw-logo-circle">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo" />
            ) : (
              institutionName.charAt(0).toUpperCase() || "?"
            )}
          </div>
          <input
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://example.com/logo.png"
            className="hf-input"
            style={{ flex: 1 }}
          />
        </div>
      </div>

      <div>
        <FieldHint label="Primary Colour" hint={WIZARD_HINTS["institution.primaryColor"]} />
        <div className="iw-color-row">
          <input
            type="color"
            value={primaryColor || "#3b82f6"}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="iw-color-swatch"
          />
          <input
            type="text"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            placeholder="#3b82f6"
            className="hf-input"
            style={{ flex: 1 }}
          />
        </div>
      </div>

      <div>
        <label className="hf-label">Secondary Colour</label>
        <div className="iw-color-row">
          <input
            type="color"
            value={secondaryColor || "#6366f1"}
            onChange={(e) => setSecondaryColor(e.target.value)}
            className="iw-color-swatch"
          />
          <input
            type="text"
            value={secondaryColor}
            onChange={(e) => setSecondaryColor(e.target.value)}
            placeholder="#6366f1"
            className="hf-input"
            style={{ flex: 1 }}
          />
        </div>
      </div>

      {(primaryColor || institutionName) && (
        <div className="iw-branding-preview">
          <div className="iw-branding-preview-label">Live Preview</div>
          <div className="iw-branding-preview-bar">
            <div
              className="iw-branding-preview-dot"
              style={{ background: primaryColor || "var(--accent-primary)" }}
            />
            <span className="iw-branding-preview-name">{institutionName || "Institution"}</span>
            <span
              className="iw-branding-preview-btn"
              style={{ background: primaryColor || "var(--accent-primary)" }}
            >
              Button
            </span>
          </div>
        </div>
      )}

      <StepFooter
        onBack={onPrev}
        onSkip={handleContinue}
        skipLabel="Skip"
        onNext={handleContinue}
        nextLabel="Continue"
      />
    </div>
  );
}
