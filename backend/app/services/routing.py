"""Routing service — geocoding via Nominatim and routing via OSRM."""
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Tuple

import httpx

from app.config import get_settings


@dataclass
class GeocodedPoint:
    name: str
    lat: float
    lng: float


@dataclass
class RoutePath:
    geometry: List[Tuple[float, float]]  # list of (lat, lng)
    distance_km: float
    duration_min: float


@dataclass
class RoutePair:
    fastest: RoutePath
    alternative: RoutePath


class RoutingError(Exception):
    """Raised when geocoding or routing fails."""


class RoutingService:
    def __init__(self) -> None:
        self._settings = get_settings()

    async def geocode(self, query: str) -> GeocodedPoint:
        url = (
            f"{self._settings.nominatim_url}"
            f"?format=json&limit=1&q={query}"
        )
        async with httpx.AsyncClient(timeout=self._settings.request_timeout) as client:
            resp = await client.get(
                url,
                headers={
                    "User-Agent": "ShadowWalker/1.0 (heat-aware navigation)",
                    "Accept-Language": "en",
                },
            )
        if resp.status_code >= 400:
            raise RoutingError(f"Geocoding failed: {resp.status_code}")
        data = resp.json()
        if not data:
            raise RoutingError(f'Could not find location: "{query}"')
        hit = data[0]
        return GeocodedPoint(
            name=hit["display_name"],
            lat=float(hit["lat"]),
            lng=float(hit["lon"]),
        )

    async def route_pair(
        self, start: GeocodedPoint, end: GeocodedPoint
    ) -> RoutePair:
        """Return the fastest OSRM route plus a distinct alternative."""
        url = (
            f"{self._settings.osrm_foot_url}/"
            f"{start.lng},{start.lat};{end.lng},{end.lat}"
            f"?overview=full&geometries=geojson&alternatives=true&steps=false"
        )
        async with httpx.AsyncClient(timeout=self._settings.request_timeout) as client:
            resp = await client.get(url)
        if resp.status_code >= 400:
            raise RoutingError(f"OSRM error: {resp.status_code}")
        data = resp.json()
        routes = data.get("routes") or []
        if not routes:
            raise RoutingError("No route found between the two locations")

        routes.sort(key=lambda r: r["duration"])
        fastest = self._convert(routes[0])
        alt = next(
            (
                r
                for r in routes
                if r["distance"] > routes[0]["distance"] * 1.05
                and len(r["geometry"]["coordinates"]) >= 3
            ),
            routes[min(1, len(routes) - 1)] if len(routes) > 1 else routes[0],
        )
        return RoutePair(fastest=fastest, alternative=self._convert(alt))

    @staticmethod
    def _convert(route: dict) -> RoutePath:
        coords = route["geometry"]["coordinates"]
        geometry = [(c[1], c[0]) for c in coords]  # (lat, lng)
        return RoutePath(
            geometry=geometry,
            distance_km=round(route["distance"] / 1000, 3),
            duration_min=round(route["duration"] / 60, 2),
        )


routing = RoutingService()
