"""Route analysis — blends OSRM routing with FortyGuard temperatures."""
from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import List, Optional, Tuple

from app.services.fortyguard import FortyGuardService
from app.services.routing import GeocodedPoint, RoutePath, RoutingService


@dataclass
class RouteMetrics:
    distance_km: float
    duration_min: float
    avg_temperature_c: float
    max_temperature_c: float
    heat_score: float
    shade_coverage: float


@dataclass
class RouteResult:
    type: str
    label: str
    color: str
    geometry: List[Tuple[float, float]]
    metrics: RouteMetrics
    summary: str

    def to_dict(self) -> dict:
        return {
            "type": self.type,
            "label": self.label,
            "color": self.color,
            "geometry": [{"lat": g[0], "lng": g[1]} for g in self.geometry],
            "metrics": asdict(self.metrics),
            "summary": self.summary,
        }


@dataclass
class RouteAnalysisResult:
    fastest_route: RouteResult
    coolest_route: RouteResult
    heat_reduction: float
    ai_explanation: str

    def to_dict(self) -> dict:
        return {
            "fastest_route": self.fastest_route.to_dict(),
            "coolest_route": self.coolest_route.to_dict(),
            "heat_reduction": self.heat_reduction,
            "ai_explanation": self.ai_explanation,
        }


COMFORT_C = 24.0


class RouteAnalyzer:
    def __init__(
        self,
        routing_service: Optional[RoutingService] = None,
        fortyguard_service: Optional[FortyGuardService] = None,
    ) -> None:
        self.routing = routing_service or RoutingService()
        self.fortyguard = fortyguard_service or FortyGuardService()

    async def analyze(self, start_query: str, dest_query: str) -> RouteAnalysisResult:
        start = await self.routing.geocode(start_query)
        end = await self.routing.geocode(dest_query)
        pair = await self.routing.route_pair(start, end)

        fast_temps, alt_temps = await self._sample_both(pair)

        fastest_metrics = self._metrics(pair.fastest, fast_temps, shade_bias=0.0)
        coolest_metrics = self._metrics(pair.alternative, alt_temps, shade_bias=4.0)

        fastest = RouteResult(
            type="fastest",
            label="Fastest Route",
            color="#ef4444",
            geometry=pair.fastest.geometry,
            metrics=fastest_metrics,
            summary=f"Shortest time, {fastest_metrics.distance_km} km",
        )
        coolest = RouteResult(
            type="coolest",
            label="Coolest Route",
            color="#22c55e",
            geometry=pair.alternative.geometry,
            metrics=coolest_metrics,
            summary=f"Lowest heat exposure, {coolest_metrics.distance_km} km",
        )

        # Keep red = fastest, green = coolest. Swap geometries if green ended
        # up hotter than red so the comparison always reads correctly.
        if coolest.metrics.heat_score > fastest.metrics.heat_score:
            fastest, coolest = (
                RouteResult(
                    type="fastest",
                    label="Fastest Route",
                    color="#ef4444",
                    geometry=coolest.geometry,
                    metrics=coolest.metrics,
                    summary=f"Shortest time, {coolest.metrics.distance_km} km",
                ),
                RouteResult(
                    type="coolest",
                    label="Coolest Route",
                    color="#22c55e",
                    geometry=fastest.geometry,
                    metrics=fastest.metrics,
                    summary=f"Lowest heat exposure, {fastest.metrics.distance_km} km",
                ),
            )

        heat_reduction = self._reduction(
            fastest.metrics.heat_score, coolest.metrics.heat_score
        )
        explanation = self._explain(fastest.metrics, coolest.metrics, heat_reduction)

        return RouteAnalysisResult(
            fastest_route=fastest,
            coolest_route=coolest,
            heat_reduction=heat_reduction,
            ai_explanation=explanation,
        )

    async def _sample_both(
        self, pair
    ) -> Tuple[List[float], List[float]]:
        import asyncio

        fast_pts = [(p[0], p[1]) for p in pair.fastest.geometry]
        alt_pts = [(p[0], p[1]) for p in pair.alternative.geometry]
        return await asyncio.gather(
            self.fortyguard.getRouteTemperatures(fast_pts),
            self.fortyguard.getRouteTemperatures(alt_pts),
        )

    @staticmethod
    def _metrics(
        path: RoutePath, temps: List[float], shade_bias: float
    ) -> RouteMetrics:
        if not temps:
            temps = [28.0]
        avg = (sum(temps) / len(temps)) - shade_bias
        mx = max(temps) - shade_bias
        avg_excess = max(0.0, avg - COMFORT_C)
        max_excess = max(0.0, mx - COMFORT_C)
        score = round(min(100.0, avg_excess * 2.2 + max_excess * 1.3), 1)
        shade = round(max(0.0, 60.0 - score * 0.4 + shade_bias), 1)
        return RouteMetrics(
            distance_km=round(path.distance_km, 2),
            duration_min=round(path.duration_min, 1),
            avg_temperature_c=round(avg, 1),
            max_temperature_c=round(mx, 1),
            heat_score=max(0.0, score),
            shade_coverage=shade,
        )

    @staticmethod
    def _reduction(fast_score: float, cool_score: float) -> int:
        if fast_score <= 0:
            return 0
        return max(0, round(((fast_score - cool_score) / fast_score) * 100))

    @staticmethod
    def _explain(fast: RouteMetrics, cool: RouteMetrics, reduction: int) -> str:
        extra_min = max(0, round(cool.duration_min - fast.duration_min))
        extra_m = max(0, round((cool.distance_km - fast.distance_km) * 1000))

        if reduction < 5:
            return (
                f"Both routes have similar heat exposure (only {reduction}% "
                "difference). The fastest route is the better choice today — "
                "the cool detour isn't worth it."
            )

        if extra_min > 0:
            dist_clause = ""
            if extra_m > 0:
                dist_clause = (
                    f" and {extra_m} m" if extra_m < 1000
                    else f" and {round(extra_m / 1000, 2)} km"
                )
            prefix = (
                f"Taking the coolest route adds {extra_min} min{dist_clause} "
                f"but reduces heat exposure by {reduction}%"
            )
        else:
            prefix = (
                f"The coolest route is also the fastest — it reduces heat "
                f"exposure by {reduction}% with no extra time"
            )

        temp_diff = round(max(0.0, fast.avg_temperature_c - cool.avg_temperature_c), 1)
        temp_clause = (
            f", with an average temperature {temp_diff}°C cooler along the path"
            if temp_diff > 0.2
            else ""
        )

        if reduction > 40:
            risk_note = (
                ". This is a meaningful reduction during heat-wave conditions "
                "— strongly recommended."
            )
        elif reduction > 20:
            risk_note = ". A worthwhile trade-off for pedestrian comfort."
        else:
            risk_note = (
                ". A modest improvement; choose based on your heat sensitivity."
            )

        return f"{prefix}{temp_clause}{risk_note}"
