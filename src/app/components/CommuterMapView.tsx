import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { DivIcon, type LatLngBoundsExpression } from 'leaflet';
import { Toaster } from 'sonner';
import 'leaflet/dist/leaflet.css';
import type { SeatStatus } from '../hooks/useJeepSimulation';
import { useJeepAlarm } from '../hooks/useJeepAlarm';
import { PinpointAlarm } from './PinpointAlarm';

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
const PHILIPPINES_BOUNDS: LatLngBoundsExpression = [
  [4.5, 116.8],
  [21.3, 127.4],
];

interface RealDriverLocation {
  driverId: string;
  name: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  seatStatus: 'space' | 'full';
  timestamp: number;
  jeepId?: string;
  route?: string;
}

export interface CommuterJeepney {
  id: string;
  lat: number;
  lng: number;
  route: string;
  seatStatus: SeatStatus;
}

interface CommuterMapViewProps {
  jeepneys: CommuterJeepney[];
}

interface AlarmDraft {
  jeepId: string;
  route: string;
  thresholdKm: number;
}

interface ActiveAlarm {
  jeepId: string;
  thresholdKm: number;
}

const CEBU_FALLBACK: [number, number] = [10.3157, 123.8854];

const SEAT_COLOR: Record<SeatStatus, string> = {
  many: '#16a34a',
  few: '#16a34a',
  full: '#dc2626',
};

const SEAT_LABEL: Record<SeatStatus, string> = {
  many: 'Seats available',
  few: 'Seats available',
  full: 'Full',
};

const SEAT_BG: Record<SeatStatus, string> = {
  many: 'bg-green-100 text-green-800',
  few: 'bg-green-100 text-green-800',
  full: 'bg-red-100 text-red-800',
};

function makeMarkerIcon(id: string, seatStatus: SeatStatus): DivIcon {
  const color = SEAT_COLOR[seatStatus];
  const shortId = id.split('-')[1] ?? id;

  return new DivIcon({
    html: `
      <div style="
        background: ${color};
        color: #fff;
        font-size: 10px;
        font-weight: 700;
        font-family: monospace;
        min-width: 46px;
        padding: 3px 5px;
        border-radius: 6px;
        border: 2px solid rgba(255,255,255,0.85);
        box-shadow: 0 2px 6px rgba(0,0,0,0.35);
        display: flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
      ">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="white">
          <rect x="3" y="11" width="18" height="10" rx="2"/>
          <path d="M7 11V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4" stroke="white" stroke-width="2" fill="none"/>
          <circle cx="8" cy="18" r="1.5" fill="white"/>
          <circle cx="16" cy="18" r="1.5" fill="white"/>
        </svg>
        ${shortId}
      </div>`,
    className: '',
    iconSize: [50, 22],
    iconAnchor: [25, 11],
    popupAnchor: [0, -16],
  });
}

function makeAlarmRingIcon(): DivIcon {
  return new DivIcon({
    html: `
      <div style="position:relative; width:34px; height:34px;">
        <span class="animate-ping" style="
          position:absolute; inset:0;
          border-radius:999px;
          background: rgba(59,130,246,0.35);
        "></span>
        <span style="
          position:absolute; inset:8px;
          border-radius:999px;
          background:#2563eb;
          border:2px solid #fff;
          box-shadow:0 0 0 2px rgba(37,99,235,0.35);
        "></span>
      </div>
    `,
    className: '',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function makeRealDriverIcon(seatStatus: 'space' | 'full', jeepId?: string, route?: string): DivIcon {
  const bg = seatStatus === 'full' ? '#dc2626' : '#16a34a';
  const label = jeepId ? (jeepId.split('-')[1] ?? jeepId) : '???';
  const routeChip = route ? (route.split(' - ')[0] ?? route) : null;
  return new DivIcon({
    html: `
      <div style="
        background:${bg};
        color:#fff;
        font-size:10px;
        font-weight:700;
        font-family:monospace;
        min-width:64px;
        padding:3px 7px;
        border-radius:6px;
        border:2.5px solid #fff;
        box-shadow:0 2px 8px rgba(0,0,0,0.4);
        display:flex;
        align-items:center;
        gap:4px;
        white-space:nowrap;
        position:relative;
      ">
        <span style="
          position:absolute;top:-5px;right:-5px;
          background:#facc15;color:#78350f;
          font-size:8px;font-weight:800;
          padding:1px 3px;border-radius:4px;
          line-height:1.2;
        ">LIVE</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="white">
          <rect x="3" y="11" width="18" height="10" rx="2"/>
          <path d="M7 11V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4" stroke="white" stroke-width="2" fill="none"/>
          <circle cx="8" cy="18" r="1.5" fill="white"/>
          <circle cx="16" cy="18" r="1.5" fill="white"/>
        </svg>
        ${label}
        ${routeChip ? `<span style="background:rgba(255,255,255,0.2); border:1px solid rgba(255,255,255,0.5); padding:1px 4px; border-radius:999px; font-size:8px; font-weight:800; letter-spacing:0.02em;">${routeChip}</span>` : ''}
      </div>`,
    className: '',
    iconSize: [88, 22],
    iconAnchor: [44, 11],
    popupAnchor: [0, -16],
  });
}

function FlyToLocation({ center }: { center: [number, number] }) {
  const map = useMap();
  const prev = useRef<[number, number] | null>(null);

  useEffect(() => {
    if (!prev.current || prev.current[0] !== center[0] || prev.current[1] !== center[1]) {
      map.flyTo(center, 15, { duration: 1.2 });
      prev.current = center;
    }
  }, [center, map]);

  return null;
}

const userDotIcon = new DivIcon({
  html: `
    <div style="position:relative; width:18px; height:18px;">
      <div style="
        position:absolute; inset:0;
        background:#2563eb;
        border-radius:50%;
        border:2.5px solid #fff;
        box-shadow:0 0 0 4px rgba(37,99,235,0.25);
      "></div>
    </div>
  `,
  className: '',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function formatDistance(distanceKm: number | null): string {
  if (distanceKm === null) return 'Calculating distance...';
  return `${distanceKm.toFixed(1)}km away`;
}

function areDriverLocationsEqual(a: RealDriverLocation[], b: RealDriverLocation[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (
      left.driverId !== right.driverId
      || left.lat !== right.lat
      || left.lng !== right.lng
      || left.accuracy !== right.accuracy
      || left.seatStatus !== right.seatStatus
      || left.timestamp !== right.timestamp
      || left.jeepId !== right.jeepId
      || left.route !== right.route
    ) {
      return false;
    }
  }
  return true;
}

export function CommuterMapView({ jeepneys }: CommuterMapViewProps) {
  const [center, setCenter] = useState<[number, number]>(CEBU_FALLBACK);
  const [gpsGranted, setGpsGranted] = useState(false);
  const [locating, setLocating] = useState(true);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);

  const [alarmDraft, setAlarmDraft] = useState<AlarmDraft | null>(null);
  const [activeAlarm, setActiveAlarm] = useState<ActiveAlarm | null>(null);

  // ── Real driver locations polled from the server every 3 s ───────────────
  const [realDrivers, setRealDrivers] = useState<RealDriverLocation[]>([]);
  useEffect(() => {
    const poll = async () => {
      try {
        const token = localStorage.getItem('ptis_token');
        const res = await fetch(`${API_BASE}/api/driver/locations`, {
          headers: { Authorization: `Bearer ${token ?? ''}` },
        });
        if (res.ok) {
          const data = await res.json();
          const next = [...(data.locations ?? [])].sort((l: RealDriverLocation, r: RealDriverLocation) =>
            l.driverId.localeCompare(r.driverId),
          );
          setRealDrivers((prev) => (areDriverLocationsEqual(prev, next) ? prev : next));
        }
      } catch {
        // ignore network blips
      }
    };
    poll();
    const id = setInterval(poll, 3_000);
    return () => clearInterval(id);
  }, []);

  // Track user location continuously for live distance updates.
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocating(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const next: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserPos({ lat: next[0], lng: next[1] });
        setCenter((prev) => (prev === CEBU_FALLBACK ? next : prev));
        setGpsGranted(true);
        setLocating(false);
      },
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 2_000 },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const {
    isActive: isAlarmActive,
    hasTriggered,
    trackedJeep,
    distanceKm,
    cancelAlarm,
  } = useJeepAlarm({
    targetJeepId: activeAlarm?.jeepId ?? null,
    thresholdKm: activeAlarm?.thresholdKm ?? 1,
    userLat: userPos?.lat ?? null,
    userLng: userPos?.lng ?? null,
    allJeepneys: jeepneys,
  });

  // Auto-cancel after one-time trigger.
  useEffect(() => {
    if (hasTriggered) {
      setActiveAlarm(null);
    }
  }, [hasTriggered]);

  const alarmTrackedJeep = useMemo(
    () => (activeAlarm ? jeepneys.find((j) => j.id === activeAlarm.jeepId) ?? null : null),
    [activeAlarm, jeepneys],
  );

  const openAlarmModal = (jeep: CommuterJeepney) => {
    setAlarmDraft({ jeepId: jeep.id, route: jeep.route, thresholdKm: 1 });
  };

  const setAlarm = () => {
    if (!alarmDraft) return;
    setActiveAlarm({ jeepId: alarmDraft.jeepId, thresholdKm: alarmDraft.thresholdKm });
    setAlarmDraft(null);
  };

  const clearAlarm = () => {
    cancelAlarm();
    setActiveAlarm(null);
  };

  const ringPos = alarmTrackedJeep ? ([alarmTrackedJeep.lat, alarmTrackedJeep.lng] as [number, number]) : null;

  const simulatedMarkers = useMemo(
    () => jeepneys.map((jeep) => ({
      ...jeep,
      icon: makeMarkerIcon(jeep.id, jeep.seatStatus),
    })),
    [jeepneys],
  );

  const liveMarkers = useMemo(
    () => realDrivers.map((driver) => ({
      ...driver,
      icon: makeRealDriverIcon(driver.seatStatus, driver.jeepId, driver.route),
    })),
    [realDrivers],
  );

  return (
    <div className="relative h-screen w-full overflow-hidden bg-gray-100">
      <Toaster position="top-center" richColors />

      {/* Top status bar */}
      <div className="absolute top-0 left-0 right-0 z-[1100] flex items-center justify-between px-4 py-2 bg-white/80 backdrop-blur-sm shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">LarGo</span>
          <span className="text-xs text-gray-400">Commuter View</span>
        </div>
        <div className="flex items-center gap-2">
          {locating && <span className="text-xs text-blue-500 animate-pulse">Locating...</span>}
          {!locating && gpsGranted && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
              GPS
            </span>
          )}
          {!locating && !gpsGranted && <span className="text-xs text-gray-400">Cebu City</span>}
          <span className="text-xs font-medium text-gray-600">{jeepneys.length} jeepneys</span>
          {realDrivers.length > 0 && (
            <span className="flex items-center gap-1 text-xs font-semibold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
              {realDrivers.length} live
            </span>
          )}
        </div>
      </div>

      {/* Active alarm banner */}
      {isAlarmActive && activeAlarm && trackedJeep && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-[1150] w-[min(95vw,560px)] bg-blue-600 text-white rounded-xl shadow-lg px-4 py-2.5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                Tracking {activeAlarm.jeepId} · Alarm at {activeAlarm.thresholdKm}km
              </p>
              <p className="text-xs text-blue-100 truncate">
                {trackedJeep.id} is {formatDistance(distanceKm)}
              </p>
            </div>
            <button
              onClick={clearAlarm}
              className="text-xs font-semibold bg-white/15 hover:bg-white/25 px-3 py-1 rounded-md"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <MapContainer
        center={center}
        zoom={15}
        minZoom={6}
        maxZoom={18}
        maxBounds={PHILIPPINES_BOUNDS}
        maxBoundsViscosity={1.0}
        preferCanvas
        className="h-full w-full"
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={18}
          noWrap
          bounds={PHILIPPINES_BOUNDS}
        />

        <FlyToLocation center={center} />

        {userPos && (
          <Marker position={[userPos.lat, userPos.lng]} icon={userDotIcon}>
            <Popup>
              <p className="text-xs font-medium">Your location</p>
            </Popup>
          </Marker>
        )}

        {/* Pulsing alarm ring marker */}
        {isAlarmActive && ringPos && (
          <Marker position={ringPos} icon={makeAlarmRingIcon()}>
            <Popup>
              <p className="text-xs font-semibold">Alarm tracking {activeAlarm?.jeepId}</p>
            </Popup>
          </Marker>
        )}

        {/* Real driver markers (from server) */}
        {liveMarkers.map((driver) => (
          <Marker
            key={driver.driverId}
            position={[driver.lat, driver.lng]}
            icon={driver.icon}
          >
            <Popup>
              <div className="min-w-[150px] space-y-1.5 py-0.5">
                <div className="flex items-center gap-2">
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-800">LIVE</span>
                  <span className="font-semibold text-sm text-gray-900">{driver.jeepId ?? driver.name}</span>
                </div>
                {driver.route && (
                  <p className="text-xs font-medium text-blue-700">{driver.route}</p>
                )}
                <p className="text-xs text-gray-500">
                  {driver.seatStatus === 'full' ? '🔴 Full' : '🟢 Space available'}
                </p>
                {driver.accuracy && (
                  <p className="text-[11px] text-gray-400">GPS ±{Math.round(driver.accuracy)} m</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Simulated jeep markers */}
        {simulatedMarkers.map((jeep) => (
          <Marker
            key={jeep.id}
            position={[jeep.lat, jeep.lng]}
            icon={jeep.icon}
            eventHandlers={{
              click: () => openAlarmModal(jeep),
            }}
          >
            <Popup>
              <div className="min-w-[160px] space-y-2 py-0.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-sm font-bold text-gray-900">{jeep.id}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SEAT_BG[jeep.seatStatus]}`}>
                    {SEAT_LABEL[jeep.seatStatus]}
                  </span>
                </div>
                <p className="text-xs text-gray-500 leading-snug">{jeep.route}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        <PinpointAlarm />
      </MapContainer>

      {/* Zoom controls */}
      <div className="absolute bottom-24 right-4 z-[1100] flex flex-col gap-1">
        {(['+', '−'] as const).map((label) => (
          <button
            key={label}
            aria-label={label === '+' ? 'Zoom in' : 'Zoom out'}
            onClick={() => {
              const map = (document.querySelector('.leaflet-container') as { _leaflet_map?: { zoomIn: () => void; zoomOut: () => void } } | null)?._leaflet_map;
              if (map) label === '+' ? map.zoomIn() : map.zoomOut();
            }}
            className="w-10 h-10 bg-white rounded-xl shadow-md text-gray-700 font-bold text-lg flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-transform"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Seat status legend */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1100] flex items-center gap-3 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg px-4 py-2">
        {(['many', 'full'] as const).map((status) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: SEAT_COLOR[status] }} />
            <span className="text-xs text-gray-600 capitalize">{SEAT_LABEL[status]}</span>
          </div>
        ))}
      </div>

      {/* Alarm panel/modal */}
      {alarmDraft && (
        <div className="absolute inset-0 z-[1200] bg-black/30 backdrop-blur-[1px] flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">Set Jeepney Alarm</h2>
              <p className="text-xs text-gray-500 mt-1">Get alerted when this jeepney gets close.</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 space-y-1">
              <p className="text-sm font-mono font-bold text-gray-900">{alarmDraft.jeepId}</p>
              <p className="text-xs text-gray-500">{alarmDraft.route}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="alarm-distance" className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Distance
                </label>
                <span className="text-sm font-bold text-blue-700">{alarmDraft.thresholdKm}km</span>
              </div>
              <input
                id="alarm-distance"
                type="range"
                min={1}
                max={3}
                step={1}
                value={alarmDraft.thresholdKm}
                onChange={(e) => setAlarmDraft((prev) => (prev ? { ...prev, thresholdKm: Number(e.target.value) } : prev))}
                className="w-full"
              />
              <div className="flex justify-between text-[11px] text-gray-400 px-0.5">
                <span>1km</span>
                <span>2km</span>
                <span>3km</span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={setAlarm}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg"
              >
                Set Alarm
              </button>
              <button
                onClick={() => setAlarmDraft(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold py-2.5 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
