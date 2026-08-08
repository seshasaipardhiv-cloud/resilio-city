import { GraphEdge, EnvironmentalTelemetry } from '../types.js';
import { HazardPrediction } from './flood_model.js';

export class WildfireModel {

  static vegetationIgnitionIndex(ndvi: number, windSpeedMs: number, tempC: number, rh: number): number {
    // Dead fuel moisture proxy: Fuel Moisture = 0.942*(RH^0.679) + 0.000499*exp(0.1*RH) + 0.18*(21.1+273.15-tempC)*(1-exp(-0.115*RH))
    // We use a simplified linear approximation:
    const fuelMoistureProxy = Math.max(0, Math.min(1, (rh / 100) * 0.7 + (40 - Math.max(25, tempC)) / 100));
    const ignitionRisk = Math.max(0, Math.min(1, ndvi * (1 - fuelMoistureProxy)));
    // Wind multiplier: Rothermel (1972) spread rate proportional to wind speed
    const windMultiplier = 1 + windSpeedMs * 0.08;
    return Math.min(1.0, ignitionRisk * windMultiplier);
  }

  /**
   * Approximate NDVI from road surface type — proxy for roadside vegetation.
   * Urban roads (asphalt) have minimal roadside vegetation.
   * Rural/unpaved roads are surrounded by vegetation.
   */
  static ndviProxy(highway_class?: string, surface?: string): number {
    // Motorway/trunk = largely paved → low vegetation exposure
    if (highway_class?.includes('motorway') || highway_class?.includes('trunk')) return 0.05;
    // Primary/secondary roads = mixed urban-peri-urban
    if (highway_class?.includes('primary') || highway_class?.includes('secondary')) return 0.15;
    // Tertiary/residential = more vegetation
    if (highway_class?.includes('tertiary') || highway_class?.includes('residential')) return 0.25;
    // Unpaved roads in rural/forest context
    if (surface === 'unpaved') return 0.45;
    return 0.10;
  }

  public static execute(
    edges: GraphEdge[],
    telemetry: EnvironmentalTelemetry,
    intensity: number
  ): HazardPrediction[] {
    const timestamp = new Date().toISOString();
    // Intensity scalar amplifies temperature and wind — drought scenario
    const tempC = telemetry.temperature_celsius + intensity * 10;
    const rh = Math.max(10, telemetry.humidity_percent - intensity * 30);
    const windMs = telemetry.wind_speed_kmh / 3.6 + intensity * 5;

    return edges.map((edge) => {
      const ndvi = WildfireModel.ndviProxy(edge.highway_class, edge.surface);
      const susceptibility = WildfireModel.vegetationIgnitionIndex(ndvi, windMs, tempC, rh);

      // Road itself doesn't burn — obstructions from fallen trees / roadside fires
      const damageState: HazardPrediction['damage_state'] = susceptibility > 0.5 ? 'obstructed' : 'none';

      return {
        edge_id: edge.id,
        damage_state: damageState,
        severity: Math.min(1.0, susceptibility),
        provenance: {
          model_name: 'NDVI Vegetation Ignition Susceptibility (Chuvieco & Congalton 1989)',
          version: '1.0.0',
          fallback_from: 'FARSITE (unavailable: fuel moisture maps, 40-class fuel models, FORTRAN binary required). FlamMap (same). WRF-Fire (NWP cluster, 4-12h runtime).',
          input_datasets: [
            'Open-Meteo Temperature (' + tempC.toFixed(1) + '°C)',
            'Open-Meteo Relative Humidity (' + rh.toFixed(0) + '%)',
            'Open-Meteo Wind Speed (' + (windMs * 3.6).toFixed(1) + ' km/h)',
            'OSM Highway + Surface Tags (NDVI proxy)',
          ],
          prediction_timestamp: timestamp,
          confidence_pct: 35,
          confidence_interval_lower_pct: -50,
          confidence_interval_upper_pct: 50,
          rmse: 'N/A — no fuel moisture data, no local fire history',
          mae: 'N/A',
          calibration_dataset: 'None — NDVI proxy, not calibrated to observed fire events',
          scientific_publication: 'Chuvieco & Congalton (1989). Remote Sens. Environ. 29(2):147-159. Rothermel (1972). USDA INT-115.',
          limitations: [
            '⚠ THIS IS A SUSCEPTIBILITY ASSESSMENT — NOT A WILDFIRE SIMULATION',
            'FARSITE/FlamMap not implementable: fuel moisture rasters and compiled binary unavailable',
            'NDVI approximated from road class — not from satellite imagery (no real-time API)',
            'Fuel moisture estimated from temperature + humidity proxy — not measured',
            'Wind direction not modelled — directional spread not computed',
            'No fire history or ignition point available',
          ],
          calibration_status: 'Experimental',
          validation_metrics: {
            dataset: 'Chuvieco & Congalton (1989) Mediterranean validation',
            metric: 'Area Under ROC Curve (transferred)',
            value: '0.68 — uncalibrated transfer to Indian urban context',
          },
        },
      };
    });
  }
}
