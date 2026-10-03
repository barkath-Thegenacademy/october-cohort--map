import fs from 'node:fs/promises';

const source = JSON.parse(await fs.readFile(new URL('./students.json', import.meta.url), 'utf8'));
const unique = [...new Set(source.map((row) => row.location).filter(Boolean))];
const cachePath = new URL('./geocache.json', import.meta.url);
let cache = {};
try { cache = JSON.parse(await fs.readFile(cachePath, 'utf8')); } catch {}

async function geocode(location) {
  if (cache[location]) return;
  const params = new URLSearchParams({ SingleLine: location, f: 'json', maxLocations: '1', outFields: 'City,Region,Country,CountryCode' });
  const response = await fetch(`https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?${params}`);
  if (!response.ok) throw new Error(`${response.status} ${location}`);
  const json = await response.json();
  const hit = json.candidates?.[0];
  cache[location] = hit ? {
    lat: hit.location.y,
    lng: hit.location.x,
    score: hit.score,
    label: hit.address,
    country: hit.attributes?.Country || '',
    countryCode: hit.attributes?.CountryCode || '',
    region: hit.attributes?.Region || '',
    city: hit.attributes?.City || ''
  } : null;
}

for (let i = 0; i < unique.length; i += 10) {
  const batch = unique.slice(i, i + 10);
  await Promise.all(batch.map(async (location) => {
    try { await geocode(location); }
    catch (error) { console.error(error.message); cache[location] = null; }
  }));
  await fs.writeFile(cachePath, JSON.stringify(cache, null, 2));
  console.log(`${Math.min(i + batch.length, unique.length)}/${unique.length}`);
}

const out = source.map((row, index) => ({ id: index + 1, ...row, geo: row.location ? cache[row.location] || null : null }));
await fs.writeFile(new URL('./students-geocoded.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(`mapped ${out.filter((row) => row.geo).length}/${out.length}`);
