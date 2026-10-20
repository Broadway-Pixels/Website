// An authenticated service-binding relay, not an embedded Fleeterbase application.
const encoder = new TextEncoder();
const digest = async value => new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
const reply = (status, body) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export async function handleFleeterbaseVerification(request, env, fetchImpl = fetch) {
  if (request.method !== 'POST') return reply(405, { message: 'Method not allowed.' });
  const supplied = request.headers.get('x-fleeterbase-relay-secret');
  if (!supplied || !env.FLEETERBASE_EMAIL_RELAY_SECRET) return reply(404, { message: 'Not found.' });
  const [actual, expected] = await Promise.all([digest(supplied), digest(env.FLEETERBASE_EMAIL_RELAY_SECRET)]);
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual[i] ^ expected[i];
  if (difference) return reply(404, { message: 'Not found.' });
  if (!env.RESEND_API_KEY) return reply(503, { message: 'Email sending is not configured.' });
  if (!request.headers.get('content-type')?.startsWith('application/json')) return reply(415, { message: 'JSON required.' });
  let input;
  try {
    const reader = request.body?.getReader();
    if (!reader) return reply(400, { message: 'JSON required.' });
    const chunks = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); return reply(413, { message: 'Request too large.' }); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    input = JSON.parse(new TextDecoder().decode(bytes));
  } catch { return reply(400, { message: 'Invalid JSON.' }); }
  const to = typeof input?.to === 'string' ? input.to.trim().toLowerCase() : '';
  if (to.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to)) return reply(422, { message: 'Invalid recipient.' });
  const changed = input?.passwordChanged === true;
  const changeId = typeof input?.changeId === 'string' ? input.changeId : '';
  const reset = !changed && typeof input?.resetUrl === 'string';
  if (changed && (input.resetUrl !== undefined || input.verificationUrl !== undefined || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(changeId))) {
    return reply(422, { message: 'Invalid password change event.' });
  }
  let verificationUrl = '';
  if (!changed) {
    let url;
    try { url = new URL(reset ? input.resetUrl : input.verificationUrl); } catch { return reply(422, { message: 'Invalid Fleeterbase link.' }); }
    const token = url.searchParams.get('token');
    const resetToken = url.searchParams.get('reset-password');
    const verificationLink = !reset && url.pathname === '/api/auth/verify' && [...url.searchParams.keys()].length === 1 && /^[A-Za-z0-9_-]{43}$/.test(token || '');
    const resetLink = reset && url.pathname === '/' && [...url.searchParams.keys()].length === 1 && /^[A-Za-z0-9_-]{43}$/.test(resetToken || '');
    if (url.origin !== 'https://fleeterbase.com' || url.username || url.password || url.hash || (!verificationLink && !resetLink)) {
      return reply(422, { message: 'Invalid Fleeterbase link.' });
    }
    verificationUrl = url.href;
  }
  const kind = changed ? 'password-changed' : reset ? 'reset' : 'verification';
  const key = [...await digest(`${to}\n${changed ? changeId : verificationUrl}`)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const subject = changed ? 'Your Fleeterbase password was changed' : reset ? 'Reset your Fleeterbase password' : 'Verify your Fleeterbase account';
  const text = changed
    ? 'Your Fleeterbase password was changed successfully, and your previous sessions have been signed out. If you did not make this change, reset your password immediately at https://fleeterbase.com and contact support@broadwaypixels.com.'
    : reset
    ? `Reset your Fleeterbase password using this secure link:\n\n${verificationUrl}\n\nThis one-time link expires in 1 hour. If you did not request this, you can ignore this email.`
    : `Confirm your email address to finish creating your Fleeterbase account:\n\n${verificationUrl}\n\nThis link expires in 24 hours. If you did not request this, you can ignore this email.`;
  const content = changed
    ? '<h1 style="color:#0b1f36;font-size:28px;margin:0 0 18px">Password changed</h1><p>Your Fleeterbase password was changed successfully. For your protection, your previous sessions have been signed out.</p><div style="background:#f4f8f9;border-left:4px solid #0e9b96;border-radius:6px;margin:24px 0;padding:16px"><strong>Wasn\'t you?</strong><br>Reset your password immediately and contact our support team.</div><p><a href="https://fleeterbase.com" style="color:#087f7b;font-weight:700">Go to Fleeterbase</a></p>'
    : reset
      ? `<h1 style="color:#0b1f36;font-size:28px;margin:0 0 18px">Reset your password</h1><p>Use the secure link below to choose a new Fleeterbase password.</p><p style="margin:28px 0"><a href="${verificationUrl}" style="background:#0e9b96;border-radius:8px;color:#fff;display:inline-block;font-weight:700;padding:13px 22px;text-decoration:none">Reset password</a></p><p style="color:#607086;font-size:14px">This one-time link expires in 1 hour. If you did not request it, you can safely ignore this email.</p>`
      : `<h1 style="color:#0b1f36;font-size:28px;margin:0 0 18px">Verify your email</h1><p>Confirm your email address to finish creating your Fleeterbase account.</p><p style="margin:28px 0"><a href="${verificationUrl}" style="background:#0e9b96;border-radius:8px;color:#fff;display:inline-block;font-weight:700;padding:13px 22px;text-decoration:none">Verify email address</a></p><p style="color:#607086;font-size:14px">This link expires in 24 hours. If you did not create an account, you can safely ignore this email.</p>`;
  const html = `<!doctype html><html><body style="background:#eef3f5;font-family:Arial,sans-serif;margin:0;padding:32px 16px;color:#23364d"><div style="background:#fff;border:1px solid #dce5e9;border-radius:14px;box-shadow:0 6px 24px rgba(11,31,54,.08);margin:auto;max-width:580px;overflow:hidden"><div style="background:#0b1f36;padding:22px 30px"><img src="https://fleeterbase.com/app-icon-192.png" alt="Fleeterbase" width="46" height="46" style="border-radius:10px;display:inline-block;vertical-align:middle"><strong style="color:#fff;font-size:22px;margin-left:12px;vertical-align:middle">Fleeterbase</strong></div><div style="line-height:1.6;padding:34px 30px">${content}<hr style="border:0;border-top:1px solid #e3eaed;margin:28px 0"><p style="color:#607086;font-size:13px;margin:0">Need help? Email <a href="mailto:support@broadwaypixels.com" style="color:#087f7b">support@broadwaypixels.com</a>.</p></div></div></body></html>`;
  try {
    const send = (from, suffix = '') => fetchImpl('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(15_000),
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json', 'idempotency-key': `fleeterbase-${kind}-${key}${suffix}` },
      body: JSON.stringify({ from, to: [to], reply_to: 'support@broadwaypixels.com', subject, text, html,
        tags: [{ name: 'project', value: 'fleeterbase' }, { name: 'type', value: changed ? 'password_changed' : reset ? 'password_reset' : 'email_verification' }] }),
    });
    let response = await send('Fleeterbase <no-reply@fleeterbase.com>');
    if (response.status === 403) {
      console.warn(JSON.stringify({ event: 'fleeterbase_sender_pending', fallback: true }));
      response = await send('Fleeterbase via Broadway Pixels <support@broadwaypixels.com>', '-verified-fallback');
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok || typeof result.id !== 'string' || !result.id) {
      console.error(JSON.stringify({ event: 'fleeterbase_email_rejected', status: response.status }));
      return reply(502, { message: 'Email service is temporarily unavailable.' });
    }
    console.log(JSON.stringify({ event: 'fleeterbase_email_accepted', id: result.id }));
    return reply(200, { sent: true, id: result.id });
  } catch {
    console.error(JSON.stringify({ event: 'fleeterbase_email_unavailable' }));
    return reply(502, { message: 'Email service is temporarily unavailable.' });
  }
}
