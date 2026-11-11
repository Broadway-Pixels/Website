import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("the Videos page loads the live reels script and keeps three local Shorts as fallback", async () => {
  const page = await readFile(new URL("../content.html", import.meta.url), "utf8");
  assert.match(page, /<script src="\/reels\.js\?v=[^"]+" defer><\/script>/);
  assert.match(page, /id="video-releases-title">Featured Videos<\/h2><p>A few favorites from the channel\.<\/p>/);
  assert.match(page, /id="shorts-title">Latest Reels<\/h2><p>Just Random Videos\.<\/p>/);
  assert.doesNotMatch(page, /See all Shorts on YouTube/);
  assert.doesNotMatch(page, /class="content-hero-actions"/);
  const footer = page.match(/<footer\b[\s\S]*?<\/footer>/)?.[0];
  assert.ok(footer);
  for (const platform of ["YouTube", "Instagram", "TikTok"]) {
    assert.ok(footer.includes(`aria-label="${platform}"`));
  }
  const grid = page.match(/<div class="shorts-grid" data-latest-reels>([\s\S]*?)<\/section>/)?.[1];
  assert.ok(grid);
  const cards = [...grid.matchAll(/href="https:\/\/www\.youtube\.com\/shorts\/([\w-]{11})"[^>]*><img src="\/assets\/youtube-short-([\w-]{11})\.jpg"[^>]*>/g)];
  assert.equal(cards.length, 3);
  assert.equal(new Set(cards.map(([, id]) => id)).size, 3);
  for (const [, id, thumbnailId] of cards) {
    assert.equal(thumbnailId, id);
    await access(new URL(`../assets/youtube-short-${id}.jpg`, import.meta.url));
  }
});
