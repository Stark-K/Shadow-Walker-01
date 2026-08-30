"""FortyGuard Temperature API service.

Provides three reusable helpers:
  * getTemperature()  – point / area temperature for a coordinate.
  * getHeatData()     – richer heat intelligence (risk bands, segments).
  * getHeatRisk()     – categorical heat-risk level for a coordinate.

FortyGuard's API is asynchronous: a POST submits a task, and the result is
polled until complete. Every public helper degrades gracefully to a
deterministic local simulation when the API key is missing or a request fails,
so the rest of the pipeline keeps working during a hackathon demo.
"""
from __future__ import annotations

import asyncio
import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.config import get_settings


@dataclass
class TemperatureReading:
    latitude: float
    longitude: float
    temperature_c: float
    source: str = "simulated"


@dataclass
class HeatData:
    avg_temperature_c: float
    max_temperature_c: float
    min_temperature_c: float
    heat_score: float
    shade_coverage: float
    samples: List[TemperatureReading] = field(default_factory=list)
    source: str = "simulated"


@dataclass
class HeatRisk:
    level: str  # low | moderate | high | extreme
    label: str
    score: float
    recommendation: str


class FortyGuardError(Exception):
    """Raised when the FortyGuard API fails irrecoverably."""


class FortyGuardService:
    """Thin async client around the FortyGuard Temperature API."""

    def __init__(self) -> None:
        self._settings = get_settings()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    async def getTemperature(
        self, lat: float, lng: float
    ) -> TemperatureReading:
        """Return the current temperature at a single coordinate."""
        readings = await self.getHeatData(lat, lng)
        if readings.samples:
            # pick the sample closest to the requested point
            return min(
                readings.samples,
                key=lambda s: (s.latitude - lat) ** 2 + (s.longitude - lng) ** 2,
            )
        return TemperatureReading(
            latitude=lat,
            longitude=lng,
            temperature_c=readings.avg_temperature_c,
            source=readings.source,
        )

    async def getHeatData(
        self, lat: float, lng: float, radius: float = 0.01
    ) -> HeatData:
        """Return aggregated heat intelligence for a small area.

        ``radius`` is in degrees (~1 km at the equator) and defines the bbox
        submitted to FortyGuard's heatmap endpoint.
        """
        if not self._settings.fortyguard_enabled:
            return self._simulate_heat_data(lat, lng)

        try:
            temps = await self._fetch_area_temperatures(lat, lng, radius)
            if temps:
                return self._build_heat_data(temps, source="fortyguard")
        except FortyGuardError:
            pass
        # Graceful fallback
        return self._simulate_heat_data(lat, lng)

    async def getHeatRisk(self, lat: float, lng: float) -> HeatRisk:
        """Return a categorical heat-risk level for a coordinate."""
        heat = await self.getHeatData(lat, lng)
        return self._risk_from_score(heat.heat_score)

    async def getRouteTemperatures(
        self, points: List[Tuple[float, float]]
    ) -> List[float]:
        """Sample temperatures along a route (used by the routing engine)."""
        if not points:
            return []
        # Subsample to limit API credits — at most 8 sample points.
        step = max(1, len(points) // 8)
        samples = points[::step][:8]
        readings: List[float] = []

        if self._settings.fortyguard_enabled:
            try:
                lats = [p[0] for p in samples]
                lngs = [p[1] for p in samples]
                area_temps = await self._fetch_area_temperatures_bbox(
                    min_lat=min(lats),
                    max_lat=max(lats),
                    min_lng=min(lngs),
                    max_lng=max(lngs),
                )
                if area_temps:
                    readings = self._interpolate(points, samples, area_temps)
                    return readings
            except FortyGuardError:
                pass

        # Simulation fallback — deterministic per-coordinate.
        return [self._simulate_point_temp(p[0], p[1]) for p in points]

    # ------------------------------------------------------------------
    # FortyGuard HTTP integration (async submit + poll)
    # ------------------------------------------------------------------
    async def _fetch_area_temperatures(
        self, lat: float, lng: float, radius: float
    ) -> List[float]:
        return await self._fetch_area_temperatures_bbox(
            min_lat=lat - radius,
            max_lat=lat + radius,
            min_lng=lng - radius,
            max_lng=lng + radius,
        )

    async def _fetch_area_temperatures_bbox(
        self, min_lat: float, max_lat: float, min_lng: float, max_lng: float
    ) -> List[float]:
        settings = self._settings
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.fortyguard_api_key}",
        }
        body = {
            "top_left": {"lat": max_lat, "lng": min_lng},
            "bottom_right": {"lat": min_lat, "lng": max_lng},
            "resolution": "high",
        }
        async with httpx.AsyncClient(timeout=settings.request_timeout) as client:
            # 1. Submit the heatmap task.
            resp = await client.post(
                f"{settings.fortyguard_base_url}/api/heatmap",
                json=body,
                headers=headers,
            )
            if resp.status_code >= 400:
                raise FortyGuardError(
                    f"FortyGuard submit failed: {resp.status_code} {resp.text}"
                )
            payload = resp.json()
            task_id = (
                payload.get("task_id")
                or payload.get("id")
                or payload.get("taskId")
            )
            if not task_id:
                # Some plans return the result synchronously.
                temps = self._extract_temps(payload)
                if temps:
                    return temps
                raise FortyGuardError("No task_id returned by FortyGuard")

            # 2. Poll until complete.
            return await self._poll_task(task_id, client, headers)

    async def _poll_task(
        self,
        task_id: str,
        client: httpx.AsyncClient,
        headers: Dict[str, str],
        attempts: int = 8,
        delay: float = 1.2,
    ) -> List[float]:
        url = f"{self._settings.fortyguard_base_url}/api/heatmap/{task_id}"
        for _ in range(attempts):
            try:
                resp = await client.get(url, headers=headers)
                if resp.status_code < 400:
                    data = resp.json()
                    status = data.get("status", "").lower()
                    if status in ("completed", "done", "success"):
                        return self._extract_temps(data)
                    if status in ("failed", "error"):
                        raise FortyGuardError(f"FortyGuard task {task_id} failed")
            except httpx.HTTPError:
                pass
            await asyncio.sleep(delay)
        raise FortyGuardError(f"FortyGuard task {task_id} timed out")

    # ------------------------------------------------------------------
    # Response parsing helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _extract_temps(data: Dict[str, Any]) -> List[float]:
        """Best-effort extraction of a flat temperature list from any shape."""
        for key in ("heatmap", "grid", "data", "temperatures", "results"):
            grid = data.get(key)
            if isinstance(grid, list) and grid:
                if isinstance(grid[0], (int, float)):
                    return [float(t) for t in grid]
                if isinstance(grid[0], dict):
                    out: List[float] = []
                    for cell in grid:
                        val = (
                            cell.get("temp")
                            or cell.get("temperature")
                            or cell.get("value")
                        )
                        if isinstance(val, (int, float)):
                            out.append(float(val))
                    if out:
                        return out
        return []

    # ------------------------------------------------------------------
    # Simulation fallbacks (deterministic, terrain-aware-ish)
    # ------------------------------------------------------------------
    @staticmethod
    def _simulate_point_temp(lat: float, lng: float) -> float:
        base = 28.0
        lat_factor = math.sin(math.radians(lat)) * 6
        urban_bias = abs(math.sin(lng * 7.3) * math.cos(lat * 5.1)) * 8
        micro = abs(math.sin(lng * 31 + lat * 17)) * 4
        return round(base + lat_factor + urban_bias + micro, 1)

    def _simulate_heat_data(self, lat: float, lng: float) -> HeatData:
        temps = [self._simulate_point_temp(lat + d * 0.005, lng + d * 0.005)
                 for d in (-1, 0, 1)]
        avg = round(sum(temps) / len(temps), 1)
        score = self._heat_score(avg, max(temps))
        return HeatData(
            avg_temperature_c=avg,
            max_temperature_c=max(temps),
            min_temperature_c=min(temps),
            heat_score=score,
            shade_coverage=round(max(0, 60 - score * 0.4), 1),
            samples=[
                TemperatureReading(lat, lng, t, source="simulated")
                for t in temps
            ],
            source="simulated",
        )

    def _build_heat_data(
        self, temps: List[float], source: str = "fortyguard"
    ) -> HeatData:
        avg = round(sum(temps) / len(temps), 1)
        mx = max(temps)
        mn = min(temps)
        score = self._heat_score(avg, mx)
        return HeatData(
            avg_temperature_c=avg,
            max_temperature_c=round(mx, 1),
            min_temperature_c=round(mn, 1),
            heat_score=score,
            shade_coverage=round(max(0, 60 - score * 0.4), 1),
            samples=[
                TemperatureReading(0, 0, t, source=source) for t in temps
            ],
            source=source,
        )

    @staticmethod
    def _heat_score(avg: float, mx: float) -> float:
        comfort = 24.0
        avg_excess = max(0.0, avg - comfort)
        max_excess = max(0.0, mx - comfort)
        return round(min(100.0, avg_excess * 2.2 + max_excess * 1.3), 1)

    def _interpolate(
        self,
        points: List[Tuple[float, float]],
        samples: List[Tuple[float, float]],
        sample_temps: List[float],
    ) -> List[float]:
        if not sample_temps:
            return [self._simulate_point_temp(p[0], p[1]) for p in points]
        out: List[float] = []
        for p in points:
            best = 0
            best_d = float("inf")
            for i, s in enumerate(samples):
                d = (s[0] - p[0]) ** 2 + (s[1] - p[1]) ** 2
                if d < best_d:
                    best_d = d
                    best = i
            out.append(sample_temps[best])
        return out

    @staticmethod
    def _risk_from_score(score: float) -> HeatRisk:
        if score < 25:
            return HeatRisk(
                level="low",
                label="Low Risk",
                score=score,
                recommendation="Safe to walk. Minimal heat exposure expected.",
            )
        if score < 50:
            return HeatRisk(
                level="moderate",
                label="Moderate Risk",
                score=score,
                recommendation="Stay hydrated. Consider shaded paths where possible.",
            )
        if score < 75:
            return HeatRisk(
                level="high",
                label="High Risk",
                score=score,
                recommendation="Avoid prolonged sun exposure. Use the coolest route.",
            )
        return HeatRisk(
            level="extreme",
            label="Extreme Risk",
            score=score,
            recommendation=(
                "Heat wave conditions. Strongly recommended to take the coolest route."
            ),
        )


# Module-level singleton for convenience.
fortyguard = FortyGuardService()
