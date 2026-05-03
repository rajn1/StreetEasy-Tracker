import { get } from "@vercel/edge-config";
import { randomUUID } from "node:crypto";
import { edgeConfigWriteConfig, saveEdgeConfigItem } from "./storage.js";

const DESTINATIONS_KEY = "apartment_hunt_destinations";

export default async function handler(request, response) {
  try {
    if (request.method === "GET") {
      const destinations = await get(DESTINATIONS_KEY);
      response.setHeader("Cache-Control", "no-store");
      return response.status(200).json({ destinations: Array.isArray(destinations) ? destinations : [] });
    }

    if (request.method === "PUT") {
      const destinations = normalizeDestinations(request.body?.destinations);
      await saveEdgeConfigItem(edgeConfigWriteConfig(), DESTINATIONS_KEY, destinations);
      return response.status(200).json({ destinations });
    }

    return response.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return response.status(500).json({ error: error.message || "Destination storage request failed." });
  }
}

function normalizeDestinations(items) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => ({
      id: String(item?.id || randomUUID()),
      name: String(item?.name || "").trim(),
      address: String(item?.address || "").trim(),
      weight: Math.max(1, Math.min(5, Number(item?.weight) || 1))
    }))
    .filter((item) => item.name || item.address)
    .slice(0, 20);
}
