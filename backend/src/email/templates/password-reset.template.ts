/**
 * Password reset email templates. No tokens in logs or events.
 */

export function getPasswordResetText(resetLink: string): string {
  return `You requested a password reset. Click the link below to set a new password. This link expires in 15 minutes.\n\n${resetLink}\n\nIf you did not request this, ignore this email.`;
}

export function getPasswordResetHtml(resetLink: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="font-size: 1.25rem;">Reset your password</h1>
  <p>You requested a password reset. Click the button below to set a new password. This link expires in <strong>15 minutes</strong>.</p>
  <p style="margin: 24px 0;">
    <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">Reset password</a>
  </p>
  <p style="font-size: 0.875rem; color: #666;">If the button doesn't work, copy and paste this link into your browser:</p>
  <p style="font-size: 0.875rem; word-break: break-all;">${resetLink}</p>
  <p style="font-size: 0.875rem; color: #666;">If you did not request this, you can safely ignore this email.</p>
</body>
</html>
`.trim();
}
