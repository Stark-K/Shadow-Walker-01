'use client';

import { useState } from 'react';
import { SiteHeader, SiteFooter } from '@/components/site-shell';
import { LocationSearch } from '@/components/location-search';
import { RouteMap } from '@/components/route-map';
import { RouteComparison } from '@/components/route-comparison';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type {
  GeocodeResult,
  LatLng,
  RouteAnalysisResponse,
} from '@/lib/types';
import {
  MapPin,
  Flag,
  Clock,
  Search,
  Loader2,
  Sparkles,
  Sun,
  Route as RouteIcon,
  Thermometer,
  Wind,
  AlertTriangle,
  Flame,
} from 'lucide-react';

const TIME_OPTIONS = [
  { value: 'now', label: 'Right now' },
  { value: '09:00', label: '09:00 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '15:00', label: '03:00 PM' },
  { value: '18:00', label: '06:00 PM' },
];

const PREF_OPTIONS = [
  { value: 'coolest', label: 'Coolest route (recommended)' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'fastest', label: 'Fastest route' },
];

export default function DashboardPage() {
  const [start, setStart] = useState<GeocodeResult | null>(null);
  const [startText, setStartText] = useState('');
  const [end, setEnd] = useState<GeocodeResult | null>(null);
  const [endText, setEndText] = useState('');
  const [time, setTime] = useState('now');
  const [preference, setPreference] = useState('coolest');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RouteAnalysisResponse | null>(null);

  async function handleFind() {
    if (!start || !end) {
      setError('Please select both a start location and a destination from the suggestions.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/route-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: start.display_name,
          destination: end.display_name,
          startCoords: { lat: start.lat, lng: start.lng },
          endCoords: { lat: end.lat, lng: end.lng },
          time,
          preference,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong analyzing the route.');
        return;
      }
      setResult(data as RouteAnalysisResponse);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const startLatLng: LatLng | undefined = start
    ? { lat: start.lat, lng: start.lng }
    : undefined;
  const endLatLng: LatLng | undefined = end
    ? { lat: end.lat, lng: end.lng }
    : undefined;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader active="dashboard" />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Title */}
          <div className="mb-8 flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Route Dashboard
            </h1>
            <p className="text-muted-foreground">
              Enter your start and destination to compare the fastest and coolest routes.
            </p>
          </div>

          {/* Search panel */}
          <Card className="mb-6 border-border/60 bg-card/50 backdrop-blur">
            <CardContent className="p-5">
              <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto_auto_auto] lg:items-end">
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Start location
                  </label>
                  <LocationSearch
                    placeholder="Enter starting point"
                    value={startText}
                    icon={<MapPin className="h-4 w-4 text-primary" />}
                    onClear={() => {
                      setStart(null);
                      setStartText('');
                    }}
                    onSelect={(r) => {
                      setStart(r);
                      setStartText(r.display_name);
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Destination
                  </label>
                  <LocationSearch
                    placeholder="Enter destination"
                    value={endText}
                    icon={<Flag className="h-4 w-4" />}
                    onClear={() => {
                      setEnd(null);
                      setEndText('');
                    }}
                    onSelect={(r) => {
                      setEnd(r);
                      setEndText(r.display_name);
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Time
                  </label>
                  <Select value={time} onValueChange={setTime}>
                    <SelectTrigger className="w-[150px]">
                      <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Preference
                  </label>
                  <Select value={preference} onValueChange={setPreference}>
                    <SelectTrigger className="w-[210px]">
                      <Sun className="mr-2 h-4 w-4 text-muted-foreground" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PREF_OPTIONS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleFind}
                  disabled={loading}
                  size="lg"
                  className="h-10 gap-2 glow-primary lg:w-auto"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  {loading ? 'Analyzing…' : 'Find Coolest Route'}
                </Button>
              </div>

              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Map + results */}
          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            {/* Map */}
            <Card className="overflow-hidden border-border/60 bg-card/50 backdrop-blur">
              <CardContent className="p-0">
                <div className="relative h-[420px] w-full sm:h-[560px]">
                  <RouteMap
                    fastest={result?.fastest_route}
                    coolest={result?.coolest_route}
                    start={startLatLng}
                    end={endLatLng}
                    className="h-full w-full"
                  />
                  {!result && !loading && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="rounded-xl border border-border/60 bg-background/80 px-6 py-4 text-center backdrop-blur">
                        <RouteIcon className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Enter two locations and find your coolest route.
                        </p>
                      </div>
                    </div>
                  )}
                  {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-sm">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">
                          Sampling temperatures along candidate routes…
                        </p>
                      </div>
                    </div>
                  )}
                  {/* Legend */}
                  <div className="absolute bottom-4 left-4 z-[400] flex flex-col gap-1.5 rounded-lg border border-border/60 bg-background/90 px-3 py-2 text-xs backdrop-blur">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-6 rounded-full bg-red-500" />
                      Fastest route
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-6 rounded-full bg-primary" />
                      Coolest route
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Results panel */}
            <div className="space-y-6">
              {result ? (
                <>
                  {/* AI Explanation */}
                  <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card glow-primary">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
                          <Sparkles className="h-4 w-4 text-primary" />
                        </span>
                        AI Explanation
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed text-foreground">
                        {result.ai_explanation}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Comparison */}
                  <Card className="border-border/60 bg-card/50 backdrop-blur">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Route Comparison</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <RouteComparison
                        fastest={result.fastest_route}
                        coolest={result.coolest_route}
                        heatReduction={result.heat_reduction}
                      />
                    </CardContent>
                  </Card>
                </>
              ) : (
                <EmptyState loading={loading} />
              )}
            </div>
          </div>

          {/* Detailed breakdown when results exist */}
          {result && (
            <div className="mt-6">
              <Tabs defaultValue="fastest">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                  <TabsTrigger
                    value="fastest"
                    className="data-[state=active]:text-red-400"
                  >
                    Fastest Route
                  </TabsTrigger>
                  <TabsTrigger
                    value="coolest"
                    className="data-[state=active]:text-primary"
                  >
                    Coolest Route
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="fastest" className="mt-4">
                  <RouteDetailCard route={result.fastest_route} />
                </TabsContent>
                <TabsContent value="coolest" className="mt-4">
                  <RouteDetailCard route={result.coolest_route} />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function EmptyState({ loading }: { loading: boolean }) {
  return (
    <Card className="border-dashed border-border/60 bg-card/30">
      <CardContent className="flex h-full flex-col items-center justify-center p-10 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-muted/30">
          {loading ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          ) : (
            <Thermometer className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        <h3 className="text-lg font-semibold">
          {loading ? 'Analyzing routes…' : 'No routes yet'}
        </h3>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          {loading
            ? 'Sampling street-level temperatures and comparing candidate paths.'
            : 'Enter a start and destination above, then tap "Find Coolest Route" to see the heat-aware comparison.'}
        </p>
      </CardContent>
    </Card>
  );
}

function RouteDetailCard({ route }: { route: import('@/lib/types').RouteResult }) {
  const metrics = route.metrics;
  const stats = [
    { icon: <RouteIcon className="h-4 w-4" />, label: 'Distance', value: `${metrics.distance_km} km` },
    { icon: <Clock className="h-4 w-4" />, label: 'Travel time', value: formatMin(metrics.duration_min) },
    { icon: <Thermometer className="h-4 w-4" />, label: 'Avg. temperature', value: `${metrics.avg_temperature_c}°C` },
    { icon: <Sun className="h-4 w-4" />, label: 'Max temperature', value: `${metrics.max_temperature_c}°C` },
    { icon: <Flame className="h-4 w-4" />, label: 'Heat score', value: `${metrics.heat_score}/100` },
    { icon: <Wind className="h-4 w-4" />, label: 'Shade coverage', value: `${metrics.shade_coverage}%` },
  ];
  return (
    <Card className="border-border/60 bg-card/50 backdrop-blur">
      <CardContent className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <span
            className={cn('h-3 w-3 rounded-full')}
            style={{ background: route.color }}
          />
          <h3 className="text-lg font-semibold">{route.label}</h3>
          <span className="text-sm text-muted-foreground">· {route.summary}</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-border/50 bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                {s.icon}
                {s.label}
              </div>
              <div className="mt-1.5 text-xl font-semibold tabular-nums">
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function formatMin(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}min`;
}
