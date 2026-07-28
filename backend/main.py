from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
import threading

from engine.generator import generate_city
from engine.cities import CITY_CONFIGS, generate_city_from_config, get_city_summary
from engine.osm_loader import load_osm_city, get_osm_city_summary, CITY_OSM_CONFIG
from engine.hazard import apply_hazard
from engine.graph_intelligence import analyze_network
from engine.simulation import run_simulation, get_predictions, validate_simulation
from engine.optimization import optimize_budget
from engine.emergency import get_services_for_city, get_nearest_services, align_services_to_city_nodes

log = logging.getLogger("resilio")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="RESILIO CITY API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Global state ─────────────────────────────────────────────────────────────
city_data   = {"nodes": {}, "edges": [], "city_id": None, "city_name": None}

# Pre-cached city store: city_id -> ready city_data dict
_cache: dict = {}
_cache_status: dict = {cid: "pending" for cid in CITY_OSM_CONFIG}  # pending | loading | ready | error


def _preload_city(city_id: str):
    """Background thread: fetch + cache one city."""
    global _cache, _cache_status
    _cache_status[city_id] = "loading"
    log.info(f"[PRE-CACHE] Starting {city_id}...")
    try:
        data = load_osm_city(city_id)
        data["edges"] = analyze_network(data["nodes"], data["edges"])
        # Align emergency services to the real map nodes
        align_services_to_city_nodes(city_id, list(data["nodes"].values()))
        
        _cache[city_id] = data
        _cache_status[city_id] = "ready"
        log.info(f"[PRE-CACHE] ✓ {city_id} ready — {len(data['edges'])} roads")
    except Exception as e:
        log.warning(f"[PRE-CACHE] ✗ {city_id} OSM failed ({e}), using synthetic fallback")
        try:
            data = generate_city_from_config(city_id)
            data["edges"] = analyze_network(data["nodes"], data["edges"])
            # Align emergency services to synthetic map nodes
            align_services_to_city_nodes(city_id, list(data["nodes"].values()))
            
            _cache[city_id] = data
            _cache_status[city_id] = "ready"
            log.info(f"[PRE-CACHE] ✓ {city_id} ready (synthetic) — {len(data['edges'])} roads")
        except Exception as e2:
            log.error(f"[PRE-CACHE] ✗✗ {city_id} total failure: {e2}")
            _cache_status[city_id] = "error"


@app.on_event("startup")
def startup_preload():
    """On server start, pre-cache all cities in parallel background threads."""
    log.info("[STARTUP] Pre-loading all 5 cities in background...")
    for city_id in CITY_OSM_CONFIG:
        t = threading.Thread(target=_preload_city, args=(city_id,), daemon=True)
        t.start()


# ─── Request Models ───────────────────────────────────────────────────────────
class OptimizeRequest(BaseModel):
    budget: float
    hazard: str

class DisasterRequest(BaseModel):
    hazard: str
    intensity: float


# ─── Cities API ───────────────────────────────────────────────────────────────
@app.get("/cities")
def list_cities():
    """Return summary cards for all pre-defined cities (for landing page)."""
    summaries = []
    for cid in CITY_OSM_CONFIG:
        s = get_city_summary(cid) if cid in CITY_CONFIGS else get_osm_city_summary(cid)
        s["cache_status"] = _cache_status.get(cid, "pending")
        summaries.append(s)
    return summaries


@app.get("/cities/cache-status")
def cache_status():
    """Return pre-cache status for all cities."""
    return _cache_status


@app.get("/cities/{city_id}/load")
def load_city(city_id: str):
    """
    Load a city — instantly from pre-cache if ready, otherwise generate on-demand.
    """
    global city_data
    if city_id not in CITY_OSM_CONFIG and city_id not in CITY_CONFIGS:
        raise HTTPException(status_code=404, detail=f"City '{city_id}' not found.")

    status = _cache_status.get(city_id, "pending")

    if status == "ready" and city_id in _cache:
        # ✅ INSTANT — serve from pre-cache
        city_data = _cache[city_id]
        source = "OpenStreetMap (cached — instant)"
        log.info(f"[LOAD] {city_id} served from cache instantly")
    elif status == "loading":
        # Still loading OSM, give synthetic immediately
        log.info(f"[LOAD] {city_id} OSM still loading, serving synthetic instantly")
        city_data = generate_city_from_config(city_id)
        city_data["edges"] = analyze_network(city_data["nodes"], city_data["edges"])
        source = "Synthetic (OSM loading in background)"
    else:
        # Fallback: generate synthetic on the spot
        log.info(f"[LOAD] {city_id} generating synthetic data")
        city_data = generate_city_from_config(city_id)
        city_data["edges"] = analyze_network(city_data["nodes"], city_data["edges"])
        source = "Synthetic"

    return {
        "message": f"City '{city_data['city_name']}' loaded.",
        "nodes": len(city_data["nodes"]),
        "roads": len(city_data["edges"]),
        "city_id": city_id,
        "city_name": city_data["city_name"],
        "source": source,
        "cache_status": status,
    }


# ─── City GeoJSON ─────────────────────────────────────────────────────────────
@app.get("/city")
def get_geojson():
    global city_data
    if not city_data["edges"]:
        raise HTTPException(status_code=400, detail="No city loaded yet.")
    features = []
    for edge in city_data["edges"]:
        u = city_data["nodes"][edge["source"]]
        v = city_data["nodes"][edge["target"]]
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [[u["lon"], u["lat"]], [v["lon"], v["lat"]]]
            },
            "properties": edge,
        })
    return {"type": "FeatureCollection", "features": features}


@app.get("/city/analysis")
def get_analysis():
    global city_data
    if not city_data["edges"]:
        raise HTTPException(status_code=400, detail="No city loaded yet.")
    avg_rci  = sum(e["rci"] for e in city_data["edges"]) / len(city_data["edges"])
    avg_crit = sum(e["criticality"] for e in city_data["edges"]) / len(city_data["edges"])
    critical = sum(1 for e in city_data["edges"] if e["failure_probability"] > 0.7)
    return {
        "average_rci":        avg_rci,
        "average_criticality": avg_crit,
        "total_roads":        len(city_data["edges"]),
        "critical_roads":     critical,
        "city_id":            city_data.get("city_id"),
        "city_name":          city_data.get("city_name"),
    }


@app.get("/city/road/{road_id}")
def get_road_detail(road_id: str):
    """Return detailed info for a single road (for 3D simulation panel)."""
    global city_data
    for edge in city_data["edges"]:
        if edge["id"] == road_id:
            return edge
    raise HTTPException(status_code=404, detail="Road not found.")


# ─── Emergency Services ───────────────────────────────────────────────────────
@app.get("/city/emergency-services")
def list_emergency_services():
    """Return all emergency service locations for the loaded city."""
    global city_data
    city_id = city_data.get("city_id")
    if not city_id:
        raise HTTPException(status_code=400, detail="No city loaded yet.")
    return get_services_for_city(city_id)


@app.get("/city/road/{road_id}/emergency")
def road_emergency_info(road_id: str):
    """
    For a clicked road, return nearest emergency services sorted by ETA.
    Computes road midpoint from its source/target nodes.
    """
    global city_data
    city_id = city_data.get("city_id")
    if not city_id:
        raise HTTPException(status_code=400, detail="No city loaded yet.")

    # Find the road
    edge = next((e for e in city_data["edges"] if e["id"] == road_id), None)
    if not edge:
        raise HTTPException(status_code=404, detail="Road not found.")

    # Compute midpoint of the road
    src = city_data["nodes"].get(edge["source"])
    tgt = city_data["nodes"].get(edge["target"])
    if not src or not tgt:
        raise HTTPException(status_code=400, detail="Road nodes missing.")

    mid_lat = (src["lat"] + tgt["lat"]) / 2
    mid_lon = (src["lon"] + tgt["lon"]) / 2

    nearest = get_nearest_services(city_id, mid_lat, mid_lon, top_n=6)
    return {
        "road_id": road_id,
        "road_name": edge.get("name", "Unknown Road"),
        "road_lat": mid_lat,
        "road_lon": mid_lon,
        "nearest_services": nearest,
    }


# ─── Disaster Simulation ──────────────────────────────────────────────────────
@app.post("/city/disaster")
def run_disaster(req: DisasterRequest):
    global city_data
    if not city_data["edges"]:
        raise HTTPException(status_code=400, detail="No city loaded yet.")
    city_data["edges"] = apply_hazard(city_data["edges"], req.hazard, req.intensity)
    city_data["edges"] = analyze_network(city_data["nodes"], city_data["edges"])
    sim = run_simulation(city_data["nodes"], city_data["edges"], req.intensity)
    return sim


@app.post("/city/optimize")
def optimize(req: OptimizeRequest):
    global city_data
    if not city_data["edges"]:
        raise HTTPException(status_code=400, detail="No city loaded yet.")
    return optimize_budget(city_data["edges"], req.budget)


@app.get("/city/prediction")
def get_prediction():
    global city_data
    return get_predictions(city_data["edges"])


@app.get("/city/validation")
def get_validation():
    global city_data
    predicted = [e["road_id"] for e in get_predictions(city_data["edges"])]
    actual = [e["id"] for e in city_data["edges"] if e["failure_probability"] > 0.6]
    return validate_simulation(predicted, actual)


# ─── Legacy endpoint ──────────────────────────────────────────────────────────
@app.get("/city/generate")
def generate_legacy():
    """Legacy: generate random city (kept for compatibility)."""
    global city_data
    city_data = generate_city()
    city_data["edges"] = analyze_network(city_data["nodes"], city_data["edges"])
    return {"message": f"City generated with {len(city_data['nodes'])} nodes."}
