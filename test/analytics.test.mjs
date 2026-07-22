import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AnalyticsStore, summarizePageViews, validatePageView } from "../lib/analytics.mjs";

const validView = { path: "/projects", sessionId: "019f7c23-20f0-7fc1-a4c4-15c60685f833", device: "mobile", source: "instagram.com" };

test("validates privacy-preserving page view fields", () => {
  assert.equal(validatePageView(validView).ok, true);
  assert.equal(validatePageView({ ...validView, path: "/dashboard" }).ok, false);
  assert.equal(validatePageView({ ...validView, sessionId: "not-a-session" }).ok, false);
  assert.equal(validatePageView({ ...validView, source: "https://bad.example/path" }).ok, false);
});

test("summarizes page views, sessions, traffic sources, and devices", () => {
  const now = new Date("2026-07-22T18:00:00.000Z");
  const events = [
    { ...validView, timestamp: "2026-07-22T17:50:00.000Z" },
    { ...validView, path: "/", timestamp: "2026-07-22T17:55:00.000Z" },
    { ...validView, path: "/music", sessionId: "019f7c23-20f0-7fc1-a4c4-15c60685f834", device: "desktop", source: "direct", timestamp: "2026-07-21T12:00:00.000Z" },
  ];
  const stats = summarizePageViews(events, 7, now);
  assert.deepEqual(stats.totals, { pageViews: 3, sessions: 2, todayViews: 2, liveSessions: 1 });
  assert.equal(stats.pages[0].views, 1);
  assert.deepEqual(stats.devices, [{ device: "mobile", views: 2 }, { device: "desktop", views: 1 }]);
  assert.equal(stats.daily.length, 7);
});

test("persists monthly analytics and reads them back", async () => {
  const directory = await mkdtemp(join(tmpdir(), "broadway-analytics-"));
  try {
    const store = new AnalyticsStore(directory);
    await store.record(validView, new Date("2026-07-22T17:50:00.000Z"));
    const stats = await store.stats(30, new Date("2026-07-22T18:00:00.000Z"));
    assert.equal(stats.totals.pageViews, 1);
    assert.equal(stats.pages[0].name, "Projects");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

