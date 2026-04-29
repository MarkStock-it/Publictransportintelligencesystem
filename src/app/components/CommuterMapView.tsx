import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { DivIcon, type LatLngBoundsExpression } from 'leaflet';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import 'leaflet/dist/leaflet.css';
import type { SeatStatus } from '../hooks/useJeepSimulation';
import { useJeepAlarm } from '../hooks/useJeepAlarm';
import { PinpointAlarm } from './PinpointAlarm';
import { Toaster } from './ui/sonner';
import {
  JEEPNEY_ROUTES,
  findRouteOptions,
  type Coordinates as PlannerCoordinates,
  type Route,
  type RouteMatch,
} from '../data/jeepneyRoutes';
import { drawRouteSegment } from '../services/routeDrawing';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

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
  onLogout?: () => void;
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

interface RecentSearch {
  start: string;
  end: string;
  updatedAt: number;
}

const CEBU_FALLBACK: [number, number] = [10.3157, 123.8854];
const TRIP_PLANNER_ROUTE = JEEPNEY_ROUTES[0];
const TRIP_PLANNER_STOPS = [...TRIP_PLANNER_ROUTE.stops].sort((a, b) => a.order - b.order);
const TRIP_PLANNER_ROUTES: Route[] = JEEPNEY_ROUTES.map((route) => ({
  ...route,
  path: route.path.map((point) => [...point] as PlannerCoordinates),
  stops: route.stops.map((stop) => ({
    ...stop,
    coords: [...stop.coords] as PlannerCoordinates,
  })),
}));

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

const ROUTE_BADGE_BG: Record<string, string> = {
  '21FE': 'bg-blue-100 text-blue-800 border-blue-300',
};

const RECENT_SEARCHES_STORAGE_KEY = 'largo_commuter_recent_searches_v1';
const FAVORITE_ROUTES_STORAGE_KEY = 'largo_commuter_favorite_routes_v1';

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage write errors
  }
}

function estimateEtaMinutes(distanceKm: number): number {
  const urbanSpeedKmH = 18;
  return Math.max(2, Math.round((distanceKm / urbanSpeedKmH) * 60));
}

function plannerPathDistanceKm(route: Route, start: PlannerCoordinates, end: PlannerCoordinates): number {
  const startIdx = route.path.findIndex((p) => pointsEqual(p, start));
  const endIdx = route.path.findIndex((p) => pointsEqual(p, end));
  if (startIdx < 0 || endIdx < 0 || endIdx <= startIdx) return 0;

  let km = 0;
  for (let i = startIdx; i < endIdx; i += 1) {
    const a = route.path[i];
    const b = route.path[i + 1];
    km += Math.hypot((b[0] - a[0]) * 111, (b[1] - a[1]) * 111);
  }
  return km;
}

function makeMarkerIcon(id: string, seatStatus: SeatStatus): DivIcon {
  const color = SEAT_COLOR[seatStatus];
  const shortId = id.split('-')[1] ?? id;

  return new DivIcon({
    html: `
      <div class="jeep-icon-wrap">
        <span class="jeep-icon-pulse" style="background:${color};"></span>
        <div style="
          position:relative;
          background: ${color};
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          font-family: monospace;
          min-width: 46px;
          padding: 3px 5px;
          border-radius: 999px;
          border: 2px solid rgba(255,255,255,0.85);
          box-shadow: 0 8px 18px rgba(0,0,0,0.28);
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
        </div>
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
      <div class="jeep-icon-wrap">
        <span class="jeep-icon-pulse" style="background:${bg};"></span>
        <div style="
          background:${bg};
          color:#fff;
          font-size:10px;
          font-weight:700;
          font-family:monospace;
          min-width:64px;
          padding:3px 7px;
          border-radius:999px;
          border:2.5px solid #fff;
          box-shadow:0 10px 22px rgba(0,0,0,0.32);
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
        </div>
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

function pointsEqual(a: PlannerCoordinates, b: PlannerCoordinates): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function RoutePlannerLayer({ match }: { match: RouteMatch | null }) {
  const map = useMap();
  const routeLayerRef = useRef<ReturnType<typeof drawRouteSegment> | null>(null);

  useEffect(() => {
    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }

    map.eachLayer((layer) => {
      const paneName = (layer as { options?: { pane?: string } }).options?.pane;
      if (paneName === 'route') {
        map.removeLayer(layer);
      }
    });

    if (!match) {
      return;
    }

    const route = TRIP_PLANNER_ROUTES.find((item) => item.id === match.routeId);
    if (!route) {
      return;
    }

    const startIndex = route.path.findIndex((point) => pointsEqual(point, match.boardingPoint));
    const endIndex = route.path.findIndex((point) => pointsEqual(point, match.alightingPoint));

    if (startIndex === -1 || endIndex === -1) {
      return;
    }

    routeLayerRef.current = drawRouteSegment(map, route.path, startIndex, endIndex);

    return () => {
      if (routeLayerRef.current) {
        routeLayerRef.current.remove();
        routeLayerRef.current = null;
      }
    };
  }, [map, match]);

  return null;
}

export function CommuterMapView({ jeepneys, onLogout }: CommuterMapViewProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [center, setCenter] = useState<[number, number]>(CEBU_FALLBACK);
  const [gpsGranted, setGpsGranted] = useState(false);
  const [locating, setLocating] = useState(true);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);

  const [alarmDraft, setAlarmDraft] = useState<AlarmDraft | null>(null);
  const [activeAlarm, setActiveAlarm] = useState<ActiveAlarm | null>(null);
  const [plannerStartInput, setPlannerStartInput] = useState(TRIP_PLANNER_STOPS[0]?.name ?? '');
  const [plannerEndInput, setPlannerEndInput] = useState(
    TRIP_PLANNER_STOPS[TRIP_PLANNER_STOPS.length - 1]?.name ?? '',
  );
  const [plannedTrip, setPlannedTrip] = useState<RouteMatch | null>(null);
  const [routeOptions, setRouteOptions] = useState<RouteMatch[]>([]);
  const [isRouteCalculating, setIsRouteCalculating] = useState(false);
  const [routeLookupError, setRouteLookupError] = useState<string | null>(null);
  const [isTripPlannerOpen, setIsTripPlannerOpen] = useState(false);
  const [isBottomInfoOpen, setIsBottomInfoOpen] = useState(true);
  const [isMobileView, setIsMobileView] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>(() =>
    typeof window === 'undefined' ? [] : readJSON<RecentSearch[]>(RECENT_SEARCHES_STORAGE_KEY, []),
  );
  const [favoriteRouteIds, setFavoriteRouteIds] = useState<string[]>(() =>
    typeof window === 'undefined' ? [] : readJSON<string[]>(FAVORITE_ROUTES_STORAGE_KEY, []),
  );

  const plannerTouchStartY = useRef<number | null>(null);

  const debouncedPlannerStart = useDebouncedValue(plannerStartInput, 300);
  const debouncedPlannerEnd = useDebouncedValue(plannerEndInput, 300);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    const applyMatch = (matches: boolean) => {
      setIsMobileView(matches);
      setIsTripPlannerOpen((prev) => (matches ? prev : true));
    };
    applyMatch(media.matches);

    const onChange = (event: MediaQueryListEvent) => applyMatch(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    writeJSON(RECENT_SEARCHES_STORAGE_KEY, recentSearches);
  }, [recentSearches]);

  useEffect(() => {
    writeJSON(FAVORITE_ROUTES_STORAGE_KEY, favoriteRouteIds);
  }, [favoriteRouteIds]);

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

  const selectedStartStop = useMemo(
    () => TRIP_PLANNER_STOPS.find((stop) => stop.name.toLowerCase() === debouncedPlannerStart.trim().toLowerCase()) ?? null,
    [debouncedPlannerStart],
  );

  const selectedEndStop = useMemo(
    () => TRIP_PLANNER_STOPS.find((stop) => stop.name.toLowerCase() === debouncedPlannerEnd.trim().toLowerCase()) ?? null,
    [debouncedPlannerEnd],
  );

  const plannedRouteName = useMemo(
    () => TRIP_PLANNER_ROUTES.find((route) => route.id === plannedTrip?.routeId)?.name ?? null,
    [plannedTrip],
  );

  const plannedRoute = useMemo(
    () => TRIP_PLANNER_ROUTES.find((route) => route.id === plannedTrip?.routeId) ?? TRIP_PLANNER_ROUTE,
    [plannedTrip],
  );

  useEffect(() => {
    if (!debouncedPlannerStart.trim() || !debouncedPlannerEnd.trim()) {
      setPlannedTrip(null);
      setRouteOptions([]);
      setRouteLookupError('Start and destination are required.');
      setIsRouteCalculating(false);
      return;
    }

    if (!selectedStartStop || !selectedEndStop) {
      setPlannedTrip(null);
      setRouteOptions([]);
      setRouteLookupError('Select a stop from the suggestions.');
      setIsRouteCalculating(false);
      return;
    }

    if (selectedStartStop.order >= selectedEndStop.order) {
      setPlannedTrip(null);
      setRouteOptions([]);
      setRouteLookupError(null);
      setIsRouteCalculating(false);
      return;
    }

    let cancelled = false;
    setIsRouteCalculating(true);
    setRouteLookupError(null);

    const frameId = window.requestAnimationFrame(() => {
      try {
        const options = findRouteOptions(
          selectedStartStop.coords as PlannerCoordinates,
          selectedEndStop.coords as PlannerCoordinates,
          TRIP_PLANNER_ROUTES,
        );
        const match = options[0] ?? null;

        if (cancelled) return;

        setRouteOptions(options);
        setPlannedTrip(match);
        if (!match) {
          setRouteLookupError('No matching route found for this stop pair under the walking limit.');
        }
        if (match) {
          setCenter(match.boardingPoint);
        }
      } catch {
        if (cancelled) return;
        setPlannedTrip(null);
        setRouteOptions([]);
        setRouteLookupError('Route lookup failed. Please try another stop combination.');
      } finally {
        if (!cancelled) {
          setIsRouteCalculating(false);
        }
      }
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
    };
  }, [debouncedPlannerEnd, debouncedPlannerStart, selectedEndStop, selectedStartStop]);

  useEffect(() => {
    if (!plannedTrip || !selectedStartStop || !selectedEndStop) return;

    const next: RecentSearch = {
      start: selectedStartStop.name,
      end: selectedEndStop.name,
      updatedAt: Date.now(),
    };

    setRecentSearches((prev) => {
      const deduped = prev.filter((item) => !(item.start === next.start && item.end === next.end));
      return [next, ...deduped].slice(0, 6);
    });
  }, [plannedTrip, selectedEndStop, selectedStartStop]);

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

  const swapPlannerPoints = () => {
    setPlannerStartInput(plannerEndInput);
    setPlannerEndInput(plannerStartInput);
    toast.success('Start and destination swapped.');
  };

  const applyRecentSearch = (entry: RecentSearch) => {
    setPlannerStartInput(entry.start);
    setPlannerEndInput(entry.end);
    if (isMobileView) setIsTripPlannerOpen(true);
  };

  const toggleFavoriteRoute = (routeId: string) => {
    setFavoriteRouteIds((prev) => {
      if (prev.includes(routeId)) {
        toast.success('Removed from favorites.');
        return prev.filter((id) => id !== routeId);
      }
      toast.success('Saved to favorites.');
      return [...prev, routeId];
    });
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
      <div className="map-float absolute top-0 left-0 right-0 z-[1100] flex items-center justify-between px-4 py-2.5 bg-slate-900/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <button
            aria-label="Toggle trip planner"
            onClick={() => setIsTripPlannerOpen((prev) => !prev)}
            className="h-11 w-11 rounded-xl border border-white/20 bg-white/10 text-white flex items-center justify-center sm:hidden"
          >
            ☰
          </button>
          <span className="text-sm font-black text-white tracking-tight">LarGo</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-indigo-300/70 bg-indigo-500/20 px-2 py-0.5 rounded-full">Commuter</span>
        </div>
        <div className="flex items-center gap-2">
          {locating && <span className="text-xs text-indigo-300 animate-pulse">Locating…</span>}
          {!locating && gpsGranted && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />
              GPS
            </span>
          )}
          {!locating && !gpsGranted && <span className="text-[11px] text-white/30">Cebu City</span>}
          <span className="text-[11px] font-medium text-white/50">{jeepneys.length} jeeps</span>
          {realDrivers.length > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-yellow-300 bg-yellow-400/15 border border-yellow-400/25 px-2 py-0.5 rounded-full">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
              {realDrivers.length} live
            </span>
          )}
          <button
            aria-label="Toggle dark mode"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="h-11 w-11 rounded-xl border border-white/15 bg-white/10 text-white flex items-center justify-center"
          >
            {resolvedTheme === 'dark' ? '☀' : '☾'}
          </button>
          {onLogout && (
            <button
              onClick={onLogout}
              className="ml-1 min-h-11 px-3 text-[11px] font-semibold text-white/30 hover:text-red-400 transition-colors rounded-lg hover:bg-white/5"
            >
              Sign out
            </button>
          )}
        </div>
      </div>

      {/* Active alarm banner */}
      {isAlarmActive && activeAlarm && trackedJeep && (
        <div className="map-float absolute top-12 left-1/2 -translate-x-1/2 z-[1150] w-[min(95vw,560px)] bg-blue-600 text-white rounded-xl px-4 py-2.5">
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

      <div
        className={`map-float absolute z-[1150] rounded-[8px] border border-slate-200 bg-white/95 backdrop-blur-md p-6 transition-all duration-200 ease-in-out
          ${isMobileView
            ? `left-2 right-2 bottom-2 ${isTripPlannerOpen ? 'translate-y-0 opacity-100' : 'translate-y-[115%] opacity-0 pointer-events-none'}`
            : 'top-20 left-4 w-[min(94vw,380px)] opacity-100'}`}
        onTouchStart={(event) => {
          plannerTouchStartY.current = event.touches[0]?.clientY ?? null;
        }}
        onTouchEnd={(event) => {
          if (!isMobileView || plannerTouchStartY.current === null) return;
          const deltaY = (event.changedTouches[0]?.clientY ?? plannerTouchStartY.current) - plannerTouchStartY.current;
          if (deltaY > 56) {
            setIsTripPlannerOpen(false);
          }
          plannerTouchStartY.current = null;
        }}
      >
        <div className="rounded-[8px] bg-gradient-to-r from-[#4285F4] via-[#357AE8] to-[#10B981] px-4 py-3 text-white shadow-lg">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/85">Trip Planner</p>
          <h2 className="text-[clamp(1rem,2.6vw,1.15rem)] font-semibold text-white">Jeepney route preview</h2>
          <p className="text-[clamp(0.75rem,2.2vw,0.82rem)] leading-relaxed text-blue-100">Select a start and destination stop to preview route, boarding point, and walking distance.</p>
        </div>

        <datalist id="commuter-stop-options">
          {TRIP_PLANNER_STOPS.map((stop) => (
            <option key={`stop-${stop.order}`} value={stop.name} />
          ))}
        </datalist>

        <div className="grid grid-cols-1 gap-3.5 mt-4">
          <label className="block text-xs font-semibold text-slate-700">
            Start
            <input
              list="commuter-stop-options"
              value={plannerStartInput}
              onChange={(e) => setPlannerStartInput(e.target.value)}
              placeholder="Choose start stop"
              className="mt-1.5 min-h-11 w-full rounded-[8px] border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200 hover:border-indigo-300 hover:shadow focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              aria-label="Start stop"
            />
          </label>

          <label className="block text-xs font-semibold text-slate-700">
            Destination
            <input
              list="commuter-stop-options"
              value={plannerEndInput}
              onChange={(e) => setPlannerEndInput(e.target.value)}
              placeholder="Choose destination stop"
              className="mt-1.5 min-h-11 w-full rounded-[8px] border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200 hover:border-indigo-300 hover:shadow focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              aria-label="Destination stop"
            />
          </label>

          <button
            onClick={swapPlannerPoints}
            className="min-h-11 rounded-[8px] border border-indigo-200 bg-indigo-50 px-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
          >
            Swap start and destination
          </button>

          {recentSearches.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {recentSearches.map((entry) => (
                <button
                  key={`${entry.start}-${entry.end}`}
                  onClick={() => applyRecentSearch(entry)}
                  className="min-h-11 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
                >
                  {entry.start} → {entry.end}
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedStartStop && selectedEndStop && selectedStartStop.order >= selectedEndStop.order ? (
          <div className="mt-4 rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-900 shadow-sm">
            Choose a later stop as the destination to preview the route.
          </div>
        ) : isRouteCalculating ? (
          <div className="mt-4 rounded-[8px] border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-sm text-indigo-800 flex items-center gap-2 shadow-sm">
            <span className="inline-block h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
            Calculating best route...
          </div>
        ) : plannedTrip ? (
          <div className="mt-4 rounded-[8px] border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-slate-800 space-y-1.5 shadow-sm">
            <p><span className="font-semibold text-slate-900">Suggested route:</span> {plannedRouteName ?? plannedTrip.routeId}</p>
            <p><span className="font-semibold text-slate-900">Boarding point:</span> {selectedStartStop?.name}</p>
            <p><span className="font-semibold text-slate-900">Alighting point:</span> {selectedEndStop?.name}</p>
            <p><span className="font-semibold text-slate-900">Estimated walking:</span> {Math.round(plannedTrip.walkDistance)} m</p>
          </div>
        ) : routeLookupError ? (
          <div className="mt-4 rounded-[8px] border border-rose-300 bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-800 shadow-sm">
            {routeLookupError}
          </div>
        ) : (
          <div className="mt-4 rounded-[8px] border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800 shadow-sm">
            No route matched the walking threshold.
          </div>
        )}

        {isMobileView && (
          <button
            onClick={() => setIsTripPlannerOpen(false)}
            className="mt-3 w-full min-h-11 rounded-[8px] border border-slate-200 bg-white text-sm font-semibold text-slate-600"
          >
            Close planner
          </button>
        )}
      </div>

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
        <RoutePlannerLayer match={plannedTrip} />

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
            <Popup className="jeep-popup">
              <div className="jeep-popup-card min-w-[150px] space-y-1.5 py-0.5">
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
            <Popup className="jeep-popup">
              <div className="jeep-popup-card min-w-[180px] space-y-2 py-0.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-sm font-bold text-gray-900">{jeep.id}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SEAT_BG[jeep.seatStatus]}`}>
                    {SEAT_LABEL[jeep.seatStatus]}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ROUTE_BADGE_BG[plannedTrip?.routeId ?? '21FE'] ?? 'bg-blue-100 text-blue-800 border-blue-300'}`}>
                    {jeep.route}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500">
                    ETA {estimateEtaMinutes(Math.max(0.4, Math.random() * 2.4))} min
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                    <span
                      className="block h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-300"
                      style={{ width: jeep.seatStatus === 'full' ? '96%' : jeep.seatStatus === 'few' ? '68%' : '42%' }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-600">Live passenger gauge</p>
                </div>

                <p className="text-xs font-medium text-blue-700 leading-snug">Next stop in {Math.max(1, Math.floor(Math.random() * 4) + 1)} min</p>
                {userPos && (
                  <p className="text-xs text-slate-600">
                    Approx. {formatDistance(
                      Math.hypot((jeep.lat - userPos.lat) * 111, (jeep.lng - userPos.lng) * 111),
                    )} from you
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setAlarmDraft({ jeepId: jeep.id, route: jeep.route, thresholdKm: 1 });
                      toast.success('Approach notification enabled for this jeep.');
                    }}
                    className="min-h-11 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white"
                  >
                    Notify when nearby
                  </button>
                  <span className="text-[11px] text-slate-500">Wait ~{estimateEtaMinutes(Math.max(0.4, Math.random() * 2.1))} min</span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        <PinpointAlarm />
      </MapContainer>

      {/* Zoom controls */}
      <div className="map-float absolute bottom-28 right-4 z-[1100] flex flex-col gap-2">
        {(['+', '−'] as const).map((label) => (
          <button
            key={label}
            aria-label={label === '+' ? 'Zoom in' : 'Zoom out'}
            onClick={() => {
              const map = (document.querySelector('.leaflet-container') as { _leaflet_map?: { zoomIn: () => void; zoomOut: () => void } } | null)?._leaflet_map;
              if (map) label === '+' ? map.zoomIn() : map.zoomOut();
            }}
            className="w-11 h-11 bg-gradient-to-br from-slate-900/90 to-slate-700/90 backdrop-blur-sm border border-white/20 rounded-full shadow-xl text-white font-black text-lg flex items-center justify-center hover:brightness-110 hover:-translate-y-0.5 active:scale-95 transition-all duration-200"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Seat status legend */}
      <div className="map-float absolute bottom-4 left-4 z-[1100] flex items-center gap-3 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-2">
        {(['many', 'full'] as const).map((status) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: SEAT_COLOR[status] }} />
            <span className="text-xs text-white/50">{SEAT_LABEL[status]}</span>
          </div>
        ))}
      </div>

      {plannedTrip && selectedStartStop && selectedEndStop && (
        <div className="map-float absolute bottom-4 left-1/2 -translate-x-1/2 z-[1110] w-[min(95vw,740px)] rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-md p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">Route details</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleFavoriteRoute(plannedTrip.routeId)}
                className="min-h-11 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700"
              >
                {favoriteRouteIds.includes(plannedTrip.routeId) ? 'Saved' : 'Save to favorites'}
              </button>
              <button
                onClick={() => setIsBottomInfoOpen((prev) => !prev)}
                className="min-h-11 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700"
              >
                {isBottomInfoOpen ? 'Collapse' : 'Expand'}
              </button>
            </div>
          </div>

          {isBottomInfoOpen && (
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-500">Step-by-step</p>
                <ol className="mt-2 space-y-1 text-xs text-slate-700">
                  <li>1. Walk to {selectedStartStop.name}</li>
                  <li>2. Ride {plannedRouteName ?? plannedTrip.routeId}</li>
                  <li>3. Alight at {selectedEndStop.name}</li>
                </ol>
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-500">Fare breakdown</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">Regular: ₱13.00 + ₱{Math.max(0, Math.round((plannerPathDistanceKm(plannedRoute, plannedTrip.boardingPoint, plannedTrip.alightingPoint) - 4) * 2)).toFixed(0)}</p>
                <p className="text-xs text-slate-600">Student/Senior: about 20% discount</p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-500">Alternatives</p>
                <ul className="mt-2 space-y-1 text-xs text-slate-700">
                  {routeOptions.slice(0, 3).map((option) => (
                    <li key={`${option.routeId}-${option.walkDistance}`}>
                      {option.routeId} · walk {Math.round(option.walkDistance)} m
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Alarm panel/modal */}
      {alarmDraft && (
        <div className="absolute inset-0 z-[1200] bg-black/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-white">Set Jeepney Alarm</h2>
              <p className="text-xs text-white/40 mt-1">Get alerted when this jeepney gets close.</p>
            </div>

            <div className="bg-white/[0.05] border border-white/10 rounded-xl p-3 space-y-1">
              <p className="text-sm font-mono font-bold text-white">{alarmDraft.jeepId}</p>
              <p className="text-xs text-white/40">{alarmDraft.route}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="alarm-distance" className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                  Distance
                </label>
                <span className="text-sm font-bold text-indigo-300">{alarmDraft.thresholdKm}km</span>
              </div>
              <input
                id="alarm-distance"
                type="range"
                min={1}
                max={3}
                step={1}
                value={alarmDraft.thresholdKm}
                onChange={(e) => setAlarmDraft((prev) => (prev ? { ...prev, thresholdKm: Number(e.target.value) } : prev))}
                className="w-full accent-indigo-400"
              />
              <div className="flex justify-between text-[11px] text-white/25 px-0.5">
                <span>1km</span>
                <span>2km</span>
                <span>3km</span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={setAlarm}
                className="flex-1 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-400 hover:to-blue-400 text-white text-sm font-bold py-2.5 rounded-xl shadow-lg shadow-indigo-900/40 transition-all"
              >
                Set Alarm
              </button>
              <button
                onClick={() => setAlarmDraft(null)}
                className="flex-1 bg-white/[0.07] hover:bg-white/10 border border-white/10 text-white/60 text-sm font-semibold py-2.5 rounded-xl transition-all"
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
