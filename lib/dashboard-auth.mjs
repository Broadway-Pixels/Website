import { createHmac, timingSafeEqual } from "node:crypto";

const cookieName = "bp_dashboard";

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function signature(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function dashboardConfigured(env) {
  return String(env.DASHBOARD_USERNAME || "").length >= 3
    && String(env.DASHBOARD_PASSWORD || "").length >= 12
    && String(env.DASHBOARD_SESSION_SECRET || "").length >= 32;
}

export function verifyDashboardCredentials(input, env) {
  if (!dashboardConfigured(env)) return false;
  return safeEqual(input?.username, env.DASHBOARD_USERNAME) && safeEqual(input?.password, env.DASHBOARD_PASSWORD);
}

export function createDashboardSession(env, now = Date.now()) {
  const expiresAt = now + 12 * 60 * 60 * 1000;
  const value = String(expiresAt);
  return `${value}.${signature(value, env.DASHBOARD_SESSION_SECRET)}`;
}

export function verifyDashboardSession(token, env, now = Date.now()) {
  if (!dashboardConfigured(env) || !token) return false;
  const [expiresAt, suppliedSignature, extra] = String(token).split(".");
  if (extra || !/^\d{13}$/.test(expiresAt) || Number(expiresAt) <= now) return false;
  return safeEqual(suppliedSignature, signature(expiresAt, env.DASHBOARD_SESSION_SECRET));
}

export function readDashboardSession(cookieHeader = "") {
  const match = String(cookieHeader).split(";").map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
  return match ? decodeURIComponent(match.slice(cookieName.length + 1)) : "";
}

export function dashboardSessionCookie(token, secure = true) {
  return `${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${secure ? "; Secure" : ""}`;
}

export function clearDashboardSessionCookie(secure = true) {
  return `${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`;
}

