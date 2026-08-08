const axios = require('axios');
const query = '[out:json];relation["name"~"Coimbatore"]["boundary"="administrative"];out tags;';
axios.post('https://overpass-api.de/api/interpreter', query, {
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
}).then(r => {
  r.data.elements.forEach(x => console.log(x.id, x.tags.name, x.tags.admin_level));
}).catch(console.error);
