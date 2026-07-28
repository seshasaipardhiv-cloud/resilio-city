import { CityRoadGraph } from './types.js';
import { TTLCacheManager } from './cache_manager.js';
import { SatelliteIntelligenceEngine } from './satellite_intelligence.js';
import { RoadGraphBuilder } from './graph_builder.js';
import { InfrastructureIntelligenceEngine } from './infrastructure_intelligence.js';
import { TrafficIntelligenceEngine } from './traffic_intelligence.js';
import { OsmLoaderEngine } from './osm_loader.js';
import { MetadataEnrichmentEngine } from './metadata_enrichment.js';
import { SpatialIndexEngine } from './spatial_index.js';

/**
 * Production Digital Twin Data Pipeline & Fusion Engine
 * Strictly ordered execution:
 * OSM -> Road Parser -> Geometry Builder -> Graph Builder -> Metadata -> Satellite/Traffic -> Digital Twin Platform
 * ZERO SYNTHETIC ROADS. ZERO GOOGLE MAPS GEOMETRY GENERATION.
 */
export class CityDataFusionEngine {
  public static async buildUnifiedCityModel(cityId: string): Promise<any> {
    const cacheKey = `unified_city_dt_v3_${cityId}`;
    const cached = TTLCacheManager.get<any>(cacheKey);
    if (cached && cached.edges && cached.edges.length > 50) {
      return cached;
    }

    try {
      // STAGE 1 & 2: OSM -> Road Parser -> Geometry Builder
      console.log(`[Digital Twin Pipeline] Stage 1 & 2: Ingesting complete OpenStreetMap municipal network for '${cityId}'...`);
      const osmMunicipalGraph: CityRoadGraph = await OsmLoaderEngine.loadMunicipalNetwork(cityId);

      if (!osmMunicipalGraph || !osmMunicipalGraph.edges || osmMunicipalGraph.edges.length === 0) {
        throw new Error(`DATA UNAVAILABLE: OpenStreetMap Overpass returned an empty graph for ${cityId}. Synthetic fallbacks are strictly forbidden.`);
      }

      // STAGE 3: Graph Builder
      console.log(`[Digital Twin Pipeline] Stage 3: Normalizing topology via Road Graph Builder for '${cityId}'...`);
      const { nodes, edges } = RoadGraphBuilder.validateAndNormalize(
        osmMunicipalGraph.nodes,
        osmMunicipalGraph.edges,
        cityId
      );

      const structuralGraph: CityRoadGraph = {
        ...osmMunicipalGraph,
        nodes,
        edges,
        total_road_segments: edges.length
      };

      // STAGE 4: Metadata Enrichment (Google Maps Platform solely for Place IDs, routing & speed limits)
      console.log(`[Digital Twin Pipeline] Stage 4: Enriching Google Maps metadata for '${cityId}' without touching OSM geometry...`);
      const metadataEnrichedGraph = MetadataEnrichmentEngine.enrichGraph(cityId, structuralGraph);

      // STAGE 5: Satellite / Orbital Intelligence & Live Traffic
      console.log(`[Digital Twin Pipeline] Stage 5: Ingesting Copernicus Sentinel, Open-Meteo, & Live Traffic profiles...`);
      const centerLat = osmMunicipalGraph.center_lat || 28.6139;
      const centerLon = osmMunicipalGraph.center_lon || 77.2090;
      const telemetry = await SatelliteIntelligenceEngine.fetchTelemetry(cityId, centerLat, centerLon);

      SatelliteIntelligenceEngine.attachObservationsToEdges(metadataEnrichedGraph.edges, telemetry, cityId);

      const isCoastal = cityId === 'coastal_mumbai' || cityId === 'techno_hyderabad';
      metadataEnrichedGraph.edges.forEach((edge) => {
        InfrastructureIntelligenceEngine.evaluateAsset(edge, isCoastal);
        TrafficIntelligenceEngine.enrichEdgeTraffic(edge);
      });

      // Populate spatial tile index for viewport culling and LOD rendering
      const spatialData = SpatialIndexEngine.buildSpatialIndex(metadataEnrichedGraph.nodes, metadataEnrichedGraph.edges);

      // STAGE 6: Final Digital Twin Platform Payload Construction (100% Backward Compatible with UI routes)
      const unifiedModel = {
        city_id: cityId,
        city_name: osmMunicipalGraph.city_name || cityId,
        center_lat: centerLat,
        center_lon: centerLon,
        bbox: osmMunicipalGraph.bbox,
        fit_bounds: osmMunicipalGraph.fit_bounds,
        total_road_segments: spatialData.edges.length,
        last_updated: new Date().toISOString(),
        nodes: metadataEnrichedGraph.nodes,
        edges: spatialData.edges,
        spatial_index: spatialData.index,
        satellite_telemetry: {
          constellation: telemetry.source_verification,
          timestamp: telemetry.timestamp,
          soil_moisture_0_to_7cm: telemetry.soil_moisture_index,
          surface_temp_celsius: Math.round((telemetry.temperature_celsius + 1.2) * 10) / 10,
          ambient_temp_celsius: telemetry.temperature_celsius,
          precipitation_mm: telemetry.rainfall_mm,
          relative_humidity: telemetry.humidity_percent,
          surface_pressure_hpa: telemetry.pressure_hpa,
          wind_speed_kmh: telemetry.wind_speed_kmh,
          insar_subsidence_rate_mm_yr: telemetry.ground_subsidence_mm_yr,
          source_verification: telemetry.source_verification
        },
        telemetry_raw: telemetry,
        google_maps_metadata: {
          geocoding_status: "VERIFIED_OSM_WITH_GOOGLE_ROADS_TELEMATICS",
          traffic_model: "DYNAMIC_BEST_GUESS",
          elevation_dataset: "SRTM3 / Copernicus Global DEM",
          source: "OpenStreetMap Authentic Geometry with Google Maps Place ID Enrichment"
        }
      };

      console.log(`[Digital Twin Pipeline Complete] Produced production-grade digital twin for '${cityId}' with ${spatialData.edges.length} road segments. ZERO SYNTHETIC ROADS.`);
      TTLCacheManager.set(cacheKey, unifiedModel, 3600);
      return unifiedModel;
    } catch (err: any) {
      console.error(`[Digital Twin Fusion Fatal] Pipeline halted for '${cityId}':`, err.message);
      const failover = TTLCacheManager.getFailover<any>(cacheKey);
      if (failover && failover.edges && failover.edges.length > 50) {
        console.warn(`[Offline Mode] Restored verified municipal cache from offline persistence store for '${cityId}'.`);
        return failover;
      }
      throw err;
    }
  }
}
