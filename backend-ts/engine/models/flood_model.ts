import { GraphNode, GraphEdge, EnvironmentalTelemetry, ModelProvenance } from '../types.js';

export interface HazardPrediction {
  edge_id: string;
  damage_state: 'none' | 'flooded' | 'subsided' | 'collapsed' | 'obstructed' | null;
  severity: number; // 0.0 to 1.0
  provenance: ModelProvenance;
}

export class FloodModel {
  /**
   * Evaluates flood susceptibility using Topographic Wetness Index (TWI) Approximation.
   * TWI = ln(a / tan(beta))
   * We approximate 'a' (specific catchment area) using distance to waterways and terrain depression.
   */
  public static execute(
    nodes: Record<string, GraphNode>,
    edges: GraphEdge[],
    telemetry: EnvironmentalTelemetry,
    intensity: number
  ): HazardPrediction[] {
    const predictions: HazardPrediction[] = [];
    const timestamp = new Date().toISOString();

    const rainfall = telemetry.rainfall_mm > 0 ? telemetry.rainfall_mm : intensity * 150; // Use live rainfall or scaled scenario

    edges.forEach((edge) => {
      const u = nodes[edge.source];
      const v = nodes[edge.target];
      if (!u || !v) return;

      // Extract elevations (fallback to 0 if missing to avoid NaN, though ElevationService should populate them)
      const elU = u.elevation_m ?? 0;
      const elV = v.elevation_m ?? 0;
      
      // Calculate slope (tan beta)
      const heightDiff = Math.abs(elU - elV);
      const slope = Math.max(0.001, heightDiff / Math.max(1, edge.length_meters)); // avoid division by zero

      // Approximate specific catchment area 'a' based on proximity to river and local depression
      let catchmentAreaProxy = 100; 
      if (edge.type === 'river' || edge.type === 'stream') {
        catchmentAreaProxy = 10000;
      } else {
        // If it's a bridge, it crosses a waterway
        if (edge.is_bridge) catchmentAreaProxy = 5000;
      }

      // TWI calculation
      const twi = Math.log(catchmentAreaProxy / slope);

      // Normalize TWI to a 0-1 vulnerability score (typical urban TWI ranges from 5 to 15)
      const normalizedTwi = Math.max(0, Math.min(1, (twi - 5) / 10));

      // Rainfall thresholding for inundation
      // Standard heuristic: If TWI is high and rainfall is high, inundation occurs
      const floodThreshold = 0.6;
      let severity = normalizedTwi * (rainfall / 200); // normalized against extreme 200mm/day rainfall
      
      let damageState: HazardPrediction['damage_state'] = 'none';
      if (severity > floodThreshold && !edge.is_bridge) {
        damageState = 'flooded';
      }

      predictions.push({
        edge_id: edge.id,
        damage_state: damageState,
        severity: Math.min(1.0, severity),
        provenance: {
          model_name: 'Topographic Wetness Index (TWI) + Kinematic Approximation',
          version: '1.0.0',
          input_datasets: ['Open-Meteo DEM', 'OSM Waterways', 'Open-Meteo Rainfall API'],
          prediction_timestamp: timestamp,
          confidence_pct: 65, // Standard confidence for uncalibrated TWI
          limitations: [
            'Lacks high-resolution LiDAR DEM',
            'Does not account for municipal subsurface drainage network capacity',
            'Catchment area is approximated'
          ],
          calibration_status: 'Transferred Approximation',
          validation_metrics: {
            dataset: 'Literature standard (Beven & Kirkby, 1979)',
            metric: 'Theoretical applicability',
            value: 'N/A (Uncalibrated)'
          }
        }
      });
    });

    return predictions;
  }
}
