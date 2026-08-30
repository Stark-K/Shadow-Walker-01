# ShadowWalker

> Navigation that keeps you in the shade, not just on the shortest path.

ShadowWalker is a heat-aware navigation platform. It compares the **fastest route** with the **coolest route** and recommends the safer option during heat waves — powered by street-level temperature intelligence from the FortyGuard Temperature API.

![ShadowWalker](https://img.shields.io/badge/stack-Next.js%20%2B%20FastAPI-22c55e)

---

## What it does

- **Landing page** — modern dark theme, hero, feature cards, and a clear call to action.
- **Dashboard** — enter a start and destination, pick a time and route preference, and hit *Find Coolest Route*.
- **Interactive map** — Leaflet + OpenStreetMap/CARTO dark tiles. The fastest route is drawn in **red**, the coolest route in **green**, with live heat-risk labels.
- **Route comparison** — distance, travel time, average/max temperature, heat score, and heat-reduction percentage side-by-side.
- **AI explanation panel** — auto-generates a plain-language summary, e.g. *"Taking the coolest route adds 3 minutes but reduces heat exposure by 47%."*
- **FortyGuard integration** — a reusable service with `getTemperature()`, `getHeatData()`, and `getHeatRisk()`, full error handling, and an async submit-and-poll flow. Falls back to a deterministic local simulation if the API is unavailable.

## Tech stack

| Layer    | Technology |
| -------- | ---------- |
| Frontend | Next.js, React, TypeScript, Tailwind CSS, Leaflet |
| Backend  | FastAPI (Python), Uvicorn |
| Data     | OpenStreetMap (Nominatim + OSRM), FortyGuard Temperature API |

## Project structure

```
.
├── app/                      # Next.js app (frontend + API routes)
│   ├── api/
│   │   ├── geocode/route.ts        # Nominatim geocoding proxy
│   │   └── route-analysis/route.ts # Route analysis (FastAPI proxy OR in-process engine)
│   ├── dashboard/page.tsx          # Heat-aware routing dashboard
│   ├── layout.tsx
│   ├── page.tsx                    # Landing page
│   └── globals.css
├── components/
│   ├── route-map.tsx               # Leaflet map with red/green routes
│   ├── route-comparison.tsx        # Metric comparison panel
│   ├── location-search.tsx         # Address autocomplete
│   ├── site-shell.tsx              # Header + footer
│   └── ui/                         # shadcn/ui components
├── lib/
│   ├── types.ts
│   └── route-utils.ts
├── backend/                  # FastAPI backend (Python)
│   ├── app/
│   │   ├── main.py                 # FastAPI app + endpoints
│   │   ├── config.py               # Env-driven settings
│   │   ├── schemas.py              # Pydantic request/response models
│   │   └── services/
│   │       ├── fortyguard.py       # FortyGuard service (getTemperature / getHeatData / getHeatRisk)
│   │       ├── routing.py          # Nominatim + OSRM
│   │       └── analyzer.py         # Route comparison + AI explanation
│   ├── main.py                     # Uvicorn entrypoint
│   ├── requirements.txt
│   └── .env.example
├── .env.example
└── README.md
```

## Quick start

### 1. Frontend (Next.js)

```bash
npm install
npm run dev
```

Open http://localhost:3000.

The frontend works **on its own**: the `/api/route-analysis` route runs an in-process engine that geocodes via Nominatim, routes via OSRM, and samples temperatures (via FortyGuard if a key is present, otherwise via a deterministic simulation). No backend required to demo.

### 2. Backend (FastAPI, optional but recommended)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

Then point the frontend at it by adding to the project root `.env`:

```
SHADOWWALKER_BACKEND_URL=http://localhost:8000
```

When set, `/api/route-analysis` proxies to the FastAPI service.

## API endpoints

### `POST /api/route-analysis`

**Request**
```json
{ "start": "Times Square, NY", "destination": "Central Park, NY" }
```

**Response**
```json
{
  "fastest_route": {
    "type": "fastest",
    "label": "Fastest Route",
    "color": "#ef4444",
    "geometry": [{ "lat": 40.758, "lng": -73.985 }],
    "metrics": {
      "distance_km": 1.2,
      "duration_min": 14.5,
      "avg_temperature_c": 33.4,
      "max_temperature_c": 36.1,
      "heat_score": 42,
      "shade_coverage": 43
    },
    "summary": "Shortest time, 1.2 km"
  },
  "coolest_route": { "...": "same shape, green route" },
  "heat_reduction": 47,
  "ai_explanation": "Taking the coolest route adds 3 min but reduces heat exposure by 47%, with an average temperature 2.1°C cooler along the path. This is a meaningful reduction during heat-wave conditions — strongly recommended."
}
```

The FastAPI backend also exposes:

- `GET /api/health` — service health + FortyGuard status
- `POST /api/temperature` — point temperature via `getTemperature()`
- `POST /api/heat-risk` — categorical heat risk via `getHeatRisk()`

## Environment variables

| Variable | Description | Required |
| -------- | ----------- | -------- |
| `FORTYGUARD_API_KEY` | FortyGuard API key | Yes (for live temperatures) |
| `FORTYGUARD_BASE_URL` | FortyGuard base URL | No (defaults to `https://api.fortyguard.com`) |
| `SHADOWWALKER_BACKEND_URL` | FastAPI backend URL | No (enables backend proxy mode) |
| `CORS_ORIGINS` | Allowed origins for the backend | No (defaults to `*`) |

Copy `.env.example` to `.env` and fill in values. **Never hardcode API keys.**

## How the coolest route is chosen

1. **Geocode** the start and destination via OpenStreetMap Nominatim.
2. **Route** with OSRM's foot profile, requesting alternatives.
3. **Sample** street-level temperatures along each candidate path via FortyGuard (`getHeatData` / `getRouteTemperatures`), with a credit-conscious sub-sampling strategy.
4. **Score** each route with a heat score combining average and peak temperature above the 24°C comfort threshold.
5. **Compare** the fastest-by-time route against the coolest-by-heat route, compute the heat-reduction percentage, and generate a plain-language trade-off summary.

## Notes

- Map tiles use CARTO's free dark basemap under the OpenStreetMap attribution.
- Routing uses the public OSRM demo server — fine for a hackathon demo; swap for a self-hosted OSRM for production.
- When the FortyGuard API key is missing or a request fails, the service falls back to a deterministic local temperature simulation so the demo never breaks.

Built for hackathon use. Stay cool out there.
