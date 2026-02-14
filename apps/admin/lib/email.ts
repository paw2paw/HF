// @ts-expect-error — no @types/nodemailer installed
import nodemailer from "nodemailer";
import {
  getEmailTemplateSettings,
  EMAIL_TEMPLATE_DEFAULTS,
  type EmailTemplateSettings,
} from "@/lib/system-settings";
import { renderEmailHtml } from "@/lib/email-render";
export { renderEmailHtml, type RenderEmailOptions } from "@/lib/email-render";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.resend.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  auth: {
    user: process.env.SMTP_USER || "resend",
    pass: process.env.SMTP_PASSWORD || process.env.RESEND_API_KEY || "",
  },
});

// ── Template variable replacement ───────────────────────

function replaceVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

// ── Magic link email ────────────────────────────────────

interface SendMagicLinkEmailParams {
  to: string;
  url: string;
}

export async function sendMagicLinkEmail({ to, url }: SendMagicLinkEmailParams) {
  let settings: EmailTemplateSettings;
  try {
    settings = await getEmailTemplateSettings();
  } catch {
    settings = EMAIL_TEMPLATE_DEFAULTS;
  }

  const fromAddress = process.env.EMAIL_FROM || `${settings.sharedFromName} <noreply@example.com>`;

  const html = renderEmailHtml({
    heading: settings.magicLinkHeading,
    bodyHtml: `<p style="margin: 0 0 16px;">${settings.magicLinkBody}</p>`,
    buttonText: settings.magicLinkButtonText,
    buttonUrl: url,
    footer: settings.magicLinkFooter,
    brandColorStart: settings.sharedBrandColorStart,
    brandColorEnd: settings.sharedBrandColorEnd,
  });

  const text = `${settings.magicLinkBody}\n\nSign in: ${url}\n\n${settings.magicLinkFooter}`;

  await transporter.sendMail({
    from: fromAddress,
    to,
    subject: settings.magicLinkSubject,
    text,
    html,
  });
}

// ── Invite email ────────────────────────────────────────

interface SendInviteEmailParams {
  to: string;
  firstName?: string;
  inviteUrl: string;
  domainName?: string;
}

export async function sendInviteEmail({
  to,
  firstName,
  inviteUrl,
  domainName,
}: SendInviteEmailParams) {
  let settings: EmailTemplateSettings;
  try {
    settings = await getEmailTemplateSettings();
  } catch {
    settings = EMAIL_TEMPLATE_DEFAULTS;
  }

  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  const context = domainName
    ? `You've been invited to test the <strong>${domainName}</strong> experience.`
    : "You've been invited to test our conversational AI system.";

  const vars: Record<string, string> = {
    greeting,
    context,
    firstName: firstName || "",
    domainName: domainName || "",
  };

  const subject = replaceVars(settings.inviteSubject, vars);
  const bodyTemplate = replaceVars(settings.inviteBody, vars);
  const footerText = replaceVars(settings.inviteFooter, vars);

  const fromAddress = process.env.EMAIL_FROM || `${settings.sharedFromName} <noreply@example.com>`;

  const bodyHtml = bodyTemplate
    .split("\n")
    .map((line) => `<p style="font-size: 16px; margin: 0 0 16px;">${line}</p>`)
    .join("\n");

  const html = renderEmailHtml({
    heading: replaceVars(settings.inviteHeading, vars),
    bodyHtml,
    buttonText: replaceVars(settings.inviteButtonText, vars),
    buttonUrl: inviteUrl,
    footer: footerText,
    brandColorStart: settings.sharedBrandColorStart,
    brandColorEnd: settings.sharedBrandColorEnd,
  });

  const textContext = domainName
    ? `You've been invited to test the ${domainName} experience.`
    : "You've been invited to test our conversational AI system.";
  const text = `${greeting}\n\n${textContext}\n\nAccept your invitation: ${inviteUrl}\n\n${footerText}`;

  await transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    text,
    html,
  });
}
