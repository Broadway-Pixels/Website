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
} from "../worker/auth.mjs";
import { normalizeTrafficSource, validatePageView } from "../worker/store.mjs";
import { handleRequest } from "../worker/index.mjs";

const env = {
  DASHBOARD_USERNAME: "broadwaypixels",
  DASHBOARD_PASSWORD: "a-strong-dashboard-password",
  DASHBOARD_SESSION_SECRET: "a-session-secret-that-is-at-least-thirty-two-characters",
};

test("Cloudflare dashboard auth signs and verifies secure sessions", async () => {
  const now = Date.parse("2026-08-29T12:00:00.000Z");
  assert.equal(dashboardConfigured(env), true);
  assert.equal(verifyDashboardCredentials({ username: env.DASHBOARD_USERNAME, password: env.DASHBOARD_PASSWORD }, env), true);
  const token = await createDashboardSession(env, now);
  assert.equal(await verifyDashboardSession(token, env, now + 1_000), true);
  assert.equal(await verifyDashboardSession(`${token}tampered`, env, now + 1_000), false);
  assert.equal(readDashboardSession(`other=value; ${dashboardSessionCookie(token)}`), token);
  assert.match(clearDashboardSessionCookie(), /Max-Age=0/);
});

test("Cloudflare analytics validation matches the existing privacy rules", () => {
  const view = {
    path: "/projects",
    sessionId: "019f7c23-20f0-7fc1-a4c4-15c60685f833",
    device: "mobile",
    source: "www.broadwaypixels.com",
  };
  assert.equal(validatePageView(view).ok, true);
  assert.equal(validatePageView(view).event.source, "internal");
  assert.equal(normalizeTrafficSource("l.instagram.com"), "l.instagram.com");
  assert.equal(validatePageView({ ...view, path: "/dashboard" }).ok, false);
});

test("deletion requests create a dedicated ticket and notification", async (t) => {
  const emails = [];
  const tickets = [];
  const requestsEnv = {
    RESEND_API_KEY: "re_test",
    SUPPORT_FROM_EMAIL: "support@example.com",
    DB: {
      prepare(statement) {
        return { bind: (...parameters) => ({
          first: async () => ({ count: 1 }),
          run: async () => { if (statement.includes("INSERT INTO tickets")) tickets.push(parameters); },
        }) };
      },
    },
  };
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    emails.push({ key: options.headers["Idempotency-Key"], ...JSON.parse(options.body) });
    return Response.json({ id: `email-${emails.length}` });
  });
  const submit = (body) => handleRequest(new Request("https://broadwaypixels.com/api/deletion-requests", {
    method: "POST",
    headers: { Origin: "https://broadwaypixels.com", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }), requestsEnv);
  const input = {
    name: "Example Player",
    email: "player@example.com",
    game: "Kitty Match Mania",
    requestId: "example-request-id",
    project: "General",
  };
  assert.equal((await submit({ ...input, game: "" })).status, 422);
  assert.deepEqual(await (await submit({ ...input, website: "spam" })).json(), { message: "Request received." });
  assert.equal(tickets.length, 0);
  assert.equal(emails.length, 0);

  const response = await submit(input);
  assert.equal(response.status, 200);
  const { ticketId, confirmationSent } = await response.json();
  assert.match(ticketId, /^B\d{10}$/);
  assert.equal(confirmationSent, true);
  assert.deepEqual(tickets[0].slice(0, 5), [ticketId, input.name, input.email, "Deletion Requests", input.game]);
  assert.match(emails[0].subject, /\[Deletion Requests\] Kitty Match Mania/);
  assert.equal(emails[0].key, "support-admin-deletion-example-request-id");
  assert.match(emails[1].text, /received your deletion request/);
});
