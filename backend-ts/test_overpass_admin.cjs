const axios = require('axios');

async function test() {
  const query = `
    [out:json];
    relation["name"~"Coimbatore",i]["boundary"="administrative"];
    out tags;
  `;
  try {
    const res = await axios.get('https://overpass-api.de/api/interpreter', {
      params: { data: query },
      headers: { 'User-Agent': 'curl/7.68.0' }
    });
    res.data.elements.forEach(e => {
      console.log(`ID: ${e.id} Name: ${e.tags.name} AdminLevel: ${e.tags.admin_level} Type: ${e.tags.type}`);
    });
  } catch (err) {
    console.error(err.message);
  }
}
test();
