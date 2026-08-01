import { GraphNode, GraphEdge, EnvironmentalTelemetry } from '../types.js';
import { HazardPrediction } from './flood_model.js';

export class LandslideModel {
  /**
   * Evaluates landslide susceptibility using a simplified kinematic slope + rainfall proxy.
   * Ls = (Slope / 45) * (Rainfall / 200) * SurfaceFactor
   */
  public static execute(
    nodes: Record<string, GraphNode>,
    edges: GraphEdge[],
    telemetry: EnvironmentalTelemetry,
    intensity: number
  ): HazardPrediction[] {
    const predictions: HazardPrediction[] = [];
    const timestamp = new Date().toISOString();

    const rainfall = telemetry.rainfall_mm > 0 ? telemetry.rainfall_mm : intensity * 200;

    edges.forEach((edge) => {
      const u = nodes[edge.source];
      const v = nodes[edge.target];
      if (!u || !v) return;

      const elU = u.elevation_m ?? 0;
      const elV = v.elevation_m ?? 0;
      
      const heightDiff = Math.abs(elU - elV);
      const slopeRatio = heightDiff / Math.max(1, edge.length_meters);
      
      // Convert slope ratio to degrees approximately (arctan)
      const slopeDegrees = Math.atan(slopeRatio) * (180 / Math.PI);

      // In urban contexts, paved surfaces resist landslides better than unpaved
      let surfaceFactor = 1.0;
      if (edge.surface === 'concrete') surfaceFactor = 0.6;
      else if (edge.surface === 'asphalt') surfaceFactor = 0.8;
      else if (edge.surface === 'unpaved') surfaceFactor = 1.5;

      // Calculate landslide susceptibility
      // Normalizing slope to a critical threshold (e.g., 45 degrees)
      const slopeFactor = Math.min(1.0, slopeDegrees / 45);
      const rainFactor = Math.min(1.0, rainfall / 200);
      
      let severity = slopeFactor * rainFactor * surfaceFactor;
      
      // Edge cases: Flat terrain cannot have a landslide
      if (slopeDegrees < 5) {
        severity = 0;
      }

      let damageState: HazardPrediction['damage_state'] = 'none';
      if (severity > 0.6) {
        damageState = 'obstructed';
      }

      predictions.push({
        edge_id: edge.id,
        damage_state: damageState,
        severity: Math.min(1.0, severity),
        provenance: {
          model_name: 'Kinematic Slope & Rainfall Proxy',
          version: '1.0.0',
          input_datasets: ['Open-Meteo DEM', 'Open-Meteo Rainfall API'],
          prediction_timestamp: timestamp,
          confidence_pct: 40,
          limitations: [
            'Lacks geological substrate data (soil/rock type)',
            'Lacks vegetation cover (NDVI) mapping',
            'Cannot model deep-seated landslides, only shallow rainfall-induced debris flows'
          ],
          calibration_status: 'Experimental',
          validation_metrics: {
            dataset: 'None',
            metric: 'N/A',
            value: 'Uncalibrated Heuristic'
          }
        }
      });
    });

    return predictions;
  }
}
