import type { HeatRisk } from './types';

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(2)} km`;
}

export function formatDuration(min: number): string {
  if (min < 1) return `${Math.round(min * 60)} sec`;
  const mins = Math.round(min);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}min`;
}

export function formatTemp(c: number): string {
  return `${c.toFixed(1)}°C`;
}

export function heatScoreToRisk(score: number): HeatRisk {
  if (score < 25)
    return {
      level: 'low',
      label: 'Low Risk',
      color: 'text-emerald-400',
      recommendation: 'Safe to walk. Minimal heat exposure expected.',
    };
  if (score < 50)
    return {
      level: 'moderate',
      label: 'Moderate Risk',
      color: 'text-yellow-400',
      recommendation: 'Stay hydrated. Consider shaded paths where possible.',
    };
  if (score < 75)
    return {
      level: 'high',
      label: 'High Risk',
      color: 'text-orange-400',
      recommendation: 'Avoid prolonged sun exposure. Use the coolest route.',
    };
  return {
    level: 'extreme',
    label: 'Extreme Risk',
    color: 'text-red-400',
    recommendation: 'Heat wave conditions. Strongly recommended to take the coolest route.',
  };
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
