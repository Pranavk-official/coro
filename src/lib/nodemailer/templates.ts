export type Mail = { subject: string; text: string; html: string };

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function build(subject: string, body: string, cta: string, url: string): Mail {
  const text = `${body}\n\n${cta}: ${url}\n`;
  const html = `<!doctype html><html><body style="margin:0;padding:24px;font-family:system-ui,sans-serif;color:#111">
<div style="max-width:560px;margin:0 auto">
<p style="font-size:16px;line-height:1.5">${esc(body)}</p>
<p><a href="${esc(url)}" style="display:inline-block;padding:10px 20px;background:#111;color:#fff;border-radius:999px;text-decoration:none">${esc(cta)}</a></p>
<p style="font-size:13px;color:#555">Or paste this link into your browser:<br>${esc(url)}</p>
</div></body></html>`;
  return { subject, text, html };
}

export const magicLink = (url: string) =>
  build(
    "Your sign-in link for Coro",
    "Click to sign in. This link works once and expires in 10 minutes. If you didn't ask for it, ignore this email.",
    "Sign in",
    url,
  );

export const verifyEmail = (url: string) =>
  build(
    "Verify your email for Coro",
    "Confirm your email to finish creating your account. This link expires in 1 hour.",
    "Verify email",
    url,
  );

export const resetPassword = (url: string) =>
  build(
    "Reset your Coro password",
    "Use this link to choose a new password. It expires in 30 minutes. If you didn't ask, ignore this — your password stays the same.",
    "Reset password",
    url,
  );

export const accountExists = (url: string) =>
  build(
    "You already have a Coro account",
    "Someone tried to sign up with this address. You can sign in, or reset your password from the sign-in page. If it wasn't you, ignore this.",
    "Sign in",
    url,
  );
