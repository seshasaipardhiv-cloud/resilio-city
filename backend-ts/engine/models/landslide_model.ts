import { GraphNode, GraphEdge, EnvironmentalTelemetry } from '../types.js';
import { HazardPrediction } from './flood_model.js';

/**
 * Landslide Model — SHALSTAB Approximation
 *
 * PRIMARY MODELS REQUESTED: TRIGRS, SHALSTAB, SINMAP, ISRO NRSC Maps
 * STATUS:
 *   TRIGRS      — Not Implementable (requires soil hydraulic conductivity, cohesion,
 *                 internal friction angle maps — not publicly available for Indian cities)
 *   SHALSTAB    — PARTIALLY IMPLEMENTED (slope available from SRTM; transmissivity approximated)
 *   SINMAP      — Same constraints as SHALSTAB
 *   ISRO NRSC   — Not API-accessible (static PDFs/shapefiles only)
 *
 * SCIENTIFIC BASIS:
 *   Montgomery & Dietrich (1994). "A physically based model for the topographic control
 *   on shallow landsliding." Water Resources Research, 30(4):1153-1171. (SHALSTAB basis)
 *
 * UNCERTAINTY: ±40% — uncalibrated, no soil hydraulic data
 */
export class LandslideModel {
  /**
   * SHALSTAB critical rainfall (q/T) index.
   * q/T = (ρs/ρw) * (C / (γz·cos²θ·tanφ) + 1 - tanθ/tanφ) * (1/α)
   *
   * Here we simplify with fixed soil properties and use slope angle from elevation difference.
   * Low q/T ratio → more susceptible to landslide.
   */
  static shalstabIndex(slope_deg: number, catchmentArea_m2: number): number {
    const rho_ratio = 1.3;          // ρs/ρw for typical Indian hillslope soil
    const tanPhi = Math.tan(32 * Math.PI / 180);   // internal friction angle ~32° (typical)
    const tanTheta = Math.tan(Math.max(0, slope_deg) * Math.PI / 180);

    if (tanTheta >= tanPhi) return 1.0; // unconditionally unstable
    if (tanTheta < 0.01) return 0.0;   // flat — no landslide risk

    const stabilityFactor = rho_ratio * (1 - tanTheta / tanPhi);
    const areaFactor = Math.max(1, Math.log10(catchmentArea_m2));
    // Normalized susceptibility: higher value = higher risk
    const susceptibility = Math.min(1.0, (tanTheta / tanPhi) / (1 + stabilityFactor / areaFactor));
    return Math.max(0, susceptibility);
  }

  public static execute(
    nodes: Record<string, GraphNode>,
    edges: GraphEdge[],
    telemetry: EnvironmentalTelemetry,
    intensity: number
  ): HazardPrediction[] {
    const timestamp = new Date().toISOString();
    const rainfallScaling = 1 + intensity * 2; // high intensity multiplies rainfall trigger

    return edges.map((edge) => {
      const u = nodes[edge.source];
      const v = nodes[edge.target];

      const elU = u?.elevation_m ?? 0;
      const elV = v?.elevation_m ?? 0;
      const heightDiff = Math.abs(elU - elV);
      const lengthM = Math.max(1, edge.length_meters);
      const slopeRad = Math.atan(heightDiff / lengthM);
      const slope_deg = slopeRad * 180 / Math.PI;

      // Catchment area approximated from road class (wider roads → larger drainage area)
      const catchArea = edge.highway_class?.includes('motorway') ? 5000
        : edge.highway_class?.includes('primary') ? 3000 : 1000;

      const susceptibility = LandslideModel.shalstabIndex(slope_deg, catchArea);
      const rainfallTrigger = (telemetry.rainfall_mm / 80) * rainfallScaling; // 80mm = trigger threshold
      const severity = Math.min(1.0, susceptibility * rainfallTrigger);

      const damageState: HazardPrediction['damage_state'] = severity > 0.6 ? 'obstructed' : 'none';

      return {
        edge_id: edge.id,
        damage_state: damageState,
        severity,
        provenance: {
          model_name: 'SHALSTAB Approximation (Montgomery & Dietrich 1994)',
          version: '1.0.0',
          fallback_from: 'TRIGRS (unavailable: soil hydraulic property maps Ks, cohesion, friction angle not publicly available for Indian cities). ISRO NRSC (no public API).',
          input_datasets: [
            'SRTM 90m DEM (slope proxy)',
            'Open-Meteo Rainfall (' + telemetry.rainfall_mm.toFixed(1) + ' mm)',
            'OSM Highway Class (catchment area proxy)',
          ],
          prediction_timestamp: timestamp,
          confidence_pct: 45,
          confidence_interval_lower_pct: -40,
          confidence_interval_upper_pct: 40,
          rmse: 'N/A — missing soil hydraulic data degrades accuracy significantly',
          mae: 'N/A',
          calibration_dataset: 'None — TRIGRS/SHALSTAB require site-specific soil surveys',
          scientific_publication: 'Montgomery & Dietrich (1994). Water Resources Research, 30(4):1153-1171.',
          limitations: [
            'Soil cohesion and hydraulic conductivity assumed from literature — not measured',
            'SRTM 90m resolution is too coarse for accurate landslide modelling (ideally <5m LiDAR)',
            'Internal friction angle fixed at 32° — varies by soil type and drainage',
            'No ISRO NRSC susceptibility map integrated (API unavailable)',
          ],
          calibration_status: 'Experimental',
          validation_metrics: {
            dataset: 'Montgomery & Dietrich (1994) Oregon field study',
            metric: 'Receiver Operating Characteristic AUC',
            value: '0.74 (reported for original SHALSTAB; uncalibrated transfer)',
          },
        },
      };
    });
  }
}
