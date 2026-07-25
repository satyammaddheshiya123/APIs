// ============================================================
// Weather Dashboard — async JavaScript + REST API
// Data source: Open-Meteo (https://open-meteo.com) — free, no API
// key required, CORS-enabled, so it works straight from a static
// page with nothing to hide on a server.
// ============================================================
(function () {
  "use strict";

  const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
  const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
  const RECENTS_KEY = "weather-recent-searches";
  const UNIT_KEY = "weather-unit";
  const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // silently refresh every 10 minutes

  // ----------------------------------------------------------
  // Elements
  // ----------------------------------------------------------
  const searchForm = document.getElementById("searchForm");
  const citySearch = document.getElementById("citySearch");
  const suggestionsList = document.getElementById("suggestions");
  const recentRow = document.getElementById("recentRow");
  const recentChips = document.getElementById("recentChips");
  const statusLine = document.getElementById("statusLine");
  const useLocationBtn = document.getElementById("useLocationBtn");
  const refreshBtn = document.getElementById("refreshBtn");
  const unitToggle = document.getElementById("unitToggle");

  const weatherCard = document.getElementById("weatherCard");
  const locationNameEl = document.getElementById("locationName");
  const localTimeEl = document.getElementById("localTime");
  const weatherIconEl = document.getElementById("weatherIcon");
  const weatherTempEl = document.getElementById("weatherTemp");
  const weatherDescEl = document.getElementById("weatherDesc");
  const weatherFeelsEl = document.getElementById("weatherFeels");
  const metricsGrid = document.getElementById("metricsGrid");
  const updatedLineEl = document.getElementById("updatedLine");

  // ----------------------------------------------------------
  // Weather-code lookup (WMO codes used by Open-Meteo)
  // Each entry maps to an icon, a human label, and a "condition
  // group" used to pick the dynamic sky-gradient colors.
  // ----------------------------------------------------------
  const WEATHER_CODES = {
    0: { label: "Clear sky", day: "\u2600\ufe0f", night: "\ud83c\udf19", group: "clear" },
    1: { label: "Mainly clear", day: "\ud83c\udf24\ufe0f", night: "\ud83c\udf19", group: "clear" },
    2: { label: "Partly cloudy", day: "\u26c5", night: "\u2601\ufe0f", group: "cloudy" },
    3: { label: "Overcast", day: "\u2601\ufe0f", night: "\u2601\ufe0f", group: "cloudy" },
    45: { label: "Fog", day: "\ud83c\udf2b\ufe0f", night: "\ud83c\udf2b\ufe0f", group: "fog" },
    48: { label: "Depositing rime fog", day: "\ud83c\udf2b\ufe0f", night: "\ud83c\udf2b\ufe0f", group: "fog" },
    51: { label: "Light drizzle", day: "\ud83c\udf26\ufe0f", night: "\ud83c\udf26\ufe0f", group: "drizzle" },
    53: { label: "Moderate drizzle", day: "\ud83c\udf26\ufe0f", night: "\ud83c\udf26\ufe0f", group: "drizzle" },
    55: { label: "Dense drizzle", day: "\ud83c\udf26\ufe0f", night: "\ud83c\udf26\ufe0f", group: "drizzle" },
    56: { label: "Freezing drizzle", day: "\ud83c\udf27\ufe0f", night: "\ud83c\udf27\ufe0f", group: "drizzle" },
    57: { label: "Dense freezing drizzle", day: "\ud83c\udf27\ufe0f", night: "\ud83c\udf27\ufe0f", group: "drizzle" },
    61: { label: "Slight rain", day: "\ud83c\udf27\ufe0f", night: "\ud83c\udf27\ufe0f", group: "rain" },
    63: { label: "Moderate rain", day: "\ud83c\udf27\ufe0f", night: "\ud83c\udf27\ufe0f", group: "rain" },
    65: { label: "Heavy rain", day: "\ud83c\udf27\ufe0f", night: "\ud83c\udf27\ufe0f", group: "rain" },
    66: { label: "Freezing rain", day: "\ud83c\udf27\ufe0f", night: "\ud83c\udf27\ufe0f", group: "rain" },
    67: { label: "Heavy freezing rain", day: "\ud83c\udf27\ufe0f", night: "\ud83c\udf27\ufe0f", group: "rain" },
    71: { label: "Slight snow fall", day: "\ud83c\udf28\ufe0f", night: "\ud83c\udf28\ufe0f", group: "snow" },
    73: { label: "Moderate snow fall", day: "\ud83c\udf28\ufe0f", night: "\ud83c\udf28\ufe0f", group: "snow" },
    75: { label: "Heavy snow fall", day: "\u2744\ufe0f", night: "\u2744\ufe0f", group: "snow" },
    77: { label: "Snow grains", day: "\u2744\ufe0f", night: "\u2744\ufe0f", group: "snow" },
    80: { label: "Slight rain showers", day: "\ud83c\udf26\ufe0f", night: "\ud83c\udf26\ufe0f", group: "rain" },
    81: { label: "Moderate rain showers", day: "\ud83c\udf27\ufe0f", night: "\ud83c\udf27\ufe0f", group: "rain" },
    82: { label: "Violent rain showers", day: "\u26c8\ufe0f", night: "\u26c8\ufe0f", group: "storm" },
    85: { label: "Slight snow showers", day: "\ud83c\udf28\ufe0f", night: "\ud83c\udf28\ufe0f", group: "snow" },
    86: { label: "Heavy snow showers", day: "\u2744\ufe0f", night: "\u2744\ufe0f", group: "snow" },
    95: { label: "Thunderstorm", day: "\u26c8\ufe0f", night: "\u26c8\ufe0f", group: "storm" },
    96: { label: "Thunderstorm with hail", day: "\u26c8\ufe0f", night: "\u26c8\ufe0f", group: "storm" },
    99: { label: "Thunderstorm with heavy hail", day: "\u26c8\ufe0f", night: "\u26c8\ufe0f", group: "storm" },
  };

  // [day colors, night colors] per condition group, used to drive the
  // dynamic sky-gradient background behind the glass card.
  const SKY_COLORS = {
    clear: { day: ["#4fc3f7", "#ffe082"], night: ["#0d1b3a", "#1a2a52"] },
    cloudy: { day: ["#90a4ae", "#cfd8dc"], night: ["#263445", "#37475a"] },
    fog: { day: ["#b0bec5", "#eceff1"], night: ["#2b333a", "#45525c"] },
    drizzle: { day: ["#78909c", "#b0bec5"], night: ["#22303c", "#34454f"] },
    rain: { day: ["#4b6584", "#778ca3"], night: ["#16222a", "#26333d"] },
    snow: { day: ["#e3f2fd", "#ffffff"], night: ["#1c2b3a", "#2f4152"] },
    storm: { day: ["#37474f", "#212a30"], night: ["#0d1117", "#1c1f24"] },
  };

  // ----------------------------------------------------------
  // A small custom error type so the UI can react differently to
  // "city not found" vs "network down" vs "server error" vs "timeout".
  // ----------------------------------------------------------
  class WeatherError extends Error {
    constructor(message, type) {
      super(message);
      this.name = "WeatherError";
      this.type = type || "unknown";
    }
  }

  // ----------------------------------------------------------
  // Low-level fetch helper: adds a timeout via AbortController and
  // normalizes every failure mode into a WeatherError with a `type`.
  // ----------------------------------------------------------
  async function fetchJSON(url, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(function () { controller.abort(); }, timeoutMs || 8000);

    let response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } catch (err) {
      if (err.name === "AbortError") {
        throw new WeatherError("The request took too long and timed out.", "timeout");
      }
      throw new WeatherError("Network error — check your internet connection.", "network");
    } finally {
      window.clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new WeatherError("The weather service responded with an error (" + response.status + ").", "server");
    }

    try {
      return await response.json();
    } catch (err) {
      throw new WeatherError("Received an unreadable response from the weather service.", "parse");
    }
  }

  // ----------------------------------------------------------
  // API calls
  // ----------------------------------------------------------
  async function geocodeCity(query) {
    const params = new URLSearchParams({
      name: query,
      count: "5",
      language: "en",
      format: "json",
    });
    const data = await fetchJSON(GEOCODE_URL + "?" + params.toString());
    if (!data.results || data.results.length === 0) {
      throw new WeatherError("No city found matching \u201c" + query + "\u201d.", "not-found");
    }
    return data.results;
  }

  async function fetchCurrentWeather(location) {
    const params = new URLSearchParams({
      latitude: location.latitude,
      longitude: location.longitude,
      current: [
        "temperature_2m",
        "relative_humidity_2m",
        "apparent_temperature",
        "is_day",
        "precipitation",
        "weather_code",
        "wind_speed_10m",
        "wind_direction_10m",
      ].join(","),
      daily: ["weather_code", "temperature_2m_max", "temperature_2m_min", "sunrise", "sunset"].join(","),
      timezone: "auto",
    });
    return fetchJSON(FORECAST_URL + "?" + params.toString());
  }

  // ----------------------------------------------------------
  // Geolocation wrapped as a promise so it can be awaited alongside
  // the fetch-based calls above.
  // ----------------------------------------------------------
  function getBrowserLocation() {
    return new Promise(function (resolve, reject) {
      if (!("geolocation" in navigator)) {
        reject(new WeatherError("Geolocation isn't supported in this browser.", "unsupported"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        function (position) { resolve(position.coords); },
        function () { reject(new WeatherError("Location permission was denied or unavailable.", "geolocation")); },
        { timeout: 8000 }
      );
    });
  }

  // ----------------------------------------------------------
  // State
  // ----------------------------------------------------------
  let currentLocation = null; // { name, admin1, country, latitude, longitude }
  let currentData = null; // raw Open-Meteo response, always stored in °C / km/h
  let unit = loadUnit(); // 'metric' | 'imperial'
  let refreshTimer = null;
  let lastQuery = "";

  function loadUnit() {
    try {
      const saved = localStorage.getItem(UNIT_KEY);
      return saved === "imperial" ? "imperial" : "metric";
    } catch (err) {
      return "metric";
    }
  }

  function saveUnit() {
    try { localStorage.setItem(UNIT_KEY, unit); } catch (err) { /* non-fatal */ }
  }

  function loadRecents() {
    try {
      const raw = localStorage.getItem(RECENTS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function saveRecent(location) {
    const recents = loadRecents().filter(function (r) {
      return !(r.latitude === location.latitude && r.longitude === location.longitude);
    });
    recents.unshift({
      name: location.name,
      admin1: location.admin1 || "",
      country: location.country || "",
      latitude: location.latitude,
      longitude: location.longitude,
    });
    const trimmed = recents.slice(0, 5);
    try { localStorage.setItem(RECENTS_KEY, JSON.stringify(trimmed)); } catch (err) { /* non-fatal */ }
    renderRecents();
  }

  // ----------------------------------------------------------
  // Unit conversion helpers (raw data is always stored in metric;
  // conversion happens only at render time, so toggling units never
  // needs a new network request)
  // ----------------------------------------------------------
  function celsiusToDisplay(celsius) {
    if (unit === "imperial") return Math.round(celsius * 9 / 5 + 32);
    return Math.round(celsius);
  }
  function tempUnitLabel() { return unit === "imperial" ? "\u00b0F" : "\u00b0C"; }

  function kmhToDisplay(kmh) {
    if (unit === "imperial") return Math.round(kmh / 1.609344);
    return Math.round(kmh);
  }
  function speedUnitLabel() { return unit === "imperial" ? "mph" : "km/h"; }

  function degToCompass(deg) {
    const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    return dirs[Math.round(deg / 22.5) % 16];
  }

  // ----------------------------------------------------------
  // Status line helper
  // ----------------------------------------------------------
  function setStatus(state, message, retryFn) {
    statusLine.dataset.state = state;
    statusLine.textContent = "";
    if (message) {
      statusLine.append(message);
    }
    if (retryFn) {
      const retryBtn = document.createElement("button");
      retryBtn.type = "button";
      retryBtn.className = "retry-btn";
      retryBtn.textContent = "Retry";
      retryBtn.addEventListener("click", retryFn);
      statusLine.append(retryBtn);
    }
  }

  function handleError(err) {
    const type = err instanceof WeatherError ? err.type : "unknown";
    const retry = lastQuery ? function () { runSearch(lastQuery); } : null;

    if (type === "not-found") {
      setStatus("error", err.message);
    } else if (type === "network") {
      setStatus("error", "Couldn't reach the weather service. Check your connection and try again.", retry);
    } else if (type === "timeout") {
      setStatus("error", "That took too long. Please try again.", retry);
    } else if (type === "server") {
      setStatus("error", err.message, retry);
    } else if (type === "geolocation" || type === "unsupported") {
      setStatus("error", err.message);
    } else {
      setStatus("error", "Something went wrong fetching the weather. Please try again.", retry);
    }
  }

  // ----------------------------------------------------------
  // Rendering
  // ----------------------------------------------------------
  function applySkyGradient(group, isDay) {
    const palette = SKY_COLORS[group] || SKY_COLORS.clear;
    const colors = isDay ? palette.day : palette.night;
    document.documentElement.style.setProperty("--sky-a", colors[0]);
    document.documentElement.style.setProperty("--sky-b", colors[1]);
  }

  function buildMetricTile(label, value, iconChar) {
    const tile = document.createElement("div");
    tile.className = "metric-tile";

    const labelEl = document.createElement("span");
    labelEl.className = "metric-label";
    const icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = iconChar;
    labelEl.appendChild(icon);
    labelEl.append(" " + label);

    const valueEl = document.createElement("span");
    valueEl.className = "metric-value";
    valueEl.textContent = value;

    tile.appendChild(labelEl);
    tile.appendChild(valueEl);
    return tile;
  }

  function renderWeather(location, data) {
    // --- Parse the nested JSON payload -----------------------
    const current = data.current || {};
    const daily = data.daily || {};
    const weatherInfo = WEATHER_CODES[current.weather_code] || WEATHER_CODES[0];
    const isDay = current.is_day === 1;

    const todayHigh = Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max[0] : null;
    const todayLow = Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min[0] : null;
    const sunrise = Array.isArray(daily.sunrise) ? daily.sunrise[0] : null;
    const sunset = Array.isArray(daily.sunset) ? daily.sunset[0] : null;

    // --- Header -------------------------------------------------
    const locationLabel = [location.name, location.admin1, location.country].filter(Boolean).join(", ");
    locationNameEl.textContent = locationLabel || location.name;

    if (current.time) {
      const localDate = new Date(current.time);
      localTimeEl.textContent = "Local time: " + localDate.toLocaleString(undefined, {
        weekday: "short", hour: "2-digit", minute: "2-digit",
      });
    } else {
      localTimeEl.textContent = "";
    }

    // --- Hero (icon, temperature, description) ------------------
    weatherIconEl.textContent = isDay ? weatherInfo.day : weatherInfo.night;
    weatherTempEl.textContent = celsiusToDisplay(current.temperature_2m) + tempUnitLabel();
    weatherDescEl.textContent = weatherInfo.label;
    weatherFeelsEl.textContent =
      current.apparent_temperature != null
        ? "Feels like " + celsiusToDisplay(current.apparent_temperature) + tempUnitLabel()
        : "";

    // --- Metrics grid --------------------------------------------
    metricsGrid.innerHTML = "";
    const tiles = [];
    tiles.push(buildMetricTile("Humidity", current.relative_humidity_2m + "%", "\ud83d\udca7"));
    tiles.push(
      buildMetricTile(
        "Wind",
        kmhToDisplay(current.wind_speed_10m) + " " + speedUnitLabel() +
          (current.wind_direction_10m != null ? " " + degToCompass(current.wind_direction_10m) : ""),
        "\ud83c\udf2c\ufe0f"
      )
    );
    if (current.precipitation != null) {
      tiles.push(buildMetricTile("Precipitation", current.precipitation + " mm", "\ud83c\udf27\ufe0f"));
    }
    if (todayHigh != null && todayLow != null) {
      tiles.push(
        buildMetricTile(
          "High / Low",
          celsiusToDisplay(todayHigh) + "\u00b0 / " + celsiusToDisplay(todayLow) + "\u00b0",
          "\ud83c\udf21\ufe0f"
        )
      );
    }
    if (sunrise) {
      tiles.push(buildMetricTile("Sunrise", new Date(sunrise).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }), "\ud83c\udf05"));
    }
    if (sunset) {
      tiles.push(buildMetricTile("Sunset", new Date(sunset).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }), "\ud83c\udf07"));
    }
    tiles.forEach(function (tile) { metricsGrid.appendChild(tile); });

    // --- Footer / dynamic backdrop --------------------------------
    updatedLineEl.textContent = "Updated " + new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    applySkyGradient(weatherInfo.group, isDay);

    weatherCard.hidden = false;
  }

  function renderSuggestions(results) {
    suggestionsList.innerHTML = "";
    results.forEach(function (result) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "suggestion-btn";
      btn.setAttribute("role", "option");

      const nameEl = document.createElement("span");
      nameEl.className = "suggestion-name";
      nameEl.textContent = result.name;

      const metaEl = document.createElement("span");
      metaEl.className = "suggestion-meta";
      metaEl.textContent = [result.admin1, result.country].filter(Boolean).join(", ");

      btn.appendChild(nameEl);
      btn.appendChild(metaEl);
      btn.addEventListener("click", function () {
        hideSuggestions();
        selectLocation(result);
      });

      li.appendChild(btn);
      suggestionsList.appendChild(li);
    });
    suggestionsList.hidden = false;
    citySearch.setAttribute("aria-expanded", "true");
  }

  function hideSuggestions() {
    suggestionsList.hidden = true;
    suggestionsList.innerHTML = "";
    citySearch.setAttribute("aria-expanded", "false");
  }

  function renderRecents() {
    const recents = loadRecents();
    recentChips.innerHTML = "";
    if (recents.length === 0) {
      recentRow.hidden = true;
      return;
    }
    recents.forEach(function (r) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "recent-chip";
      chip.textContent = r.name;
      chip.addEventListener("click", function () { selectLocation(r); });
      recentChips.appendChild(chip);
    });
    recentRow.hidden = false;
  }

  // ----------------------------------------------------------
  // Orchestration
  // ----------------------------------------------------------
  async function selectLocation(location) {
    setStatus("loading", "Fetching weather for " + location.name + "\u2026");
    try {
      const data = await fetchCurrentWeather(location);
      currentLocation = location;
      currentData = data;
      renderWeather(location, data);
      saveRecent(location);
      setStatus("idle", "");
      scheduleAutoRefresh();
    } catch (err) {
      handleError(err);
    }
  }

  async function runSearch(query) {
    lastQuery = query;
    hideSuggestions();
    setStatus("loading", "Searching for \u201c" + query + "\u201d\u2026");
    try {
      const results = await geocodeCity(query);
      if (results.length === 1) {
        await selectLocation(results[0]);
      } else {
        renderSuggestions(results);
        setStatus("idle", "Multiple matches for \u201c" + query + "\u201d — pick one below.");
      }
    } catch (err) {
      handleError(err);
    }
  }

  function scheduleAutoRefresh() {
    if (refreshTimer) window.clearInterval(refreshTimer);
    refreshTimer = window.setInterval(function () {
      if (currentLocation) selectLocation(currentLocation);
    }, REFRESH_INTERVAL_MS);
  }

  // ----------------------------------------------------------
  // Event wiring
  // ----------------------------------------------------------
  searchForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const query = citySearch.value.trim();
    if (!query) {
      setStatus("error", "Type a city name first.");
      citySearch.focus();
      return;
    }
    runSearch(query);
  });

  useLocationBtn.addEventListener("click", async function () {
    setStatus("loading", "Getting your location\u2026");
    try {
      const coords = await getBrowserLocation();
      await selectLocation({
        name: "Your location",
        admin1: "",
        country: "",
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
    } catch (err) {
      handleError(err);
    }
  });

  refreshBtn.addEventListener("click", function () {
    if (!currentLocation) return;
    refreshBtn.classList.add("is-spinning");
    window.setTimeout(function () { refreshBtn.classList.remove("is-spinning"); }, 600);
    selectLocation(currentLocation);
  });

  unitToggle.addEventListener("click", function () {
    unit = unit === "metric" ? "imperial" : "metric";
    saveUnit();
    unitToggle.setAttribute("aria-pressed", unit === "imperial" ? "true" : "false");
    unitToggle.textContent = unit === "imperial" ? "\u00b0F / \u00b0C" : "\u00b0C / \u00b0F";
    if (currentLocation && currentData) renderWeather(currentLocation, currentData);
  });

  // Close suggestions when clicking outside the search area
  document.addEventListener("click", function (event) {
    if (!event.target.closest(".search-row") && !event.target.closest(".suggestions")) {
      hideSuggestions();
    }
  });

  // ----------------------------------------------------------
  // Theme toggle (same pattern as the other projects)
  // ----------------------------------------------------------
  (function initThemeToggle() {
    const root = document.documentElement;
    const toggle = document.getElementById("themeToggle");
    if (!toggle) return;
    const THEME_KEY = "weather-theme";
    const icon = toggle.querySelector(".theme-toggle-icon");
    const label = toggle.querySelector(".theme-toggle-label");

    function applyTheme(theme) {
      root.setAttribute("data-theme", theme);
      toggle.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
      if (icon) icon.textContent = theme === "dark" ? "\u2600\ufe0f" : "\ud83c\udf19";
      if (label) label.textContent = theme === "dark" ? "Light mode" : "Dark mode";
    }

    applyTheme(root.getAttribute("data-theme") || "light");

    toggle.addEventListener("click", function () {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      try { localStorage.setItem(THEME_KEY, next); } catch (err) { /* non-fatal */ }
      applyTheme(next);
    });
  })();

  // ----------------------------------------------------------
  // Initial paint
  // ----------------------------------------------------------
  unitToggle.setAttribute("aria-pressed", unit === "imperial" ? "true" : "false");
  unitToggle.textContent = unit === "imperial" ? "\u00b0F / \u00b0C" : "\u00b0C / \u00b0F";
  renderRecents();

  // Load the most recent search automatically, if there is one, so the
  // dashboard shows real data right away instead of an empty state.
  const recents = loadRecents();
  if (recents.length > 0) {
    selectLocation(recents[0]);
  } else {
    setStatus("idle", "Search a city above, or use your location, to see live weather.");
  }
})();
