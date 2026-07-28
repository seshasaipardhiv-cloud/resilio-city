import { GraphEdge, GraphNode } from './types.js';

/**
 * Spatial Indexing & LOD Engine for High-Capacity Digital Twins
 * Supports 10,000+, 50,000+, and 100,000+ road segments through spatial grid tiling,
 * viewport culling, and lazy rendering without performance degradation.
 */
export class SpatialIndexEngine {
  public static readonly DEFAULT_TILE_RESOLUTION_DEG = 0.025; // ~2.5 km grid squares

  /**
   * Generates a deterministic spatial grid geohash/tile coordinate for a given GPS position
   */
  public static computeTileHash(lat: number, lon: number, resolutionDeg: number = SpatialIndexEngine.DEFAULT_TILE_RESOLUTION_DEG): string {
    const latIdx = Math.floor(lat / resolutionDeg);
    const lonIdx = Math.floor(lon / resolutionDeg);
    return `tile_${latIdx}_${lonIdx}`;
  }

  /**
   * Index City Graph into Spatial Grid Tiles
   * Stamps edges with tile IDs and generates high-speed lookup directory for lazy rendering and viewport culling.
   */
  public static buildSpatialIndex(
    nodes: Record<string, GraphNode>,
    edges: GraphEdge[]
  ): { edges: GraphEdge[]; index: Record<string, string[]> } {
    const index: Record<string, string[]> = {};

    edges.forEach((edge) => {
      let centerLat = 0;
      let centerLon = 0;
      let valid = false;

      if (edge.polyline && edge.polyline.length > 0) {
        const midIdx = Math.floor(edge.polyline.length / 2);
        const [lon, lat] = edge.polyline[midIdx]!;
        centerLat = lat;
        centerLon = lon;
        valid = true;
      } else {
        const src = nodes[edge.source];
        const tgt = nodes[edge.target];
        if (src && tgt) {
          centerLat = (src.lat + tgt.lat) / 2;
          centerLon = (src.lon + tgt.lon) / 2;
          valid = true;
        }
      }

      if (!valid) {
        return;
      }

      const tileId = SpatialIndexEngine.computeTileHash(centerLat, centerLon);
      edge.tile_id = tileId;

      if (!index[tileId]) {
        index[tileId] = [];
      }
      index[tileId]!.push(edge.id);
    });

    return { edges, index };
  }

  public static cullByViewport(
    edges: GraphEdge[],
    minLon: number,
    minLat: number,
    maxLon: number,
    maxLat: number,
    maxLimit: number = 25000
  ): GraphEdge[] {
    const culled: GraphEdge[] = [];

    for (const edge of edges) {
      if (culled.length >= maxLimit) {
        break;
      }

      let visible = false;
      if (edge.polyline && edge.polyline.length >= 2) {
        for (const [lon, lat] of edge.polyline) {
          if (lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat) {
            visible = true;
            break;
          }
        }
      } else {
        visible = true;
      }

      if (visible) {
        culled.push(edge);
      }
    }

    return culled;
  }
}
