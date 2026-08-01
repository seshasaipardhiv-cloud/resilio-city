import { GraphNode, GraphEdge, EnvironmentalTelemetry } from '../types.js';
import { HazardPrediction } from './flood_model.js';

export class EarthquakeModel {
  /**
   * Evaluates earthquake structural damage using GMPE (Ground Motion Prediction Equation) 
   * and HAZUS Fragility Curves for bridges/roads.
   */
  public static execute(
    nodes: Record<string, GraphNode>,
    edges: GraphEdge[],
    telemetry: EnvironmentalTelemetry,
    intensity: number
  ): HazardPrediction[] {
    const predictions: HazardPrediction[] = [];
    const timestamp = new Date().toISOString();

    // Map scenario intensity (0-1) to an approximated Peak Ground Acceleration (PGA in g)
    // For a major scenario, PGA might range from 0.1g (light) to 0.8g (severe)
    const basePga = intensity * 0.8;

    edges.forEach((edge) => {
      // 1. Determine local site amplification based on surface (very simplified site class proxy)
      // Unpaved/soft soils amplify shaking
      let siteAmplification = 1.0;
      if (edge.surface === 'unpaved') siteAmplification = 1.3;
      else if (edge.surface === 'concrete') siteAmplification = 0.9;
      
      const localPga = basePga * siteAmplification;

      // 2. Apply HAZUS Fragility Curve logic
      // HAZUS uses lognormal CDF. We will approximate the median PGA (theta) and dispersion (beta)
      // for different road/bridge classes.
      let medianPga = 0.6; // theta
      const beta = 0.4;    // standard deviation
      
      if (edge.is_bridge || edge.type === 'bridge_deck' || edge.type === 'flyover') {
        // Bridges are structurally more fragile to PGA than at-grade roads
        medianPga = 0.4;
      } else {
        // At-grade roads are fairly resilient to ground shaking unless there is liquefaction
        medianPga = 0.8;
      }

      // Age degradation: older infrastructure shifts the median PGA lower
      const currentYear = new Date().getFullYear();
      const ageYears = currentYear - (edge.construction_year || 2010);
      const ageDegradation = Math.min(0.2, ageYears * 0.005);
      medianPga -= ageDegradation;

      // Approximate the Lognormal CDF for probability of exceeding 'extensive' damage state
      // P(D >= Extensive | PGA) = Phi( (ln(PGA) - ln(theta)) / beta )
      let failureProb = 0.0;
      if (localPga > 0.01) {
        const z = (Math.log(localPga) - Math.log(medianPga)) / beta;
        failureProb = EarthquakeModel.approximatePhi(z);
      }

      let damageState: HazardPrediction['damage_state'] = 'none';
      if (failureProb > 0.5) {
        damageState = edge.is_bridge ? 'collapsed' : 'subsided';
      }

      predictions.push({
        edge_id: edge.id,
        damage_state: damageState,
        severity: failureProb,
        provenance: {
          model_name: 'HAZUS Fragility Curves (MH MR4) + Attenuation Proxy',
          version: '1.0.0',
          input_datasets: ['OSM Highway Tags', 'Synthetic Age Distribution'],
          prediction_timestamp: timestamp,
          confidence_pct: 55,
          limitations: [
            'No local geotechnical shear wave velocity (Vs30) data for accurate site amplification',
            'HAZUS curves are calibrated for US infrastructure, not India-specific (requires NDMA calibration)',
            'PGA is derived from scenario scalar, not a rigorous spatial attenuation model from a specific fault'
          ],
          calibration_status: 'Transferred Approximation',
          validation_metrics: {
            dataset: 'FEMA HAZUS Technical Manual',
            metric: 'Theoretical applicability',
            value: 'N/A'
          }
        }
      });
    });

    return predictions;
  }

  /**
   * Approximation of the standard normal cumulative distribution function (Phi)
   * using the error function (erf) approximation.
   */
  private static approximatePhi(x: number): number {
    // Constants for Abramowitz and Stegun approximation
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2.0);
    const t = 1.0 / (1.0 + 0.3275911 * x);
    const erf = 1.0 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return 0.5 * (1.0 + sign * erf);
  }
}
