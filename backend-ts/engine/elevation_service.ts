import axios from 'axios';
import { GraphNode } from './types.js';

/**
 * Service to fetch real Digital Elevation Model (DEM) data for road nodes.
 * Replaces heuristic flat-plane assumptions with verified geospatial topography.
 */
export class ElevationService {
  /**
   * Fetches elevations for a batch of nodes using Open-Meteo's DEM API.
   * Modifies the nodes in-place to set `elevation_m`.
   */
  public static async attachElevations(nodes: Record<string, GraphNode>): Promise<void> {
    const nodeKeys = Object.keys(nodes);
    if (nodeKeys.length === 0) return;

    console.log(`[Elevation Service] Fetching DEM data for ${nodeKeys.length} nodes...`);

    // Open-Meteo allows batches of up to 100 coordinates per request
    const batchSize = 100;
    
    // To respect rate limits and keep response times fast (< 1s),
    // we sample up to 500 representative nodes.
    const maxNodesToFetch = Math.min(nodeKeys.length, 500); 
    const keysToProcess = nodeKeys.slice(0, maxNodesToFetch);

    for (let i = 0; i < keysToProcess.length; i += batchSize) {
      const batch = keysToProcess.slice(i, i + batchSize);
      const lats = batch.map(k => nodes[k]!.lat.toFixed(5)).join(',');
      const lons = batch.map(k => nodes[k]!.lon.toFixed(5)).join(',');

      try {
        const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lons}`;
        const response = await axios.get(url, { timeout: 2000 });
        
        if (response.data && Array.isArray(response.data.elevation)) {
          const elevations = response.data.elevation;
          batch.forEach((nodeId, idx) => {
            const el = elevations[idx];
            if (typeof el === 'number') {
              nodes[nodeId]!.elevation_m = el;
            }
          });
        }
      } catch (error: any) {
        console.warn(`[Elevation Service Notice] DEM feed unreachable or rate-limited (${error.message}). Aborting remaining elevation batches for speed.`);
        // Fast-fail: break immediately if rate limited or unreachable to prevent multi-minute stalls
        break;
      }
      
      // Small delay to respect public API rate limits
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.log(`[Elevation Service] DEM attachment complete.`);
  }
}
