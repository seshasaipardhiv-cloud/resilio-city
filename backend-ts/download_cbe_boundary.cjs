const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function downloadAndMerge() {
  console.log('Downloading Coimbatore wards...');
  const res = await axios.get('https://raw.githubusercontent.com/datameet/Municipal_Spatial_Data/master/Coimbatore/Cbe2011Wards.geojson');
  
  const geojson = res.data;
  
  // Extract all polygons and multipolygons from the features and combine into one MultiPolygon
  const multiPolygonCoords = [];
  
  geojson.features.forEach(feature => {
    if (feature.geometry.type === 'Polygon') {
      multiPolygonCoords.push(feature.geometry.coordinates);
    } else if (feature.geometry.type === 'MultiPolygon') {
      feature.geometry.coordinates.forEach(coords => {
        multiPolygonCoords.push(coords);
      });
    }
  });
  
  const finalGeometry = {
    type: 'MultiPolygon',
    coordinates: multiPolygonCoords
  };
  
  const cacheDir = path.join(__dirname, 'municipal_polygons_cache');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  
  fs.writeFileSync(path.join(cacheDir, 'coimbatore.json'), JSON.stringify(finalGeometry, null, 2), 'utf-8');
  console.log('Successfully created true Coimbatore municipal boundary from DataMeet wards data.');
}

downloadAndMerge().catch(console.error);
