import assert from 'node:assert/strict';
import test from 'node:test';
import { handleFleeterbaseVerification } from '../lib/fleeterbase-email.mjs';
import { handleRequest } from '../worker/index.mjs';

const env = { FLEETERBASE_EMAIL_RELAY_SECRET: 'test-relay-secret', RESEND_API_KEY: 'test-key' };
const body = { to: 'host@example.com', verificationUrl: `https://fleeterbase.com/api/auth/verify?token=${'a'.repeat(43)}` };
const request = (value = body, secret = env.FLEETERBASE_EMAIL_RELAY_SECRET) => new Request('https://broadwaypixels.internal/api/internal/fleeterbase-verification', {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-fleeterbase-relay-secret': secret }, body: JSON.stringify(value),
});

test('relay route is registered and denies unauthenticated access', async () => {
  const res = await handleRequest(request(body, 'wrong'), env);
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { message: 'Not found.' });
});
test('relay accepts only authenticated requests and fixed verification links', async () => {
  let calls = 0;
  const sender = async () => { calls++; return Response.json({ id: 'email-1' }); };
  for (const value of [{ ...body, to: 'bad\r\naddress' }, { ...body, verificationUrl: 'https://attacker.example/' },
    { ...body, verificationUrl: body.verificationUrl + '&redirect=evil' }, { ...body, verificationUrl: body.verificationUrl + '#x' }]) {
    assert.equal((await handleFleeterbaseVerification(request(value), env, sender)).status, 422);
  }
  assert.equal((await handleFleeterbaseVerification(request(), {}, sender)).status, 404);
  assert.equal((await handleFleeterbaseVerification(request({ ...body, extra: 'x'.repeat(5000) }), env, sender)).status, 413);
  assert.equal(calls, 0);
});
test('relay sends through existing verified sender and returns a provider acknowledgement', async () => {
  let sent;
  const res = await handleFleeterbaseVerification(request(), env, async (url, init) => {
    assert.equal(url, 'https://api.resend.com/emails');
    sent = JSON.parse(init.body);
    assert.match(init.headers['idempotency-key'], /^fleeterbase-verification-/);
    return Response.json({ id: 'email-1' });
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { sent: true, id: 'email-1' });
  assert.deepEqual(sent.to, ['host@example.com']);
  assert.equal(sent.from, 'Fleeterbase <no-reply@fleeterbase.com>');
  assert.equal(sent.reply_to, 'support@broadwaypixels.com');
  assert.match(sent.text, /expires in 24 hours/);
});
test('relay accepts only fixed Fleeterbase password reset links', async () => {
  const resetBody = { to: 'host@example.com', resetUrl: `https://fleeterbase.com/?reset-password=${'b'.repeat(43)}` };
  let sent;
  const res = await handleFleeterbaseVerification(request(resetBody), env, async (_url, init) => {
    sent = JSON.parse(init.body);
    assert.match(init.headers['idempotency-key'], /^fleeterbase-reset-/);
    return Response.json({ id: 'reset-1' });
  });
  assert.equal(res.status, 200);
  assert.equal(sent.subject, 'Reset your Fleeterbase password');
  assert.match(sent.text, /expires in 1 hour/);
  for (const resetUrl of ['https://attacker.example/?reset-password=x', `https://fleeterbase.com/?reset-password=${'b'.repeat(43)}&next=evil`, `https://fleeterbase.com/api/auth/verify?reset-password=${'b'.repeat(43)}`]) {
    assert.equal((await handleFleeterbaseVerification(request({ ...resetBody, resetUrl }), env, async () => Response.json({ id: 'wrong' }))).status, 422);
  }
});
test('relay sends a branded confirmation after a password change', async () => {
  const changedBody = { to: 'host@example.com', passwordChanged: true, changeId: '9e5b1f51-9e18-4cca-9b4d-d6300372c982' };
  let sent;
  const res = await handleFleeterbaseVerification(request(changedBody), env, async (_url, init) => {
    sent = JSON.parse(init.body);
    assert.match(init.headers['idempotency-key'], /^fleeterbase-password-changed-/);
    return Response.json({ id: 'changed-1' });
  });
  assert.equal(res.status, 200);
  assert.equal(sent.subject, 'Your Fleeterbase password was changed');
  assert.match(sent.html, /https:\/\/fleeterbase\.com\/app-icon-192\.png/);
  assert.match(sent.text, /previous sessions have been signed out/);
  assert.deepEqual(sent.tags, [{ name: 'project', value: 'fleeterbase' }, { name: 'type', value: 'password_changed' }]);
  for (const invalid of [
    { to: 'host@example.com', passwordChanged: true },
    { ...changedBody, changeId: 'not-a-uuid' },
    { ...changedBody, resetUrl: `https://fleeterbase.com/?reset-password=${'b'.repeat(43)}` },
  ]) assert.equal((await handleFleeterbaseVerification(request(invalid), env, async () => Response.json({ id: 'wrong' }))).status, 422);
});
test('relay falls back to the verified sender while the Fleeterbase domain is pending', async () => {
  const senders = [];
  const res = await handleFleeterbaseVerification(request(), env, async (_url, init) => {
    senders.push(JSON.parse(init.body).from);
    return senders.length === 1 ? Response.json({ message: 'domain not verified' }, { status: 403 }) : Response.json({ id: 'fallback-1' });
  });
  assert.equal(res.status, 200);
  assert.deepEqual(senders, ['Fleeterbase <no-reply@fleeterbase.com>', 'Fleeterbase via Broadway Pixels <support@broadwaypixels.com>']);
});
test('provider rejection, malformed success and network failure fail closed', async () => {
  for (const sender of [async () => Response.json({ message: 'rejected' }, { status: 403 }), async () => Response.json({}), async () => { throw Error('network'); }]) {
    const res = await handleFleeterbaseVerification(request(), env, sender);
    assert.equal(res.status, 502);
    assert.equal((await res.json()).sent, undefined);
  }
});
