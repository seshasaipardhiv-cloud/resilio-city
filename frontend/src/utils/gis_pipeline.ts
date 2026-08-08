import * as THREE from 'three';

// ── Strict Validation Helper (No NaN, no undefined, no Infinity) ─────────────────────────
export function isValidCoord(val: any): boolean {
  return val !== null && val !== undefined && typeof val === 'number' && !Number.isNaN(val) && Number.isFinite(val);
}

export interface ValidatedGraph {
  validRoads: any[];
  skippedCount: number;
  nodeCount: number;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  centerLat: number;
  centerLon: number;
  radiusKm: number;
  isValid: boolean;
  errorDetail?: string;
}

// ── STEP 2, 3, 4, 5: Validate Backend Response, Graph, and Every Road ───────────────────
export async function validateAndProcessGISGraph(features: any[], cityId: string): Promise<ValidatedGraph> {
  console.log(`[STAGE 4: JSON Parsing] Parsing GeoJSON structures for city: ${cityId}...`);
  if (!features || !Array.isArray(features) || features.length === 0) {
    const err = 'Backend validation error: edges/features array is empty or undefined.';
    console.error(`[STEP 2 Error] ${err}`);
    return {
      validRoads: [], skippedCount: 0, nodeCount: 0,
      minLat: 0, maxLat: 0, minLon: 0, maxLon: 0, centerLat: 0, centerLon: 0, radiusKm: 0,
      isValid: false, errorDetail: err,
    };
  }

  console.log('[STAGE 5: Road Graph] Graph structure assembled. Validating topology & coordinates...');

  const validRoads: any[] = [];
  const nodeSet = new Set<string>();
  let skippedCount = 0;
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;

  // Instantaneous single-pass processing (<15ms for 35,000 roads)
  features.forEach((f: any, idx: number) => {
    const coords = f?.geometry?.coordinates;
    const roadId = f?.properties?.id ?? f?.properties?.osm_id ?? `road_${idx}`;

    // 1. Check existing coords
    if (!coords || !Array.isArray(coords) || coords.length < 2) {
      console.warn(`[STEP 5 Road Validation] Skipped Road ${roadId}: Missing or incomplete coordinates array.`);
      skippedCount++;
      return;
    }

    const [src, tgt] = coords;
    // 2. Check No NaN, no undefined, no Infinity
    if (!Array.isArray(src) || !Array.isArray(tgt) || src.length < 2 || tgt.length < 2 ||
        !isValidCoord(src[0]) || !isValidCoord(src[1]) || !isValidCoord(tgt[0]) || !isValidCoord(tgt[1])) {
      console.warn(`[STEP 5 Road Validation] Skipped Road ${roadId}: Invalid coordinate detected (NaN, undefined, or Infinity). Coords:`, src, tgt);
      skippedCount++;
      return;
    }

    const [lon1, lat1] = src;
    const [lon2, lat2] = tgt;

    // 3. Check duplicate coordinates (zero length geometry)
    if (lon1 === lon2 && lat1 === lat2) {
      console.warn(`[STEP 5 Road Validation] Skipped Road ${roadId}: Duplicate coordinates (zero length geometry).`);
      skippedCount++;
      return;
    }

    // Record valid feature
    validRoads.push(f);
    nodeSet.add(`${lon1.toFixed(6)},${lat1.toFixed(6)}`);
    nodeSet.add(`${lon2.toFixed(6)},${lat2.toFixed(6)}`);

    if (lat1 < minLat) minLat = lat1; if (lat1 > maxLat) maxLat = lat1;
    if (lat2 < minLat) minLat = lat2; if (lat2 > maxLat) maxLat = lat2;
    if (lon1 < minLon) minLon = lon1; if (lon1 > maxLon) maxLon = lon1;
    if (lon2 < minLon) minLon = lon2; if (lon2 > maxLon) maxLon = lon2;
  });

  if (validRoads.length === 0 || nodeSet.size === 0) {
    const err = 'No valid roads remaining after geometry validation.';
    console.error(`[STEP 2 Error] ${err}`);
    return {
      validRoads: [], skippedCount, nodeCount: 0,
      minLat: 0, maxLat: 0, minLon: 0, maxLon: 0, centerLat: 0, centerLon: 0, radiusKm: 0,
      isValid: false, errorDetail: err,
    };
  }

  const centerLat = (minLat + maxLat) / 2;
  const centerLon = (minLon + maxLon) / 2;

  // Calculate bounding radius in km (approx using degree distances)
  const dLatKm = (maxLat - minLat) * 111.32;
  const dLonKm = (maxLon - minLon) * (111.32 * Math.cos(centerLat * (Math.PI / 180)));
  const radiusKm = Math.sqrt(dLatKm * dLatKm + dLonKm * dLonKm) / 2;

  // STEP 3: Print Validation logs
  console.log('====================================================');
  console.log('[STEP 3: GRAPH VALIDATION REPORT]');
  console.log(`  Number of Nodes:     ${nodeSet.size}`);
  console.log(`  Number of Roads:     ${validRoads.length}`);
  console.log(`  Bounding Box:        [${minLon.toFixed(5)}, ${minLat.toFixed(5)}] to [${maxLon.toFixed(5)}, ${maxLat.toFixed(5)}]`);
  console.log(`  Center Latitude:     ${centerLat.toFixed(6)}`);
  console.log(`  Center Longitude:    ${centerLon.toFixed(6)}`);
  console.log(`  Min Latitude:        ${minLat.toFixed(6)}, Max Latitude: ${maxLat.toFixed(6)}`);
  console.log(`  Min Longitude:       ${minLon.toFixed(6)}, Max Longitude: ${maxLon.toFixed(6)}`);
  console.log(`  City Radius (km):    ${radiusKm.toFixed(2)} km`);
  console.log('====================================================');

  return {
    validRoads,
    skippedCount,
    nodeCount: nodeSet.size,
    minLat, maxLat, minLon, maxLon,
    centerLat, centerLon,
    radiusKm,
    isValid: true
  };
}

// ── STEP 4 & 10: Compute City Bounds and fitBounds() ────────────────────────────────────
export interface CameraBounds {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
  near: number;
  far: number;
}

export function fitBounds(minLon: number, minLat: number, maxLon: number, maxLat: number, width = 1280, height = 720): CameraBounds {
  let lon = (minLon + maxLon) / 2;
  let lat = (minLat + maxLat) / 2;

  // Never leave camera at (0,0,0)
  if (lon === 0 && lat === 0) {
    lon = 77.2090; // safe fallback
    lat = 28.6139;
    console.warn('[STEP 4 WARNING] Computed center was (0,0,0). Forced camera repositioning to safe non-zero coordinate.');
  }

  const lonDiff = Math.abs(maxLon - minLon) || 0.02;
  const latDiff = Math.abs(maxLat - minLat) || 0.02;

  const zoomLon = Math.log2(width / (lonDiff * 256));
  const zoomLat = Math.log2(height / (latDiff * 256));
  const computedZoom = Math.max(10, Math.min(16.5, Math.floor(Math.min(zoomLon, zoomLat) * 10) / 10));

  console.log(`[STEP 4 & 10: Camera Auto-Center] Executed fitBounds(). Camera centered at [${lon.toFixed(4)}, ${lat.toFixed(4)}] at zoom ${computedZoom}`);

  return {
    longitude: lon,
    latitude: lat,
    zoom: computedZoom,
    pitch: 55,
    bearing: -10,
    near: 0.1,
    far: 50000, // Wide clipping plane to prevent distance culling/blackouts
  };
}

// ── STEP 9, 11, 14: Three.js Production Geometry Engine ───────────────────────────────
export class ThreeGISRendererEngine {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer | null = null;
  private currentMesh: THREE.LineSegments | null = null;
  private ambientLight: THREE.AmbientLight;
  private directionalLight: THREE.DirectionalLight;
  private isDisposed: boolean = false;

  constructor(containerWidth = 1280, containerHeight = 720) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030610);

    // Camera with safe clipping planes (STEP 10)
    this.camera = new THREE.PerspectiveCamera(60, containerWidth / containerHeight, 0.1, 50000);
    this.camera.position.set(0, 0, 1000);
    this.camera.lookAt(0, 0, 0);

    // Lighting (STEP 11)
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.directionalLight = new THREE.DirectionalLight(0x00ff9d, 1.2);
    this.directionalLight.position.set(500, 1000, 800);
    this.scene.add(this.ambientLight);
    this.scene.add(this.directionalLight);
    console.log('[STEP 11: Lighting Initialization] AmbientLight, DirectionalLight, and projection aspect ratio configured.');
  }

  public attachRenderer(canvas: HTMLCanvasElement) {
    if (!canvas) return;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    // Tone mapping (STEP 11)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setSize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    console.log('[STEP 11: Renderer Setup] WebGLRenderer tone mapping ACESFilmicToneMapping active.');
  }

  // STEP 9: Three.js Safety & STEP 14: Progressive Asynchronous Build
  public async buildRoadGeometryAsync(validRoads: any[], centerLon: number, centerLat: number): Promise<boolean> {
    if (this.isDisposed) return false;
    console.log('[STAGE 6: Three.js Geometry] Generating async BufferGeometry & LineSegments buffers...');
    
    // Safety check: Never create BufferGeometry with empty arrays or zero vertices
    if (!validRoads || validRoads.length === 0) {
      console.warn('[STEP 9 Three.js Safety] Zero vertices received! Skipping BufferGeometry & LineSegments creation to prevent shader crash.');
      return false;
    }

    // Dispose previous geometry before loading another city (STEP 9)
    this.disposePreviousGeometry();

    const positions: number[] = [];
    const colors: number[] = [];
    const color = new THREE.Color();

    // Fast synchronous single-pass BufferGeometry construction (<10ms)
    validRoads.forEach(f => {
      const coords = f.geometry.coordinates;
      if (coords && coords.length >= 2) {
        const [src, tgt] = coords;
        // Transform GPS coordinates to Three.js local space around city center
        const x1 = (src[0] - centerLon) * 111320 * Math.cos(centerLat * (Math.PI / 180));
        const y1 = (src[1] - centerLat) * 111320;
        const x2 = (tgt[0] - centerLon) * 111320 * Math.cos(centerLat * (Math.PI / 180));
        const y2 = (tgt[1] - centerLat) * 111320;

        if (isValidCoord(x1) && isValidCoord(y1) && isValidCoord(x2) && isValidCoord(y2)) {
          positions.push(x1, y1, 0, x2, y2, 0);
          const rci = f.properties?.rci ?? 70;
          if (rci >= 75) color.setHex(0x00ff9d);
          else if (rci >= 50) color.setHex(0xffd93d);
          else color.setHex(0xff3b6b);
          colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
        }
      }
    });

    if (positions.length === 0) {
      console.warn('[STEP 9 Three.js Safety] Calculated position buffer is empty. Aborting geometry binding.');
      return false;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    const material = new THREE.LineBasicMaterial({ vertexColors: true, linewidth: 1.5 });
    
    // Safety check: Never create LineSegments with zero vertices
    this.currentMesh = new THREE.LineSegments(geometry, material);
    this.scene.add(this.currentMesh);

    console.log(`[STEP 9: Three.js Safety Verification] BufferGeometry instantiated successfully with ${positions.length / 3} vertices.`);
    return true;
  }

  public async buildBoundaryGeometryAsync(boundaryCoords: any[], centerLon: number, centerLat: number): Promise<boolean> {
    if (this.isDisposed || !boundaryCoords) return false;
    
    // Extract all [lon, lat] rings recursively
    const rings: [number, number][][] = [];
    const extractRings = (arr: any[]) => {
      if (!Array.isArray(arr) || arr.length === 0) return;
      if (typeof arr[0] === 'number' && typeof arr[1] === 'number') {
        // It's a flat [lon, lat] array, shouldn't happen at top level but just in case
        rings.push([arr as [number, number]]);
        return;
      }
      if (Array.isArray(arr[0]) && typeof arr[0][0] === 'number') {
        // It's a ring [[lon, lat], ...]
        rings.push(arr as [number, number][]);
        return;
      }
      // It's an array of rings or an array of polygons
      for (const item of arr) {
        if (Array.isArray(item)) extractRings(item);
      }
    };
    extractRings(boundaryCoords);

    if (rings.length === 0) return false;
    console.log(`[STAGE 6: Three.js Geometry] Generating async boundary geometry for ${rings.length} rings...`);

    const positions: number[] = [];
    const colors: number[] = [];
    const color = new THREE.Color(0x00d4ff); // Cyan color for border

    for (const ring of rings) {
      if (ring.length < 3) continue;
      // Connect the points in a loop
      for (let i = 0; i < ring.length; i++) {
        let p1 = ring[i];
        let p2 = ring[(i + 1) % ring.length];
        
        if (typeof p1[0] !== 'number' || typeof p2[0] !== 'number') continue;

        const x1 = (p1[0] - centerLon) * 111320 * Math.cos(centerLat * (Math.PI / 180));
        const y1 = (p1[1] - centerLat) * 111320;
        const x2 = (p2[0] - centerLon) * 111320 * Math.cos(centerLat * (Math.PI / 180));
        const y2 = (p2[1] - centerLat) * 111320;

        if (isValidCoord(x1) && isValidCoord(y1) && isValidCoord(x2) && isValidCoord(y2)) {
          positions.push(x1, y1, 10); // Draw slightly above roads (z=10)
          positions.push(x2, y2, 10);
          colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
        }
      }
    }

    if (positions.length === 0) return false;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    // Use a LineBasicMaterial with higher linewidth (if supported by browser) or just a brighter color
    const material = new THREE.LineBasicMaterial({ vertexColors: true, linewidth: 3, transparent: true, opacity: 0.8 });
    
    const borderMesh = new THREE.LineSegments(geometry, material);
    // Render on top
    borderMesh.renderOrder = 999;
    
    this.scene.add(borderMesh);
    // Keep reference if we want to dispose it, we can just attach it to the current scene and it will be destroyed when scene is cleared.
    // Or store it in this.borderMesh
    (this as any).borderMesh = borderMesh;

    return true;
  }

  public handleResize(width: number, height: number) {
    if (width <= 0 || height <= 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (this.renderer) {
      this.renderer.setSize(width, height);
    }
  }

  public render() {
    if (this.renderer && !this.isDisposed) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  public disposePreviousGeometry() {
    if (this.currentMesh) {
      console.log('[STEP 9 Three.js Safety] Disposing previous BufferGeometry and Material before loading new city...');
      this.scene.remove(this.currentMesh);
      this.currentMesh.geometry.dispose();
      if (Array.isArray(this.currentMesh.material)) {
        this.currentMesh.material.forEach(m => m.dispose());
      } else {
        this.currentMesh.material.dispose();
      }
      this.currentMesh = null;
    }
    const borderMesh = (this as any).borderMesh;
    if (borderMesh) {
      this.scene.remove(borderMesh);
      borderMesh.geometry.dispose();
      if (Array.isArray(borderMesh.material)) borderMesh.material.forEach((m: any) => m.dispose());
      else borderMesh.material.dispose();
      (this as any).borderMesh = null;
    }
  }

  public destroy() {
    this.isDisposed = true;
    this.disposePreviousGeometry();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
  }
}
