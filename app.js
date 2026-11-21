const STORAGE_KEY = 'afterhours_reports_v1';

// Seed 4 realistic sample reports so the map and Pie Charts look rich immediately
function initializeData() {
  if (!localStorage.getItem(STORAGE_KEY)) {
    const sampleReports = [
      {
        id: 101,
        category: 'Broken Streetlight',
        description: 'Three consecutive streetlights out near the bus bay. Very dark.',
        lat: 12.9237,
        lng: 77.4987,
        photo: null,
        status: 'Pending'
      },
      {
        id: 102,
        category: 'Damaged Footpath',
        description: 'Open drain slab near metro exit, hard to spot at night.',
        lat: 12.9279,
        lng: 77.5021,
        photo: null,
        status: 'Resolved'
      },
      {
        id: 103,
        category: 'Unsafe Transit Stop',
        description: 'Bus shelter has no overhead light and zero visibility after 9 PM.',
        lat: 12.9251,
        lng: 77.5045,
        photo: null,
        status: 'Pending'
      },
      {
        id: 104,
        category: 'Dark Stretch / Blind Spot',
        description: 'Tree branches blocking streetlight along the college back gate road.',
        lat: 12.9222,
        lng: 77.5012,
        photo: null,
        status: 'Pending'
      }
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleReports));
  }
}

function getReports() {
  initializeData();
  return JSON.parse(localStorage.getItem(STORAGE_KEY));
}

function saveReports(reports) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

// Initialize Leaflet Map
const map = L.map('map').setView([12.9255, 77.5005], 15);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '© OpenStreetMap contributors © CARTO',
  maxZoom: 19
}).addTo(map);

let selectedPin = null;
let safetyCircle = null;
let gpsWatchId = null;
const markersLayer = L.layerGroup().addTo(map);

function createPinIcon(status) {
  const color = status === 'Resolved' ? '#10b981' : '#ef4444';
  return L.divIcon({
    className: 'custom-pin',
    html: `<div style="background-color:${color}; width:18px; height:18px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 10px ${color};"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });
}

// Live pulsing blue GPS dot icon
function createLiveGpsIcon() {
  return L.divIcon({
    className: 'live-gps-pin',
    html: `<div style="background-color:#38bdf8; width:18px; height:18px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 14px #38bdf8;"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });
}

// Haversine formula to calculate exact distance in meters
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Scan within 500m for unresolved hazards
function checkRouteProximity(lat, lng) {
  const box = document.getElementById('proximityBox');
  const reports = getReports();

  const nearbyPending = reports
    .filter(r => r.status === 'Pending')
    .map(r => ({ ...r, distance: getDistanceMeters(lat, lng, r.lat, r.lng) }))
    .filter(r => r.distance <= 500)
    .sort((a, b) => a.distance - b.distance);

  if (nearbyPending.length > 0) {
    const nearest = nearbyPending[0];
    box.className = 'proximity-alert';
    box.innerHTML = `
      <strong>⚠️ Route Warning (${nearbyPending.length} hazard${nearbyPending.length > 1 ? 's' : ''} within 500m):</strong><br/>
      Nearest: <em>${nearest.category}</em> is <strong>${nearest.distance}m away</strong>. Choose a well-lit route.
    `;
  } else {
    box.className = 'proximity-alert safe';
    box.innerHTML = `
      <strong>✅ Clear Radius (500m):</strong> No unresolved nighttime hazards reported near this location.
    `;
  }
}

function setLocation(lat, lng, isLiveGps = false) {
  document.getElementById('lat').value = lat.toFixed(6);
  document.getElementById('lng').value = lng.toFixed(6);

  if (selectedPin) map.removeLayer(selectedPin);
  if (safetyCircle) map.removeLayer(safetyCircle);

  const markerOptions = isLiveGps ? { icon: createLiveGpsIcon() } : {};
  const label = isLiveGps ? 'Live GPS Location (500m Safety Scan)' : 'Pinned Location (500m Safety Scan)';

  selectedPin = L.marker([lat, lng], markerOptions).addTo(map).bindPopup(label).openPopup();

  safetyCircle = L.circle([lat, lng], {
    radius: 500,
    color: '#38bdf8',
    fillColor: '#38bdf8',
    fillOpacity: 0.1,
    weight: 1
  }).addTo(map);

  checkRouteProximity(lat, lng);
}

// Click anywhere on map to pin
map.on('click', (e) => {
  setLocation(e.latlng.lat, e.latlng.lng, false);
});

// Single GPS Snapshot Button
document.getElementById('locateBtn').addEventListener('click', () => {
  if (!navigator.geolocation) {
    return alert('Geolocation is not supported by your browser.');
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      map.setView([latitude, longitude], 16);
      setLocation(latitude, longitude, true);
    },
    () => alert('GPS blocked by browser/PC settings. Click anywhere directly on the map instead!')
  );
});

// Continuous Live GPS Tracking Button (watchPosition)
const liveTrackBtn = document.getElementById('liveTrackBtn');
const gpsStatusBox = document.getElementById('gpsStatusBox');

liveTrackBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    return alert('Geolocation is not supported by your browser.');
  }

  if (gpsWatchId !== null) {
    // Stop Live GPS
    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
    liveTrackBtn.textContent = 'Start Live GPS';
    liveTrackBtn.classList.remove('tracking');
    gpsStatusBox.style.display = 'none';
  } else {
    // Start Live GPS
    liveTrackBtn.textContent = 'Stop Live GPS';
    liveTrackBtn.classList.add('tracking');
    gpsStatusBox.style.display = 'block';
    gpsStatusBox.textContent = '📡 Acquiring live GPS satellite lock...';

    gpsWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        map.setView([latitude, longitude], 16);
        setLocation(latitude, longitude, true);
        gpsStatusBox.innerHTML = `📡 <strong>Live GPS Active</strong> | Accuracy: ±${Math.round(accuracy)}m | Updating automatically as you move.`;
      },
      () => {
        gpsStatusBox.innerHTML = '⚠️ Lab PC GPS unavailable. Click anywhere on the map to simulate movement.';
      },
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
  }
});

// Render hazard pins
function renderMarkers() {
  const reports = getReports();
  markersLayer.clearLayers();

  reports.forEach(report => {
    const photoHtml = report.photo
      ? `<img src="${report.photo}" alt="Hazard evidence" style="width:100%; max-height:140px; object-fit:cover; border-radius:4px; margin-top:8px;" />`
      : '';

    const popupContent = `
      <div style="color:#111; min-width:200px;">
        <strong style="font-size:14px;">${report.category}</strong><br/>
        <span style="font-size:11px; font-weight:bold; color:${report.status === 'Resolved' ? '#059669' : '#dc2626'};">
          Status: ${report.status}
        </span>
        <p style="margin:6px 0; font-size:13px;">${report.description}</p>
        ${photoHtml}
      </div>
    `;

    L.marker([report.lat, report.lng], { icon: createPinIcon(report.status) })
      .bindPopup(popupContent)
      .addTo(markersLayer);
  });
}

// Convert uploaded photo to Base64
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Submit Form
document.getElementById('reportForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const lat = parseFloat(document.getElementById('lat').value);
  const lng = parseFloat(document.getElementById('lng').value);
  if (isNaN(lat) || isNaN(lng)) {
    return alert('Please click on the map or use GPS to pin the location first.');
  }

  const category = document.getElementById('category').value;
  const description = document.getElementById('description').value;
  const photoInput = document.getElementById('photo');

  let photoDataUrl = null;
  if (photoInput.files && photoInput.files[0]) {
    photoDataUrl = await readFileAsDataURL(photoInput.files[0]);
  }

  const newReport = {
    id: Date.now(),
    category,
    description,
    lat,
    lng,
    photo: photoDataUrl,
    status: 'Pending'
  };

  const reports = getReports();
  reports.unshift(newReport);
  saveReports(reports);

  alert('Hazard report saved! View it on the Map or check the Pie Chart in Admin & Analytics.');
  e.target.reset();
  if (selectedPin) map.removeLayer(selectedPin);
  if (safetyCircle) map.removeLayer(safetyCircle);
  renderMarkers();
});

renderMarkers();