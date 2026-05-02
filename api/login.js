import { authCookie, configuredPassword } from "../auth.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method not allowed" });
  }

  const expectedPassword = configuredPassword();
  if (!expectedPassword) {
    return response.status(501).json({ error: "APP_PASSWORD is not configured." });
  }

  const password = String(request.body?.password || "");
  if (password !== expectedPassword) {
    return response.status(401).json({ error: "Incorrect password." });
  }

  response.setHeader("Set-Cookie", authCookie(request));
  return response.status(200).json({ ok: true });
}
