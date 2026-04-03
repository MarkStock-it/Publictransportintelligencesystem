/**
 * PinpointAlarm.tsx
 *
 * Self-contained component that renders inside a react-leaflet MapContainer.
 *
 * Usage — drop it anywhere inside your <MapContainer>:
 *
 *   <MapContainer ...>
 *     <TileLayer ... />
 *     <PinpointAlarm />
 *   </MapContainer>
 *
 * Features
 * ────────
 * • Click-to-pin: toggle "Set Pin" mode, then click the map to drop a pin.
 * • Radius slider: 50 m – 10 000 m with real-time circle overlay.
 * • Visual circle drawn around the pin (react-leaflet Circle).
 * • Pulsing red pin marker when alarm is armed.
 * • Status panel: distance, armed/triggered/clear states.
 * • Multi-beep audio + browser notification on entry.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Circle, Marker, useMapEvents } from 'react-leaflet';
import { DivIcon } from 'leaflet';
import { MapPin, BellRing, BellOff, Crosshair, X, RotateCcw } from 'lucide-react';
import { usePinpointAlarm } from '../hooks/usePinpointAlarm';

// ─── Pin marker icon ──────────────────────────────────────────────────────────

function makePinIcon(armed: boolean, triggered: boolean): DivIcon {
  const color = triggered ? '#22c55e' : armed ? '#ef4444' : '#6366f1';
  const pulse = armed && !triggered;

  return new DivIcon({
    html: `
      <div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;">
        ${
          pulse
            ? `<div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:0.25;animation:ping 1.2s cubic-bezier(0,0,0.2,1) infinite;"></div>`
            : ''
        }
        <div style="width:28px;height:28px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
      </div>
      <style>
        @keyframes ping {
          75%,100%{transform:scale(2.2);opacity:0}
        }
      </style>
    `,
    className: 'pinpoint-alarm-marker',
    iconSize: [36, 44],
    iconAnchor: [18, 44],
  });
}

// ─── Map click interceptor ────────────────────────────────────────────────────

interface MapClickHandlerProps {
  active: boolean;
  onMapClick: (lat: number, lng: number) => void;
}

function MapClickHandler({ active, onMapClick }: MapClickHandlerProps) {
  useMapEvents({
    click(e) {
      if (!active) return;
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// ─── Distance formatter ───────────────────────────────────────────────────────

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

// ─── Main component ────────────────────────────────────────────────────────────

export function PinpointAlarm() {
  const {
    pin,
    radiusMeters,
    distanceMeters,
    isArmed,
    hasTriggered,
    isLocating,
    geoError,
    userPosition,
    setPin,
    setRadiusMeters,
    cancelAlarm,
    clearPin,
    resetAlarm,
  } = usePinpointAlarm();

  const [isPinMode, setIsPinMode] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  // When user drops a pin, exit pin-placement mode.
  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      setPin({ lat, lng, label: 'pinned location' });
      setIsPinMode(false);
    },
    [setPin],
  );

  // Status label
  const statusLabel = (() => {
    if (geoError === 1) return { text: 'Location access denied', color: 'text-red-500' };
    if (geoError === 2) return { text: 'Location unavailable', color: 'text-red-500' };
    if (isLocating) return { text: 'Getting GPS fix…', color: 'text-yellow-500' };
    if (!pin) return { text: 'No pin set — click "Set Pin" then tap the map', color: 'text-gray-500' };
    if (hasTriggered) return { text: 'You reached the pinned location!', color: 'text-green-600' };
    if (isArmed && distanceMeters !== null && distanceMeters <= radiusMeters)
      return { text: 'Inside radius — alarm firing!', color: 'text-red-600' };
    if (isArmed)
      return {
        text: distanceMeters !== null ? `Armed — ${formatDistance(distanceMeters)} to pin` : 'Armed — waiting for GPS…',
        color: 'text-indigo-600',
      };
    return { text: 'Alarm disarmed', color: 'text-gray-500' };
  })();

  // Circle fill colour
  const circleColor = hasTriggered ? '#22c55e' : isArmed ? '#ef4444' : '#6366f1';

  return (
    <>
      {/* Map interaction layer */}
      <MapClickHandler active={isPinMode} onMapClick={handleMapClick} />

      {/* Pin marker */}
      {pin && (
        <Marker
          position={[pin.lat, pin.lng]}
          icon={makePinIcon(isArmed, hasTriggered)}
        />
      )}

      {/* Radius circle */}
      {pin && (
        <Circle
          center={[pin.lat, pin.lng]}
          radius={radiusMeters}
          pathOptions={{
            color: circleColor,
            fillColor: circleColor,
            fillOpacity: 0.12,
            weight: 2,
            dashArray: isArmed && !hasTriggered ? '6 4' : undefined,
          }}
        />
      )}

      {/* ── Control panel ─────────────────────────────────────────────── */}
      <div
        style={{ zIndex: 1200 }}
        className="absolute right-4 top-16 w-[min(24rem,calc(100vw-1rem))] select-none"
      >
        {/* Toggle header */}
        <button
          onClick={() => setPanelOpen((o) => !o)}
          className="w-full flex items-center justify-between bg-gradient-to-r from-indigo-600 to-blue-600 rounded-t-2xl px-4 py-2.5 shadow-xl border border-indigo-500 text-sm font-semibold text-white hover:brightness-105 transition"
        >
          <span className="flex items-center gap-2">
            <MapPin size={15} className="text-white" />
            Pinpoint Alarm
            {isArmed && !hasTriggered && (
              <span className="ml-1 h-2 w-2 rounded-full bg-red-300 animate-pulse" />
            )}
          </span>
          <span className="text-xs text-indigo-100">{panelOpen ? '▲' : '▼'}</span>
        </button>

        {panelOpen && (
          <div className="bg-white/95 rounded-b-2xl shadow-xl border border-t-0 border-indigo-100 p-4 backdrop-blur-sm flex flex-col gap-3">

            {/* Status */}
            <p className={`text-xs font-medium ${statusLabel.color}`}>
              {statusLabel.text}
            </p>

            {/* GPS indicator */}
            {userPosition && (
              <p className="text-[11px] text-gray-400 flex items-center gap-1">
                <Crosshair size={11} />
                Your GPS: {userPosition.lat.toFixed(5)}, {userPosition.lng.toFixed(5)}
              </p>
            )}

            {/* Radius slider */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600 font-medium">Radius</span>
                <span className="text-xs font-bold text-indigo-600">
                  {formatDistance(radiusMeters)}
                </span>
              </div>
              <input
                type="range"
                min={50}
                max={10000}
                step={50}
                value={radiusMeters}
                onChange={(e) => setRadiusMeters(Number(e.target.value))}
                className="w-full accent-indigo-500"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                <span>50 m</span>
                <span>10 km</span>
              </div>
            </div>

            {/* Pin coordinate display */}
            {pin && (
              <p className="text-[11px] text-gray-500 bg-gray-50 rounded px-2 py-1">
                Pin: {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
              </p>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setIsPinMode((m) => !m)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  isPinMode
                    ? 'bg-indigo-600 text-white'
                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                }`}
              >
                <MapPin size={13} />
                {isPinMode ? 'Click map to pin…' : pin ? 'Move Pin' : 'Set Pin'}
              </button>

              {isArmed && !hasTriggered && (
                <button
                  onClick={cancelAlarm}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-yellow-50 text-yellow-700 hover:bg-yellow-100 transition-colors"
                >
                  <BellOff size={13} />
                  Disarm
                </button>
              )}

              {!isArmed && !hasTriggered && pin && (
                <button
                  onClick={resetAlarm}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                >
                  <BellRing size={13} />
                  Arm
                </button>
              )}

              {hasTriggered && (
                <button
                  onClick={resetAlarm}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                >
                  <RotateCcw size={13} />
                  Reset
                </button>
              )}

              {pin && (
                <button
                  onClick={clearPin}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                >
                  <X size={13} />
                  Clear
                </button>
              )}
            </div>

            {/* Triggered celebration */}
            {hasTriggered && (
              <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700 font-medium text-center">
                ✓ Alarm triggered — you reached the pin!
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
