import { GraphNode, GraphEdge, EnvironmentalTelemetry, ModelProvenance } from '../types.js';

export interface HazardPrediction {
  edge_id: string;
  damage_state: 'none' | 'flooded' | 'subsided' | 'collapsed' | 'obstructed' | null;
  /** 0.0–1.0 severity driving the 4-tier damage color scheme */
  severity: number;
  provenance: ModelProvenance;
}

/**
 * Flood Model — TWI (Topographic Wetness Index) Approximation
 *
 * PRIMARY MODELS REQUESTED: HEC-RAS, LISFLOOD-FP, SWMM, CaMa-Flood
 * STATUS: Not Implementable (missing hydraulic geometry files, cross-section surveys,
 *         sub-10m DEM, underground drainage network GIS for Indian cities)
 * FALLBACK (APPROVED): TWI using SRTM 90m DEM + Open-Meteo rainfall
 * SCIENTIFIC BASIS: Beven & Kirkby (1979). "A physically based variable contributing
 *                   area model of basin hydrology." Hydrol. Sci. Bull.
 * UNCERTAINTY: ±30% at 65% confidence for uncalibrated TWI
 */
export class FloodModel {
  public static execute(
    nodes: Record<string, GraphNode>,
    edges: GraphEdge[],
    telemetry: EnvironmentalTelemetry,
    intensity: number
  ): HazardPrediction[] {
    const predictions: HazardPrediction[] = [];
    const timestamp = new Date().toISOString();
    const rainfall = telemetry.rainfall_mm > 0 ? telemetry.rainfall_mm : intensity * 150;

    edges.forEach((edge) => {
      const u = nodes[edge.source];
      const v = nodes[edge.target];
      if (!u || !v) return;

      const elU = u.elevation_m ?? 0;
      const elV = v.elevation_m ?? 0;
      const heightDiff = Math.abs(elU - elV);
      // Slope: tan(β) — avoid division by zero
      const slope = Math.max(0.001, heightDiff / Math.max(1, edge.length_meters));

      // Specific catchment area proxy 'a' — approximated from waterway proximity
      let catchmentAreaProxy = 100;
      if (edge.type === 'river' || edge.type === 'stream') {
        catchmentAreaProxy = 10000;
      } else if (edge.is_bridge) {
        catchmentAreaProxy = 5000;
      }

      // TWI = ln(a / tan(β)) — Beven & Kirkby (1979)
      const twi = Math.log(catchmentAreaProxy / slope);

      // Normalize TWI to 0–1 (urban TWI typically 5–15)
      const normalizedTwi = Math.max(0, Math.min(1, (twi - 5) / 10));

      // Severity scaled by rainfall against 200mm/day extreme threshold
      let severity = normalizedTwi * (rainfall / 200);
      const floodThreshold = 0.6;

      let damageState: HazardPrediction['damage_state'] = 'none';
      if (severity > floodThreshold && !edge.is_bridge) {
        damageState = 'flooded';
      }

      predictions.push({
        edge_id: edge.id,
        damage_state: damageState,
        severity: Math.min(1.0, severity),
        provenance: {
          model_name: 'Topographic Wetness Index (TWI)',
          version: '1.1.0',
          fallback_from: 'HEC-RAS (unavailable: missing hydraulic geometry files & CWC gauge data for India)',
          input_datasets: ['SRTM 90m DEM (elevation proxy)', 'Open-Meteo Rainfall API', 'OSM Waterway Tags'],
          prediction_timestamp: timestamp,
          confidence_pct: 65,
          confidence_interval_lower_pct: -30,
          confidence_interval_upper_pct: 30,
          rmse: 'N/A (uncalibrated)',
          mae: 'N/A (uncalibrated)',
          calibration_dataset: 'None — transferred approximation from literature',
          scientific_publication: 'Beven & Kirkby (1979). Hydrol. Sci. Bull. 24(1):43-69',
          limitations: [
            'Lacks high-resolution LiDAR DEM (using SRTM 90m)',
            'Does not model underground municipal drainage network capacity',
            'Catchment area is approximated from OSM tags, not surveyed',
            'Fallback from HEC-RAS — hydraulic geometry datasets unavailable for Indian cities',
          ],
          calibration_status: 'Transferred Approximation',
          validation_metrics: {
            dataset: 'Beven & Kirkby (1979) theoretical validation',
            metric: 'Theoretical applicability',
            value: 'Transferred — not locally calibrated',
          },
        },
      });
    });

    return predictions;
  }
}
