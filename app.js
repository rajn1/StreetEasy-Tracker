const STORAGE_KEY = "nyc-apartment-hunt-v1";

const state = {
  destinations: [
    {
      id: crypto.randomUUID(),
      name: "Office",
      address: "295 Lafayette Street, New York, NY",
      weight: 5
    },
    {
      id: crypto.randomUUID(),
      name: "Gym",
      address: "Union Square, New York, NY",
      weight: 2
    }
  ],
  apartments: [
    {
      id: crypto.randomUUID(),
      name: "Sample East Village",
      address: "100 Avenue A, New York, NY",
      price: 4200,
      url: "https://streeteasy.com/",
      manualMinutes: 24
    },
    {
      id: crypto.randomUUID(),
      name: "Sample Prospect Heights",
      address: "550 Vanderbilt Ave, Brooklyn, NY",
      price: 3900,
      url: "https://streeteasy.com/",
      manualMinutes: 38
    }
  ],
  options: {
    weekday: "2",
    departTime: "08:30",
    travelMode: "TRANSIT"
  }
};

const els = {
  apiStatus: document.querySelector("#apiStatus"),
  apiHint: document.querySelector("#apiHint"),
  weekday: document.querySelector("#weekday"),
  departTime: document.querySelector("#departTime"),
  travelMode: document.querySelector("#travelMode"),
  streetEasyUrl: document.querySelector("#streetEasyUrl"),
  streetEasyConfirm: document.querySelector("#streetEasyConfirm"),
  inferredAddress: document.querySelector("#inferredAddress"),
  inferredName: document.querySelector("#inferredName"),
  inferHint: document.querySelector("#inferHint"),
  destinations: document.querySelector("#destinations"),
  apartments: document.querySelector("#apartments"),
  results: document.querySelector("#results"),
  resultsMeta: document.querySelector("#resultsMeta"),
  bestTime: document.querySelector("#bestTime"),
  apartmentCount: document.querySelector("#apartmentCount"),
  destinationCount: document.querySelector("#destinationCount")
};

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;

  try {
    const parsed = JSON.parse(saved);
    state.destinations = parsed.destinations?.length ? parsed.destinations : state.destinations;
    state.apartments = parsed.apartments?.length ? parsed.apartments : state.apartments;
    state.options = { ...state.options, ...parsed.options };
    migrateDefaultDestinations();
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function migrateDefaultDestinations() {
  state.destinations = state.destinations.map((destination) => {
    if (destination.name === "Office" && destination.address === "11 Madison Ave, New York, NY") {
      return {
        ...destination,
        address: "295 Lafayette Street, New York, NY"
      };
    }

    return destination;
  });
  saveState();
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      destinations: state.destinations,
      apartments: state.apartments,
      options: state.options
    })
  );
}

function updateApiStatus() {
  els.apiStatus.textContent = "Backend mode";
  els.apiStatus.classList.add("ready");
  els.apiHint.textContent = "Real commute checks run through /api/commutes using GOOGLE_MAPS_API_KEY on the server.";
}

function nextRushHourDate() {
  const targetDay = Number(state.options.weekday);
  const [hour, minute] = state.options.departTime.split(":").map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);

  const today = date.getDay();
  let daysAhead = (targetDay - today + 7) % 7;
  if (daysAhead === 0 && date <= new Date()) daysAhead = 7;
  date.setDate(date.getDate() + daysAhead);
  return date;
}

function renderCards() {
  els.weekday.value = state.options.weekday;
  els.departTime.value = state.options.departTime;
  els.travelMode.value = state.options.travelMode;

  els.destinations.innerHTML = "";
  state.destinations.forEach((destination) => {
    const node = document.querySelector("#destinationTemplate").content.cloneNode(true);
    const card = node.querySelector(".destination-card");
    card.dataset.id = destination.id;
    node.querySelector(".destination-name").value = destination.name;
    node.querySelector(".destination-address").value = destination.address;
    node.querySelector(".destination-weight").value = destination.weight;
    els.destinations.append(node);
  });

  els.apartments.innerHTML = "";
  state.apartments.forEach((apartment) => {
    const node = document.querySelector("#apartmentTemplate").content.cloneNode(true);
    const card = node.querySelector(".apartment-card");
    card.dataset.id = apartment.id;
    node.querySelector(".apartment-name").value = apartment.name;
    node.querySelector(".apartment-address").value = apartment.address;
    node.querySelector(".apartment-price").value = apartment.price || "";
    node.querySelector(".apartment-url").value = apartment.url;
    node.querySelector(".apartment-manual").value = apartment.manualMinutes || "";
    els.apartments.append(node);
  });

  updateCounts();
}

function updateCounts() {
  els.apartmentCount.textContent = state.apartments.length;
  els.destinationCount.textContent = state.destinations.length;
}

function syncFromDom() {
  state.options.weekday = els.weekday.value;
  state.options.departTime = els.departTime.value;
  state.options.travelMode = els.travelMode.value;

  state.destinations = [...els.destinations.querySelectorAll(".destination-card")].map((card) => ({
    id: card.dataset.id,
    name: card.querySelector(".destination-name").value.trim(),
    address: card.querySelector(".destination-address").value.trim(),
    weight: Math.max(1, Number(card.querySelector(".destination-weight").value) || 1)
  }));

  state.apartments = [...els.apartments.querySelectorAll(".apartment-card")].map((card) => ({
    id: card.dataset.id,
    name: card.querySelector(".apartment-name").value.trim(),
    address: card.querySelector(".apartment-address").value.trim(),
    price: Number(card.querySelector(".apartment-price").value) || 0,
    url: card.querySelector(".apartment-url").value.trim(),
    manualMinutes: Number(card.querySelector(".apartment-manual").value) || 0
  }));

  saveState();
  updateCounts();
}

function addDestination() {
  syncFromDom();
  state.destinations.push({
    id: crypto.randomUUID(),
    name: "",
    address: "",
    weight: 3
  });
  saveState();
  renderCards();
}

function addApartment() {
  syncFromDom();
  state.apartments.push({
    id: crypto.randomUUID(),
    name: "",
    address: "",
    price: 0,
    url: "",
    manualMinutes: 0
  });
  saveState();
  renderCards();
}

function inferStreetEasyListing() {
  const url = els.streetEasyUrl.value.trim();
  const inference = parseStreetEasyUrl(url);
  els.streetEasyConfirm.hidden = false;
  els.inferredAddress.value = inference.address;
  els.inferredName.value = inference.name;
  els.inferHint.textContent = inference.message;
  els.inferHint.classList.toggle("warning", !inference.confident);
}

async function confirmStreetEasyListing() {
  syncFromDom();
  const address = els.inferredAddress.value.trim();
  if (!address) {
    els.inferHint.textContent = "Add or confirm an address before checking commute.";
    els.inferHint.classList.add("warning");
    return;
  }

  state.apartments.push({
    id: crypto.randomUUID(),
    name: els.inferredName.value.trim() || address,
    address,
    price: 0,
    url: els.streetEasyUrl.value.trim(),
    manualMinutes: 0
  });

  els.streetEasyUrl.value = "";
  els.streetEasyConfirm.hidden = true;
  saveState();
  renderCards();
  await rankApartments();
}

function parseStreetEasyUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return {
      name: "",
      address: "",
      confident: false,
      message: "Paste a full StreetEasy URL, then review the inferred address."
    };
  }

  if (!url.hostname.endsWith("streeteasy.com")) {
    return {
      name: "",
      address: "",
      confident: false,
      message: "This does not look like a StreetEasy link. You can still type the address manually."
    };
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const buildingIndex = segments.indexOf("building");
  const buildingSlug = buildingIndex >= 0 ? segments[buildingIndex + 1] : "";
  const unitSlug = buildingIndex >= 0 ? segments[buildingIndex + 2] : "";

  if (!buildingSlug) {
    return {
      name: "StreetEasy listing",
      address: "",
      confident: false,
      message: "I could not infer an address from this StreetEasy URL. Type it once, then add it."
    };
  }

  const buildingName = titleCaseSlug(buildingSlug);
  const unitName = unitSlug ? `, Unit ${unitSlug.toUpperCase()}` : "";

  return {
    name: `${buildingName}${unitName}`,
    address: `${buildingName}, New York, NY`,
    confident: true,
    message: "This is a best-effort guess from the URL. Confirm the exact street suffix, borough, and unit if needed."
  };
}

function titleCaseSlug(slug) {
  return slug
    .replace(/_/g, "-")
    .split("-")
    .filter(Boolean)
    .map((part) => {
      if (/^\d+[a-z]?$/i.test(part)) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function removeCard(event) {
  const button = event.target.closest(".remove-card");
  if (!button) return;

  const destination = button.closest(".destination-card");
  const apartment = button.closest(".apartment-card");
  if (destination) {
    state.destinations = state.destinations.filter((item) => item.id !== destination.dataset.id);
  }
  if (apartment) {
    state.apartments = state.apartments.filter((item) => item.id !== apartment.dataset.id);
  }
  saveState();
  renderCards();
  renderEmptyResults();
}

async function rankApartments() {
  syncFromDom();
  const apartments = state.apartments.filter((item) => item.address);
  const destinations = state.destinations.filter((item) => item.address);

  if (!apartments.length || !destinations.length) {
    renderEmptyResults("Add at least one apartment and one destination.");
    return;
  }

  els.results.innerHTML = '<div class="empty-state">Ranking apartments...</div>';

  try {
    const ranked = await rankWithBackend(apartments, destinations);
    renderResults(ranked, true);
  } catch (error) {
    const ranked = rankWithManual(apartments, destinations);
    renderResults(ranked, false, error.message);
  }
}

async function rankWithBackend(apartments, destinations) {
  const response = await fetch("/api/commutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      apartments,
      destinations,
      options: {
        travelMode: state.options.travelMode,
        departureTime: nextRushHourDate().toISOString()
      }
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Commute API request failed with status ${response.status}.`);
  }

  return apartments
    .map((apartment, apartmentIndex) => {
      const commutes = destinations.map((destination, destinationIndex) => {
        const element = data.elements.find(
          (item) => item.originIndex === apartmentIndex && item.destinationIndex === destinationIndex
        );
        return {
          destination,
          minutes: element?.minutes || null,
          distance: element?.distance || "",
          status: element?.condition || element?.status || "UNKNOWN"
        };
      });
      return withScore(apartment, commutes);
    })
    .sort((a, b) => a.score - b.score || a.apartment.price - b.apartment.price);
}

function rankWithManual(apartments, destinations) {
  return apartments
    .map((apartment) => {
      const fallbackMinutes = apartment.manualMinutes || 999;
      const commutes = destinations.map((destination) => ({
        destination,
        minutes: fallbackMinutes,
        distance: "",
        status: apartment.manualMinutes ? "MANUAL" : "MISSING"
      }));
      return withScore(apartment, commutes);
    })
    .sort((a, b) => a.score - b.score || a.apartment.price - b.apartment.price);
}

function withScore(apartment, commutes) {
  let weightedTotal = 0;
  let weightTotal = 0;

  commutes.forEach((commute) => {
    const weight = commute.destination.weight || 1;
    weightedTotal += (commute.minutes || 999) * weight;
    weightTotal += weight;
  });

  return {
    apartment,
    commutes,
    score: Math.round(weightedTotal / Math.max(1, weightTotal))
  };
}

function renderResults(ranked, usedGoogle, warning = "") {
  const best = ranked[0]?.score;
  els.bestTime.textContent = Number.isFinite(best) && best < 999 ? `${best}m` : "--";

  const modeName = state.options.travelMode.toLowerCase();
  const departure = nextRushHourDate();
  els.resultsMeta.textContent = usedGoogle
    ? `Sorted by ${modeName} time for ${departure.toLocaleDateString([], { weekday: "long" })} at ${state.options.departTime}.`
    : "Sorted by manual commute estimate.";

  els.results.innerHTML = "";
  if (warning) {
    const warningNode = document.createElement("div");
    warningNode.className = "empty-state warning";
    warningNode.textContent = `${warning} Showing manual estimates.`;
    els.results.append(warningNode);
  }

  ranked.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "result-card";
    const url = item.apartment.url || "#";
    const rent = item.apartment.price ? `$${item.apartment.price.toLocaleString()}` : "Rent TBD";
    const commutes = item.commutes
      .map((commute) => {
        const time = commute.minutes && commute.minutes < 999 ? `${commute.minutes} min` : "Missing";
        const detail = commute.distance || commute.status.toLowerCase();
        return `
          <div class="commute-cell">
            <strong>${escapeHtml(commute.destination.name || "Destination")}</strong>
            <span>${time}${detail ? ` · ${escapeHtml(detail)}` : ""}</span>
          </div>
        `;
      })
      .join("");

    card.innerHTML = `
      <div class="result-top">
        <div>
          <div class="result-title">
            <a href="${escapeAttribute(url)}" target="_blank" rel="noreferrer">${index + 1}. ${escapeHtml(item.apartment.name || item.apartment.address)}</a>
            <span class="rent">${rent}</span>
          </div>
          <p class="address">${escapeHtml(item.apartment.address)}</p>
        </div>
        <div class="score">${item.score < 999 ? `${item.score} min` : "Missing"}</div>
      </div>
      <div class="commute-grid">${commutes}</div>
    `;
    els.results.append(card);
  });
}

function renderEmptyResults(message = "Add apartments, destinations, then rank the list.") {
  els.bestTime.textContent = "--";
  els.resultsMeta.textContent = "Sorted by weighted commute time.";
  els.results.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  const text = String(value || "#");
  if (!/^https?:\/\//i.test(text) && text !== "#") return "#";
  return escapeHtml(text);
}

function bindEvents() {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab-button").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      document.querySelector(`#${button.dataset.tab}`).classList.add("active");
    });
  });

  document.querySelector("#addDestination").addEventListener("click", addDestination);
  document.querySelector("#addApartment").addEventListener("click", addApartment);
  document.querySelector("#inferStreetEasy").addEventListener("click", inferStreetEasyListing);
  document.querySelector("#confirmStreetEasy").addEventListener("click", confirmStreetEasyListing);
  document.querySelector("#rankApartments").addEventListener("click", rankApartments);
  els.destinations.addEventListener("click", removeCard);
  els.apartments.addEventListener("click", removeCard);

  els.streetEasyUrl.addEventListener("input", () => {
    if (els.streetEasyConfirm.hidden || !els.streetEasyUrl.value.trim()) return;
    inferStreetEasyListing();
  });

  document.addEventListener("input", (event) => {
    if (event.target.closest(".apartment-card") || event.target.closest(".destination-card")) {
      syncFromDom();
    }
    if (event.target === els.weekday || event.target === els.departTime || event.target === els.travelMode) {
      syncFromDom();
    }
  });
}

loadState();
bindEvents();
renderCards();
updateApiStatus();
renderEmptyResults();
