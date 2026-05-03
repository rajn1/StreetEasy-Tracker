import { get } from "@vercel/edge-config";
import { randomUUID } from "node:crypto";
import { edgeConfigWriteConfig, saveEdgeConfigItem } from "./storage.js";

const APARTMENTS_KEY = "apartment_hunt_apartments";

export default async function handler(request, response) {
  try {
    if (request.method === "GET") {
      const apartments = await get(APARTMENTS_KEY);
      response.setHeader("Cache-Control", "no-store");
      return response.status(200).json({ apartments: Array.isArray(apartments) ? apartments : [] });
    }

    if (request.method === "PUT") {
      const apartments = normalizeApartments(request.body?.apartments);
      await saveEdgeConfigItem(edgeConfigWriteConfig(), APARTMENTS_KEY, apartments);
      return response.status(200).json({ apartments });
    }

    return response.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return response.status(500).json({ error: error.message || "Apartment storage request failed." });
  }
}

function normalizeApartments(items) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => ({
      id: String(item?.id || randomUUID()),
      name: String(item?.name || "").trim(),
      address: String(item?.address || "").trim(),
      price: Math.max(0, Number(item?.price) || 0),
      url: normalizeUrl(item?.url),
      manualMinutes: Math.max(0, Number(item?.manualMinutes) || 0)
    }))
    .filter((item) => item.name || item.address || item.url)
    .slice(0, 50);
}

function normalizeUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";

  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return "";
  }
}
