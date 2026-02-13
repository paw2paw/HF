// @ts-expect-error — no @types/nodemailer installed
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.resend.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  auth: {
    user: process.env.SMTP_USER || "resend",
    pass: process.env.SMTP_PASSWORD || process.env.RESEND_API_KEY || "",
  },
});

const FROM = process.env.EMAIL_FROM || "HF Admin <noreply@example.com>";

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
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";

  const context = domainName
    ? `You've been invited to test the <strong>${domainName}</strong> experience.`
    : "You've been invited to test our conversational AI system.";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
  <div style="background: linear-gradient(135deg, #3b82f6 0%, #9333ea 100%); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
    <div style="display: inline-block; width: 56px; height: 56px; background: white; border-radius: 14px; line-height: 56px; font-size: 24px; font-weight: bold; color: #3b82f6;">HF</div>
    <h1 style="color: white; margin: 16px 0 0; font-size: 22px; font-weight: 600;">You're Invited</h1>
  </div>
  <div style="background: white; padding: 32px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <p style="font-size: 16px; margin: 0 0 16px;">${greeting}</p>
    <p style="font-size: 16px; margin: 0 0 24px;">${context}</p>
    <p style="font-size: 16px; margin: 0 0 32px;">Click below to accept your invitation and get started:</p>
    <div style="text-align: center; margin: 0 0 32px;">
      <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #9333ea 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Accept Invitation</a>
    </div>
    <p style="font-size: 13px; color: #888; margin: 0 0 8px;">Or copy this link:</p>
    <p style="font-size: 13px; margin: 0 0 24px;"><a href="${inviteUrl}" style="color: #3b82f6; word-break: break-all;">${inviteUrl}</a></p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
    <p style="font-size: 13px; color: #999; margin: 0;">This invitation expires in 7 days.</p>
  </div>
</body>
</html>`.trim();

  const text = `${greeting}

${domainName ? `You've been invited to test the ${domainName} experience.` : "You've been invited to test our conversational AI system."}

Accept your invitation: ${inviteUrl}

This invitation expires in 7 days.`;

  await transporter.sendMail({
    from: FROM,
    to,
    subject: domainName
      ? `You're invited to test HF — ${domainName}`
      : "You're invited to test HF",
    text,
    html,
  });
}
