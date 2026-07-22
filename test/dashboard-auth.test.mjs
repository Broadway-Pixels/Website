import assert from "node:assert/strict";
import test from "node:test";
import {
  clearDashboardSessionCookie,
  createDashboardSession,
  dashboardConfigured,
  dashboardSessionCookie,
  readDashboardSession,
  verifyDashboardCredentials,
  verifyDashboardSession,
} from "../lib/dashboard-auth.mjs";

const env = {
  DASHBOARD_USERNAME: "broadwaypixels",
  DASHBOARD_PASSWORD: "a-strong-dashboard-password",
  DASHBOARD_SESSION_SECRET: "a-session-secret-that-is-at-least-thirty-two-characters",
};

test("requires complete dashboard configuration and exact credentials", () => {
  assert.equal(dashboardConfigured(env), true);
  assert.equal(dashboardConfigured({}), false);
  assert.equal(verifyDashboardCredentials({ username: "broadwaypixels", password: "a-strong-dashboard-password" }, env), true);
  assert.equal(verifyDashboardCredentials({ username: "broadwaypixels", password: "wrong-password" }, env), false);
});

test("creates signed expiring dashboard sessions", () => {
  const now = Date.parse("2026-07-22T18:00:00.000Z");
  const token = createDashboardSession(env, now);
  assert.equal(verifyDashboardSession(token, env, now + 1_000), true);
  assert.equal(verifyDashboardSession(`${token}tampered`, env, now + 1_000), false);
  assert.equal(verifyDashboardSession(token, env, now + 13 * 60 * 60 * 1000), false);
});

test("writes, reads, and clears secure session cookies", () => {
  const cookie = dashboardSessionCookie("signed-token");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.equal(readDashboardSession(`other=value; ${cookie}`), "signed-token");
  assert.match(clearDashboardSessionCookie(), /Max-Age=0/);
});

