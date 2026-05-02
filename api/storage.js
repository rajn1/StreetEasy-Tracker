const VERCEL_API_URL = "https://api.vercel.com/v1/edge-config";

export function edgeConfigWriteConfig() {
  const edgeConfigId = process.env.EDGE_CONFIG_ID;
  const token = process.env.VERCEL_API_TOKEN;
  if (!edgeConfigId || !token) {
    throw new Error("Saving requires EDGE_CONFIG_ID and VERCEL_API_TOKEN in Vercel.");
  }

  return {
    edgeConfigId,
    token,
    teamId: process.env.VERCEL_TEAM_ID || ""
  };
}

export async function saveEdgeConfigItem(config, key, value) {
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
          key,
          value
        }
      ]
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Edge Config save failed: ${formatVercelApiError(message)}`);
  }
}

function formatVercelApiError(message) {
  try {
    const data = JSON.parse(message);
    return data?.error?.message || message.slice(0, 220);
  } catch {
    return message.slice(0, 220);
  }
}
