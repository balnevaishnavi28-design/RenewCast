// RenewCast AI — Leaflet map
let mapInst    = null;
let mapMarker  = null;

function renderMap(lat, lon, name) {
    if (!mapInst) {
        mapInst = L.map("map").setView([lat, lon], 10);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "© OpenStreetMap contributors",
        }).addTo(mapInst);
    } else {
        mapInst.setView([lat, lon], 10);
        if (mapMarker) mapInst.removeLayer(mapMarker);
    }
    mapMarker = L.marker([lat, lon])
        .addTo(mapInst)
        .bindPopup(`<b>${name}</b><br>${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`)
        .openPopup();
}
