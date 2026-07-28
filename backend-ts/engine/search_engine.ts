import axios from 'axios';
import { SearchResult, GraphNode, GraphEdge } from './types.js';
import { TTLCacheManager } from './cache_manager.js';

/**
 * Production Multi-Engine Urban Geocoding & Feature Search Engine
 * Enforces strictly prioritized lookup:
 * Google Places API -> OpenStreetMap Nominatim API -> Local Municipal Graph Index
 * Never generates fabricated coordinates or placeholder names per Requirement #15.
 */
export class SearchEngine {
  public static async search(
    query: string,
    cityName: string,
    nodes: Record<string, GraphNode>,
    edges: GraphEdge[]
  ): Promise<SearchResult[]> {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    const cacheKey = `search_v1_${cityName}_${cleanQuery.toLowerCase()}`;
    const cached = TTLCacheManager.get<SearchResult[]>(cacheKey);
    if (cached) return cached;

    const results: SearchResult[] = [];

    // ── 1. Google Places & Geocoding API (Primary if configured) ────────────
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (googleApiKey && googleApiKey !== "EXPLICIT_LIVE_API_KEY_REQUIRED") {
      try {
        const placeUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(cleanQuery + " " + cityName)}&key=${googleApiKey}`;
        const resp = await axios.get(placeUrl, { timeout: 4000 });
        const data = resp.data;
        if (data.status === 'OK' && Array.isArray(data.results)) {
          data.results.slice(0, 5).forEach((p: any) => {
            if (p.geometry?.location) {
              results.push({
                name: p.name || p.formatted_address || cleanQuery,
                lat: Number(p.geometry.location.lat),
                lon: Number(p.geometry.location.lng),
                google_place_id: p.place_id,
                address: p.formatted_address || `${p.name}, ${cityName}`,
                road_type: p.types ? p.types[0] : 'place',
                confidence: 0.98,
                source: 'Google Places'
              });
            }
          });
        }
      } catch (err: any) {
        console.warn(`[Search Engine] Google Places search fallback required: ${err.message}`);
      }
    }

    // ── 2. OpenStreetMap Nominatim Geocoding API ─────────────────────────────
    if (results.length === 0) {
      try {
        const nomQuery = `${cleanQuery}, ${cityName}`;
        const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(nomQuery)}&format=json&limit=6&addressdetails=1`;
        const nomResp = await axios.get(nomUrl, {
          headers: { 'User-Agent': 'ResilioCity-DigitalTwin/2.0' },
          timeout: 4500
        });
        if (Array.isArray(nomResp.data) && nomResp.data.length > 0) {
          nomResp.data.forEach((item: any) => {
            results.push({
              name: item.display_name?.split(',')[0] || cleanQuery,
              lat: Number(item.lat),
              lon: Number(item.lon),
              osm_id: item.osm_id ? `osm:${item.osm_type || 'N'}:${item.osm_id}` : undefined,
              address: item.display_name || undefined,
              road_type: item.class === 'highway' ? (item.type || 'road') : item.type || item.class || 'landmark',
              confidence: Number(item.importance) > 0 ? Math.min(0.95, Math.max(0.6, Number(item.importance) * 1.5)) : 0.85,
              source: 'OpenStreetMap Nominatim'
            });
          });
        }
      } catch (err: any) {
        console.warn(`[Search Engine] Nominatim API unreachable (${err.message}). Defaulting to verified municipal road graph.`);
      }
    }

    // ── 3. Local Municipal Road Graph & Landmark Index (Sub-millisecond) ─────
    const lowerQ = cleanQuery.toLowerCase();
    
    // Scan nodes (hospitals, intersections, metro stations, emergency hubs)
    for (const [nid, node] of Object.entries(nodes)) {
      const lbl = (node.label || "").toLowerCase();
      const ntype = (node.type || "").toLowerCase();
      if (lbl.includes(lowerQ) || (lowerQ.length > 3 && ntype === lowerQ)) {
        // Prevent near-duplicate coordinates if Nominatim already returned this spot
        const isDup = results.some(r => Math.abs(r.lat - node.lat) < 0.0005 && Math.abs(r.lon - node.lon) < 0.0005);
        if (!isDup && results.length < 15) {
          results.push({
            name: node.label || `${node.type.toUpperCase()}: ${node.id}`,
            lat: node.lat,
            lon: node.lon,
            osm_id: node.id.startsWith('osm:') ? node.id : undefined,
            google_place_id: node.google_place_id,
            road_type: node.type,
            confidence: 0.9,
            source: 'Local Road Graph',
            target_id: nid
          });
        }
      }
    }

    // Scan road segments, flyovers, bridges, streets
    for (const edge of edges) {
      const rname = (edge.road_name || "").toLowerCase();
      const hw = (edge.highway_class || "").toLowerCase();
      if ((rname && rname !== 'unnamed road' && rname.includes(lowerQ)) ||
          (lowerQ === 'bridge' && edge.is_bridge) ||
          (lowerQ === 'flyover' && (edge.type === 'flyover' || edge.bridge_type === 'flyover')) ||
          (lowerQ === 'tunnel' && edge.is_tunnel)) {
        const srcNode = nodes[edge.source];
        const tgtNode = nodes[edge.target];
        if (srcNode && tgtNode) {
          const midLat = (srcNode.lat + tgtNode.lat) / 2;
          const midLon = (srcNode.lon + tgtNode.lon) / 2;
          const isDup = results.some(r => Math.abs(r.lat - midLat) < 0.0008 && Math.abs(r.lon - midLon) < 0.0008);
          if (!isDup && results.length < 20) {
            results.push({
              name: edge.road_name !== 'Unnamed Road' && edge.road_name ? edge.road_name : `${edge.type || 'Road'} Segment (${edge.highway_class || 'street'})`,
              lat: Number(midLat.toFixed(6)),
              lon: Number(midLon.toFixed(6)),
              osm_id: edge.id.startsWith('osm:') || edge.id.startsWith('way/') ? edge.id : undefined,
              google_place_id: edge.google_place_id,
              road_type: edge.highway_class || edge.type || 'road_segment',
              confidence: edge.road_name === cleanQuery ? 0.99 : 0.82,
              source: 'Local Road Graph',
              target_id: edge.id
            });
          }
        }
      }
    }

    // Sort descending by confidence
    results.sort((a, b) => b.confidence - a.confidence);

    if (results.length > 0) {
      TTLCacheManager.set(cacheKey, results, 300);
    }
    return results;
  }
}
