import { GraphNode, GraphEdge, EnvironmentalTelemetry } from './types.js';
import { GeographicIntelligenceEngine } from './geographic_intelligence.js';
import { MUNICIPAL_BOUNDARIES } from './municipal_boundaries.js';
import { CITY_OSM_CONFIG } from './osm_loader.js';
import { FloodModel, HazardPrediction } from './models/flood_model.js';
import { EarthquakeModel } from './models/earthquake_model.js';
import { LandslideModel } from './models/landslide_model.js';
import { HeatwaveModel } from './models/heatwave_model.js';
import { CycloneModel } from './models/cyclone_model.js';
import { WildfireModel } from './models/wildfire_model.js';

// ─────────────────────────────────────────────────────────────────────────────
// SCIENTIFIC TERMINOLOGY STANDARD
// Per user specification — the platform must use precise scientific language:
//
//  Hazard       | Correct Label                          | NOT
// ─────────────────────────────────────────────────────────────────────────────
//  Flood (TWI)  | "Flood Susceptibility Assessment"      | "Flood Simulation"
//  Earthquake   | "Earthquake Damage Probability"        | "Earthquake Simulation"
//  Landslide    | "Landslide Susceptibility"             | "Landslide Simulation"
//  Wildfire     | "Wildfire Susceptibility Assessment"   | "Wildfire Simulation"
//  Cyclone      | "Cyclone Wind Impact Assessment"       | "Cyclone Simulation"
//  Heatwave     | "Heatwave Infrastructure Impact"       | "Heatwave Simulation"
// ─────────────────────────────────────────────────────────────────────────────

export const SCIENTIFIC_LABELS: Record<string, { label: string; type: 'susceptibility' | 'probability' | 'impact_assessment' | 'simulation' }> = {
  flood:      { label: 'Flood Susceptibility Assessment (TWI)',                type: 'susceptibility' },
  rain:       { label: 'Flood Susceptibility Assessment (TWI)',                type: 'susceptibility' },
  earthquake: { label: 'Earthquake Damage Probability Assessment (GMPE+HAZUS)', type: 'probability' },
  seismic:    { label: 'Earthquake Damage Probability Assessment (GMPE+HAZUS)', type: 'probability' },
  landslide:  { label: 'Landslide Susceptibility Assessment (SHALSTAB)',       type: 'susceptibility' },
  cyclone:    { label: 'Cyclone Wind Impact Assessment (Holland 1980)',         type: 'impact_assessment' },
  heatwave:   { label: 'Heatwave Infrastructure Impact Assessment (UTCI)',     type: 'impact_assessment' },
  heat:       { label: 'Heatwave Infrastructure Impact Assessment (UTCI)',     type: 'impact_assessment' },
  wildfire:   { label: 'Wildfire Susceptibility Assessment (NDVI Proxy)',      type: 'susceptibility' },
  fire:       { label: 'Wildfire Susceptibility Assessment (NDVI Proxy)',      type: 'susceptibility' },
  industrial: { label: 'Industrial Hazard Exposure Assessment',                type: 'susceptibility' },
};

export type HazardApplicabilityResult = {
  applicable: boolean;
  risk_level: 'high' | 'medium' | 'low' | 'na' | 'not_applicable';
  reasoning: string;
  mitigation_priority: string[];
  scientific_label: string;
  assessment_type: string;
  primary_model_unavailable?: string;
  fallback_model?: string;
};

export class DisasterPhysicsEngine {

  // ─── MAJOR RIVER COORDINATES ──────────────────────────────────────────────
  private static readonly MAJOR_RIVER_COORDINATES = [
    { name: 'Musi River (Hyderabad)',          lat: 17.3780, lon: 78.4750, influence_km: 3.5 },
    { name: 'Hussain Sagar Lake (Hyderabad)',  lat: 17.4239, lon: 78.4738, influence_km: 2.0 },
    { name: 'Yamuna River (Delhi)',             lat: 28.6180, lon: 77.2450, influence_km: 4.0 },
    { name: 'Mithi River & Arabian Coast (Mumbai)', lat: 19.0400, lon: 72.8500, influence_km: 5.0 },
    { name: 'Dravyavati River (Jaipur)',        lat: 26.8900, lon: 75.7800, influence_km: 3.0 },
    { name: 'Bellandur Lakeway (Bangalore)',    lat: 12.9350, lon: 77.6600, influence_km: 3.5 },
    { name: 'Noyyal River (Coimbatore)',        lat: 11.0168, lon: 76.9558, influence_km: 3.0 },
    { name: 'Periyar River (Kochi)',            lat: 9.9312,  lon: 76.2673, influence_km: 4.0 },
    { name: 'Sabarmati River (Ahmedabad)',      lat: 23.0225, lon: 72.5714, influence_km: 3.5 },
    { name: 'Godavari River (Nashik)',          lat: 19.9975, lon: 73.7898, influence_km: 3.0 },
  ];

  public static calculateRiverProximityMeters(lat: number, lon: number): { minDistanceMeters: number; riverName: string } {
    let minDist = 50000;
    let closestRiver = 'Municipal Groundwater Drainage';
    DisasterPhysicsEngine.MAJOR_RIVER_COORDINATES.forEach((river) => {
      const dLat = (lat - river.lat) * 111133;
      const dLon = (lon - river.lon) * 105000;
      const dist = Math.sqrt(dLat * dLat + dLon * dLon);
      if (dist < minDist) { minDist = dist; closestRiver = river.name; }
    });
    return { minDistanceMeters: Math.round(minDist), riverName: closestRiver };
  }

  // ─── HAZARD APPLICABILITY ENGINE ─────────────────────────────────────────
  /**
   * Evaluates whether a hazard is scientifically applicable to a municipality.
   * Checks terrain, coastal distance, climate, and historical disaster profiles.
   * NEVER runs a model for an inapplicable hazard.
   */
  public static assessHazardApplicability(
    cityId: string,
    hazardType: string
  ): HazardApplicabilityResult {
    const muni = MUNICIPAL_BOUNDARIES[cityId] || CITY_OSM_CONFIG[cityId];
    const normHazard = hazardType.toLowerCase().trim();
    const sciEntry = SCIENTIFIC_LABELS[normHazard] ?? SCIENTIFIC_LABELS['flood']!;
    const sci = sciEntry;

    if (!muni) {
      return {
        applicable: true,
        risk_level: 'medium',
        reasoning: `No municipal boundary data for '${cityId}'. Standard multi-hazard assessment applied.`,
        mitigation_priority: ['Municipal drainage upkeep', 'Structural bridge monitoring'],
        scientific_label: sci.label,
        assessment_type: sci.type,
      };
    }

    const profile = GeographicIntelligenceEngine.buildGeographicProfile(
      cityId, muni.name, muni.center_lat, muni.center_lon,
      muni.average_elevation_meters, muni.state,
      muni.major_rivers || [], muni.area_sq_km || 200
    );

    // ── ABSOLUTE INAPPLICABILITY RULES (geographic physics) ──────────────────
    const coastKm: number = (profile as any).coastal_distance_km ?? 999;
    const elevM: number = muni.average_elevation_meters ?? 300;

    if (normHazard.includes('tsunami') || normHazard.includes('surge')) {
      if (coastKm > 50) {
        return {
          applicable: false, risk_level: 'not_applicable',
          reasoning: `${muni.name} is ${coastKm} km from the nearest coastline at ${elevM}m elevation. Tsunamis and oceanic storm surges cannot reach this location under any plausible scenario. GeoClaw/MOST/COMCOT require coastal bathymetry unavailable for inland cities.`,
          mitigation_priority: [],
          scientific_label: 'Tsunami / Storm Surge — NOT APPLICABLE',
          assessment_type: 'not_applicable',
          primary_model_unavailable: 'GeoClaw, MOST, COMCOT (coastal bathymetry required)',
          fallback_model: 'None — geographically inapplicable',
        };
      }
    }

    if (normHazard.includes('cyclone')) {
      if (coastKm > 300) {
        return {
          applicable: false, risk_level: 'not_applicable',
          reasoning: `${muni.name} is ${coastKm} km from the coast. Tropical cyclone landfalls attenuate to tropical depression intensity beyond 250–300 km inland. Significant wind damage is scientifically implausible for this location.`,
          mitigation_priority: [],
          scientific_label: 'Cyclone — NOT APPLICABLE (inland city)',
          assessment_type: 'not_applicable',
        };
      }
    }

    if (normHazard.includes('landslide')) {
      if (elevM < 150 && !muni.state?.match(/Uttarakhand|Himachal|Sikkim|Meghalaya|Nagaland|Manipur|Mizoram|Arunachal|Jammu/i)) {
        return {
          applicable: false, risk_level: 'not_applicable',
          reasoning: `${muni.name} is at ${elevM}m elevation in flat to gently undulating terrain (state: ${muni.state}). Shallow landslides require slopes typically >15° — scientifically implausible for this terrain.`,
          mitigation_priority: [],
          scientific_label: 'Landslide — NOT APPLICABLE (flat terrain)',
          assessment_type: 'not_applicable',
        };
      }
    }

    // ── PROFILE-BASED APPLICABILITY ──────────────────────────────────────────
    const found = (profile.hazard_assessments || []).find((h: any) =>
      normHazard.includes(h.hazard.toLowerCase()) || h.hazard.toLowerCase().includes(normHazard)
    );

    return {
      applicable: found ? found.risk_level !== 'not_applicable' : true,
      risk_level: found ? (found.risk_level as any) : 'medium',
      reasoning: found
        ? found.reasoning
        : `Standard multi-hazard assessment applied based on geographic topology for ${muni.name}.`,
      mitigation_priority: found?.mitigation_notes ? [found.mitigation_notes] : ['Infrastructure reinforcement'],
      scientific_label: sci.label,
      assessment_type: sci.type,
    };
  }

  // ─── SIMULATION ORCHESTRATOR ─────────────────────────────────────────────
  /**
   * Routes each hazard to its dedicated scientific model.
   * NEVER mixes incompatible models.
   * NEVER silently uses a fallback without recording it in provenance.
   */
  public static executeHazardPropagation(
    hazardType: string,
    intensity: number,
    nodes: Record<string, GraphNode>,
    edges: GraphEdge[],
    telemetry: EnvironmentalTelemetry
  ): { affectedEdges: string[]; stats: Record<string, any> } {
    const affectedSet = new Set<string>();
    const stats: Record<string, any> = {
      total_corridors_analyzed: edges.length,
      bridges_structurally_compromised: 0,
      arterials_affected: 0,
      collapses_detected: 0,
      mean_severity: 0,
      model_used: 'unknown',
      scientific_label: 'Unknown Assessment',
      assessment_type: 'unknown',
    };

    const normIntensity = intensity > 1.0 ? intensity / 10.0 : intensity;
    const hType = hazardType.toLowerCase().trim();
    const sci = SCIENTIFIC_LABELS[hType] ?? SCIENTIFIC_LABELS['flood']!;
    stats.scientific_label = sci.label;
    stats.assessment_type = sci.type;

    let predictions: HazardPrediction[] = [];

    // ── ROUTE TO CORRECT SCIENTIFIC MODEL ────────────────────────────────────
    if (hType.includes('flood') || hType.includes('rain')) {
      // Primary: HEC-RAS — NOT AVAILABLE (missing hydraulic geometry + CWC gauge data)
      // Fallback (approved): TWI (Beven & Kirkby 1979)
      stats.model_used = 'TWI (Topographic Wetness Index) — Fallback from HEC-RAS';
      predictions = FloodModel.execute(nodes, edges, telemetry, normIntensity);

    } else if (hType.includes('earthquake') || hType.includes('seismic')) {
      // Primary: OpenQuake — NOT AVAILABLE (500MB+ cluster, 30-120min runtime, NDMA PSHA required)
      // Fallback (approved): Boore-Atkinson 2008 GMPE + HAZUS MR4 Fragility Curves
      stats.model_used = 'GMPE (Boore-Atkinson 2008) + HAZUS MR4 — Fallback from OpenQuake';
      predictions = EarthquakeModel.execute(nodes, edges, telemetry, normIntensity);

    } else if (hType.includes('landslide')) {
      // Primary: TRIGRS — NOT AVAILABLE (soil hydraulic property maps required)
      // Fallback (approved): SHALSTAB (Montgomery & Dietrich 1994)
      stats.model_used = 'SHALSTAB Approximation — Fallback from TRIGRS';
      predictions = LandslideModel.execute(nodes, edges, telemetry, normIntensity);

    } else if (hType.includes('cyclone')) {
      // Primary: WRF — NOT AVAILABLE (NWP cluster, 4-12h runtime)
      // Fallback (approved): Holland (1980) parametric wind model
      stats.model_used = 'Holland (1980) Parametric Wind — Fallback from WRF';
      predictions = CycloneModel.execute(edges, telemetry, normIntensity);

    } else if (hType.includes('heat') || hType.includes('heatwave') || hType.includes('temperature')) {
      // UTCI: FULLY IMPLEMENTED (analytical, ISO 15743)
      stats.model_used = 'UTCI (ISO 15743) + Material Thermal Degradation';
      predictions = HeatwaveModel.execute(nodes, edges, telemetry, normIntensity);

    } else if (hType.includes('wildfire') || hType.includes('fire')) {
      // Primary: FARSITE/FlamMap — NOT AVAILABLE (fuel moisture rasters + compiled binary required)
      // Fallback (approved): NDVI Vegetation Ignition Susceptibility
      // ⚠ SCIENTIFIC DISCLAIMER: This is a SUSCEPTIBILITY ASSESSMENT, not a SIMULATION
      stats.model_used = 'NDVI Vegetation Susceptibility — Fallback from FARSITE';
      predictions = WildfireModel.execute(edges, telemetry, normIntensity);

    } else {
      // Default: treat as flood susceptibility (most common urban hazard)
      stats.model_used = 'TWI (Topographic Wetness Index) — Default for unrecognized hazard type';
      predictions = FloodModel.execute(nodes, edges, telemetry, normIntensity);
    }

    // ── APPLY PREDICTIONS TO GRAPH EDGES ─────────────────────────────────────
    // Build O(1) lookup map first — edges.find() inside forEach was O(n²) and caused a 20-minute hang
    // on large cities like Hyderabad (251,474 edges × 251,474 predictions = 63 billion comparisons)
    const edgeById = new Map<string, GraphEdge>();
    edges.forEach(e => edgeById.set(e.id, e));

    let totalSeverity = 0;

    predictions.forEach(pred => {
      const edge = edgeById.get(pred.edge_id);
      if (!edge) return;

      // Attach provenance to every edge regardless of damage state
      edge.provenance = pred.provenance;

      if (pred.damage_state !== 'none' && pred.severity > 0.1) {
        affectedSet.add(pred.edge_id);
        edge.damage_state = pred.damage_state;
        totalSeverity += pred.severity;

        if (edge.damage_state === 'flooded') {
          stats.arterials_affected++;
          edge.current_speed_kmh = Math.round((edge.speed_limit_kmh ?? 50) * 0.2);
          if (!edge.satellite_observations) edge.satellite_observations = {};
          edge.satellite_observations.flood_water_depth_m = Math.round(pred.severity * 2.5 * 100) / 100;

        } else if (edge.damage_state === 'collapsed') {
          stats.collapses_detected++;
          if (edge.is_bridge) stats.bridges_structurally_compromised++;
          edge.current_speed_kmh = 0;
          if (!edge.traffic_status) edge.traffic_status = {};
          edge.traffic_status.is_road_closed = true;
          edge.traffic_status.closure_reason = 'STRUCTURAL COLLAPSE — road closed';

        } else if (edge.damage_state === 'subsided') {
          edge.current_speed_kmh = Math.max(5, Math.round((edge.speed_limit_kmh ?? 50) * 0.4));

        } else if (edge.damage_state === 'obstructed') {
          edge.current_speed_kmh = Math.max(5, Math.round((edge.speed_limit_kmh ?? 50) * 0.3));
        }

        // RCI degradation proportional to severity
        const rciDrop = Math.round((edge.rci || 70) * pred.severity * 0.8);
        edge.rci = Math.max(5, (edge.rci || 70) - rciDrop);
        edge.failure_probability = pred.severity;
      }
    });

    stats.mean_severity = affectedSet.size > 0 ? Math.round((totalSeverity / affectedSet.size) * 100) / 100 : 0;

    console.log(
      `[${stats.scientific_label}] Model: ${stats.model_used}. ` +
      `Corridors analyzed: ${edges.length}. Affected: ${affectedSet.size}. ` +
      `Mean severity: ${(stats.mean_severity * 100).toFixed(1)}%.`
    );

    return { affectedEdges: Array.from(affectedSet), stats };
  }
}
