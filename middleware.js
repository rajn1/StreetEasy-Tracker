import { next } from "@vercel/functions";
import { isAuthenticated, configuredPassword } from "./auth.js";

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!login.html|api/login|styles.css|favicon.ico).*)"]
};

export default function middleware(request) {
  if (!configuredPassword()) {
    return new Response("APP_PASSWORD is not configured.", { status: 503 });
  }

  const url = new URL(request.url);
  const cookie = request.headers.get("cookie") || "";
  if (isAuthenticated(cookie)) {
    return next();
  }

  if (url.pathname.startsWith("/api/")) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const loginUrl = new URL("/login.html", request.url);
  loginUrl.searchParams.set("next", `${url.pathname}${url.search}`);

  return Response.redirect(loginUrl, 302);
}
