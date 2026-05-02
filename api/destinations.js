import { get } from "@vercel/edge-config";
import { randomUUID } from "node:crypto";

const VERCEL_API_URL = "https://api.vercel.com/v1/edge-config";
const DESTINATIONS_KEY = "apartment-hunt:destinations";

export default async function handler(request, response) {
  try {
    if (request.method === "GET") {
      const destinations = await get(DESTINATIONS_KEY);
      return response.status(200).json({ destinations: Array.isArray(destinations) ? destinations : [] });
    }

    if (request.method === "PUT") {
      const config = edgeConfigWriteConfig();
      const destinations = normalizeDestinations(request.body?.destinations);
      await saveDestinations(config, destinations);
      return response.status(200).json({ destinations });
    }

    return response.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return response.status(500).json({ error: error.message || "Destination storage request failed." });
  }
}

function edgeConfigWriteConfig() {
  const edgeConfigId = process.env.EDGE_CONFIG_ID;
  const token = process.env.VERCEL_API_TOKEN;
  if (!edgeConfigId || !token) {
    throw new Error("Saving destinations requires EDGE_CONFIG_ID and VERCEL_API_TOKEN in Vercel.");
  }

  return {
    edgeConfigId,
    token,
    teamId: process.env.VERCEL_TEAM_ID || ""
  };
}

async function saveDestinations(config, destinations) {
  const url = new URL(`${VERCEL_API_URL}/${config.edgeConfigId}/items`);
  if (config.teamId) {
    url.searchParams.set("teamId", config.teamId);
  }

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      items: [
        {
          operation: "upsert",
          key: DESTINATIONS_KEY,
          value: destinations
        }
      ]
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Edge Config save failed: ${message.slice(0, 220)}`);
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
