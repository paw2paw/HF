"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { EMAIL_TEMPLATE_DEFAULTS } from "@/lib/system-settings";
import { renderEmailHtml } from "@/lib/email-render";

interface EmailPreviewPanelProps {
  values: Record<string, number | boolean | string>;
}

export function EmailPreviewPanel({ values }: EmailPreviewPanelProps) {
  const [showMagicLinkPreview, setShowMagicLinkPreview] = useState(false);
  const [showInvitePreview, setShowInvitePreview] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
      {/* Magic Link Preview */}
      <div style={{
        background: "var(--surface-primary)",
        border: "1px solid var(--border-default)",
        borderRadius: 16,
        padding: 24,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Magic Link Email Preview
          </h3>
          <button
            onClick={() => setShowMagicLinkPreview((v) => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 8,
              border: "1px solid var(--border-default)",
              background: showMagicLinkPreview ? "var(--accent-primary)" : "var(--surface-secondary)",
              color: showMagicLinkPreview ? "white" : "var(--text-primary)",
              fontSize: 12, fontWeight: 500, cursor: "pointer",
            }}
          >
            {showMagicLinkPreview ? <EyeOff size={14} /> : <Eye size={14} />}
            {showMagicLinkPreview ? "Hide" : "Preview"}
          </button>
        </div>
        {showMagicLinkPreview && (
          <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--border-default)" }}>
            <div style={{ padding: "8px 12px", background: "var(--surface-secondary)", fontSize: 11, color: "var(--text-muted)" }}>
              Subject: <strong style={{ color: "var(--text-primary)" }}>
                {String(values["email.magic_link.subject"] ?? EMAIL_TEMPLATE_DEFAULTS.magicLinkSubject)}
              </strong>
            </div>
            <iframe
              title="Magic link email preview"
              sandbox=""
              style={{ width: "100%", height: 500, border: "none", background: "#f5f5f5" }}
              srcDoc={renderEmailHtml({
                heading: String(values["email.magic_link.heading"] ?? EMAIL_TEMPLATE_DEFAULTS.magicLinkHeading),
                bodyHtml: `<p style="font-size:16px;margin:0 0 16px;">${String(values["email.magic_link.body"] ?? EMAIL_TEMPLATE_DEFAULTS.magicLinkBody)}</p>`,
                buttonText: String(values["email.magic_link.button_text"] ?? EMAIL_TEMPLATE_DEFAULTS.magicLinkButtonText),
                buttonUrl: "https://example.com/auth/verify?token=abc123",
                footer: String(values["email.magic_link.footer"] ?? EMAIL_TEMPLATE_DEFAULTS.magicLinkFooter),
                brandColorStart: String(values["email.shared.brand_color_start"] ?? EMAIL_TEMPLATE_DEFAULTS.sharedBrandColorStart),
                brandColorEnd: String(values["email.shared.brand_color_end"] ?? EMAIL_TEMPLATE_DEFAULTS.sharedBrandColorEnd),
              })}
            />
          </div>
        )}
      </div>

      {/* Invite Preview */}
      <div style={{
        background: "var(--surface-primary)",
        border: "1px solid var(--border-default)",
        borderRadius: 16,
        padding: 24,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Invite Email Preview
          </h3>
          <button
            onClick={() => setShowInvitePreview((v) => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 8,
              border: "1px solid var(--border-default)",
              background: showInvitePreview ? "var(--accent-primary)" : "var(--surface-secondary)",
              color: showInvitePreview ? "white" : "var(--text-primary)",
              fontSize: 12, fontWeight: 500, cursor: "pointer",
            }}
          >
            {showInvitePreview ? <EyeOff size={14} /> : <Eye size={14} />}
            {showInvitePreview ? "Hide" : "Preview"}
          </button>
        </div>
        {showInvitePreview && (() => {
          const exampleVars: Record<string, string> = {
            greeting: "Hi Alex,",
            context: "You've been invited to test the <strong>Quality Management</strong> experience.",
            firstName: "Alex",
            domainName: "Quality Management",
          };
          const replaceVars = (t: string) => t.replace(/\{\{(\w+)\}\}/g, (_, k: string) => exampleVars[k] ?? `{{${k}}}`);
          const rawBody = String(values["email.invite.body"] ?? EMAIL_TEMPLATE_DEFAULTS.inviteBody);
          const bodyHtml = replaceVars(rawBody)
            .split("\n")
            .map((line: string) => `<p style="font-size:16px;margin:0 0 16px;">${line}</p>`)
            .join("\n");
          const subject = replaceVars(String(values["email.invite.subject"] ?? EMAIL_TEMPLATE_DEFAULTS.inviteSubject));

          return (
            <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--border-default)" }}>
              <div style={{ padding: "8px 12px", background: "var(--surface-secondary)", fontSize: 11, color: "var(--text-muted)" }}>
                Subject: <strong style={{ color: "var(--text-primary)" }}>{subject}</strong>
                <span style={{ marginLeft: 12, fontStyle: "italic" }}>(example: Alex invited to Quality Management)</span>
              </div>
              <iframe
                title="Invite email preview"
                sandbox=""
                style={{ width: "100%", height: 500, border: "none", background: "#f5f5f5" }}
                srcDoc={renderEmailHtml({
                  heading: replaceVars(String(values["email.invite.heading"] ?? EMAIL_TEMPLATE_DEFAULTS.inviteHeading)),
                  bodyHtml,
                  buttonText: replaceVars(String(values["email.invite.button_text"] ?? EMAIL_TEMPLATE_DEFAULTS.inviteButtonText)),
                  buttonUrl: "https://example.com/invite/accept?token=xyz789",
                  footer: replaceVars(String(values["email.invite.footer"] ?? EMAIL_TEMPLATE_DEFAULTS.inviteFooter)),
                  brandColorStart: String(values["email.shared.brand_color_start"] ?? EMAIL_TEMPLATE_DEFAULTS.sharedBrandColorStart),
                  brandColorEnd: String(values["email.shared.brand_color_end"] ?? EMAIL_TEMPLATE_DEFAULTS.sharedBrandColorEnd),
                })}
              />
            </div>
          );
        })()}
      </div>
    </div>
  );
}
