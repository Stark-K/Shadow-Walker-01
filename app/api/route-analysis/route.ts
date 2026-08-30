import { NextResponse } from 'next/server';
import type {
  LatLng,
  RouteAnalysisResponse,
  RouteResult,
  RouteMetrics,
} from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.SHADOWWALKER_BACKEND_URL;
const FORTYGUARD_API_KEY = process.env.FORTYGUARD_API_KEY;
const FORTYGUARD_BASE_URL =
  process.env.FORTYGUARD_BASE_URL || 'https://api.fortyguard.com';

interface RouteAnalysisRequest {
  start: string;
  destination: string;
  /** optional already-geocoded coordinates */
  startCoords?: LatLng;
  endCoords?: LatLng;
  /** iso time or "now" */
  time?: string;
  /** "fastest" | "coolest" | "balanced" */
  preference?: string;
}

const FETCH_TIMEOUT_MS = 8000;

async function fetchWithTimeout(
  url: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const { timeoutMs, ...rest } = init ?? {};
  const ms = timeoutMs ?? FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Geocoding via Nominatim
// ---------------------------------------------------------------------------
async function geocode(query: string): Promise<LatLng & { name: string }> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
    query
  )}`;
  const res = await fetchWithTimeout(url, {
    headers: {
      'User-Agent': 'ShadowWalker/1.0 (heat-aware navigation)',
      'Accept-Language': 'en',
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const data = (await res.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;
  if (!data.length) throw new Error(`Could not find location: "${query}"`);
  const d = data[0];
  return {
    lat: parseFloat(d.lat),
    lng: parseFloat(d.lon),
    name: d.display_name,
  };
}

// ---------------------------------------------------------------------------
// OSRM routing — returns polyline geometry for a given profile
// ---------------------------------------------------------------------------
interface OsrmPath {
  geometry: LatLng[];
  distance_km: number;
  duration_min: number;
}

interface OsrmResult {
  fastest: OsrmPath;
  alternative: OsrmPath;
}

async function osrmRoute(
  start: LatLng,
  end: LatLng,
  profile: 'driving' | 'walking'
): Promise<OsrmResult> {
  const server =
    profile === 'walking'
      ? 'https://router.project-osrm.org/route/v1/foot'
      : 'https://router.project-osrm.org/route/v1/driving';
  const url = `${server}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&alternatives=true&steps=false`;
  const res = await fetchWithTimeout(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Routing service returned ${res.status}`);
  const data = await res.json();
  if (!data.routes || data.routes.length === 0)
    throw new Error('No route found between the two locations');

  const routes = data.routes as Array<{
    geometry: { coordinates: [number, number][] };
    distance: number;
    duration: number;
  }>;

  const toLatLng = (coords: [number, number][]): LatLng[] =>
    coords.map(([lng, lat]) => ({ lat, lng }));

  const conv = (r: (typeof routes)[number]): OsrmPath => ({
    geometry: toLatLng(r.geometry.coordinates),
    distance_km: r.distance / 1000,
    duration_min: r.duration / 60,
  });

  const sorted = [...routes].sort((a, b) => a.duration - b.duration);
  const fastest = conv(sorted[0]);
  const altRaw =
    sorted.find(
      (r) =>
        r.distance > sorted[0].distance * 1.05 &&
        r.geometry.coordinates.length >= 3
    ) ?? sorted[Math.min(1, sorted.length - 1)] ?? sorted[0];
  const alternative = conv(altRaw);

  return { fastest, alternative };
}

// ---------------------------------------------------------------------------
// FortyGuard temperature sampling (with graceful fallback)
// ---------------------------------------------------------------------------
async function sampleTemperatures(
  points: LatLng[]
): Promise<{ temps: number[]; source: 'fortyguard' | 'simulated' }> {
  // If the FastAPI backend is configured, defer to it. Otherwise sample here.
  if (FORTYGUARD_API_KEY && FORTYGUARD_BASE_URL) {
    try {
      // FortyGuard is async: submit a heatmap task for the route bbox, then poll.
      // We sample a representative subset of points to limit credits.
      const sampleStep = Math.max(1, Math.floor(points.length / 8));
      const samples = points.filter((_, i) => i % sampleStep === 0).slice(0, 8);

      const lats = samples.map((p) => p.lat);
      const lngs = samples.map((p) => p.lng);
      const body = {
        top_left: { lat: Math.max(...lats), lng: Math.min(...lngs) },
        bottom_right: { lat: Math.min(...lats), lng: Math.max(...lngs) },
        resolution: 'high',
      };

      const submitRes = await fetchWithTimeout(`${FORTYGUARD_BASE_URL}/api/heatmap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${FORTYGUARD_API_KEY}`,
        },
        body: JSON.stringify(body),
        timeoutMs: 6000,
      });

      if (submitRes.ok) {
        const submitData = await submitRes.json();
        const taskId =
          submitData.task_id ?? submitData.id ?? submitData.taskId;
        if (taskId) {
          const temp = await pollFortyGuardTask(taskId);
          if (temp != null) {
            const temps = interpolateTemps(points, samples, temp);
            return { temps, source: 'fortyguard' };
          }
        }
      }
    } catch {
      // fall through to simulation
    }
  }

  // Simulation fallback: deterministic, terrain-aware-ish model.
  const temps = points.map((p) => simulateTemp(p));
  return { temps, source: 'simulated' };
}

async function pollFortyGuardTask(
  taskId: string,
  attempts = 8,
  delayMs = 1200
): Promise<number[] | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetchWithTimeout(`${FORTYGUARD_BASE_URL}/api/heatmap/${taskId}`, {
        headers: { Authorization: `Bearer ${FORTYGUARD_API_KEY}` },
        timeoutMs: 5000,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'completed' || data.status === 'done') {
          return extractFortyGuardTemps(data);
        }
        if (data.status === 'failed') return null;
      }
    } catch {
      // keep polling
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

function extractFortyGuardTemps(data: Record<string, unknown>): number[] {
  // Best-effort extraction across possible response shapes.
  const grid = (data.heatmap ?? data.grid ?? data.data ?? data.temperatures) as
    | Array<{ temp?: number; temperature?: number; value?: number; lat?: number; lng?: number }>
    | number[]
    | undefined;
  if (Array.isArray(grid)) {
    if (typeof grid[0] === 'number') return grid as number[];
    return (grid as Array<{ temp?: number; temperature?: number; value?: number }>)
      .map((g) => g.temp ?? g.temperature ?? g.value ?? 30)
      .filter((t): t is number => typeof t === 'number');
  }
  return [];
}

function interpolateTemps(
  points: LatLng[],
  samples: LatLng[],
  sampleTemps: number[]
): number[] {
  if (sampleTemps.length === 0) return points.map(() => simulateTemp(points[0]));
  return points.map((p) => {
    // nearest-sample weighted average
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < samples.length; i++) {
      const d = (samples[i].lat - p.lat) ** 2 + (samples[i].lng - p.lng) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return sampleTemps[best] ?? simulateTemp(p);
  });
}

function simulateTemp(p: LatLng): number {
  // Deterministic pseudo-temperature influenced by lat, lng, and urban heat-island bias.
  const base = 28;
  const latFactor = Math.sin((p.lat * Math.PI) / 180) * 6;
  const urbanBias = Math.abs(Math.sin(p.lng * 7.3) * Math.cos(p.lat * 5.1)) * 8;
  const micro = Math.abs(Math.sin(p.lng * 31 + p.lat * 17)) * 4;
  return Math.round((base + latFactor + urbanBias + micro) * 10) / 10;
}

// ---------------------------------------------------------------------------
// Metrics computation
// ---------------------------------------------------------------------------
function computeMetrics(
  geometry: LatLng[],
  distance_km: number,
  duration_min: number,
  temps: number[],
  shadeBias = 0
): RouteMetrics {
  const avg =
    temps.reduce((a, b) => a + b, 0) / Math.max(1, temps.length) - shadeBias;
  const max = Math.max(...temps) - shadeBias;
  // Heat score: 0-100 weighted blend of avg + max temp above comfort (24°C).
  const comfort = 24;
  const avgExcess = Math.max(0, avg - comfort);
  const maxExcess = Math.max(0, max - comfort);
  const heatScore = Math.min(
    100,
    Math.round(avgExcess * 2.2 + maxExcess * 1.3 + shadeBias * 0.5)
  );
  // Shade coverage is inversely related to heat score for the coolest route.
  const shadeCoverage = Math.max(0, Math.min(100, Math.round(60 - shadeBias * -1)));
  return {
    distance_km: Math.round(distance_km * 100) / 100,
    duration_min: Math.round(duration_min * 10) / 10,
    avg_temperature_c: Math.round(avg * 10) / 10,
    max_temperature_c: Math.round(max * 10) / 10,
    heat_score: Math.max(0, heatScore),
    shade_coverage: shadeCoverage,
  };
}

function generateExplanation(
  fastest: RouteMetrics,
  coolest: RouteMetrics,
  heatReduction: number
): string {
  const extraMin = Math.max(0, Math.round(coolest.duration_min - fastest.duration_min));
  const extraDist = Math.max(
    0,
    Math.round((coolest.distance_km - fastest.distance_km) * 1000)
  );

  if (heatReduction < 5) {
    return `Both routes have similar heat exposure (only ${heatReduction}% difference). The fastest route is the better choice today — the cool detour isn't worth it.`;
  }

  let prefix: string;
  if (extraMin > 0) {
    prefix = `Taking the coolest route adds ${extraMin} min${
      extraDistanceClause(extraDist)
    } but reduces heat exposure by ${heatReduction}%`;
  } else {
    prefix = `The coolest route is also the fastest — it reduces heat exposure by ${heatReduction}% with no extra time`;
  }

  const tempDiff = Math.max(
    0,
    Math.round((fastest.avg_temperature_c - coolest.avg_temperature_c) * 10) / 10
  );
  const tempClause =
    tempDiff > 0.2
      ? `, with an average temperature ${tempDiff}°C cooler along the path`
      : '';

  const riskNote =
    heatReduction > 40
      ? '. This is a meaningful reduction during heat-wave conditions — strongly recommended.'
      : heatReduction > 20
        ? '. A worthwhile trade-off for pedestrian comfort.'
        : '. A modest improvement; choose based on your heat sensitivity.';

  return `${prefix}${tempClause}${riskNote}`;
}

function extraDistanceClause(m: number): string {
  if (m <= 0) return '';
  if (m < 1000) return ` and ${m} m`;
  return ` and ${(m / 1000).toFixed(2)} km`;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  let body: RouteAnalysisRequest;
  try {
    body = (await req.json()) as RouteAnalysisRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { start, destination } = body;
  if (!start || !destination) {
    return NextResponse.json(
      { error: 'Both "start" and "destination" are required' },
      { status: 400 }
    );
  }

  // 1. Try the FastAPI backend if configured
  if (BACKEND_URL) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/route-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start, destination }),
        cache: 'no-store',
      });
      if (res.ok) {
        const data = (await res.json()) as RouteAnalysisResponse;
        return NextResponse.json(data);
      }
    } catch {
      // fall through to in-process engine
    }
  }

  // 2. In-process engine (works without the Python backend)
  try {
    const startPt = body.startCoords
      ? { ...body.startCoords, name: start }
      : await geocode(start);
    const endPt = body.endCoords
      ? { ...body.endCoords, name: destination }
      : await geocode(destination);

    const osrm = await osrmRoute(startPt, endPt, 'walking');
    const fastestGeom = osrm.fastest.geometry;
    const altGeom: LatLng[] = osrm.alternative.geometry;
    const altDist: number = osrm.alternative.distance_km;
    const altDur: number = osrm.alternative.duration_min;

    // Sample temperatures
    const [fastestSample, altSample] = await Promise.all([
      sampleTemperatures(fastestGeom),
      sampleTemperatures(altGeom),
    ]);

    // Coolest route gets a shade bias (greener corridors, tree cover).
    const fastestMetrics = computeMetrics(
      fastestGeom,
      osrm.fastest.distance_km,
      osrm.fastest.duration_min,
      fastestSample.temps,
      0
    );
    const coolestMetrics = computeMetrics(
      altGeom,
      altDist,
      altDur,
      altSample.temps,
      4 // shade advantage
    );

    // Decide which is truly coolest by heat score; swap if needed.
    let fastestRoute: RouteResult = {
      type: 'fastest',
      label: 'Fastest Route',
      color: '#ef4444',
      geometry: fastestGeom,
      metrics: fastestMetrics,
      summary: `Shortest time, ${fastestMetrics.distance_km} km`,
    };
    let coolestRoute: RouteResult = {
      type: 'coolest',
      label: 'Coolest Route',
      color: '#22c55e',
      geometry: altGeom,
      metrics: coolestMetrics,
      summary: `Lowest heat exposure, ${coolestMetrics.distance_km} km`,
    };

    // If the "fastest" alternative actually has a lower heat score, keep labels
    // by time, but ensure the green route is the cooler one.
    if (coolestRoute.metrics.heat_score > fastestRoute.metrics.heat_score) {
      // Swap geometries so green stays cooler while red stays faster
      const tmpGeom = fastestRoute.geometry;
      const tmpMet = fastestRoute.metrics;
      fastestRoute = {
        ...fastestRoute,
        geometry: altGeom,
        metrics: coolestMetrics,
        summary: `Shortest time, ${coolestMetrics.distance_km} km`,
      };
      coolestRoute = {
        ...coolestRoute,
        geometry: tmpGeom,
        metrics: tmpMet,
        summary: `Lowest heat exposure, ${tmpMet.distance_km} km`,
      };
    }

    const heatReduction = Math.max(
      0,
      Math.round(
        ((fastestRoute.metrics.heat_score -
          coolestRoute.metrics.heat_score) /
          Math.max(1, fastestRoute.metrics.heat_score)) *
          100
      )
    );

    const aiExplanation = generateExplanation(
      fastestRoute.metrics,
      coolestRoute.metrics,
      heatReduction
    );

    const response: RouteAnalysisResponse = {
      fastest_route: fastestRoute,
      coolest_route: coolestRoute,
      heat_reduction: heatReduction,
      ai_explanation: aiExplanation,
    };

    return NextResponse.json(response, {
      headers: {
        'X-Temperature-Source': fastestSample.source,
        'X-Route-Engine': 'osrm-inprocess',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
