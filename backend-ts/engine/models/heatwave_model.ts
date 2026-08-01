import { GraphNode, GraphEdge, EnvironmentalTelemetry } from '../types.js';
import { HazardPrediction } from './flood_model.js';

export class HeatwaveModel {
  /**
   * Evaluates infrastructure degradation due to extreme heat using UTCI approximation.
   * Asphalt rutting and concrete thermal expansion occur when surface temps exceed material tolerances.
   */
  public static execute(
    nodes: Record<string, GraphNode>,
    edges: GraphEdge[],
    telemetry: EnvironmentalTelemetry,
    intensity: number
  ): HazardPrediction[] {
    const predictions: HazardPrediction[] = [];
    const timestamp = new Date().toISOString();

    // Use live temperature if extreme, otherwise scale scenario intensity
    const ambientTempC = telemetry.temperature_c > 35 ? telemetry.temperature_c : 35 + (intensity * 15); // Up to 50C

    edges.forEach((edge) => {
      // Surface temperature is typically higher than ambient due to Urban Heat Island (UHI) and albedo
      let albedoFactor = 1.0;
      let criticalTempC = 60; // Temperature at which material starts failing rapidly
      
      if (edge.surface === 'asphalt') {
        albedoFactor = 1.3; // Dark asphalt absorbs more heat
        criticalTempC = 55; // Asphalt binder softens, causing rutting
      } else if (edge.surface === 'concrete') {
        albedoFactor = 1.1; 
        criticalTempC = 65; // Concrete thermal buckling
      } else if (edge.surface === 'unpaved') {
        albedoFactor = 1.0;
        criticalTempC = 70; // Dirt roads dry out but don't melt
      }

      const surfaceTempC = ambientTempC * albedoFactor;
      
      // Calculate thermal degradation severity
      let severity = 0.0;
      if (surfaceTempC > criticalTempC) {
        severity = Math.min(1.0, (surfaceTempC - criticalTempC) / 15.0);
      }

      let damageState: HazardPrediction['damage_state'] = 'none';
      if (severity > 0.5) {
        damageState = 'subsided'; // Using subsided to represent severe rutting/buckling
      }

      predictions.push({
        edge_id: edge.id,
        damage_state: damageState,
        severity: Math.min(1.0, severity),
        provenance: {
          model_name: 'UTCI Material Degradation Approximation',
          version: '1.0.0',
          input_datasets: ['Open-Meteo Temperature', 'OSM Surface Tags'],
          prediction_timestamp: timestamp,
          confidence_pct: 60,
          limitations: [
            'Lacks micro-level Urban Heat Island (UHI) thermal mapping',
            'Albedo factor is a hardcoded proxy based on surface type',
            'Does not account for traffic load compounding rutting effects'
          ],
          calibration_status: 'Experimental',
          validation_metrics: {
            dataset: 'Material Science Benchmarks',
            metric: 'Softening Point Correlation',
            value: 'Uncalibrated'
          }
        }
      });
    });

    return predictions;
  }
}
