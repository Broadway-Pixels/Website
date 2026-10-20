import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { resolvePublicRequest } from '../lib/routes.mjs';
import { validatePageView } from '../worker/store.mjs';

test('label page preserves three artist identities and real destinations', async () => {
  const html = await readFile(new URL('../label.html', import.meta.url), 'utf8');
  assert.equal((html.match(/class="label-artist"/g) || []).length, 3);
  for (const name of ['Broadway Pixels', 'Roma Williams', 'RYZFORGE']) assert.ok(html.includes(`<h3>${name}</h3>`));
  assert.match(html, /aria-current="page" href="\/label"/);
  assert.match(html, /href="https:\/\/ryzforge.com\/"/);
  assert.match(html, /href="\/support\?project=Music&amp;topic=Label%20inquiry"/);
  assert.match(html, /data-theme-toggle/);
  assert.match(html, /rel="canonical" href="https:\/\/broadwaypixels.com\/label"/);
  for (const [, asset] of html.matchAll(/src="(\/assets\/[^"?]+)"/g)) await readFile(new URL(`..${asset}`, import.meta.url));
});

test('label clean route and legacy links resolve', () => {
  assert.deepEqual(resolvePublicRequest('/label'), { type: 'file', file: '/label.html' });
  for (const path of ['/label/', '/label.html']) assert.deepEqual(resolvePublicRequest(path), { type: 'redirect', location: '/label' });
});

test('main site navigation exposes the label without removing Music', async () => {
  for (const file of ['index', 'music', 'content', 'projects', 'support', 'faq']) {
    const html = await readFile(new URL(`../${file}.html`, import.meta.url), 'utf8');
    assert.match(html, /href="\/label">Label<\/a>/);
    assert.match(html, /href="\/music">Music<\/a>/);
  }
});

test('label views are accepted by dashboard analytics', () => {
  assert.equal(validatePageView({ path: '/label', sessionId: '12345678-1234-1234-1234-123456789012', device: 'desktop', source: 'direct' }).ok, true);
});
