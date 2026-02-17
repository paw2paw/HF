import { EMAIL_TEMPLATE_DEFAULTS } from "@/lib/system-settings";

export interface RenderEmailOptions {
  heading: string;
  bodyHtml: string;
  buttonText: string;
  buttonUrl: string;
  footer: string;
  brandColorStart?: string;
  brandColorEnd?: string;
}

/** Render branded email HTML. Client-safe — no nodemailer dependency. */
export function renderEmailHtml({
  heading,
  bodyHtml,
  buttonText,
  buttonUrl,
  footer,
  brandColorStart = EMAIL_TEMPLATE_DEFAULTS.sharedBrandColorStart,
  brandColorEnd = EMAIL_TEMPLATE_DEFAULTS.sharedBrandColorEnd,
}: RenderEmailOptions): string {
  const gradient = `linear-gradient(135deg, ${brandColorStart} 0%, ${brandColorEnd} 100%)`;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
  <div style="background: ${gradient}; padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
    <div style="display: inline-block; width: 56px; height: 56px; background: white; border-radius: 14px; line-height: 56px; font-size: 24px; font-weight: bold; color: ${brandColorStart};">HF</div>
    <h1 style="color: white; margin: 16px 0 0; font-size: 22px; font-weight: 600;">${heading}</h1>
  </div>
  <div style="background: white; padding: 32px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <div style="font-size: 16px; margin: 0 0 32px;">${bodyHtml}</div>
    <div style="text-align: center; margin: 0 0 32px;">
      <a href="${buttonUrl}" style="display: inline-block; background: ${gradient}; color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">${buttonText}</a>
    </div>
    <p style="font-size: 13px; color: #888; margin: 0 0 8px;">Or copy this link:</p>
    <p style="font-size: 13px; margin: 0 0 24px;"><a href="${buttonUrl}" style="color: ${brandColorStart}; word-break: break-all;">${buttonUrl}</a></p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
    <p style="font-size: 13px; color: #999; margin: 0;">${footer}</p>
  </div>
</body>
</html>`;
}
