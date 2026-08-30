export interface LatLng {
  lat: number;
  lng: number;
}

export type LatLngExpression = [number, number] | LatLng;

export interface RouteMetrics {
  distance_km: number;
  duration_min: number;
  avg_temperature_c: number;
  max_temperature_c: number;
  heat_score: number;
  shade_coverage: number;
}

export interface RouteResult {
  type: 'fastest' | 'coolest';
  label: string;
  color: string;
  geometry: LatLng[];
  metrics: RouteMetrics;
  summary: string;
}

export interface RouteAnalysisResponse {
  fastest_route: RouteResult;
  coolest_route: RouteResult;
  heat_reduction: number;
  ai_explanation: string;
}

export interface GeocodeResult {
  display_name: string;
  lat: number;
  lng: number;
}

export interface HeatRisk {
  level: 'low' | 'moderate' | 'high' | 'extreme';
  label: string;
  color: string;
  recommendation: string;
}
