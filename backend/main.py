from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
import threading

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
    """Background thread: fetch + cache one authentic municipal OpenStreetMap city."""
    global _cache, _cache_status
    _cache_status[city_id] = "loading"
    log.info(f"[PRE-CACHE] Starting real OSM loading for {city_id}...")
    try:
        data = load_osm_city(city_id)
        data["edges"] = analyze_network(data["nodes"], data["edges"])
        align_services_to_city_nodes(city_id, list(data["nodes"].values()))
        
        _cache[city_id] = data
        _cache_status[city_id] = "ready"
        log.info(f"[PRE-CACHE] ✓ {city_id} ready — {len(data['edges'])} real road segments")
    except Exception as e:
        log.error(f"[PRE-CACHE] ✗ {city_id} OSM failed ({e}). Synthetic fallback generation is strictly forbidden.")
        _cache_status[city_id] = "error"


@app.on_event("startup")
def startup_preload():
    """On server start, pre-cache all cities in parallel background threads."""
    log.info("[STARTUP] Pre-loading all authentic municipal OSM networks in background...")
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
    """Return summary cards for all pre-defined municipal networks."""
    summaries = []
    for cid in CITY_OSM_CONFIG:
        s = get_osm_city_summary(cid)
        s["cache_status"] = _cache_status.get(cid, "pending")
        summaries.append(s)
    return summaries


@app.get("/cities/cache-status")
def cache_status():
    """Return pre-cache status for all cities."""
    return _cache_status


@app.get("/cities/{city_id}/load")
@app.get("/city/{city_id}/load")
def load_city(city_id: str):
    """
    Load a real municipal road network — instantly from pre-cache if ready. ZERO SYNTHETIC FALLBACKS.
    """
    global city_data
    if city_id not in CITY_OSM_CONFIG:
        raise HTTPException(status_code=404, detail=f"City '{city_id}' not found.")

    status = _cache_status.get(city_id, "pending")

    if status == "ready" and city_id in _cache:
        city_data = _cache[city_id]
        log.info(f"[LOAD] {city_id} served instantly from authentic OSM cache")
        return {
            "message": f"Real City '{city_data['city_name']}' loaded from OpenStreetMap.",
            "nodes": len(city_data["nodes"]),
            "roads": len(city_data["edges"]),
            "city_id": city_id,
            "city_name": city_data["city_name"],
            "source": "OpenStreetMap Authentic Geometry",
            "cache_status": status,
        }
    elif status == "loading":
        raise HTTPException(
            status_code=503, 
            detail="Real OpenStreetMap street network is currently loading from satellite Overpass relays. Synthetic fallback generation is strictly forbidden."
        )
    else:
        log.info(f"[LOAD] On-demand loading real OSM network for {city_id}...")
        try:
            data = load_osm_city(city_id)
            data["edges"] = analyze_network(data["nodes"], data["edges"])
            align_services_to_city_nodes(city_id, list(data["nodes"].values()))
            _cache[city_id] = data
            _cache_status[city_id] = "ready"
            city_data = data
            return {
                "message": f"Real City '{city_data['city_name']}' loaded from OpenStreetMap.",
                "nodes": len(city_data["nodes"]),
                "roads": len(city_data["edges"]),
                "city_id": city_id,
                "city_name": city_data["city_name"],
                "source": "OpenStreetMap Authentic Geometry",
                "cache_status": "ready",
            }
        except Exception as e:
            raise HTTPException(
                status_code=503, 
                detail=f"Data Unavailable: Could not retrieve authentic OpenStreetMap geometry ({e}). Synthetic fallback generation is strictly forbidden."
            )


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
    """Return detailed info for a single road."""
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
    """
    global city_data
    city_id = city_data.get("city_id")
    if not city_id:
        raise HTTPException(status_code=400, detail="No city loaded yet.")

    edge = next((e for e in city_data["edges"] if e["id"] == road_id), None)
    if not edge:
        raise HTTPException(status_code=404, detail="Road not found.")

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
@app.post("/city/{city_id}/disaster")
def run_disaster(req: DisasterRequest, city_id: str = None):
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
    raise HTTPException(status_code=400, detail="Synthetic random city generation is strictly forbidden in production Digital Twin.")
