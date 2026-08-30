import { NextResponse } from 'next/server';
import type { GeocodeResult } from '@/lib/types';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  if (!q || !q.trim()) {
    return NextResponse.json({ error: 'Missing query parameter "q"' }, { status: 400 });
  }

  try {
    const url = `${NOMINATIM}?format=json&limit=5&q=${encodeURIComponent(q)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          'User-Agent': 'ShadowWalker/1.0 (heat-aware navigation)',
          'Accept-Language': 'en',
        },
        cache: 'no-store',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: `Geocoding service returned ${res.status}` },
        { status: 502 }
      );
    }

    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;

    const results: GeocodeResult[] = data.map((d) => ({
      display_name: d.display_name,
      lat: parseFloat(d.lat),
      lng: parseFloat(d.lon),
    }));

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to reach geocoding service' },
      { status: 502 }
    );
  }
}
