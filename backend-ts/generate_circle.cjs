const fs = require('fs');
const path = require('path');

function createCirclePolygon(centerLat, centerLon, radiusDeg, numPoints = 64) {
  const coordinates = [];
  for (let i = 0; i <= numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    const dx = radiusDeg * Math.cos(angle);
    // Adjust dy for longitude scaling (latitude distance vs longitude distance)
    const dy = (radiusDeg / Math.cos(centerLat * Math.PI / 180)) * Math.sin(angle);
    coordinates.push([centerLon + dy, centerLat + dx]);
  }
  return {
    type: "Polygon",
    coordinates: [coordinates]
  };
}

const coimbatorePolygon = createCirclePolygon(11.0168, 76.9558, 0.08);

const cacheDir = path.join(__dirname, 'municipal_polygons_cache');
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}
fs.writeFileSync(path.join(cacheDir, 'coimbatore.json'), JSON.stringify(coimbatorePolygon, null, 2), 'utf-8');
console.log('Created circular polygon for Coimbatore.');
