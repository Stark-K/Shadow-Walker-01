'use client';

import { useEffect, useRef } from 'react';
import type * as Leaflet from 'leaflet';
import type { LatLng, LatLngExpression, RouteResult } from '@/lib/types';
import { heatScoreToRisk } from '@/lib/route-utils';

interface RouteMapProps {
  fastest?: RouteResult | null;
  coolest?: RouteResult | null;
  start?: LatLng | null;
  end?: LatLng | null;
  className?: string;
}

// Leaflet is imported lazily inside the effect so the module never touches
// `window` during SSR prerendering.
async function loadLeaflet(): Promise<typeof Leaflet> {
  const mod = await import('leaflet');
  return mod.default;
}

const START_COLOR = 'hsl(152 72% 44%)';
const END_COLOR = 'hsl(0 0% 98%)';

export function RouteMap({
  fastest,
  coolest,
  start,
  end,
  className,
}: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    loadLeaflet().then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: [40.7128, -74.006],
        zoom: 13,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution:
          '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      const map = mapRef.current;
      if (map) {
        map.remove();
        mapRef.current = null;
        layerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    void loadLeaflet().then((L) => {
      const map = mapRef.current;
      const layer = layerRef.current;
      if (!map || !layer) return;

      layer.clearLayers();

      const startIcon = L.divIcon({
        className: 'sw-marker sw-marker-start',
        html: `<div class="sw-marker-dot" style="background:${START_COLOR};box-shadow:0 0 0 4px hsl(152 72% 44% / 0.25),0 0 20px hsl(152 72% 44% / 0.6);"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      const endIcon = L.divIcon({
        className: 'sw-marker sw-marker-end',
        html: `<div class="sw-marker-dot" style="background:${END_COLOR};box-shadow:0 0 0 4px hsl(0 0% 98% / 0.2),0 0 20px hsl(0 72% 52% / 0.5);"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      const routes: RouteResult[] = [];
      if (fastest) routes.push(fastest);
      if (coolest) routes.push(coolest);

      routes.forEach((route) => {
        if (!route.geometry || route.geometry.length === 0) return;
        const latlngs: LatLngExpression[] = route.geometry.map(
          (p) => [p.lat, p.lng]
        );

        L.polyline(latlngs, {
          color: route.color,
          weight: 9,
          opacity: 0.18,
          lineCap: 'round',
        }).addTo(layer);

        L.polyline(latlngs, {
          color: route.color,
          weight: 5,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(layer);

        const mid = route.geometry[Math.floor(route.geometry.length / 2)];
        const risk = heatScoreToRisk(route.metrics.heat_score);
        L.marker([mid.lat, mid.lng], {
          icon: L.divIcon({
            className: 'sw-route-label',
            html: `<div style="background:hsl(180 18% 12%);border:1px solid ${route.color};color:${route.color};padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.4);">${route.label} · ${risk.label}</div>`,
            iconSize: [0, 0],
          }),
        }).addTo(layer);
      });

      if (start) L.marker([start.lat, start.lng], { icon: startIcon }).addTo(layer);
      if (end) L.marker([end.lat, end.lng], { icon: endIcon }).addTo(layer);

      const allPoints: LatLngExpression[] = [];
      routes.forEach((r) =>
        r.geometry.forEach((p) => allPoints.push([p.lat, p.lng]))
      );
      if (start) allPoints.push([start.lat, start.lng]);
      if (end) allPoints.push([end.lat, end.lng]);

      if (allPoints.length > 1) {
        map.fitBounds(L.latLngBounds(allPoints), { padding: [60, 60] });
      } else if (allPoints.length === 1) {
        map.setView(allPoints[0], 14);
      }
    });
  }, [fastest, coolest, start, end]);

  return (
    <div
      ref={containerRef}
      className={className ?? 'h-full w-full rounded-xl'}
      style={{ zIndex: 0 }}
    />
  );
}
