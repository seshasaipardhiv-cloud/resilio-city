import { GraphEdge } from './types.js';

/**
 * Infrastructure Intelligence Engine
 * Assesses physical asset integrity, structural aging models, Road Condition Index (RCI),
 * and disaster-specific vulnerability scores across bridges, tunnels, and arterial roads.
 */
export class InfrastructureIntelligenceEngine {
  public static evaluateAsset(edge: GraphEdge, isCoastalOrRiverside: boolean = false): void {
    const currentYear = new Date().getFullYear();
    const age = currentYear - (edge.construction_year || (edge.type === 'bridge_deck' ? 2010 : 2016));

    // Calculate base Road Condition Index (RCI from 0 to 100)
    let baseRci = 96 - Math.round(age * 1.8);
    if (edge.surface === 'unpaved') {
      baseRci -= 25;
    } else if (edge.surface === 'asphalt' && edge.traffic_volume_vph > 7000) {
      baseRci -= 10; // Heavy freight and volume wear on asphalt
    }
    edge.rci = Math.max(15, Math.min(100, baseRci));

    // Earthquake vulnerability mechanics
    // Bridges with older construction and concrete spans have specific seismic shear susceptibility
    if (edge.type === 'bridge_deck' || edge.type === 'flyover') {
      edge.earthquake_vulnerability = Math.min(0.95, Number(((age * 0.025) + 0.15).toFixed(2)));
    } else if (edge.type === 'tunnel') {
      edge.earthquake_vulnerability = Number(((age * 0.018) + 0.20).toFixed(2));
    } else {
      edge.earthquake_vulnerability = Number(((100 - edge.rci) / 250).toFixed(2));
    }

    // Flood vulnerability mechanics
    if (isCoastalOrRiverside || edge.road_name.toLowerCase().includes('yamuna') || edge.road_name.toLowerCase().includes('sea') || edge.road_name.toLowerCase().includes('coastal') || edge.road_name.toLowerCase().includes('marine') || edge.road_name.toLowerCase().includes('lake')) {
      edge.flood_vulnerability = Math.min(0.98, Number((0.45 + (100 - edge.rci) * 0.006).toFixed(2)));
    } else if (edge.type === 'tunnel' || edge.type === 'service_road') {
      edge.flood_vulnerability = 0.75; // Subsurface tunneling drainage susceptibility
    } else if (edge.type === 'bridge_deck' || edge.type === 'flyover') {
      edge.flood_vulnerability = 0.15; // Elevated structures escape direct ponding
    } else {
      edge.flood_vulnerability = Number(((100 - edge.rci) * 0.005 + 0.10).toFixed(2));
    }

    // Baseline probabilistic failure indicator
    const stressRatio = edge.traffic_volume_vph / Math.max(1, edge.lanes * 950);
    const structVn = (edge.earthquake_vulnerability + edge.flood_vulnerability) / 2;
    edge.failure_probability = Number(Math.min(0.99, ((100 - edge.rci) / 200) + (structVn * 0.3) + (stressRatio * 0.1)).toFixed(2));
  }
}
