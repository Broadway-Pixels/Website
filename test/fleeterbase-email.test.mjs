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
  assert.match(sent.from, /support@broadwaypixels.com/);
  assert.match(sent.text, /expires in 24 hours/);
});
test('provider rejection, malformed success and network failure fail closed', async () => {
  for (const sender of [async () => Response.json({ message: 'rejected' }, { status: 403 }), async () => Response.json({}), async () => { throw Error('network'); }]) {
    const res = await handleFleeterbaseVerification(request(), env, sender);
    assert.equal(res.status, 502);
    assert.equal((await res.json()).sent, undefined);
  }
});
