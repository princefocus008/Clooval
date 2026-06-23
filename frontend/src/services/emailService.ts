import sgMail from "@sendgrid/mail";

const DEFAULT_FROM_EMAIL = "cloovalcontact@gmail.com";
const DEFAULT_FROM_NAME = "Clooval";
const DEFAULT_FRONTEND_URL = "http://localhost:3000";
let sendGridConfigured = false;

function ensureSendGridConfigured(): boolean {
  if (sendGridConfigured) {
    return true;
  }

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.warn("SENDGRID_API_KEY is not configured. Email sends will fail.");
    return false;
  }

  sgMail.setApiKey(apiKey);
  sendGridConfigured = true;
  return true;
}

function getFromEmail(): string {
  return process.env.FROM_EMAIL || DEFAULT_FROM_EMAIL;
}

function getFromName(): string {
  return process.env.FROM_NAME || DEFAULT_FROM_NAME;
}

function getFrontendUrl(): string {
  return process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL;
}

function getEmailTokenExpireMinutes(): number {
  return Number(process.env.EMAIL_TOKEN_EXPIRE_MINUTES || 30);
}

async function _send(toEmail: string, subject: string, htmlContent: string): Promise<boolean> {
  if (!ensureSendGridConfigured()) {
    console.warn(`Skipping email send to ${toEmail} because SENDGRID_API_KEY is not configured.`);
    return false;
  }

  const message = {
    from: { email: getFromEmail(), name: getFromName() },
    to: toEmail,
    subject,
    html: htmlContent,
  };

  try {
    console.log(`[SendGrid] Attempting to send email to ${toEmail} with subject: "${subject}"`);
    const result = await sgMail.send(message);
    const response = Array.isArray(result) ? result[0] : result;
    const statusCode = typeof response === "object" && "statusCode" in response ? response.statusCode : 0;
    const success = [200, 201, 202].includes(statusCode);
    console.log(`[SendGrid] Email send ${success ? 'SUCCESS' : 'FAILED'} (status: ${statusCode}) to ${toEmail}`);
    return success;
  } catch (error: any) {
    console.error(`[SendGrid] Email send FAILED: ${error?.message || error}`);
    return false;
  }
}

function buildEmailHtml(title: string, bodyCopy: string, buttonText: string, actionUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;font-family:Inter,system-ui,sans-serif;background:#F5F7FA;color:#111111;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td align="center" style="padding:36px 16px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 28px 80px rgba(17,17,17,0.08);">
            <tr>
              <td style="padding:32px 32px 0;text-align:center;">
                <h1 style="margin:0;font-size:28px;font-weight:700;letter-spacing:-0.03em;">${getFromName()}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 24px;text-align:left;">
                <p style="margin:0 0 20px;font-size:15px;line-height:1.8;color:#52535B;">${bodyCopy}</p>
                <div style="text-align:center;margin:28px 0;">
                  <a href="${actionUrl}" style="display:inline-block;padding:14px 26px;background:#111111;color:#ffffff;text-decoration:none;border-radius:12px;font-size:15px;font-weight:600;">${buttonText}</a>
                </div>
                <p style="margin:0 0 6px;font-size:13px;color:#8F8F9C;">If the button does not work, copy and paste the link below into your browser:</p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#111111;word-break:break-word;">${actionUrl}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendVerificationEmail(toEmail: string, toName: string, token: string): Promise<boolean> {
  console.log(`[Email] Sending verification email to ${toEmail}`);
  const verifyUrl = `${getFrontendUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  const htmlContent = buildEmailHtml(
    "Verify your Cloova account",
    `Hello ${toName || "there"},<br /><br />Please verify your Cloova account by clicking the button below. This ensures you can securely access Cloova and track your requests.`,
    "Verify your email",
    verifyUrl
  );

  return _send(toEmail, "Verify your Cloova account", htmlContent);
}

export async function sendPasswordResetEmail(toEmail: string, toName: string, token: string): Promise<boolean> {
  const resetUrl = `${getFrontendUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  const htmlContent = buildEmailHtml(
    "Reset your Cloova password",
    `Hello ${toName || "there"},<br /><br />Use the button below to reset your Cloova password. This link expires in ${getEmailTokenExpireMinutes()} minutes. If you did not request this, you can ignore this email.`,
    "Reset your password",
    resetUrl
  );

  return _send(toEmail, "Reset your Cloova password", htmlContent);
}
