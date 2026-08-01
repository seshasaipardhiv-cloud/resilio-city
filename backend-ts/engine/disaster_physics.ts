import { GraphNode, GraphEdge, EnvironmentalTelemetry } from './types.js';
import { GeographicIntelligenceEngine } from './geographic_intelligence.js';
import { MUNICIPAL_BOUNDARIES } from './municipal_boundaries.js';
import { CITY_OSM_CONFIG } from './osm_loader.js';
import { FloodModel, HazardPrediction } from './models/flood_model.js';
import { EarthquakeModel } from './models/earthquake_model.js';
import { LandslideModel } from './models/landslide_model.js';
import { HeatwaveModel } from './models/heatwave_model.js';

/**
 * Production Disaster Physics Engine
 * Delegates to scientifically grounded models (TWI, GMPE) instead of arbitrary heuristics.
 */

export class DisasterPhysicsEngine {
  /**
   * Evaluate if a proposed hazard is scientifically applicable and what mitigation priorities exist for this municipality.
   */
  public static assessHazardApplicability(
    cityId: string,
    hazardType: string
  ): { applicable: boolean; risk_level: 'high' | 'medium' | 'low' | 'na' | 'not_applicable'; reasoning: string; mitigation_priority: string[] } {
    const muni = MUNICIPAL_BOUNDARIES[cityId] || CITY_OSM_CONFIG[cityId];
    if (!muni) {
      return {
        applicable: true,
        risk_level: 'medium',
        reasoning: `Standard urban disaster vulnerability evaluation applied for ${hazardType}.`,
        mitigation_priority: ['Municipal drainage upkeep', 'Structural bridge monitoring']
      };
    }

    const profile = GeographicIntelligenceEngine.buildGeographicProfile(
      cityId,
      muni.name,
      muni.center_lat,
      muni.center_lon,
      muni.average_elevation_meters,
      muni.state,
      muni.major_rivers || [],
      muni.area_sq_km || 200
    );

    const normHazard = hazardType.toLowerCase().trim();
    const found = profile.hazard_assessments.find((h: any) => normHazard.includes(h.hazard.toLowerCase()) || h.hazard.toLowerCase().includes(normHazard));

    if (!found || found.risk_level === 'not_applicable' || found.risk_level === ('na' as any)) {
      if (normHazard.includes('tsunami') || normHazard.includes('surge') || (normHazard.includes('cyclone') && profile.coastal_distance_km > 250)) {
        return {
          applicable: false,
          risk_level: 'not_applicable',
          reasoning: `${muni.name} is an inland municipality situated ${profile.coastal_distance_km} km away from the nearest marine coastline at ${muni.average_elevation_meters}m elevation. Oceanic storm surges or tsunamis are scientifically implausible under normal topographic physics.`,
          mitigation_priority: []
        };
      }
    }

    return {
      applicable: found ? found.risk_level !== 'not_applicable' : true,
      risk_level: found ? (found.risk_level as any) : 'medium',
      reasoning: found ? found.reasoning : `Standard multi-hazard assessment applied based on geographic topology.`,
      mitigation_priority: found && found.mitigation_notes ? [found.mitigation_notes] : ['Infrastructure reinforcement']
    };
  }

  private static readonly MAJOR_RIVER_COORDINATES: Array<{ name: string; lat: number; lon: number; influence_km: number }> = [
    { name: "Musi River (Hyderabad)", lat: 17.3780, lon: 78.4750, influence_km: 3.5 },
    { name: "Hussain Sagar Lake (Hyderabad)", lat: 17.4239, lon: 78.4738, influence_km: 2.0 },
    { name: "Yamuna River (Delhi)", lat: 28.6180, lon: 77.2450, influence_km: 4.0 },
    { name: "Mithi River & Arabian Coast (Mumbai)", lat: 19.0400, lon: 72.8500, influence_km: 5.0 },
    { name: "Dravyavati River (Jaipur)", lat: 26.8900, lon: 75.7800, influence_km: 3.0 },
    { name: "Bellandur Lakeway (Bangalore)", lat: 12.9350, lon: 77.6600, influence_km: 3.5 }
  ];

  /**
   * Determine proximity distance to major municipal water bodies in meters
   */
  public static calculateRiverProximityMeters(lat: number, lon: number): { minDistanceMeters: number; riverName: string } {
    let minDist = 50000;
    let closestRiver = "Municipal Groundwater Drainage";

    DisasterPhysicsEngine.MAJOR_RIVER_COORDINATES.forEach((river) => {
      // Euclidean geodetic approximation in meters
      const dLat = (lat - river.lat) * 111133;
      const dLon = (lon - river.lon) * 105000;
      const dist = Math.sqrt(dLat * dLat + dLon * dLon);
      if (dist < minDist) {
        minDist = dist;
        closestRiver = river.name;
      }
    });

    return { minDistanceMeters: Math.round(minDist), riverName: closestRiver };
  }

  /**
   * Execute multi-model hazard propagation and attach scientific provenance to graph edges.
   */
  public static executeHazardPropagation(
    hazardType: string,
    intensity: number, // 0.0 to 1.0 or 1 to 10
    nodes: Record<string, GraphNode>,
    edges: GraphEdge[],
    telemetry: EnvironmentalTelemetry
  ): { affectedEdges: string[]; stats: Record<string, any> } {
    const affectedSet: Set<string> = new Set();
    const stats = {
      total_corridors_analyzed: edges.length,
      bridges_structurally_compromised: 0,
      arterials_submerged: 0,
      seismic_collapses_detected: 0,
      mean_rci_degradation: 0
    };

    let totalRciLoss = 0;
    const normIntensity = intensity > 1.0 ? intensity / 10.0 : intensity;
    const hType = hazardType.toLowerCase();

    let predictions: HazardPrediction[] = [];

    // Route to appropriate scientific model
    if (hType.includes('flood') || hType.includes('rain') || hType.includes('cyclone')) {
      predictions = FloodModel.execute(nodes, edges, telemetry, normIntensity);
    } else if (hType.includes('earthquake') || hType.includes('seismic')) {
      predictions = EarthquakeModel.execute(nodes, edges, telemetry, normIntensity);
    } else if (hType.includes('heat') || hType.includes('temperature')) {
      predictions = HeatwaveModel.execute(nodes, edges, telemetry, normIntensity);
    } else {
      predictions = LandslideModel.execute(nodes, edges, telemetry, normIntensity);
    }

    // Apply predictions to the graph
    predictions.forEach(pred => {
      if (pred.damage_state !== 'none') {
        affectedSet.add(pred.edge_id);
      }
      
      const edge = edges.find(e => e.id === pred.edge_id);
      if (edge) {
        if (pred.damage_state !== 'none') {
          edge.damage_state = pred.damage_state;
          
          if (edge.damage_state === 'flooded') {
            stats.arterials_submerged++;
            edge.current_speed_kmh = Math.round(edge.speed_limit_kmh * 0.2);
            if (!edge.satellite_observations) edge.satellite_observations = {};
            edge.satellite_observations.flood_water_depth_m = Math.round(pred.severity * 2.5 * 100) / 100;
          } else if (edge.damage_state === 'collapsed') {
            stats.seismic_collapses_detected++;
            if (edge.is_bridge) stats.bridges_structurally_compromised++;
            edge.current_speed_kmh = 5;
            if (!edge.traffic_status) edge.traffic_status = {};
            edge.traffic_status.is_road_closed = true;
            edge.traffic_status.closure_reason = `STRUCTURAL COLLAPSE`;
          } else {
            edge.current_speed_kmh = 10;
          }

          // Provenance Payload attached directly to edge
          edge.provenance = pred.provenance;

          const rciDrop = Math.round((edge.rci || 70) * pred.severity);
          edge.rci = Math.max(5, (edge.rci || 70) - rciDrop);
          edge.failure_probability = pred.severity;
          totalRciLoss += rciDrop;
        }
      }
    });

    stats.mean_rci_degradation = affectedSet.size > 0 ? Math.round(totalRciLoss / affectedSet.size) : 0;
    console.log(`[Disaster Physics Engine] Completed hazard propagation (${hazardType}) across ${edges.length} corridors. Affected segments: ${affectedSet.size}.`);

    return {
      affectedEdges: Array.from(affectedSet),
      stats
    };
  }
}
