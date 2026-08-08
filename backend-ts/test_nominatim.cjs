const axios = require('axios');

async function test() {
  const queries = [
    'Coimbatore Corporation, India',
    'Coimbatore City Municipal Corporation, India',
    'Coimbatore, Tamil Nadu, India'
  ];
  for (const q of queries) {
    try {
      const res = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: { q, format: 'json', limit: 3 },
        headers: { 'User-Agent': 'Test' }
      });
      console.log(`Query: ${q}`);
      res.data.forEach(d => console.log(`  - ${d.display_name} (${d.osm_type} ${d.class}/${d.type}) [Bbox: ${d.boundingbox}]`));
    } catch (err) {
      console.error(err.message);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
}
test();
