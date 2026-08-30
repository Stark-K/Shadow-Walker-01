"""FastAPI application entrypoint for ShadowWalker backend."""
from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.schemas import (
    HealthResponse,
    HeatRiskResponse,
    RouteAnalysisRequest,
    RouteAnalysisResponse,
    TemperatureRequest,
    TemperatureResponse,
)
from app.services.analyzer import RouteAnalyzer
from app.services.fortyguard import FortyGuardError, fortyguard

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("shadowwalker")

settings = get_settings()

app = FastAPI(
    title="ShadowWalker API",
    description="Heat-aware navigation platform — compares fastest and coolest routes.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok", fortyguard_enabled=settings.fortyguard_enabled
    )


@app.get("/api/health", response_model=HealthResponse)
async def api_health() -> HealthResponse:
    return HealthResponse(
        status="ok", fortyguard_enabled=settings.fortyguard_enabled
    )


@app.post("/api/route-analysis", response_model=RouteAnalysisResponse)
async def route_analysis(req: RouteAnalysisRequest) -> RouteAnalysisResponse:
    if not req.start or not req.destination:
        raise HTTPException(status_code=400, detail="start and destination required")
    analyzer = RouteAnalyzer()
    try:
        result = await analyzer.analyze(req.start, req.destination)
    except FortyGuardError as exc:
        logger.warning("FortyGuard error during analysis: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc))
    except Exception as exc:
        logger.exception("Route analysis failed")
        raise HTTPException(status_code=500, detail=str(exc))
    return RouteAnalysisResponse(**result.to_dict())


@app.post("/api/temperature", response_model=TemperatureResponse)
async def temperature(req: TemperatureRequest) -> TemperatureResponse:
    try:
        reading = await fortyguard.getTemperature(req.lat, req.lng)
    except FortyGuardError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    return TemperatureResponse(
        latitude=reading.latitude,
        longitude=reading.longitude,
        temperature_c=reading.temperature_c,
        source=reading.source,
    )


@app.post("/api/heat-risk", response_model=HeatRiskResponse)
async def heat_risk(req: TemperatureRequest) -> HeatRiskResponse:
    try:
        risk = await fortyguard.getHeatRisk(req.lat, req.lng)
    except FortyGuardError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    return HeatRiskResponse(
        level=risk.level,
        label=risk.label,
        score=risk.score,
        recommendation=risk.recommendation,
    )
