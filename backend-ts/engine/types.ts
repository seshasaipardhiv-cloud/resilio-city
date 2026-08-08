export type NodeType = 'intersection' | 'bridge' | 'tunnel' | 'roundabout' | 'traffic_signal' | 'hospital' | 'clinic' | 'pharmacy' | 'nursing_home' | 'fire_station' | 'police' | 'police_station' | 'airport' | 'railway_crossing';
export type EdgeType = 'road_segment' | 'bridge_deck' | 'flyover' | 'tunnel' | 'service_road' | 'river' | 'stream';

export interface GraphNode {
  id: string;
  lat: number;
  lon: number;
  type: NodeType;
  label?: string | undefined;
  elevation_m?: number | undefined;
  google_place_id?: string | undefined;
  is_emergency_hub?: boolean | undefined;
  tile_id?: string | undefined;
}

export interface SatelliteObservation {
  rainfall_intensity_mm?: number | undefined;
  surface_temp_celsius?: number | undefined;
  flood_water_depth_m?: number | undefined;
}

export interface TrafficObservation {
  provider?: 'Google Traffic' | 'HERE' | 'TomTom' | string | undefined;
  congestion_coefficient?: number | undefined; // 1.0 (free flow) to 4.0+ (gridlock)
  travel_time_seconds?: number | undefined;
  is_road_closed?: boolean | undefined;
  closure_reason?: string | undefined;
  average_speed_kmh?: number | undefined;
  incident?: string | undefined;
  construction?: string | undefined;
  is_live_measured?: boolean | undefined;
}

export interface ModelProvenance {
  model_name: string;
  version: string;
  input_datasets: string[];
  prediction_timestamp: string;
  confidence_pct: number;
  /** Lower confidence interval bound (e.g. -30 means -30% of predicted value) */
  confidence_interval_lower_pct?: number;
  /** Upper confidence interval bound */
  confidence_interval_upper_pct?: number;
  /** Root Mean Squared Error from validation study */
  rmse?: number | string;
  /** Mean Absolute Error from validation study */
  mae?: number | string;
  /** Published scientific validation dataset name */
  calibration_dataset?: string;
  /** Peer-reviewed publication supporting this model */
  scientific_publication?: string;
  limitations: string[];
  calibration_status: 'Locally Calibrated' | 'Transferred Approximation' | 'Experimental';
  /** If this is a fallback, this names the primary model that could not be run */
  fallback_from?: string;
  validation_metrics: {
    dataset: string;
    metric: string;
    value: number | string;
  };
}


export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  road_name: string;
  highway_class?: 'motorway' | 'trunk' | 'primary' | 'secondary' | 'tertiary' | 'residential' | 'living_street' | 'service' | string | undefined;
  polyline?: Array<[number, number]> | undefined; // Original OSM sequence [lon, lat] preserving every intermediate coordinate
  length_meters: number;
  lanes: number;
  surface: 'asphalt' | 'concrete' | 'unpaved';
  speed_limit_kmh: number;
  current_speed_kmh: number;
  travel_time_seconds: number;
  traffic_volume_vph: number;
  is_bridge?: boolean | undefined;
  is_tunnel?: boolean | undefined;
  is_roundabout?: boolean | undefined;
  has_traffic_signal?: boolean | undefined;
  bridge_type?: string | undefined;
  construction_year?: number | undefined;
  tile_id?: string | undefined; // Spatial grid index for LOD & viewport culling
  rci: number | null; // Road Condition Index (0-100), null if unmeasured
  failure_probability: number | null; // 0.0 to 1.0, null if unmeasured
  flood_vulnerability: number | null; // 0.0 to 1.0, null if unmeasured
  earthquake_vulnerability: number | null; // 0.0 to 1.0, null if unmeasured
  damage_state: 'none' | 'flooded' | 'subsided' | 'collapsed' | 'obstructed' | null;
  google_place_id?: string | undefined;
  osm_id?: string | undefined;
  width?: number | undefined;
  satellite_observations?: SatelliteObservation | undefined;
  traffic_status?: TrafficObservation | undefined;
  last_updated?: string | undefined;
  provenance?: ModelProvenance | undefined;
}

export interface EnvironmentalTelemetry {
  rainfall_mm: number;
  temperature_celsius: number;
  pressure_hpa: number;
  wind_speed_kmh: number;
  humidity_percent: number;
  visibility_m?: number | undefined;
  cloud_cover_percent?: number | undefined;
  soil_moisture_index?: number | undefined;
  ground_subsidence_mm_yr?: number | undefined;
  weather_alerts?: string[] | undefined;
  is_live_weather?: boolean | undefined;
  source_verification: string;
  timestamp: string;
}

export interface CityRoadGraph {
  city_id: string;
  city_name: string;
  center_lat: number;
  center_lon: number;
  last_updated: string;
  bbox?: [number, number, number, number] | undefined; // [southLat, westLon, northLat, eastLon]
  fit_bounds?: [[number, number], [number, number]] | undefined; // [[minLon, minLat], [maxLon, maxLat]]
  total_road_segments?: number | undefined;
  spatial_index?: Record<string, string[]> | undefined;
  nodes: Record<string, GraphNode>;
  edges: GraphEdge[];
  telemetry: EnvironmentalTelemetry;
  boundary_polygon?: any;
}

export interface RecoveryAction {
  phase: 'Emergency Clearance' | 'Structural Stabilization' | 'Full Reconstruction';
  target_edge_id: string;
  road_name: string;
  priority_score: number;
  estimated_cost_inr: number;
  manpower_required: number;
  equipment_needed: string[];
  detour_route: string[];
  expected_recovery_hours: number;
}

export interface SearchResult {
  name: string;
  lat: number;
  lon: number;
  google_place_id?: string | undefined;
  osm_id?: string | undefined;
  address?: string | undefined;
  road_type?: string | undefined;
  confidence: number;
  source: 'Google Places' | 'OpenStreetMap Nominatim' | 'Local Road Graph' | string;
  target_id?: string | undefined;
}

export type RoutingMode = 'shortest' | 'fastest' | 'safest' | 'flood_avoidance' | 'earthquake_safe';

export interface RouteResponse {
  mode: RoutingMode;
  path_node_ids: string[];
  path_edge_ids: string[];
  polyline: Array<[number, number]>;
  total_distance_meters: number;
  estimated_travel_time_seconds: number;
  average_rci: number;
  max_failure_probability: number;
  hazard_score: number;
  status: 'SUCCESS' | 'NO_ROUTE_FOUND' | 'OFFLINE';
}
