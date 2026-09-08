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
  let url;
  try { url = new URL(input.verificationUrl); } catch { return reply(422, { message: 'Invalid verification link.' }); }
  const token = url.searchParams.get('token');
  if (url.origin !== 'https://fleeterbase.com' || url.pathname !== '/api/auth/verify' || url.username || url.password || url.hash ||
      [...url.searchParams.keys()].length !== 1 || !/^[A-Za-z0-9_-]{43}$/.test(token || '')) {
    return reply(422, { message: 'Invalid verification link.' });
  }
  const verificationUrl = url.href;
  const key = [...await digest(`${to}\n${verificationUrl}`)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  try {
    const response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(15_000),
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json', 'idempotency-key': `fleeterbase-verification-${key}` },
      body: JSON.stringify({
        from: 'Fleeterbase via Broadway Pixels <support@broadwaypixels.com>', to: [to], reply_to: 'support@broadwaypixels.com',
        subject: 'Verify your Fleeterbase account',
        text: `Confirm your email address to finish creating your Fleeterbase account:\n\n${verificationUrl}\n\nThis link expires in 24 hours. If you did not request this, you can ignore this email.`,
        html: `<h1>Verify your Fleeterbase account</h1><p>Confirm your email address to finish creating your account.</p><p><a href="${verificationUrl}">Verify email address</a></p><p>This link expires in 24 hours. If you did not request this, you can ignore this email.</p>`,
        tags: [{ name: 'project', value: 'fleeterbase' }, { name: 'type', value: 'email_verification' }],
      }),
    });
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
