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

    const affectedSet = new Set<string>();
    const totalStats = {
      total_edges_assessed: edges.length,
      bridges_damaged: 0,
      arterials_flooded: 0,
      collapses_detected: 0,
      average_network_rci_drop: 0
    };

    // Temporal Simulation: Step 1 (Primary Hazard), Step 2 & 3 (Cascades)
    const timeSteps = 3;
    let currentPrimaryAffected: string[] = [];

    for (let step = 1; step <= timeSteps; step++) {
      if (step === 1) {
        // Step 1: Initial Primary Hazard Impact
        const { affectedEdges, stats } = DisasterPhysicsEngine.executeHazardPropagation(
          disasterType,
          intensity,
          nodes,
          edgesToAnalyze,
          telemetry
        );

        affectedEdges.forEach(id => affectedSet.add(id));
        currentPrimaryAffected = affectedEdges;

        totalStats.bridges_damaged += stats.bridges_structurally_compromised || 0;
        totalStats.arterials_flooded += stats.arterials_submerged || 0;
        totalStats.collapses_detected += stats.seismic_collapses_detected || 0;
        totalStats.average_network_rci_drop = stats.mean_rci_degradation || 0;
      } else {
        // Step 2 and 3: Secondary Cascades (e.g. Traffic Congestion spreading)
        const { CascadeSimulationEngine } = require('./cascade_engine.js');
        if (CascadeSimulationEngine && CascadeSimulationEngine.executeCascades) {
          CascadeSimulationEngine.executeCascades(
            nodes,
            edges,
            Array.from(affectedSet),
            step
          );
          
          // Find newly obstructed edges that are now part of the affected set
          edges.forEach(e => {
            if (e.damage_state !== 'none' && e.damage_state !== null) {
              affectedSet.add(e.id);
            }
          });
        }
      }
    }

    return {
      affectedEdges: Array.from(affectedSet),
      structuralStats: totalStats
    };
  }
}
