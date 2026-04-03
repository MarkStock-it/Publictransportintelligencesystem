/**
 * Example — Integrated Vehicle Tracking + Pinpoint Alarm in a Map Component
 *
 * This demonstrates how to wire together:
 * 1. useVehicleTracking() — live vehicle data (Supabase)
 * 2. usePinpointAlarm() — GPS-based location alarm
 * 3. PinpointAlarm component — UI controls
 *
 * Copy and adapt this for your own map component!
 */

import { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import { DivIcon, divIcon } from 'leaflet';

import { useVehicleTracking } from '../hooks/useVehicleTracking';
import { usePinpointAlarm } from '../hooks/usePinpointAlarm';
import { PinpointAlarm } from '../components/PinpointAlarm';

// Custom marker icon for vehicles
function makeVehicleIcon(type: 'taxi' | 'jeepney', color: string) {
  return new DivIcon({
    html: `
      <div style="
        background: ${color};
        width: 32px; height: 32px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex; align-items: center; justify-content: center;
      ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
          <rect x="3" y="11" width="18" height="10" rx="2"/>
          <path d="M7 11V7a2 2 0 012-2h6a2 2 0 012 2v4"/>
          <circle cx="8" cy="18" r="1"/>
          <circle cx="16" cy="18" r="1"/>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

export function IntegratedMapExample() {
  // ──────────────────────────────────────────────────────────────────────
  // 1. Live Vehicle Tracking from Supabase
  // ──────────────────────────────────────────────────────────────────────

  const {
    jeepneys,
    taxis,
    connectionState,
    isSimulationOnly,
    updateLocation,
    getNearbyVehicles,
  } = useVehicleTracking();

  // ──────────────────────────────────────────────────────────────────────
  // 2. Pinpoint Alarm State
  // ──────────────────────────────────────────────────────────────────────

  const alarm = usePinpointAlarm();

  // ──────────────────────────────────────────────────────────────────────
  // 3. Local state for demo
  // ──────────────────────────────────────────────────────────────────────

  const connectionLabel = {
    CONNECTING: '🔄 Connecting…',
    CONNECTED: '✅ Live (WebSocket)',
    DISCONNECTED: '⚠️ Offline (Polling)',
  }[connectionState];

  const nearbyVehiclesLabel = useMemo(() => {
    return `${jeepneys.length} jeepneys, ${taxis.length} taxis nearby`;
  }, [jeepneys.length, taxis.length]);

  // ──────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header with status */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vehicle Tracking Map</h1>
          <p className="text-sm text-gray-600 mt-1">
            {isSimulationOnly ? (
              <span className="text-yellow-600">
                🟡 Supabase not configured — showing simulation data
              </span>
            ) : (
              <span className="text-green-600">{connectionLabel}</span>
            )}
          </p>
        </div>
        <div className="text-right text-sm text-gray-700">
          <div className="font-semibold">{nearbyVehiclesLabel}</div>
          {alarm.pin && (
            <div className="text-indigo-600 font-medium">
              📍 Pin set • {alarm.radiusMeters}m radius
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <MapContainer
          center={[10.3157, 123.8854]}
          zoom={14}
          className="h-full w-full"
          zoomControl={false}
        >
          {/* Base map layer */}
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='© OpenStreetMap contributors'
          />

          {/* ──────────────────────────────────────────────────────────── */}
          {/* Jeepney Markers */}
          {/* ──────────────────────────────────────────────────────────── */}
          {jeepneys.map((jeepney) => (
            <Marker
              key={jeepney.id}
              position={[jeepney.lat, jeepney.lng]}
              icon={makeVehicleIcon('jeepney', '#10b981')}
            >
              <Popup className="rounded-lg">
                <div className="text-sm">
                  <div className="font-bold">{jeepney.id}</div>
                  <div className="text-gray-600">{jeepney.route}</div>
                  <div>
                    Speed: {jeepney.speed?.toFixed(1) ?? '?'} km/h
                  </div>
                  <div>
                    Passengers: {jeepney.passengerCount}/{jeepney.capacity}
                  </div>
                  <button
                    onClick={() => {
                      alarm.setPin({
                        lat: jeepney.lat,
                        lng: jeepney.lng,
                        label: jeepney.id,
                      });
                    }}
                    className="mt-2 px-2 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600"
                  >
                    Set Alarm for this Vehicle
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* ──────────────────────────────────────────────────────────── */}
          {/* Taxi Markers */}
          {/* ──────────────────────────────────────────────────────────── */}
          {taxis.map((taxi) => (
            <Marker
              key={taxi.id}
              position={[taxi.lat, taxi.lng]}
              icon={makeVehicleIcon('taxi', '#f59e0b')}
            >
              <Popup className="rounded-lg">
                <div className="text-sm">
                  <div className="font-bold">{taxi.id}</div>
                  <div className="text-gray-600">{taxi.route || 'No route'}</div>
                  <div>
                    Speed: {taxi.speed?.toFixed(1) ?? '?'} km/h
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* ──────────────────────────────────────────────────────────── */}
          {/* Pinpoint Alarm UI (click to set pins, radius slider, status) */}
          {/* ──────────────────────────────────────────────────────────── */}
          <PinpointAlarm />
        </MapContainer>
      </div>

      {/* Footer — Demo info */}
      <div className="bg-white border-t border-gray-200 px-6 py-3 text-xs text-gray-600">
        <div className="max-w-3xl">
          <strong>Demo Controls:</strong> Click the Pinpoint Alarm panel to set a location pin on
          the map. Adjust the radius, then move your device to test the alarm. Click a vehicle
          popup to set its position as the alarm target.
        </div>
      </div>
    </div>
  );
}

export default IntegratedMapExample;
