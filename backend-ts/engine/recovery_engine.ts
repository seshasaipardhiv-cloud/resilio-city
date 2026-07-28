import { GraphNode, GraphEdge, RecoveryAction } from './types.js';
import { GraphAnalyticsEngine } from './graph_algorithms.js';

/**
 * Recovery Recommendation & Logistics Engine
 * Generates prioritized structural reconstruction workflows, estimates financial budgets (INR),
 * calculates required manpower & heavy equipment, and identifies emergency detour corridors.
 */
export class RecoveryRecommendationEngine {
  public static generateRecoveryPlan(
    nodes: Record<string, GraphNode>,
    edges: GraphEdge[],
    affectedEdgeIds: string[]
  ): {
    summary: {
      total_estimated_cost_inr: number;
      total_manpower: number;
      estimated_completion_days: number;
      emergency_accessibility_status: string;
    };
    action_items: RecoveryAction[];
    isolated_emergency_facilities: string[];
  } {
    const affectedSet = new Set(affectedEdgeIds);
    const actions: RecoveryAction[] = [];
    let totalCost = 0;
    let totalManpower = 0;
    let maxHours = 0;

    // Perform structural network connectivity analysis
    const connectivity = GraphAnalyticsEngine.analyzeConnectivity(nodes, edges);
    const emergencyStatus = connectivity.isolatedHospitals.length === 0 && connectivity.fragmentationRatio < 15
      ? "FULLY_ACCESSIBLE"
      : connectivity.fragmentationRatio < 50
      ? "PARTIALLY_RESTRICTED"
      : "CRITICAL_ISOLATION_DETECTED";

    // Filter and order critical damaged road components
    const damagedEdges = edges.filter((e) => affectedSet.has(e.id) || e.damage_state !== 'none' || e.rci < 45);
    const sortedDamaged = GraphAnalyticsEngine.rankCriticalRoads(damagedEdges);

    sortedDamaged.forEach((edge, index) => {
      let phase: 'Emergency Clearance' | 'Structural Stabilization' | 'Full Reconstruction' = 'Emergency Clearance';
      let costInr = 1250000; // base 12.5 Lakhs INR
      let manpower = 35;
      let hours = 24;
      const equipment: string[] = ['JCB Backhoe Loaders', 'Dump Trucks'];

      if (edge.type === 'bridge_deck' || edge.type === 'flyover' || edge.damage_state === 'collapsed') {
        phase = 'Full Reconstruction';
        costInr = Math.round(18500000 + (edge.length_meters * 15000)); // ~1.85 Crore+ INR for bridge structural work
        manpower = 120;
        hours = 240; // 10 days
        equipment.push('Hydraulic Telescopic Cranes', 'Prestressed Concrete Rigs', 'Piledrivers');
      } else if (edge.damage_state === 'flooded' || edge.damage_state === 'subsided') {
        phase = 'Structural Stabilization';
        costInr = Math.round(4500000 + (edge.length_meters * 4500));
        manpower = 60;
        hours = 72; // 3 days
        equipment.push('High-Capacity Industrial Pumps', 'Subgrade Compaction Rollers', 'Asphalt Pavers');
      } else {
        costInr = Math.round(850000 + (edge.length_meters * 1800));
        manpower = 25;
        hours = 18;
      }

      // Calculate emergency detour bypass using intact arteries
      const detourResult = GraphAnalyticsEngine.shortestPath(edge.source, edge.target, nodes, edges);
      const detourRoute = detourResult.path.length > 0 ? detourResult.path : ['Via Outer Peripheral Bypass (Offline Route)'];

      totalCost += costInr;
      totalManpower += manpower;
      if (hours > maxHours) {
        maxHours = hours;
      }

      actions.push({
        phase,
        target_edge_id: edge.id,
        road_name: edge.road_name,
        priority_score: Math.max(1, 100 - index * 5),
        estimated_cost_inr: costInr,
        manpower_required: manpower,
        equipment_needed: equipment,
        detour_route: detourRoute,
        expected_recovery_hours: hours
      });
    });

    return {
      summary: {
        total_estimated_cost_inr: totalCost,
        total_manpower: totalManpower,
        estimated_completion_days: Math.max(1, Math.ceil(maxHours / 24)),
        emergency_accessibility_status: emergencyStatus
      },
      action_items: actions,
      isolated_emergency_facilities: connectivity.isolatedHospitals
    };
  }
}
