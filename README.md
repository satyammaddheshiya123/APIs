# Weather Dashboard — Async JavaScript & REST APIs

A real-time weather dashboard built with plain HTML, CSS, and JavaScript
(no frameworks, no build step, no API key). Built for the "Asynchronous
JavaScript & RESTful APIs" assignment.

## How to run

Just open `index.html` in any modern browser. It needs an internet
connection (it calls a live public API), but nothing else — no server,
no installation, no API key to configure.

```
weather-app/
├── index.html
├── css/
│   └── style.css
└── js/
    └── app.js
```

## Data source

[Open-Meteo](https://open-meteo.com/) — a free, keyless, CORS-enabled
weather API. Two endpoints are used:

1. **Geocoding** (`geocoding-api.open-meteo.com/v1/search`) — turns a
   city name typed by the user into one or more candidate locations
   (name, region, country, latitude/longitude).
2. **Forecast** (`api.open-meteo.com/v1/forecast`) — given coordinates,
   returns current conditions plus today's daily summary (high/low,
   sunrise/sunset).

## Features

- **Fetch API + async/await** — every network call goes through a single
  `fetchJSON()` helper using `fetch`, `async/await`, and an
  `AbortController`-based timeout (8s) so a stalled request fails
  gracefully instead of hanging forever.
- **Comprehensive error handling** — a custom `WeatherError` class carries
  a `type` (`not-found`, `network`, `timeout`, `server`, `geolocation`,
  `unsupported`) so the UI shows a specific, honest message for each
  failure mode, with a **Retry** button wherever retrying makes sense.
- **Nested JSON parsing** — the forecast response's `current` and `daily`
  objects (the latter holding same-length arrays keyed by day) are read
  and rendered into a metrics grid: humidity, wind speed *and*
  direction (converted from degrees to a compass label), precipitation,
  today's high/low, sunrise, and sunset.
- **Search by city name** — typing a city and submitting calls the
  geocoding endpoint; if it finds more than one match (e.g. more than
  one "Springfield"), a picker list appears instead of guessing.
- **Bonus touches**
  - **"My location"** button using the Geolocation API (wrapped in a
    Promise so it can be `await`-ed like the fetch calls)
  - **Recent searches**, saved to `localStorage`, for one-click reload
    without re-hitting the geocoding endpoint
  - **°C / °F toggle** — conversion happens client-side on already-fetched
    data, no extra network call
  - **Auto-refresh** every 10 minutes for the currently displayed city
  - **Dynamic sky-gradient background** that shifts color based on the
    real weather condition and time of day returned by the API (clear,
    cloudy, fog, drizzle, rain, snow, storm — each with a day and night
    palette)
  - Light/dark theme toggle, keyboard accessible, ARIA live regions for
    loading/error/status messages

## Notes

- All temperatures/wind speeds are fetched once in metric (°C, km/h) and
  converted in the browser for the unit toggle — no duplicate requests.
- Data is attributed to Open-Meteo in the footer of the weather card, as
  their terms request.
