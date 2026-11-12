import { useEffect } from 'react';
import { MapContainer, TileLayer, Circle, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

const pin = (cls = '') => L.divIcon({ className: '', html: `<div class="af-pin ${cls}"></div>`, iconSize: [22, 22], iconAnchor: [11, 11] });

function FlyTo({ point }) {
  const map = useMap();
  useEffect(() => {
    if (point) map.flyTo([point.lat, point.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [point?.lat, point?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function ClickToPlace({ onChange }) {
  useMapEvents({ click: (e) => onChange({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

// Customer drops (or drags) a pin. The shaded circle is the delivery area around the restaurant.
export default function MapPicker({ center, radiusKm, value, onChange, height = 320 }) {
  return (
    <MapContainer center={center} zoom={13} style={{ height, width: '100%' }} className="rounded-xl border border-ink/15">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Circle center={center} radius={radiusKm * 1000} pathOptions={{ color: '#1B7A3D', weight: 2, fillOpacity: 0.06 }} />
      <Marker position={center} icon={pin('rider')} interactive={false} />
      {value && (
        <Marker
          position={[value.lat, value.lng]}
          icon={pin()}
          draggable
          eventHandlers={{ dragend: (e) => onChange({ lat: e.target.getLatLng().lat, lng: e.target.getLatLng().lng }) }}
        />
      )}
      <ClickToPlace onChange={onChange} />
      <FlyTo point={value} />
    </MapContainer>
  );
}

// Read-only map for order tracking: where the rider is (green) and where the food is going (red).
export function TrackMap({ rider, destination, height = 260 }) {
  const dest = [destination.lat, destination.lng];
  return (
    <MapContainer center={rider ? [rider.lat, rider.lng] : dest} zoom={14} style={{ height, width: '100%' }} className="rounded-xl border border-ink/15">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={dest} icon={pin()} />
      {rider && <Marker position={[rider.lat, rider.lng]} icon={pin('rider')} />}
      <FlyTo point={rider || { lat: destination.lat, lng: destination.lng }} />
    </MapContainer>
  );
}
