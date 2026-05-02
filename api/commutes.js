const GOOGLE_MATRIX_URL = "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix";
const GOOGLE_ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

const MODE_MAP = {
  TRANSIT: "TRANSIT",
  DRIVING: "DRIVE",
  WALKING: "WALK",
  BICYCLING: "BICYCLE"
};

const DEFAULT_MODES = ["TRANSIT", "WALKING", "BICYCLING"];

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

    const matrixGroups = await Promise.all(
      DEFAULT_MODES.map(async (mode) => ({
        mode,
        elements: await fetchMatrix(apiKey, apartments, destinations, options, mode)
      }))
    );
    const transitDetails = await fetchTransitDetails(apiKey, apartments, destinations, options);

    return response.status(200).json({
      elements: matrixGroups.flatMap((group) =>
        group.elements.map((element) => ({
          ...normalizeMatrixElement(element),
          mode: group.mode,
          transitSummary:
            group.mode === "TRANSIT"
              ? transitDetails[routeKey(element.originIndex, element.destinationIndex)] || null
              : null
        }))
      )
    });
  } catch (error) {
    return response.status(500).json({ error: error.message || "Commute calculation failed." });
  }
}

async function fetchMatrix(apiKey, apartments, destinations, options, mode) {
  const googleResponse = await fetch(GOOGLE_MATRIX_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "originIndex,destinationIndex,duration,distanceMeters,condition,status,localizedValues"
    },
    body: JSON.stringify(buildMatrixRequest(apartments, destinations, options, mode))
  });

  const rawText = await googleResponse.text();
  const data = parseGoogleResponse(rawText);
  if (!googleResponse.ok) {
    throw new Error(formatGoogleError(googleResponse.status, data, rawText));
  }

  if (!Array.isArray(data)) {
    throw new Error("Google Routes returned an unexpected matrix response format.");
  }

  return data;
}

async function fetchTransitDetails(apiKey, apartments, destinations, options) {
  const details = {};
  const pairs = apartments.flatMap((apartment, originIndex) =>
    destinations.map((destination, destinationIndex) => ({ apartment, destination, originIndex, destinationIndex }))
  );

  await Promise.all(
    pairs.map(async (pair) => {
      const summary = await fetchTransitRoute(apiKey, pair.apartment.address, pair.destination.address, options);
      details[routeKey(pair.originIndex, pair.destinationIndex)] = summary;
    })
  );

  return details;
}

async function fetchTransitRoute(apiKey, origin, destination, options) {
  const googleResponse = await fetch(GOOGLE_ROUTES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "routes.duration,routes.distanceMeters,routes.legs.steps.travelMode,routes.legs.steps.transitDetails"
    },
    body: JSON.stringify({
      origin: { address: origin },
      destination: { address: destination },
      travelMode: "TRANSIT",
      units: "IMPERIAL",
      languageCode: "en-US",
      regionCode: "US",
      ...(options.departureTime ? { departureTime: options.departureTime } : {})
    })
  });

  const rawText = await googleResponse.text();
  const data = parseGoogleResponse(rawText);
  if (!googleResponse.ok) return { lines: [], warning: formatGoogleError(googleResponse.status, data, rawText) };

  const route = data?.routes?.[0];
  if (!route) return { lines: [] };

  const lines = route.legs
    ?.flatMap((leg) => leg.steps || [])
    .filter((step) => step.travelMode === "TRANSIT" && step.transitDetails)
    .map((step) => normalizeTransitStep(step.transitDetails))
    .filter(Boolean);

  return {
    minutes: durationToMinutes(route.duration),
    distance: metersToMiles(route.distanceMeters),
    lines: lines || []
  };
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

function buildMatrixRequest(apartments, destinations, options, mode) {
  const travelMode = MODE_MAP[mode] || "TRANSIT";
  const request = {
    origins: apartments.map((item) => ({ waypoint: { address: item.address } })),
    destinations: destinations.map((item) => ({ waypoint: { address: item.address } })),
    travelMode,
    units: "IMPERIAL",
    languageCode: "en-US",
    regionCode: "US"
  };

  if (options.departureTime && travelMode === "TRANSIT") {
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

function normalizeTransitStep(details) {
  const line = details.transitLine || {};
  const vehicle = line.vehicle || {};
  const stopDetails = details.stopDetails || {};
  const name = line.nameShort || line.name;
  if (!name) return null;

  return {
    name,
    fullName: line.name || "",
    vehicle: vehicle.type || vehicle.name?.text || "TRANSIT",
    headsign: details.headsign || "",
    stops: details.stopCount || 0,
    departureStop: stopDetails.departureStop?.name || "",
    arrivalStop: stopDetails.arrivalStop?.name || ""
  };
}

function routeKey(originIndex, destinationIndex) {
  return `${originIndex}:${destinationIndex}`;
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
