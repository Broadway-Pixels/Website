import assert from "node:assert/strict";
import test from "node:test";
import { handleReels, parseReelsFeed } from "../lib/reels.mjs";
import worker from "../worker/index.mjs";

const channel = "UCNgrFA8SVmtWPPSjpNr0cIw";
const playlist = "UUSHNgrFA8SVmtWPPSjpNr0cIw";
const first = "9k9wqPLPjqM";
const second = "ivDFrmoVSQc";
const third = "nHGs7pGN1Fs";
const fourth = "WyATjtZDjlM";
const origin = "https://broadwaypixels.com";
const feedUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlist}`;
const jpeg = Uint8Array.of(0xff, 0xd8, 0xff, 0xd9);

function entry(id, { day = "06", date = `2026-11-${day}T18:56:59+00:00`, title = "Just your typical day in Florida", owner = channel, link = `https://www.youtube.com/shorts/${id}` } = {}) {
  return `<entry><yt:videoId>${id}</yt:videoId><yt:channelId>${owner}</yt:channelId><title>${title}</title><link href='${link}' rel="alternate"/><published>${date}</published></entry>`;
}

function feed(entries, feedPlaylist = playlist, feedChannel = channel) {
  return `<?xml version="1.0" encoding="UTF-8"?><feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom"><yt:playlistId>${feedPlaylist}</yt:playlistId><yt:channelId>${feedChannel}</yt:channelId><title>Short videos</title>${entries.join("\n")}</feed>`;
}

function atom(body) {
  return new Response(body, { headers: { "Content-Type": "application/atom+xml; charset=UTF-8" } });
}

function completeFeed(newest = first) {
  const [next, last] = [first, second, third].filter((id) => id !== newest);
  return feed([entry(newest), entry(next, { day: "05" }), entry(last, { day: "04" })]);
}

function memoryCache() {
  const entries = new Map();
  return {
    match: async (key) => entries.get(key)?.clone(),
    put: async (key, response) => { entries.set(key, response.clone()); },
  };
}

test("the owned Shorts feed sorts, deduplicates, decodes titles, and ignores non-Shorts or other channels", () => {
  const results = parseReelsFeed(feed([
    entry(fourth, { day: "01" }),
    entry(third, { day: "03", title: "BMW X5 &#x1F49A;" }),
    entry(second, { day: "04", title: "Shelby &amp; Baja &#128522;" }),
    entry(first, { day: "07", title: "Florida &quot;fun&quot; &lt;3" }),
    entry(first, { day: "02", title: "Old duplicate" }),
    entry("abcdefghijkl", { day: "08" }),
    entry("abcdefghijk", { day: "08", link: "https://www.youtube.com/watch?v=abcdefghijk" }),
    entry("abcdefghij1", { day: "08", owner: "UCnotBroadwayPixels" }),
    entry("abcdefghij2", { day: "08", link: "https://other.example/shorts/abcdefghij2" }),
    entry("abcdefghij3", { date: "not a date" }),
    entry("abcdefghij4", { day: "08", title: "\n " }),
  ]));
  assert.deepEqual(results, [
    { id: first, title: 'Florida "fun" <3', publishedAt: "2026-11-07T18:56:59.000Z" },
    { id: second, title: "Shelby & Baja 😊", publishedAt: "2026-11-04T18:56:59.000Z" },
    { id: third, title: "BMW X5 💚", publishedAt: "2026-11-03T18:56:59.000Z" },
  ]);
});

test("the parser fails closed on a wrong playlist, channel, partial feed, or DOCTYPE", () => {
  assert.deepEqual(parseReelsFeed(feed([entry(first)], "wrong-playlist")), []);
  assert.deepEqual(parseReelsFeed(feed([entry(first)], playlist, "wrong-channel")), []);
  assert.deepEqual(parseReelsFeed(feed([entry(first)]).replace("</feed>", "")), []);
  assert.deepEqual(parseReelsFeed(feed([entry(first)]).replace("<feed", '<!DOCTYPE feed [<!ENTITY bad SYSTEM "https://example.com/">]><feed')), []);
});

test("feed ignores incoming credentials, caches across queries, refreshes, and serves only bounded stale data", async () => {
  let clock = Date.parse("2026-11-10T00:00:00Z");
  let fetches = 0;
  let status = 200;
  let partial = false;
  let live = first;
  const cache = memoryCache();
  const options = { cache, now: () => clock, fetchImpl: async (url, init) => {
    fetches++;
    assert.equal(url, feedUrl);
    assert.equal(init.redirect, "manual");
    assert.ok(init.signal instanceof AbortSignal);
    assert.deepEqual(Object.keys(init.headers), ["Accept"]);
    return status === 200 ? atom(partial ? feed([entry(live)]) : completeFeed(live)) : new Response("unavailable", { status });
  } };
  const request = (query = "") => handleReels(new Request(`${origin}/api/reels${query}`, { headers: { Cookie: "session=example", Authorization: "Bearer example" } }), options);
  assert.deepEqual((await (await request()).json()).reels.map(({ id }) => id), [first, second, third]);
  assert.equal((await request("?ignore-cache=1")).status, 200);
  assert.equal(fetches, 1);

  live = second;
  clock += 15 * 60 * 1000 + 1;
  assert.deepEqual((await (await request()).json()).reels.map(({ id }) => id), [second, first, third]);
  assert.equal(fetches, 2);

  partial = true;
  live = fourth;
  clock += 15 * 60 * 1000 + 1;
  assert.deepEqual((await (await request()).json()).reels.map(({ id }) => id), [second, first, third], "partial refreshes cannot replace the cached complete set");
  assert.equal((await request()).status, 200);
  assert.equal(fetches, 3, "stale failures are retried at most once per minute");
  status = 503;
  clock += 60 * 1000 + 1;
  assert.equal((await request()).status, 200);
  assert.equal(fetches, 4, "an upstream outage still serves the cached set");
  clock += 24 * 60 * 60 * 1000;
  const unavailable = await request();
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.headers.get("Cache-Control"), "no-store");
  assert.equal((await request()).status, 503);
  assert.equal(fetches, 5, "uncached failures also use a short retry backoff");
});

test("oversized streamed data and non-XML responses never become public results", async () => {
  const req = new Request(`${origin}/api/reels`);
  let cancelled = false;
  let pulls = 0;
  const stream = new ReadableStream({
    pull(controller) {
      pulls++;
      controller.enqueue(new Uint8Array(128 * 1024));
    },
    cancel() { cancelled = true; },
  });
  const oversized = await handleReels(req, { fetchImpl: async () => atom(stream) });
  assert.equal(oversized.status, 503);
  assert.equal(cancelled, true);
  assert.ok(pulls <= 4);
  assert.equal((await handleReels(req, { fetchImpl: async () => new Response(feed([entry(first)]), { headers: { "Content-Type": "text/html" } }) })).status, 503);
  assert.equal((await handleReels(req, { fetchImpl: async () => atom(feed([entry(first), entry(second)])) })).status, 503);
});

test("upstream redirects fail closed without following the Location header", async () => {
  const requests = [];
  const response = await handleReels(new Request(`${origin}/api/reels`), {
    fetchImpl: async (url, init) => {
      requests.push(url);
      assert.equal(init.redirect, "manual");
      return new Response(null, { status: 302, headers: { Location: "https://example.com/feed" } });
    },
  });
  assert.equal(response.status, 503);
  assert.deepEqual(requests, [feedUrl]);
});

test("only the current reel IDs can fetch JPEG thumbnails, with a shared cache and no forwarded headers", async () => {
  const requests = [];
  const cache = memoryCache();
  const options = { cache, fetchImpl: async (url, init) => {
    requests.push(url);
    assert.deepEqual(Object.keys(init.headers), ["Accept"]);
    if (url === feedUrl) return atom(completeFeed());
    assert.equal(url, `https://i.ytimg.com/vi/${first}/hqdefault.jpg`);
    return new Response(jpeg, { headers: { "Content-Type": "image/jpeg", "Set-Cookie": "upstream=private" } });
  } };
  const thumb = (id) => handleReels(new Request(`${origin}/api/reels/thumbnail/${id}`, { headers: { Cookie: "visitor=private" } }), options);
  assert.equal((await thumb("invalid")).status, 404);
  assert.deepEqual(requests, []);
  assert.equal((await thumb(fourth)).status, 404);
  assert.deepEqual(requests, [feedUrl]);
  const success = await thumb(first);
  assert.equal(success.status, 200);
  assert.equal(success.headers.get("Content-Type"), "image/jpeg");
  assert.equal(success.headers.get("Cross-Origin-Resource-Policy"), "same-origin");
  assert.equal(success.headers.get("Set-Cookie"), null);
  assert.deepEqual(new Uint8Array(await success.arrayBuffer()), jpeg);
  assert.equal((await thumb(first)).status, 200);
  assert.equal(requests.length, 2);
});

test("thumbnail responses fail closed for non-JPEG bytes and for oversized images", async () => {
  for (const [body, headers] of [["not JPEG", {}], [jpeg, { "Content-Length": String(2 * 1024 * 1024) }]]) {
    const response = await handleReels(new Request(`${origin}/api/reels/thumbnail/${first}`), {
      fetchImpl: async (url) => url === feedUrl ? atom(completeFeed()) : new Response(body, { headers: { ...headers, "Content-Type": "image/jpeg" } }),
    });
    assert.equal(response.status, 502);
    assert.match(response.headers.get("Content-Type"), /^application\/json/);
  }
});

test("the Worker exposes a read-only reels API without a database binding", async (t) => {
  t.mock.method(globalThis, "fetch", async () => atom(completeFeed()));
  const response = await worker.fetch(new Request(`${origin}/api/reels`), {});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).reels[0].id, first);
  assert.equal((await worker.fetch(new Request(`${origin}/api/reels`, { method: "POST" }), {})).status, 405);
  assert.equal((await worker.fetch(new Request(`${origin}/api/reels/thumbnail/invalid`), {})).status, 404);
});
