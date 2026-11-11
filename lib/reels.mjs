const channelId = "UCNgrFA8SVmtWPPSjpNr0cIw";
const playlistId = "UUSHNgrFA8SVmtWPPSjpNr0cIw";
const feedUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`;
const reelIdPattern = /^[A-Za-z0-9_-]{11}$/;
const thumbnailPathPattern = /^\/api\/reels\/thumbnail\/([A-Za-z0-9_-]{11})$/;
const freshMs = 15 * 60 * 1000;
const staleMs = 24 * 60 * 60 * 1000;
const retryMs = 60 * 1000;
const xmlByteLimit = 256 * 1024;
const thumbnailByteLimit = 512 * 1024;
const upstreamTimeoutMs = 5000;
const responseHeaders = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

function json(body, status = 200, headers = {}) {
  return Response.json(body, { status, headers: { ...responseHeaders, ...headers } });
}

function decodeTitle(raw) {
  if (!raw) return "";
  const cdata = raw.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  const decoded = cdata?.[1] ?? raw.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, value) => {
    if (!value.startsWith("#")) return entities[value] ?? entity;
    const hex = value[1].toLowerCase() === "x";
    const code = Number.parseInt(value.slice(hex ? 2 : 1), hex ? 16 : 10);
    return code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff)
      ? String.fromCodePoint(code) : "\uFFFD";
  });
  return decoded.replace(/[\u0000-\u001f\u007f\s]+/g, " ").trim();
}

function element(xml, tag) {
  return xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))?.[1].trim();
}

function attribute(tag, name) {
  const value = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`));
  return value?.[1] ?? value?.[2];
}

export function parseReelsFeed(xml) {
  const feed = xml.trim().replace(/^<\?xml[^?]*\?>\s*/, "");
  if (!/^<feed(?:\s[^>]*)?>/.test(feed) || !feed.endsWith("</feed>") || /<!(?:DOCTYPE|ENTITY)\b/i.test(feed)) return [];
  const firstEntry = feed.search(/<entry(?:\s[^>]*)?>/);
  if (firstEntry < 0) return [];
  const header = feed.slice(0, firstEntry);
  if (element(header, "yt:playlistId") !== playlistId || element(header, "yt:channelId") !== channelId) return [];

  const reels = new Map();
  for (const [, entry] of feed.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/g)) {
    const id = element(entry, "yt:videoId");
    if (!reelIdPattern.test(id ?? "") || element(entry, "yt:channelId") !== channelId) continue;
    const isShort = [...entry.matchAll(/<link\s[^>]*>/g)].some(([link]) =>
      attribute(link, "rel") === "alternate" && attribute(link, "href") === `https://www.youtube.com/shorts/${id}`);
    if (!isShort) continue;
    const title = decodeTitle(element(entry, "title"));
    const published = element(entry, "published");
    if (!title || title.length > 200 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(published ?? "")) continue;
    const timestamp = Date.parse(published);
    if (!Number.isFinite(timestamp)) continue;
    const publishedAt = new Date(timestamp).toISOString();
    if (!reels.has(id) || reels.get(id).publishedAt < publishedAt) reels.set(id, { id, title, publishedAt });
  }
  return [...reels.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 3);
}

async function fetchBounded(url, fetchImpl, byteLimit, accept, allowedTypes) {
  const response = await fetchImpl(url, {
    headers: { Accept: accept },
    // Workers supports manual redirects; the status check below rejects 3xx.
    redirect: "manual",
    signal: AbortSignal.timeout(upstreamTimeoutMs),
  });
  const mimeType = (response.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (!response.ok || !response.body || !allowedTypes.includes(mimeType) || Number(response.headers.get("Content-Length")) > byteLimit) {
    await response.body?.cancel().catch(() => {});
    throw new Error("Unexpected upstream response");
  }

  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  let complete = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        complete = true;
        break;
      }
      size += value.byteLength;
      if (size > byteLimit) throw new Error("Upstream response exceeds byte limit");
      chunks.push(value);
    }
  } finally {
    if (!complete) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function cacheMatch(cache, key) {
  try {
    return await cache?.match(key);
  } catch {
    return undefined;
  }
}

async function cachePut(cache, key, response) {
  try {
    await cache?.put(key, response);
  } catch {
    // Serving the current response does not depend on the edge cache being available.
  }
}

async function loadReels(origin, { cache, fetchImpl, now }) {
  const key = `${origin}/api/reels?bwp-cache=shorts-feed-v2`;
  const cachedResponse = await cacheMatch(cache, key);
  const stored = await cachedResponse?.json().catch(() => null);
  const time = now();
  const previous = (stored?.reels?.length === 0 || stored?.reels?.length === 3)
    && Array.isArray(stored.reels) && stored.expiresAt > time ? stored : null;
  if (previous?.refreshAt > time) return previous.reels;

  let record;
  try {
    const bytes = await fetchBounded(feedUrl, fetchImpl, xmlByteLimit, "application/atom+xml, application/xml, text/xml", ["application/atom+xml", "application/xml", "text/xml"]);
    const reels = parseReelsFeed(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (reels.length !== 3) throw new Error("Incomplete Shorts feed");
    const fetchedAt = now();
    record = { reels, refreshAt: fetchedAt + freshMs, expiresAt: fetchedAt + staleMs };
  } catch {
    const failedAt = now();
    record = previous?.expiresAt > failedAt
      ? { ...previous, refreshAt: failedAt + retryMs }
      : { reels: [], refreshAt: failedAt + retryMs, expiresAt: failedAt + retryMs };
    console.warn(JSON.stringify({ event: "reels_feed_unavailable", usingCachedReels: record.reels.length > 0 }));
  }

  // Store membership before responding so the subsequent thumbnail requests can use it immediately.
  if (cache) {
    const maxAge = Math.max(1, Math.ceil((record.expiresAt - now()) / 1000));
    await cachePut(cache, key, Response.json(record, { headers: { "Cache-Control": `public, max-age=${maxAge}` } }));
  }
  return record.reels;
}

export async function handleReels(request, { cache, fetchImpl = fetch, now = Date.now, waitUntil } = {}) {
  const { pathname, origin } = new URL(request.url);
  const thumbnailId = pathname.match(thumbnailPathPattern)?.[1];
  if (pathname !== "/api/reels" && !thumbnailId) return json({ message: "Not found." }, 404);
  if (request.method !== "GET") return json({ message: "Method not allowed." }, 405, { Allow: "GET" });

  const reels = await loadReels(origin, { cache, fetchImpl, now });
  if (!reels.length) return json({ message: "Reels are temporarily unavailable." }, 503);
  if (!thumbnailId) return json({ reels }, 200, { "Cache-Control": "public, max-age=60" });
  if (!reels.some(({ id }) => id === thumbnailId)) return json({ message: "Not found." }, 404);

  const key = `${origin}/api/reels/thumbnail/${thumbnailId}?bwp-cache=shorts-thumbnail-v1`;
  const cachedThumbnail = await cacheMatch(cache, key);
  if (cachedThumbnail) return cachedThumbnail;

  try {
    const image = await fetchBounded(`https://i.ytimg.com/vi/${thumbnailId}/hqdefault.jpg`, fetchImpl, thumbnailByteLimit, "image/jpeg", ["image/jpeg"]);
    if (image.length < 4 || image[0] !== 0xff || image[1] !== 0xd8 || image[2] !== 0xff) throw new Error("Invalid JPEG");
    const response = new Response(image, {
      headers: { ...responseHeaders, "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=900" },
    });
    if (cache) {
      const write = cachePut(cache, key, response.clone());
      if (waitUntil) waitUntil(write);
      else await write;
    }
    return response;
  } catch {
    return json({ message: "Thumbnail is temporarily unavailable." }, 502);
  }
}
