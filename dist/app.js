const map = L.map('map', { worldCopyJump: true, minZoom: 2, zoomControl: false }).setView([27, 8], 2);
L.control.zoom({ position: 'bottomright' }).addTo(map);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 48, spiderfyOnMaxZoom: true, disableClusteringAtZoom: 10 });
const safe = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[character]);
const normalize = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const linkedIn = (url = '') => {
  if (!url) return '';
  const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  try { return new URL(normalized).hostname.toLowerCase().endsWith('linkedin.com') ? normalized : ''; }
  catch { return ''; }
};
const iconFor = (index) => L.divIcon({
  className: '', iconSize: [42, 55], iconAnchor: [21, 54], popupAnchor: [0, -45],
  html: `<div class="agent-pin" style="--pin:${index % 2 ? '#ff9fc7' : '#ffd500'}"><span class="${index % 2 ? 'lumi-pin' : 'glo-pin'}"></span></div>`
});

let members = [];
let markerEntries = [];
const search = document.querySelector('#place');
const results = document.querySelector('#results');
const searchStatus = document.querySelector('#searchStatus');

function locationValues(member) {
  return [...(member.search?.country || []), ...(member.search?.state || []), ...(member.search?.city || [])].map(normalize);
}
function searchableValues(member) {
  return [member.name, member.company, member.title, member.location, member.submittedLocation, ...locationValues(member)].map(normalize);
}
function matchesFor(query) {
  const q = normalize(query);
  if (!q) return members;
  const hasExactLocation = members.some((member) => locationValues(member).includes(q));
  if (hasExactLocation) return members.filter((member) => locationValues(member).includes(q) || normalize(member.name) === q);
  return members.filter((member) => searchableValues(member).some((value) => value.includes(q)));
}
function setVisibleMembers(hits) {
  const hitIds = new Set(hits.map((member) => member.id));
  cluster.clearLayers();
  cluster.addLayers(markerEntries.filter(({ member }) => hitIds.has(member.id)).map(({ marker }) => marker));
}
function openMember(member) {
  const entry = markerEntries.find((item) => item.member.id === member.id);
  if (!entry) return;
  map.setView(entry.marker.getLatLng(), Math.max(map.getZoom(), 7), { animate: true });
  cluster.zoomToShowLayer(entry.marker, () => entry.marker.openPopup());
}
function statusText(count, query) {
  const noun = count === 1 ? 'person' : 'people';
  return query ? `${count} ${noun} found for “${query.trim()}”` : `${count} ${noun} on the map`;
}
function renderResults(query) {
  const hits = matchesFor(query);
  const hasQuery = Boolean(query.trim());
  searchStatus.textContent = statusText(hits.length, hasQuery ? query : '');
  setVisibleMembers(hits);
  if (!hasQuery) {
    results.classList.remove('active');
    results.innerHTML = '';
    return;
  }
  results.innerHTML = hits.length
    ? hits.map((member) => `<button class="result" role="option" data-id="${member.id}"><strong>${safe(member.name || 'Name not provided')}</strong><small>${safe(member.location)}</small></button>`).join('')
    : '<div class="result empty"><small>No matching people or locations</small></div>';
  results.classList.add('active');
}

search.addEventListener('input', (event) => renderResults(event.target.value));
search.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { search.value = ''; renderResults(''); search.focus(); }
});
results.addEventListener('click', (event) => {
  const button = event.target.closest('[data-id]');
  if (button) openMember(members.find((member) => member.id === Number(button.dataset.id)));
});

fetch('./students.json').then((response) => response.json()).then((data) => {
  members = data;
  members.forEach((member, index) => {
    const url = linkedIn(member.linkedin);
    const role = [member.title, member.company].filter(Boolean).join(' · ');
    const marker = L.marker([member.geo.lat, member.geo.lng], { icon: iconFor(index), title: member.name || 'Cohort member' });
    marker.bindPopup(`<article class="profile"><h3>${safe(member.name || 'Name not provided')}</h3>${role ? `<p class="role">${safe(role)}</p>` : ''}<p class="place">${safe(member.location)}</p>${url ? `<a href="${safe(url)}" target="_blank" rel="noopener noreferrer">View LinkedIn</a>` : ''}</article>`);
    marker.on('mouseover', () => marker.openPopup());
    markerEntries.push({ member, marker });
  });
  map.addLayer(cluster);
  renderResults('');
}).catch(() => {
  searchStatus.textContent = 'The cohort map could not load.';
  results.innerHTML = '<div class="result empty"><small>Please refresh the page.</small></div>';
  results.classList.add('active');
});
