"""
emergency.py — Emergency service locations + ETA calculator for each city.
Provides hospitals, fire stations, police stations with coordinates.
"""
import math
import random

# Emergency service definitions per city (real-ish coordinates)
EMERGENCY_SERVICES = {
    "nova_delhi": [
        {"id": "nd_h1", "type": "hospital",      "name": "AIIMS New Delhi",            "lat": 28.5672, "lon": 77.2100, "capacity": 2500, "ambulances": 12},
        {"id": "nd_h2", "type": "hospital",      "name": "Safdarjung Hospital",         "lat": 28.5679, "lon": 77.2090, "capacity": 1800, "ambulances": 8},
        {"id": "nd_h3", "type": "hospital",      "name": "RML Hospital",                "lat": 28.6350, "lon": 77.2120, "capacity": 1200, "ambulances": 6},
        {"id": "nd_h4", "type": "hospital",      "name": "GTB Hospital",                "lat": 28.6815, "lon": 77.3120, "capacity": 900,  "ambulances": 5},
        {"id": "nd_f1", "type": "fire_station",  "name": "Delhi Fire Station CP",       "lat": 28.6319, "lon": 77.2199, "trucks": 8,  "personnel": 45},
        {"id": "nd_f2", "type": "fire_station",  "name": "Lajpat Nagar Fire Station",   "lat": 28.5683, "lon": 77.2434, "trucks": 6,  "personnel": 30},
        {"id": "nd_f3", "type": "fire_station",  "name": "Rohini Fire Station",         "lat": 28.7000, "lon": 77.1300, "trucks": 5,  "personnel": 28},
        {"id": "nd_p1", "type": "police",        "name": "New Delhi Police HQ",         "lat": 28.6304, "lon": 77.2177, "vehicles": 25, "personnel": 200},
        {"id": "nd_p2", "type": "police",        "name": "Connaught Place Police Stn",  "lat": 28.6330, "lon": 77.2188, "vehicles": 12, "personnel": 80},
        {"id": "nd_p3", "type": "police",        "name": "Lodi Colony Police Station",  "lat": 28.5900, "lon": 77.2250, "vehicles": 10, "personnel": 60},
    ],
    "cyber_bangalore": [
        {"id": "bl_h1", "type": "hospital",      "name": "Manipal Hospital Bangalore",  "lat": 12.9539, "lon": 77.6487, "capacity": 600,  "ambulances": 8},
        {"id": "bl_h2", "type": "hospital",      "name": "Victoria Hospital",           "lat": 12.9639, "lon": 77.5798, "capacity": 1200, "ambulances": 10},
        {"id": "bl_h3", "type": "hospital",      "name": "Bowring Hospital",            "lat": 12.9783, "lon": 77.6188, "capacity": 800,  "ambulances": 6},
        {"id": "bl_h4", "type": "hospital",      "name": "St. John's Medical College",  "lat": 12.9360, "lon": 77.6250, "capacity": 1000, "ambulances": 7},
        {"id": "bl_f1", "type": "fire_station",  "name": "Shivajinagar Fire Station",   "lat": 12.9851, "lon": 77.6001, "trucks": 7,  "personnel": 38},
        {"id": "bl_f2", "type": "fire_station",  "name": "HSR Layout Fire Station",     "lat": 12.9120, "lon": 77.6430, "trucks": 5,  "personnel": 28},
        {"id": "bl_p1", "type": "police",        "name": "Bangalore Central Police",    "lat": 12.9750, "lon": 77.5930, "vehicles": 20, "personnel": 150},
        {"id": "bl_p2", "type": "police",        "name": "Whitefield Police Station",   "lat": 12.9698, "lon": 77.7500, "vehicles": 12, "personnel": 70},
    ],
    "coastal_mumbai": [
        {"id": "mb_h1", "type": "hospital",      "name": "KEM Hospital",                "lat": 19.0023, "lon": 72.8365, "capacity": 1900, "ambulances": 14},
        {"id": "mb_h2", "type": "hospital",      "name": "Nair Hospital",               "lat": 18.9785, "lon": 72.8290, "capacity": 1400, "ambulances": 10},
        {"id": "mb_h3", "type": "hospital",      "name": "Lilavati Hospital",           "lat": 19.0530, "lon": 72.8270, "capacity": 500,  "ambulances": 6},
        {"id": "mb_h4", "type": "hospital",      "name": "Cooper Hospital",             "lat": 19.0740, "lon": 72.8370, "capacity": 1000, "ambulances": 8},
        {"id": "mb_f1", "type": "fire_station",  "name": "Byculla Fire Station",        "lat": 18.9796, "lon": 72.8356, "trucks": 10, "personnel": 55},
        {"id": "mb_f2", "type": "fire_station",  "name": "Andheri Fire Station",        "lat": 19.1136, "lon": 72.8687, "trucks": 7,  "personnel": 40},
        {"id": "mb_f3", "type": "fire_station",  "name": "Chembur Fire Station",        "lat": 19.0576, "lon": 72.8996, "trucks": 6,  "personnel": 32},
        {"id": "mb_p1", "type": "police",        "name": "Mumbai Police HQ",            "lat": 18.9376, "lon": 72.8348, "vehicles": 40, "personnel": 350},
        {"id": "mb_p2", "type": "police",        "name": "Bandra Police Station",       "lat": 19.0544, "lon": 72.8388, "vehicles": 15, "personnel": 90},
        {"id": "mb_p3", "type": "police",        "name": "Andheri Police Station",      "lat": 19.1197, "lon": 72.8468, "vehicles": 12, "personnel": 75},
    ],
    "heritage_jaipur": [
        {"id": "jp_h1", "type": "hospital",      "name": "SMS Medical College",         "lat": 26.9050, "lon": 75.7950, "capacity": 2200, "ambulances": 12},
        {"id": "jp_h2", "type": "hospital",      "name": "Sawai Man Singh Hospital",    "lat": 26.9140, "lon": 75.8000, "capacity": 1800, "ambulances": 10},
        {"id": "jp_h3", "type": "hospital",      "name": "Fortis Jaipur",               "lat": 26.8700, "lon": 75.7800, "capacity": 400,  "ambulances": 5},
        {"id": "jp_f1", "type": "fire_station",  "name": "Jaipur Central Fire Stn",     "lat": 26.9120, "lon": 75.7873, "trucks": 8,  "personnel": 42},
        {"id": "jp_f2", "type": "fire_station",  "name": "Mansarovar Fire Station",     "lat": 26.8540, "lon": 75.7740, "trucks": 5,  "personnel": 28},
        {"id": "jp_p1", "type": "police",        "name": "Jaipur Police Commissionerate","lat": 26.9050, "lon": 75.7870, "vehicles": 20, "personnel": 180},
        {"id": "jp_p2", "type": "police",        "name": "Malviya Nagar Police Stn",    "lat": 26.8583, "lon": 75.8011, "vehicles": 10, "personnel": 60},
    ],
    "techno_hyderabad": [
        {"id": "hd_h1", "type": "hospital",      "name": "Nizam's Institute of Medical","lat": 17.3974, "lon": 78.4691, "capacity": 1500, "ambulances": 10},
        {"id": "hd_h2", "type": "hospital",      "name": "Gandhi Hospital",             "lat": 17.4260, "lon": 78.5010, "capacity": 1200, "ambulances": 8},
        {"id": "hd_h3", "type": "hospital",      "name": "Apollo Hyderabad",            "lat": 17.4323, "lon": 78.4489, "capacity": 700,  "ambulances": 6},
        {"id": "hd_h4", "type": "hospital",      "name": "Yashoda Hospital Secunderabad","lat": 17.4399, "lon": 78.5011,"capacity": 600, "ambulances": 5},
        {"id": "hd_f1", "type": "fire_station",  "name": "Hyderabad Fire HQ",           "lat": 17.3981, "lon": 78.4798, "trucks": 10, "personnel": 50},
        {"id": "hd_f2", "type": "fire_station",  "name": "Hitec City Fire Station",     "lat": 17.4435, "lon": 78.3772, "trucks": 6,  "personnel": 30},
        {"id": "hd_f3", "type": "fire_station",  "name": "LB Nagar Fire Station",       "lat": 17.3500, "lon": 78.5500, "trucks": 5,  "personnel": 26},
        {"id": "hd_p1", "type": "police",        "name": "Hyderabad Police Commr Office","lat": 17.4046, "lon": 78.4729, "vehicles": 30, "personnel": 250},
        {"id": "hd_p2", "type": "police",        "name": "Cyberabad Police Station",    "lat": 17.4480, "lon": 78.3700, "vehicles": 14, "personnel": 90},
        {"id": "hd_p3", "type": "police",        "name": "LB Nagar Police Station",     "lat": 17.3460, "lon": 78.5480, "vehicles": 10, "personnel": 65},
    ],
}

# Average speeds in km/h for each service type
SERVICE_SPEEDS = {
    "hospital":    80.0,   # ambulance
    "fire_station": 70.0,  # fire truck
    "police":      90.0,   # police vehicle
}

SERVICE_LABELS = {
    "hospital":    "🏥 Ambulance",
    "fire_station": "🚒 Fire Truck",
    "police":      "🚔 Police Unit",
}

SERVICE_COLORS = {
    "hospital":    "#ff4444",
    "fire_station": "#ff8800",
    "police":      "#4488ff",
}


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate great-circle distance in km between two lat/lon points."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def get_services_for_city(city_id: str) -> list:
    """Return all emergency service locations for a city."""
    return EMERGENCY_SERVICES.get(city_id, [])


def align_services_to_city_nodes(city_id: str, nodes_list: list):
    """
    Randomly assigns emergency services to actual intersections (nodes) 
    in the loaded city graph to ensure they always appear inside the map view.
    """
    services = EMERGENCY_SERVICES.get(city_id, [])
    if not services or not nodes_list:
        return
    
    # Deterministic seed so they stay in the same place for the same city
    random.seed(city_id)
    sampled = random.sample(nodes_list, min(len(services), len(nodes_list)))
    
    for svc, node in zip(services, sampled):
        svc["lat"] = node["lat"]
        svc["lon"] = node["lon"]


def get_nearest_services(city_id: str, road_lat: float, road_lon: float, top_n: int = 5) -> list:
    """
    Given a road midpoint coordinate, return the top_n nearest emergency services
    with distance in km and ETA in minutes.
    """
    services = EMERGENCY_SERVICES.get(city_id, [])
    results = []
    for svc in services:
        dist_km = _haversine_km(road_lat, road_lon, svc["lat"], svc["lon"])
        speed_kmh = SERVICE_SPEEDS.get(svc["type"], 80.0)
        # Add 20% overhead for traffic/navigation
        eta_min = round((dist_km / speed_kmh) * 60 * 1.20, 1)
        results.append({
            **svc,
            "distance_km": round(dist_km, 2),
            "eta_minutes": eta_min,
            "speed_kmh": speed_kmh,
            "label": SERVICE_LABELS.get(svc["type"], svc["type"]),
            "color": SERVICE_COLORS.get(svc["type"], "#ffffff"),
        })
    results.sort(key=lambda x: x["eta_minutes"])
    return results[:top_n]
