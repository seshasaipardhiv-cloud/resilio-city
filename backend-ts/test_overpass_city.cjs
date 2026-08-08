const axios = require('axios');

async function test() {
  const query = `
    [out:json];
    relation["name"~"Coimbatore",i]["boundary"="administrative"];
    out tags;
  `;
    const res = await axios.get('https://overpass-api.de/api/interpreter', {
      params: { data: query },
      headers: { 'User-Agent': 'curl/7.68.0', 'Accept': '*/*' }
    });
    console.error(err.message);
  }
}
test();
