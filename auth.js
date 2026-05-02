import { createHash, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "apartment_auth";
const WEEK_SECONDS = 60 * 60 * 24 * 7;

export function configuredPassword() {
  return process.env.APP_PASSWORD || "";
}

export function sessionToken() {
  const password = configuredPassword();
  const secret = process.env.APARTMENT_AUTH_SECRET || password;
  return createHash("sha256").update(`${password}:${secret}`).digest("hex");
}

export function isAuthenticated(cookieHeader = "") {
  const expected = sessionToken();
  const actual = parseCookies(cookieHeader)[COOKIE_NAME] || "";
  if (!expected || !actual || expected.length !== actual.length) return false;

  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export function authCookie(request) {
  const host = request.headers.host || "";
  const forwardedProto = request.headers["x-forwarded-proto"];
  const secure = forwardedProto === "https" || !host.includes("localhost");
  const parts = [
    `${COOKIE_NAME}=${sessionToken()}`,
    "Path=/",
    `Max-Age=${WEEK_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax"
  ];

  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function parseCookies(cookieHeader) {
  return cookieHeader.split(";").reduce((cookies, pair) => {
    const [rawName, ...rawValue] = pair.trim().split("=");
    if (!rawName) return cookies;
    cookies[rawName] = decodeURIComponent(rawValue.join("="));
    return cookies;
  }, {});
}
