"""Pydantic request/response schemas."""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class LatLng(BaseModel):
    lat: float
    lng: float


class RouteMetrics(BaseModel):
    distance_km: float
    duration_min: float
    avg_temperature_c: float
    max_temperature_c: float
    heat_score: float
    shade_coverage: float


class RouteResult(BaseModel):
    type: str
    label: str
    color: str
    geometry: List[LatLng]
    metrics: RouteMetrics
    summary: str


class RouteAnalysisRequest(BaseModel):
    start: str = Field(..., description="Starting address or place name")
    destination: str = Field(..., description="Destination address or place name")
    time: Optional[str] = Field(default="now", description="ISO time or 'now'")
    preference: Optional[str] = Field(
        default="coolest", description="fastest | coolest | balanced"
    )


class RouteAnalysisResponse(BaseModel):
    fastest_route: RouteResult
    coolest_route: RouteResult
    heat_reduction: float
    ai_explanation: str


class TemperatureRequest(BaseModel):
    lat: float
    lng: float


class TemperatureResponse(BaseModel):
    latitude: float
    longitude: float
    temperature_c: float
    source: str


class HeatRiskResponse(BaseModel):
    level: str
    label: str
    score: float
    recommendation: str


class HealthResponse(BaseModel):
    status: str
    fortyguard_enabled: bool
