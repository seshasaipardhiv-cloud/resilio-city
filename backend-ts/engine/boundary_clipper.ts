import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { GraphNode, GraphEdge } from './types.js';

/**
 * Production Geospatial Municipal Boundary Polygon Clipper Engine
 * Replaces generic rectangular BBOX network extraction with mathematically accurate Point-in-Polygon (PIP)
 * ray-casting intersection against official OpenStreetMap MultiPolygon municipal administrative boundaries.
 */

export class MunicipalBoundaryClipper {
  private static readonly POLYGON_CACHE_DIR = path.join(process.cwd(), 'municipal_polygons_cache');

  /**
   * Ray-casting point-in-polygon algorithm for standard GeoJSON Polygon rings.
   * polyCoords: array of rings, where ring [0] is the outer boundary perimeter [ [lon, lat], [lon, lat], ... ]
   */
  private static isPointInPolygon(lat: number, lon: number, polyCoords: number[][][]): boolean {
    if (!polyCoords || polyCoords.length === 0 || !polyCoords[0]) return false;
    const ring = polyCoords[0];
    if (!ring) return false;
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const pI = ring[i];
      const pJ = ring[j];
      if (!pI || !pJ || pI.length < 2 || pJ.length < 2) continue;
      const xi = pI[0]!, yi = pI[1]!;
      const xj = pJ[0]!, yj = pJ[1]!;
      const intersect = ((yi > lat) !== (yj > lat)) &&
        (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Evaluates coordinate containment across complex GeoJSON MultiPolygon structures (island archipelagos, exclaves)
   */
  private static isPointInMultiPolygon(lat: number, lon: number, multiCoords: number[][][][]): boolean {
    if (!multiCoords || !Array.isArray(multiCoords)) return false;
    for (const poly of multiCoords) {
      if (poly && this.isPointInPolygon(lat, lon, poly)) return true;
    }
    return false;
  }

  /**
   * Check if latitude/longitude coordinate point resides inside the retrieved GeoJSON geometry
   */
  private static isPointInsideGeometry(lat: number, lon: number, geometry: { type: string; coordinates: any }): boolean {
    if (!geometry || !geometry.type || !geometry.coordinates) return true;
    if (geometry.type === 'Polygon') {
      return this.isPointInPolygon(lat, lon, geometry.coordinates);
    } else if (geometry.type === 'MultiPolygon') {
      return this.isPointInMultiPolygon(lat, lon, geometry.coordinates);
    }
    return true; // Fallback for unsupported geometries
  }

  /**
   * Retrieve official OpenStreetMap administrative boundary polygon from disk cache or Nominatim API
   */
  public static async fetchMunicipalPolygon(cityId: string, muniName: string, stateName: string): Promise<any | null> {
    if (!fs.existsSync(this.POLYGON_CACHE_DIR)) {
      fs.mkdirSync(this.POLYGON_CACHE_DIR, { recursive: true });
    }
    const localPath = path.join(this.POLYGON_CACHE_DIR, `${cityId}.json`);

    // 1. Check local polygon cache
    if (fs.existsSync(localPath)) {
      try {
        const cached = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
        if (cached && (cached.type === 'Polygon' || cached.type === 'MultiPolygon')) {
          return cached;
        }
      } catch (err: any) {
        console.warn(`[Boundary Clipper] Cache read error for ${cityId}: ${err.message}`);
      }
    }

    // 2. Build prioritized search queries for Indian municipalities and urban regions
    const cleanName = muniName.replace(/\s*\([^)]*\)/g, '').trim();
    const candidateQueries: string[] = [];
    
    if (cityId === 'kolkata') {
      candidateQueries.push('Kolkata, West Bengal, India', 'Kolkata Municipal Corporation, India');
    } else if (cityId === 'coastal_mumbai') {
      candidateQueries.push('Mumbai City District, Maharashtra, India', 'Brihanmumbai Municipal Corporation, India', 'Mumbai, Maharashtra, India');
    } else if (cityId === 'nova_delhi') {
      candidateQueries.push('Delhi, India', 'National Capital Territory of Delhi, India');
    } else if (cityId === 'techno_hyderabad') {
      candidateQueries.push('Hyderabad, Telangana, India', 'Greater Hyderabad Municipal Corporation, India');
    } else if (cityId === 'cyber_bangalore') {
      candidateQueries.push('Bengaluru, Karnataka, India', 'Bruhat Bengaluru Mahanagara Palike, India');
    } else if (cityId === 'coimbatore') {
      candidateQueries.push(
        'Coimbatore, Tamil Nadu, India',
        'Coimbatore City, India',
        'Coimbatore District, India'
      );
    } else {
      candidateQueries.push(
        `${cleanName} Corporation, India`,
        `${cleanName} Municipal Corporation, India`,
        `${cleanName}, ${stateName}, India`,
        `${cleanName} District, India`,
        `${cleanName}, India`
      );
    }

    // 3. Query OpenStreetMap Nominatim for exact Polygon/MultiPolygon geometry
    for (const q of candidateQueries) {
      try {
        console.log(`[Geospatial Boundary Clipper] Fetching official administrative boundary polygon from OSM for: "${q}"...`);
        const res = await axios.get('https://nominatim.openstreetmap.org/search', {
          params: {
            q,
            format: 'geojson',
            polygon_geojson: 1,
            limit: 5
          },
          headers: { 'User-Agent': 'ResilioCity-GIS-DigitalTwin/2.0 (Deepmind-Antigravity)' },
          timeout: 15000
        });

        if (res.data && res.data.features && Array.isArray(res.data.features)) {
          // Find first result with actual polygonal area geometry
          const polyFeature = res.data.features.find((f: any) => 
            f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
          );
          if (polyFeature && polyFeature.geometry) {
            console.log(`[Geospatial Boundary Clipper] Successfully discovered ${polyFeature.geometry.type} boundary for ${cleanName} (${polyFeature.properties?.display_name || q}). Saving to disk cache.`);
            fs.writeFileSync(localPath, JSON.stringify(polyFeature.geometry), 'utf-8');
            return polyFeature.geometry;
          }
        }
      } catch (err: any) {
        console.warn(`[Geospatial Boundary Clipper] Nominatim lookup notice for "${q}": ${err?.message || err}`);
      }
      // Respect Nominatim rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.warn(`[Geospatial Boundary Clipper] No polygonal boundary discovered for '${muniName}'. Preserving complete regional bounding box network.`);
    return null;
  }

  /**
   * Perform real-time polygonal clipping of road graph edges and nodes against municipal boundaries
   */
  public static async clipNetworkToMunicipalPolygon(
    cityId: string,
    muniName: string,
    stateName: string,
    nodes: Record<string, GraphNode>,
    edges: GraphEdge[]
  ): Promise<{ nodes: Record<string, GraphNode>; edges: GraphEdge[]; polygon: any }> {
    const startTs = Date.now();
    const geometry = await this.fetchMunicipalPolygon(cityId, muniName, stateName);
    if (!geometry) {
      return { nodes, edges, polygon: null }; // Return unmodified network if polygon lookup fails
    }

    const origEdgeCount = edges.length;
    const clippedEdges: GraphEdge[] = [];
    const usedNodeIds = new Set<string>();

    // 1. Filter road segments: retain if source node, target node, or midpoint along polyline falls inside municipal boundary polygon
    for (const edge of edges) {
      let isInside = false;
      const srcNode = nodes[edge.source];
      const tgtNode = nodes[edge.target];

      if (srcNode && this.isPointInsideGeometry(srcNode.lat, srcNode.lon, geometry)) {
        isInside = true;
      } else if (tgtNode && this.isPointInsideGeometry(tgtNode.lat, tgtNode.lon, geometry)) {
        isInside = true;
      } else if (edge.polyline && edge.polyline.length > 0) {
        // polyline points are stored as [lon, lat]
        const midIdx = Math.floor(edge.polyline.length / 2);
        const midPt = edge.polyline[midIdx];
        if (midPt && midPt.length >= 2 && this.isPointInsideGeometry(midPt[1]!, midPt[0]!, geometry)) {
          isInside = true;
        }
      }

      if (isInside) {
        clippedEdges.push(edge);
        usedNodeIds.add(edge.source);
        usedNodeIds.add(edge.target);
      }
    }

    // 2. Filter nodes: keep nodes that are referenced by retained edges OR are critical emergency POIs inside the boundary
    const clippedNodes: Record<string, GraphNode> = {};
    for (const [nid, node] of Object.entries(nodes)) {
      if (usedNodeIds.has(nid)) {
        clippedNodes[nid] = node;
      } else if (node.is_emergency_hub || node.type === 'hospital' || node.type === 'clinic' || node.type === 'fire_station' || node.type === 'police' || node.type === 'police_station' || node.type === 'nursing_home') {
        // Retain emergency POIs if inside polygon
        if (this.isPointInsideGeometry(node.lat, node.lon, geometry)) {
          clippedNodes[nid] = node;
        }
      }
    }

    const duration = Date.now() - startTs;
    console.log(`[Geospatial Boundary Clipper] Precise municipal shape polygon clipping applied for ${muniName} in ${duration}ms. Retained ${clippedEdges.length}/${origEdgeCount} authentic roads within exact administrative borders (removed ${origEdgeCount - clippedEdges.length} out-of-bounds rectangular box segments).`);

    // Safety guard: if clipping removed almost everything due to coordinate mismatches, fallback to bounding box
    // But trust the polygon if it retains at least a reasonable number of roads (e.g. 500)
    if (clippedEdges.length < 500 && origEdgeCount > 1000) {
      console.warn(`[Geospatial Boundary Clipper] Alert: polygon clipping retained <500 roads for ${muniName}; reverting to full regional bounds to prevent data loss.`);
      return { nodes, edges, polygon: geometry };
    }

    return { nodes: clippedNodes, edges: clippedEdges, polygon: geometry };
  }
}
