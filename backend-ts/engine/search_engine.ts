import axios from 'axios';
import { SearchResult, GraphNode, GraphEdge } from './types.js';
import { TTLCacheManager } from './cache_manager.js';

/**
 * Production Multi-Engine Urban Geocoding & Feature Search Engine
 * Priority: Google Places → OpenStreetMap Nominatim → Local Municipal Graph
 * - Only returns NAMED features (never raw OSM IDs or junction coordinates)
 * - Supports private hospitals, clinics, nursing homes, pharmacies
 * - Returns Google Maps-compatible road names
 */
export class SearchEngine {
  public static async search(
    query: string,
    cityName: string,
    nodes: Record<string, GraphNode>,
    edges: GraphEdge[]
  ): Promise<SearchResult[]> {
    const cleanQuery = query.trim();
    if (!cleanQuery || cleanQuery.length < 1) return [];

    const cacheKey = `search_v4_${cityName}_${cleanQuery.toLowerCase()}`;
    const cached = TTLCacheManager.get<SearchResult[]>(cacheKey);
    if (cached) return cached;

    const results: SearchResult[] = [];

    // ── 1. Google Places & Geocoding API (Primary if configured) ────────────
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (googleApiKey && googleApiKey !== "EXPLICIT_LIVE_API_KEY_REQUIRED") {
      try {
        const placeUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(cleanQuery + ' ' + cityName)}&key=${googleApiKey}&language=en&region=IN`;
        const resp = await axios.get(placeUrl, { timeout: 5000 });
        const data = resp.data;
        if (data.status === 'OK' && Array.isArray(data.results)) {
          data.results.slice(0, 6).forEach((p: any) => {
            if (p.geometry?.location) {
              results.push({
                name: p.name || p.formatted_address || cleanQuery,
                lat: Number(p.geometry.location.lat),
                lon: Number(p.geometry.location.lng),
                google_place_id: p.place_id,
                address: p.formatted_address || `${p.name}, ${cityName}`,
                road_type: p.types ? p.types[0].replace(/_/g, ' ') : 'place',
                confidence: 0.98,
                source: 'Google Places'
              });
            }
          });
        }
      } catch (err: any) {
        console.warn(`[Search Engine] Google Places: ${err.message}`);
      }
    }

    // ── 2. OpenStreetMap Nominatim Geocoding API — always run in parallel ───
    try {
      const nomQuery = `${cleanQuery}, ${cityName}, India`;
      const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(nomQuery)}&format=json&limit=8&addressdetails=1&namedetails=1`;
      const nomResp = await axios.get(nomUrl, {
        headers: { 'User-Agent': 'ResilioCity-DigitalTwin/3.0 (production)' },
        timeout: 5000
      });
      if (Array.isArray(nomResp.data) && nomResp.data.length > 0) {
        nomResp.data.forEach((item: any) => {
          const displayName = item.namedetails?.['name:en'] || item.namedetails?.name || item.display_name?.split(',')[0];
          if (!displayName || displayName.length < 2) return;
          // Deduplicate with Google results
          const isDup = results.some(r => Math.abs(r.lat - Number(item.lat)) < 0.0003 && Math.abs(r.lon - Number(item.lon)) < 0.0003);
          if (!isDup) {
            results.push({
              name: displayName,
              lat: Number(item.lat),
              lon: Number(item.lon),
              osm_id: item.osm_id ? `osm:${item.osm_type || 'N'}:${item.osm_id}` : undefined,
              address: item.display_name || undefined,
              road_type: item.class === 'highway' ? (item.type || 'road') : item.type || item.class || 'landmark',
              confidence: Number(item.importance) > 0 ? Math.min(0.95, Math.max(0.65, Number(item.importance) * 2.0)) : 0.80,
              source: 'OpenStreetMap Nominatim'
            });
          }
        });
      }
    } catch (err: any) {
      console.warn(`[Search Engine] Nominatim: ${err.message}`);
    }

    // ── 3. Local Municipal Road Graph (sub-millisecond, named features only) ─
    const lowerQ = cleanQuery.toLowerCase();

    // 3a. Named POI nodes (hospitals, clinics, fire stations, police — public AND private)
    for (const [nid, node] of Object.entries(nodes)) {
      const lbl = (node.label || '').toLowerCase();
      const ntype = (node.type || '').toLowerCase();

      // SKIP unnamed junction coordinates — never show "Junction (17.4xxx°N ...)" in search
      if (lbl.startsWith('junction (') || lbl === 'traffic signal' || lbl === 'roundabout' || lbl === 'railway crossing') {
        // Only include these if the query explicitly matches the type
        if (!ntype.includes(lowerQ) && !lowerQ.includes(ntype)) continue;
      }

      const matches = lbl.includes(lowerQ) ||
        (lowerQ.length >= 3 && ntype.includes(lowerQ)) ||
        (lowerQ === 'hospital' && (ntype === 'hospital' || ntype === 'clinic')) ||
        (lowerQ === 'clinic' && (ntype === 'clinic' || ntype === 'doctors')) ||
        (lowerQ === 'pharmacy' && ntype === 'pharmacy') ||
        (lowerQ === 'police' && ntype === 'police') ||
        (lowerQ === 'fire' && ntype === 'fire_station') ||
        (lowerQ === 'nursing' && ntype === 'nursing_home') ||
        (lowerQ === 'private hospital' && ntype === 'hospital') ||
        (lowerQ === 'emergency' && ['hospital', 'clinic', 'fire_station', 'police'].includes(ntype));

      if (matches) {
        const isDup = results.some(r => Math.abs(r.lat - node.lat) < 0.0003 && Math.abs(r.lon - node.lon) < 0.0003);
        if (!isDup && results.length < 18) {
          const typeIcon = ntype === 'hospital' ? '🏥' : ntype === 'clinic' ? '🩺' : ntype === 'fire_station' ? '🚒' : ntype === 'police' ? '🚔' : ntype === 'pharmacy' ? '💊' : '📍';
          results.push({
            name: `${typeIcon} ${node.label}`,
            lat: node.lat,
            lon: node.lon,
            osm_id: node.id.startsWith('osm:') ? node.id : undefined,
            google_place_id: node.google_place_id,
            road_type: node.type,
            confidence: node.type !== 'intersection' ? 0.92 : 0.78,
            source: 'Local Road Graph',
            target_id: nid
          });
        }
      }
    }

    // 3b. Named road segments (never show "Unnamed Road" or fallback class names in search)
    for (const edge of edges) {
      const rname = (edge.road_name || '');
      const rlower = rname.toLowerCase();
      const hw = (edge.highway_class || '').toLowerCase();

      // Skip completely unnamed roads from search results
      if (!rname || rname === 'Unnamed Road' || rname === 'National Highway' || rname === 'State Highway'
        || rname === 'Major Road' || rname === 'District Road' || rname === 'Local Road'
        || rname === 'Residential Street' || rname === 'Service Lane' || rname === 'Footpath'
        || rname === 'Path' || rname === 'Track' || rname === 'Steps') {
        // Only include bridges/tunnels by keyword
        if (lowerQ === 'bridge' && edge.is_bridge) {
          // fall through
        } else if (lowerQ === 'flyover' && (edge.type === 'flyover' || edge.is_bridge)) {
          // fall through
        } else if (lowerQ === 'tunnel' && edge.is_tunnel) {
          // fall through
        } else {
          continue;
        }
      }

      if (rlower.includes(lowerQ) ||
          (lowerQ === 'bridge' && edge.is_bridge) ||
          (lowerQ === 'flyover' && (edge.type === 'flyover' || edge.is_bridge)) ||
          (lowerQ === 'tunnel' && edge.is_tunnel) ||
          (lowerQ === 'nh' && hw === 'motorway') ||
          (lowerQ === 'national highway' && hw === 'motorway') ||
          (lowerQ === 'state highway' && hw === 'trunk')) {

        const srcNode = nodes[edge.source];
        const tgtNode = nodes[edge.target];
        if (srcNode && tgtNode) {
          // Use the midpoint of the full polyline for better location accuracy
          let midLat: number, midLon: number;
          if (edge.polyline && edge.polyline.length >= 2) {
            const midIdx = Math.floor(edge.polyline.length / 2);
            midLon = edge.polyline[midIdx]![0];
            midLat = edge.polyline[midIdx]![1];
          } else {
            midLat = (srcNode.lat + tgtNode.lat) / 2;
            midLon = (srcNode.lon + tgtNode.lon) / 2;
          }

          const isDup = results.some(r => Math.abs(r.lat - midLat) < 0.0006 && Math.abs(r.lon - midLon) < 0.0006);
          if (!isDup && results.length < 20) {
            const displayName = edge.is_bridge ? `🌉 ${rname} (Bridge)` : edge.is_tunnel ? `🚇 ${rname} (Tunnel)` : rname;
            results.push({
              name: displayName,
              lat: Number(midLat.toFixed(6)),
              lon: Number(midLon.toFixed(6)),
              osm_id: edge.id.startsWith('osm:') || edge.id.startsWith('way/') ? edge.id : undefined,
              google_place_id: edge.google_place_id,
              road_type: edge.highway_class || edge.type || 'road',
              confidence: rname.toLowerCase() === lowerQ ? 0.99 : 0.84,
              source: 'Local Road Graph',
              target_id: edge.id
            });
          }
        }
      }
    }

    // Sort descending by confidence
    results.sort((a, b) => b.confidence - a.confidence);
    const final = results.slice(0, 20);

    if (final.length > 0) {
      TTLCacheManager.set(cacheKey, final, 300);
    }
    return final;
  }
}

// ── Fuzzy string distance (Levenshtein) ───────────────────────────────────────
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] = a[i-1] === b[j-1]
        ? dp[i-1]![j-1]!
        : 1 + Math.min(dp[i-1]![j]!, dp[i]![j-1]!, dp[i-1]![j-1]!);
    }
  }
  return dp[m]![n]!;
}

export interface CitySearchResult {
  id: string;
  name: string;
  display_name: string;
  state: string;
  area_sq_km: number;
  center_lat: number;
  center_lon: number;
  elevation: number;
  source: 'static_registry' | 'nominatim';
  match_score: number;
  is_dynamic?: boolean;
}

const TRENDING_CITIES = ['techno_hyderabad', 'nova_delhi', 'coastal_mumbai', 'cyber_bangalore', 'kolkata', 'chennai', 'pune', 'ahmedabad', 'jaipur'];

/** Search Indian cities — static registry + Nominatim fallback, with fuzzy typo correction */
export async function searchIndianCities(
  query: string,
  cityIndex: Array<{ id: string; name: string; display_name: string; state: string; area_sq_km: number; center_lat: number; center_lon: number; elevation: number }>
): Promise<CitySearchResult[]> {
  const q = query.trim().toLowerCase();
  if (!q || q.length < 2) {
    // Return trending cities if no query
    return cityIndex
      .filter(c => TRENDING_CITIES.includes(c.id))
      .map(c => ({ ...c, source: 'static_registry' as const, match_score: 1.0 }))
      .slice(0, 8);
  }

  const cacheKey = `city_search_v2_${q}`;
  const cached = TTLCacheManager.get<CitySearchResult[]>(cacheKey);
  if (cached) return cached;

  const results: CitySearchResult[] = [];

  // 1. Exact + prefix match in static registry
  for (const c of cityIndex) {
    const nameLower = c.name.toLowerCase();
    const stateLower = c.state.toLowerCase();
    const idLower = c.id.toLowerCase();

    if (nameLower === q || idLower === q) {
      results.push({ ...c, source: 'static_registry', match_score: 1.0 });
    } else if (nameLower.startsWith(q) || idLower.replace(/_/g, ' ').startsWith(q)) {
      results.push({ ...c, source: 'static_registry', match_score: 0.95 });
    } else if (nameLower.includes(q) || stateLower.includes(q)) {
      results.push({ ...c, source: 'static_registry', match_score: 0.85 });
    }
  }

  // 2. Fuzzy typo correction (Levenshtein ≤2) for short queries
  if (q.length >= 4 && results.length < 5) {
    for (const c of cityIndex) {
      const nameLower = c.name.toLowerCase();
      const alreadyIn = results.some(r => r.id === c.id);
      if (alreadyIn) continue;
      const dist = levenshteinDistance(q, nameLower.slice(0, q.length + 1));
      if (dist <= 2) {
        results.push({ ...c, source: 'static_registry', match_score: Math.max(0.6, 1.0 - dist * 0.2) });
      }
    }
  }

  // 3. Nominatim fallback for unknown cities (dynamic resolution)
  if (results.length < 3) {
    try {
      const nomResp = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: `${query}, India`,
          format: 'json',
          limit: 6,
          addressdetails: 1,
          countrycodes: 'in',
          featuretype: 'settlement'
        },
        headers: { 'User-Agent': 'ResilioCity-NationalDigitalTwin/4.0' },
        timeout: 6000
      });
      const nomData = nomResp.data as any[];
      if (Array.isArray(nomData)) {
        for (const r of nomData) {
          const bb = r.boundingbox as [string, string, string, string];
          if (!bb || bb.length < 4) continue;
          const southLat = parseFloat(bb[0]!);
          const northLat = parseFloat(bb[1]!);
          const westLon  = parseFloat(bb[2]!);
          const eastLon  = parseFloat(bb[3]!);
          if ((northLat - southLat) < 0.005) continue; // point, not city

          const addr = r.address || {};
          const state = addr.state || 'India';
          const cityName = r.namedetails?.name || r.display_name?.split(',')[0] || query;
          const dynamicId = cityName.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');

          const alreadyIn = results.some(res => Math.abs(res.center_lat - (southLat + northLat)/2) < 0.05);
          if (!alreadyIn) {
            const latKm = (northLat - southLat) * 111;
            const lonKm = (eastLon - westLon) * 111;
            results.push({
              id: dynamicId,
              name: cityName,
              display_name: r.display_name?.split(',').slice(0, 2).join(',') || cityName,
              state,
              area_sq_km: Math.round(latKm * lonKm),
              center_lat: (southLat + northLat) / 2,
              center_lon: (westLon + eastLon) / 2,
              elevation: 100,
              source: 'nominatim',
              match_score: Math.min(0.88, parseFloat(r.importance || '0.5') * 1.5 + 0.3),
              is_dynamic: true
            });
          }
        }
      }
    } catch { /* Nominatim unavailable — return static results */ }
  }

  results.sort((a, b) => b.match_score - a.match_score);
  const final = results.slice(0, 10);
  if (final.length > 0) TTLCacheManager.set(cacheKey, final, 120);
  return final;
}
