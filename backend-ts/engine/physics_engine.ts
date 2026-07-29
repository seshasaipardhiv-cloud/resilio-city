import { GraphNode, GraphEdge, EnvironmentalTelemetry } from './types.js';
import { DisasterPhysicsEngine } from './disaster_physics.js';

/**
 * Backward Compatible Physics Simulation Engine
 * Delegates to production DisasterPhysicsEngine for precise terrain, drainage, river proximity,
 * and earthquake PGA structural degradation calculations.
 */
export class PhysicsSimulationEngine {
  public static assessHazardApplicability(cityId: string, hazardType: string) {
    return DisasterPhysicsEngine.assessHazardApplicability(cityId, hazardType);
  }

  public static runSimulation(
    disasterType: string,
    intensity: number, // scale 1-10 or 0-1
    nodes: Record<string, GraphNode>,
    edges: GraphEdge[],
    telemetry: EnvironmentalTelemetry,
    targetEdgeIds?: string[]
  ): { affectedEdges: string[]; structuralStats: Record<string, any> } {
    // If targeted disaster, filter active simulation scope while maintaining structural consistency
    const targetSet = targetEdgeIds && targetEdgeIds.length > 0 ? new Set(targetEdgeIds) : null;
    let edgesToAnalyze = edges;
    if (targetSet) {
      edgesToAnalyze = edges.filter(e => targetSet.has(e.id) || (e.road_name && targetSet.has(e.road_name)));
    }

    const { affectedEdges, stats } = DisasterPhysicsEngine.executeHazardPropagation(
      disasterType,
      intensity,
      nodes,
      edgesToAnalyze,
      telemetry
    );

    return {
      affectedEdges,
      structuralStats: {
        total_edges_assessed: edges.length,
        bridges_damaged: stats.bridges_structurally_compromised || 0,
        arterials_flooded: stats.arterials_submerged || 0,
        collapses_detected: stats.seismic_collapses_detected || 0,
        average_network_rci_drop: stats.mean_rci_degradation || 0
      }
    };
  }
}
