const GOOGLE_ROUTES_URL = "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix";

const MODE_MAP = {
  TRANSIT: "TRANSIT",
  DRIVING: "DRIVE",
  WALKING: "WALK",
  BICYCLING: "BICYCLE"
};

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return response.status(501).json({ error: "GOOGLE_MAPS_API_KEY is not configured." });
  }

  try {
    const payload = request.body || {};
    const apartments = cleanAddressItems(payload.apartments, "apartment");
    const destinations = cleanAddressItems(payload.destinations, "destination");
    const options = payload.options || {};

    if (!apartments.length || !destinations.length) {
      return response.status(400).json({ error: "At least one apartment and one destination are required." });
    }

    if (apartments.length + destinations.length > 50) {
      return response.status(400).json({ error: "Google Routes supports at most 50 address-based origins plus destinations." });
    }

    if (apartments.length * destinations.length > 100) {
      return response.status(400).json({ error: "This app caps commute checks at 100 route elements per request." });
    }

    const googleResponse = await fetch(GOOGLE_ROUTES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "originIndex,destinationIndex,duration,distanceMeters,condition,status,localizedValues"
      },
      body: JSON.stringify(buildGoogleRequest(apartments, destinations, options))
    });

    const rawText = await googleResponse.text();
    const data = parseGoogleResponse(rawText);
    if (!googleResponse.ok) {
      return response.status(googleResponse.status).json({
        error: formatGoogleError(googleResponse.status, data, rawText),
        googleStatus: data?.error?.status || data?.error?.code || googleResponse.status
      });
    }

    if (!Array.isArray(data)) {
      return response.status(502).json({
        error: "Google Routes returned an unexpected response format.",
        googleStatus: "UNEXPECTED_RESPONSE"
      });
    }

    return response.status(200).json({
      elements: data.map(normalizeMatrixElement)
    });
  } catch (error) {
    return response.status(500).json({ error: error.message || "Commute calculation failed." });
  }
}

function parseGoogleResponse(rawText) {
  if (!rawText) return null;

  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

function formatGoogleError(status, data, rawText) {
  const message = data?.error?.message;
  const googleStatus = data?.error?.status || data?.error?.code;
  if (message && googleStatus) return `Google Routes ${status} ${googleStatus}: ${message}`;
  if (message) return `Google Routes ${status}: ${message}`;
  if (rawText) return `Google Routes ${status}: ${rawText.slice(0, 220)}`;
  return `Google Routes ${status}: request failed.`;
}

function cleanAddressItems(items, fallbackName) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item, index) => ({
      id: String(item?.id || `${fallbackName}-${index}`),
      name: String(item?.name || `${fallbackName} ${index + 1}`).trim(),
      address: String(item?.address || "").trim()
    }))
    .filter((item) => item.address);
}

function buildGoogleRequest(apartments, destinations, options) {
  const travelMode = MODE_MAP[options.travelMode] || "TRANSIT";
  const request = {
    origins: apartments.map((item) => ({ waypoint: { address: item.address } })),
    destinations: destinations.map((item) => ({ waypoint: { address: item.address } })),
    travelMode,
    units: "IMPERIAL",
    languageCode: "en-US",
    regionCode: "US"
  };

  if (options.departureTime) {
    request.departureTime = options.departureTime;
  }

  if (travelMode === "DRIVE") {
    request.routingPreference = "TRAFFIC_AWARE_OPTIMAL";
    request.trafficModel = "BEST_GUESS";
  }

  return request;
}

function normalizeMatrixElement(element) {
  return {
    originIndex: element.originIndex,
    destinationIndex: element.destinationIndex,
    condition: element.condition || "UNKNOWN",
    status: element.status?.message || element.status?.code || element.condition || "UNKNOWN",
    minutes: durationToMinutes(element.duration),
    distance: element.localizedValues?.distance?.text || metersToMiles(element.distanceMeters)
  };
}

function durationToMinutes(value) {
  if (!value) return null;
  const seconds = Number(String(value).replace("s", ""));
  return Number.isFinite(seconds) ? Math.round(seconds / 60) : null;
}

function metersToMiles(value) {
  if (!Number.isFinite(value)) return "";
  return `${(value / 1609.344).toFixed(1)} mi`;
}
