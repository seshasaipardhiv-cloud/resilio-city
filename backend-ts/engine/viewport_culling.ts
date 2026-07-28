import { CityRoadGraph, GraphNode, GraphEdge } from './types.js';
import { SpatialIndexEngine } from './spatial_index.js';

/**
 * Production Viewport Culling & Level of Detail (LOD) Engine
 * Enables rendering and processing of 100,000+ road segments by filtering out corridors outside camera bounds
 * and applying progressive roadway tier generalization based on camera zoom altitude.
 * ZERO SYNTHETIC SIMPLIFICATION. ALL PRESERVED POLYLINE COORDINATES RETURNED FOR INCLUDED EDGES.
 */
export class ViewportCullingEngine {
  /**
   * Filter road network graph by active geographical viewport bounds and camera zoom altitude
   */
  public static cullByViewport(
    graph: CityRoadGraph,
    south: number,
    west: number,
    north: number,
    east: number,
    zoomLevel: number = 14
  ): { nodes: Record<string, GraphNode>; edges: GraphEdge[]; total_culled_edges: number } {
    const resDeg = SpatialIndexEngine.DEFAULT_TILE_RESOLUTION_DEG;
    const minLatTile = Math.floor(south / resDeg);
    const maxLatTile = Math.floor(north / resDeg);
    const minLonTile = Math.floor(west / resDeg);
    const maxLonTile = Math.floor(east / resDeg);

    const activeTiles: Set<string> = new Set();
    for (let lat = minLatTile; lat <= maxLatTile; lat++) {
      for (let lon = minLonTile; lon <= maxLonTile; lon++) {
        activeTiles.add(`tile_${lat}_${lon}`);
      }
    }

    const allowedTiers = new Set<string>();
    allowedTiers.add('motorway');
    allowedTiers.add('trunk');
    allowedTiers.add('primary');
    allowedTiers.add('bridge_deck');
    allowedTiers.add('flyover');

    if (zoomLevel >= 12) {
      allowedTiers.add('secondary');
      allowedTiers.add('tertiary');
    }
    if (zoomLevel >= 14) {
      allowedTiers.add('residential');
      allowedTiers.add('living_street');
      allowedTiers.add('road_segment');
    }
    if (zoomLevel >= 16) {
      allowedTiers.add('service');
      allowedTiers.add('service_road');
      allowedTiers.add('unclassified');
    }

    const filteredEdges: GraphEdge[] = [];
    const activeNodeIds: Set<string> = new Set();

    graph.edges.forEach((edge) => {
      const u = graph.nodes[edge.source];
      const v = graph.nodes[edge.target];
      if (!u || !v) return;

      const uInViewport = activeTiles.has(u.tile_id || '') || (u.lat >= south && u.lat <= north && u.lon >= west && u.lon <= east);
      const vInViewport = activeTiles.has(v.tile_id || '') || (v.lat >= south && v.lat <= north && v.lon >= west && v.lon <= east);

      if (uInViewport || vInViewport) {
        const hw = (edge.highway_class || edge.type).toLowerCase();
        if (allowedTiers.has(hw) || zoomLevel >= 15 || edge.damage_state !== 'none') {
          filteredEdges.push(edge);
          activeNodeIds.add(edge.source);
          activeNodeIds.add(edge.target);
        }
      }
    });

    const filteredNodes: Record<string, GraphNode> = {};
    activeNodeIds.forEach((nid) => {
      const n = graph.nodes[nid];
      if (n) filteredNodes[nid] = n;
    });

    return {
      nodes: filteredNodes,
      edges: filteredEdges,
      total_culled_edges: graph.edges.length - filteredEdges.length
    };
  }
}
