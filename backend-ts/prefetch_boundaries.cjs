const fs = require('fs');
const path = require('path');
const https = require('https');

const POLYGON_CACHE_DIR = path.join(__dirname, 'municipal_polygons_cache');
if (!fs.existsSync(POLYGON_CACHE_DIR)) fs.mkdirSync(POLYGON_CACHE_DIR, { recursive: true });

const CITIES = [
  { id: 'techno_hyderabad', queries: ['Hyderabad, Telangana, India', 'Greater Hyderabad Municipal Corporation, India'] },
  { id: 'nova_delhi', queries: ['Delhi, India', 'National Capital Territory of Delhi, India'] },
  { id: 'coastal_mumbai', queries: ['Mumbai City District, Maharashtra, India', 'Mumbai, Maharashtra, India'] },
  { id: 'heritage_jaipur', queries: ['Jaipur, Rajasthan, India'] },
  { id: 'cyber_bangalore', queries: ['Bengaluru, Karnataka, India', 'Bruhat Bengaluru Mahanagara Palike, India'] },
  { id: 'chennai', queries: ['Chennai, Tamil Nadu, India'] },
  { id: 'kolkata', queries: ['Kolkata, West Bengal, India'] },
  { id: 'ahmedabad', queries: ['Ahmedabad, Gujarat, India'] },
  { id: 'pune', queries: ['Pune, Maharashtra, India'] },
  { id: 'surat', queries: ['Surat, Gujarat, India'] },
  { id: 'lucknow', queries: ['Lucknow, Uttar Pradesh, India'] },
  { id: 'kanpur', queries: ['Kanpur, Uttar Pradesh, India'] },
  { id: 'nagpur', queries: ['Nagpur, Maharashtra, India'] },
  { id: 'indore', queries: ['Indore, Madhya Pradesh, India'] },
  { id: 'bhopal', queries: ['Bhopal, Madhya Pradesh, India'] },
  { id: 'visakhapatnam', queries: ['Visakhapatnam, Andhra Pradesh, India', 'Greater Visakhapatnam Municipal Corporation, India'] },
  { id: 'patna', queries: ['Patna, Bihar, India'] },
  { id: 'vadodara', queries: ['Vadodara, Gujarat, India'] },
  { id: 'ludhiana', queries: ['Ludhiana, Punjab, India'] },
  { id: 'agra', queries: ['Agra, Uttar Pradesh, India'] },
  { id: 'varanasi', queries: ['Varanasi, Uttar Pradesh, India'] },
  { id: 'kochi', queries: ['Kochi, Kerala, India', 'Corporation of Cochin, India'] },
  { id: 'coimbatore', queries: ['Coimbatore, Tamil Nadu, India'] },
  { id: 'madurai', queries: ['Madurai, Tamil Nadu, India'] },
  { id: 'nashik', queries: ['Nashik, Maharashtra, India'] },
  { id: 'rajkot', queries: ['Rajkot, Gujarat, India'] },
  { id: 'meerut', queries: ['Meerut, Uttar Pradesh, India'] },
  { id: 'faridabad', queries: ['Faridabad, Haryana, India'] },
  { id: 'gurugram', queries: ['Gurugram, Haryana, India'] },
  { id: 'noida', queries: ['Noida, Uttar Pradesh, India'] },
  { id: 'chandigarh', queries: ['Chandigarh, India'] },
  { id: 'thiruvananthapuram', queries: ['Thiruvananthapuram, Kerala, India'] },
  { id: 'amritsar', queries: ['Amritsar, Punjab, India'] },
  { id: 'vijayawada', queries: ['Vijayawada, Andhra Pradesh, India'] },
  { id: 'ranchi', queries: ['Ranchi, Jharkhand, India'] },
  { id: 'guwahati', queries: ['Guwahati, Assam, India'] },
  { id: 'bhubaneswar', queries: ['Bhubaneswar, Odisha, India'] },
  { id: 'jabalpur', queries: ['Jabalpur, Madhya Pradesh, India'] },
  { id: 'dehradun', queries: ['Dehradun, Uttarakhand, India'] },
  { id: 'mysuru', queries: ['Mysuru, Karnataka, India'] },
  { id: 'hubli', queries: ['Hubballi, Karnataka, India', 'Dharwad, Karnataka, India'] },
  { id: 'mangaluru', queries: ['Mangaluru, Karnataka, India'] },
  { id: 'tirupati', queries: ['Tirupati, Andhra Pradesh, India'] },
  { id: 'jodhpur', queries: ['Jodhpur, Rajasthan, India'] },
  { id: 'raipur', queries: ['Raipur, Chhattisgarh, India'] },
  { id: 'gwalior', queries: ['Gwalior, Madhya Pradesh, India'] },
  { id: 'kozhikode', queries: ['Kozhikode, Kerala, India'] },
  { id: 'prayagraj', queries: ['Prayagraj, Uttar Pradesh, India', 'Allahabad, Uttar Pradesh, India'] },
  { id: 'thrissur', queries: ['Thrissur, Kerala, India'] },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'ResilioCity-GIS/2.0' } }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e){reject(e);} });
    }); req.on('error', reject); req.setTimeout(18000, () => req.destroy(new Error('timeout')));
  });
}

async function main() {
  let ok=0, fail=0;
  for(let i=0;i<CITIES.length;i++){
    const city=CITIES[i];
    const localPath=path.join(POLYGON_CACHE_DIR,city.id+'.json');
    if(fs.existsSync(localPath)){
      try { const c=JSON.parse(fs.readFileSync(localPath,'utf-8')); if(c&&(c.type==='Polygon'||c.type==='MultiPolygon')){console.log('['+(i+1)+'/'+CITIES.length+'] CACHED: '+city.id+' ('+c.type+')');ok++;continue;} } catch(e){}
    }
    let done=false;
    for(const q of city.queries){
      try{
        const data=await httpsGet('https://nominatim.openstreetmap.org/search?q='+encodeURIComponent(q)+'&format=geojson&polygon_geojson=1&limit=5');
        if(data&&data.features){
          const f=data.features.find(f=>f.geometry&&(f.geometry.type==='Polygon'||f.geometry.type==='MultiPolygon'));
          if(f){fs.writeFileSync(localPath,JSON.stringify(f.geometry));console.log('['+(i+1)+'/'+CITIES.length+'] OK: '+city.id+' '+f.geometry.type+' via "'+q+'"');ok++;done=true;break;}
        }
      }catch(e){console.warn('  WARN '+city.id+': '+e.message);}
      await sleep(1100);
    }
    if(!done){console.warn('['+(i+1)+'/'+CITIES.length+'] FAIL: '+city.id+' - no polygon');fail++;}
    await sleep(1200);
  }
  console.log('\n=== DONE: '+ok+' cached, '+fail+' failed ===');
  const files=fs.readdirSync(POLYGON_CACHE_DIR).filter(f=>f.endsWith('.json'));
  files.forEach(f=>{const p=path.join(POLYGON_CACHE_DIR,f);try{const g=JSON.parse(fs.readFileSync(p,'utf-8'));console.log('  '+f.padEnd(35)+((fs.statSync(p).size/1024).toFixed(1)+'KB').padStart(10)+'  '+g.type);}catch(e){console.log('  '+f+' [invalid]');}});
}
main().catch(console.error);
