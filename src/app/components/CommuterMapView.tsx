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
import { MapPin, Ruler, Bell, AlertTriangle } from 'lucide-react';

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
      <div className="map-float absolute top-0 left-0 right-0 z-[1100] flex items-center justify-between px-4 py-3 bg-slate-900/90 backdrop-blur-md border-b border-white/10 animate-slide-in-top">
        <div className="flex items-center gap-2">
          <button
            aria-label="Toggle trip planner sidebar"
            onClick={() => setIsTripPlannerOpen((prev) => !prev)}
            className="h-11 w-11 rounded-lg border border-white/20 bg-white/10 text-white flex items-center justify-center sm:hidden hover:bg-white/15 transition-all active:scale-95"
            title="Toggle trip planner"
          >
            ☰
          </button>
          <span className="text-base font-black text-white tracking-tight">LarGo</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-300/80 bg-indigo-500/25 px-2 py-0.5 rounded-full border border-indigo-400/20">Commuter</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {locating && (
            <span className="text-xs text-indigo-300 animate-pulse flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-300 animate-pulse" />
              Locating…
            </span>
          )}
          {!locating && gpsGranted && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />
              GPS Active
            </span>
          )}
          {!locating && !gpsGranted && <span className="text-[11px] text-white/40 font-medium">Cebu City</span>}
          <span className="text-[11px] font-semibold text-white/60 bg-white/5 px-2 py-1 rounded-full">{jeepneys.length} Jeeps</span>
          {realDrivers.length > 0 && (
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-yellow-300 bg-yellow-400/15 border border-yellow-400/30 px-2 py-1 rounded-full">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
              {realDrivers.length} Live
            </span>
          )}
          <button
            aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="h-11 w-11 rounded-lg border border-white/15 bg-white/10 text-white flex items-center justify-center hover:bg-white/15 transition-all active:scale-95"
            title={`${resolvedTheme === 'dark' ? 'Light' : 'Dark'} mode`}
          >
            {resolvedTheme === 'dark' ? '☀️' : '🌙'}
          </button>
          {onLogout && (
            <button
              onClick={onLogout}
              aria-label="Sign out"
              className="min-h-11 px-3 text-[11px] font-semibold text-white/50 hover:text-red-400 transition-colors rounded-lg hover:bg-white/5 active:scale-95"
            >
              Sign out
            </button>
          )}
        </div>
      </div>

      {/* Active alarm banner */}
      {isAlarmActive && activeAlarm && trackedJeep && (
        <div className="map-float absolute top-16 left-1/2 -translate-x-1/2 z-[1150] w-[min(95vw,560px)] bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg px-4 py-3 shadow-lg border border-blue-500/50 animate-slide-in-top">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-bold truncate flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse" />
                Tracking {activeAlarm.jeepId} · Alert at {activeAlarm.thresholdKm}km
              </p>
              <p className="text-xs text-blue-100 truncate">
                {trackedJeep.id} is {formatDistance(distanceKm)}
              </p>
            </div>
            <button
              onClick={clearAlarm}
              aria-label="Cancel active alarm"
              className="text-xs font-bold bg-white/20 hover:bg-white/30 px-3 py-2 rounded-md transition-colors whitespace-nowrap"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div
        className={`map-float absolute z-[1150] rounded-[8px] border border-slate-200 bg-white/95 backdrop-blur-md p-6 transition-all duration-200 ease-in-out shadow-lg
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
        <div className="rounded-t-lg bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500 px-6 py-4 text-white shadow-md border-b border-blue-700/50">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/80">🚍 Trip Planner</p>
          <h2 className="text-[clamp(1.05rem,2.8vw,1.25rem)] font-bold text-white mt-1">Find your jeepney</h2>
          <p className="text-[clamp(0.8rem,2.4vw,0.9rem)] leading-relaxed text-blue-100 mt-1.5">Select start and destination to see available routes and travel distance.</p>
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
              className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200 hover:border-indigo-300 hover:shadow-md focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:ring-offset-1"
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
              className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200 hover:border-indigo-300 hover:shadow-md focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:ring-offset-1"
              aria-label="Destination stop"
            />
          </label>

          <button
            onClick={swapPlannerPoints}
            className="min-h-11 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 transition-all hover:shadow-md active:scale-95"
          >
            ⇄ Swap start and destination
          </button>

          {recentSearches.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-600 font-semibold">Recent:</span>
              {recentSearches.map((entry) => (
                <button
                  key={`${entry.start}-${entry.end}`}
                  onClick={() => applyRecentSearch(entry)}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50 transition-all active:scale-95"
                  title={`${entry.start} → ${entry.end}`}
                >
                  <span>{entry.start}</span>
                  <span className="text-slate-400">→</span>
                  <span>{entry.end}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedStartStop && selectedEndStop && selectedStartStop.order >= selectedEndStop.order ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-gradient-to-r from-amber-50 to-amber-100 px-4 py-3 text-xs font-semibold text-amber-900 shadow-sm flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" />Choose a later stop as the destination to preview the route.
          </div>
        ) : isRouteCalculating ? (
          <div className="mt-4 rounded-lg border border-indigo-200 bg-gradient-to-r from-indigo-50 to-indigo-100 px-4 py-3 text-sm text-indigo-900 flex items-center gap-3 shadow-sm animate-pulse">
            <div className="inline-block h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
            <span className="font-semibold">Calculating best route...</span>
          </div>
        ) : plannedTrip ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-100 px-4 py-4 text-sm text-slate-800 space-y-2 shadow-sm">
            <p className="font-semibold text-emerald-900">✓ Route found!</p>
            <div className="space-y-1.5 text-xs">
              <p><span className="font-semibold text-slate-900">Route:</span> {plannedRouteName ?? plannedTrip.routeId}</p>
              <p><span className="font-semibold text-slate-900">Boarding:</span> {selectedStartStop?.name}</p>
              <p><span className="font-semibold text-slate-900">Alighting:</span> {selectedEndStop?.name}</p>
              <p><span className="font-semibold text-slate-900">Walk distance:</span> {Math.round(plannedTrip.walkDistance)} m</p>
            </div>
          </div>
        ) : routeLookupError ? (
          <div className="mt-4 rounded-lg border border-red-300 bg-gradient-to-r from-red-50 to-red-100 px-4 py-3 text-sm font-semibold text-red-800 shadow-sm flex items-center gap-2">
            ❌ {routeLookupError}
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 px-4 py-3 text-sm text-slate-700 shadow-sm flex items-center gap-2">
            ℹ️ No route matched. Try different stops or check walking distance.
          </div>
        )}

        {isMobileView && (
          <button
            onClick={() => setIsTripPlannerOpen(false)}
            aria-label="Close trip planner"
            className="mt-4 w-full min-h-11 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all active:scale-95"
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
              <div className="jeep-popup-card min-w-[200px] space-y-2.5 py-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-base font-bold text-gray-900">{jeep.id}</span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${SEAT_BG[jeep.seatStatus]}`}>
                    {jeep.seatStatus === 'full' ? '🔴 Full' : '🟢 Available'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${ROUTE_BADGE_BG[plannedTrip?.routeId ?? '21FE'] ?? 'bg-blue-100 text-blue-800 border-blue-300'}`}>
                    Route {jeep.route}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                    ~{estimateEtaMinutes(Math.max(0.4, Math.random() * 2.4))} min
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">Occupancy</span>
                    <span className="text-xs text-slate-600">{jeep.seatStatus === 'full' ? '96%' : jeep.seatStatus === 'few' ? '68%' : '42%'}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                    <span
                      className="block h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-300"
                      style={{ width: jeep.seatStatus === 'full' ? '96%' : jeep.seatStatus === 'few' ? '68%' : '42%' }}
                    />
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-2 text-xs text-slate-700 space-y-1">
                  <p className="flex items-center gap-1"><MapPin size={11} className="shrink-0 text-blue-500" /><span className="font-semibold">Next stop in {Math.max(1, Math.floor(Math.random() * 4) + 1)} min</span></p>
                  {userPos && (
                    <p className="flex items-center gap-1"><Ruler size={11} className="shrink-0 text-blue-500" /><span className="font-semibold">{formatDistance(Math.hypot((jeep.lat - userPos.lat) * 111, (jeep.lng - userPos.lng) * 111))}</span> from you</p>
                  )}
                </div>

                <button
                  onClick={() => {
                    setAlarmDraft({ jeepId: jeep.id, route: jeep.route, thresholdKm: 1 });
                    toast.success('Approach notification enabled.');
                  }}
                  className="w-full min-h-10 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 px-3 text-xs font-bold text-white hover:from-blue-700 hover:to-blue-600 transition-all active:scale-95"
                >
                  <Bell size={13} className="inline mr-1" />Notify when nearby
                </button>
              </div>
            </Popup>
          </Marker>
        ))}

        <PinpointAlarm />
      </MapContainer>

      {/* Zoom controls */}
      <div className="map-float absolute bottom-56 right-4 z-[1100] flex flex-col gap-2.5 animate-slide-in-right">
        {(['+', '−'] as const).map((label) => (
          <button
            key={label}
            aria-label={label === '+' ? 'Zoom in map' : 'Zoom out map'}
            onClick={() => {
              const map = (document.querySelector('.leaflet-container') as { _leaflet_map?: { zoomIn: () => void; zoomOut: () => void } } | null)?._leaflet_map;
              if (map) label === '+' ? map.zoomIn() : map.zoomOut();
            }}
            className="w-12 h-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg shadow-lg text-slate-700 dark:text-white font-bold text-xl flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 transition-all duration-200"
            title={label === '+' ? 'Zoom in' : 'Zoom out'}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Seat status legend */}
      <div className="map-float absolute bottom-4 left-4 z-[1100] flex items-center gap-4 bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-2.5 shadow-lg animate-slide-in-left">
        {(['many', 'full'] as const).map((status) => (
          <div key={status} className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: SEAT_COLOR[status] }} />
            <span className="text-xs font-medium text-white/70">{SEAT_LABEL[status]}</span>
          </div>
        ))}
      </div>

      {plannedTrip && selectedStartStop && selectedEndStop && (
        <div className="map-float absolute bottom-20 left-1/2 -translate-x-1/2 z-[1110] w-[min(95vw,740px)] rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-md p-4 shadow-lg animate-slide-in-bottom">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">Route details</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleFavoriteRoute(plannedTrip.routeId)}
                aria-label={favoriteRouteIds.includes(plannedTrip.routeId) ? "Remove from favorites" : "Save to favorites"}
                className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:shadow-md transition-all active:scale-95"
              >
                {favoriteRouteIds.includes(plannedTrip.routeId) ? '⭐ Saved' : '☆ Save'}
              </button>
              <button
                onClick={() => setIsBottomInfoOpen((prev) => !prev)}
                aria-label={isBottomInfoOpen ? "Collapse route details" : "Expand route details"}
                className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:shadow-md transition-all active:scale-95"
              >
                {isBottomInfoOpen ? '−' : '+'}
              </button>
            </div>
          </div>

          {isBottomInfoOpen && (
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 p-4 hover:shadow-md transition-all">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">Step-by-step</p>
                <ol className="space-y-2 text-xs text-slate-700">
                  <li className="flex gap-2"><span className="font-bold text-indigo-600">1.</span> <span>Walk to {selectedStartStop.name}</span></li>
                  <li className="flex gap-2"><span className="font-bold text-indigo-600">2.</span> <span>Ride {plannedRouteName ?? plannedTrip.routeId}</span></li>
                  <li className="flex gap-2"><span className="font-bold text-indigo-600">3.</span> <span>Alight at {selectedEndStop.name}</span></li>
                </ol>
              </div>

              <div className="rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 p-4 hover:shadow-md transition-all">
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-3">Fare breakdown</p>
                <p className="text-base font-bold text-emerald-900">₱13.00 + ₱{Math.max(0, Math.round((plannerPathDistanceKm(plannedRoute, plannedTrip.boardingPoint, plannedTrip.alightingPoint) - 4) * 2)).toFixed(0)}</p>
                <p className="text-xs text-emerald-700 mt-2">Student/Senior: 20% off</p>
              </div>

              <div className="rounded-lg bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 p-4 hover:shadow-md transition-all">
                <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-3">Alternatives</p>
                <ul className="space-y-1.5 text-xs text-amber-800">
                  {routeOptions.slice(0, 3).map((option) => (
                    <li key={`${option.routeId}-${option.walkDistance}`} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span>{option.routeId} · {Math.round(option.walkDistance)}m walk</span>
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
        <div className="absolute inset-0 z-[1200] bg-black/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10 rounded-2xl shadow-2xl p-6 space-y-5 animate-scale-in">
            <div>
              <h2 className="text-lg font-bold text-white">Set Jeepney Alarm</h2>
              <p className="text-xs text-white/50 mt-2">Get alerted when this jeepney gets close to your location.</p>
            </div>

            <div className="bg-white/[0.05] border border-white/10 rounded-lg p-4 space-y-2">
              <p className="text-sm font-mono font-bold text-white">{alarmDraft.jeepId}</p>
              <p className="text-xs text-white/50">{alarmDraft.route}</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label htmlFor="alarm-distance" className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                  Alert Distance
                </label>
                <span className="text-base font-bold text-indigo-300">{alarmDraft.thresholdKm}km</span>
              </div>
              <input
                id="alarm-distance"
                type="range"
                min={1}
                max={3}
                step={1}
                value={alarmDraft.thresholdKm}
                onChange={(e) => setAlarmDraft((prev) => (prev ? { ...prev, thresholdKm: Number(e.target.value) } : prev))}
                className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-indigo-400"
              />
              <div className="flex justify-between text-[11px] text-white/40 px-1">
                <span>1km</span>
                <span>2km</span>
                <span>3km</span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={setAlarm}
                className="flex-1 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-400 hover:to-blue-400 active:scale-95 text-white text-sm font-bold py-3 rounded-lg shadow-lg shadow-indigo-900/40 transition-all"
              >
                Set Alarm
              </button>
              <button
                onClick={() => setAlarmDraft(null)}
                className="flex-1 bg-white/[0.07] hover:bg-white/10 active:scale-95 border border-white/10 text-white/70 text-sm font-semibold py-3 rounded-lg transition-all"
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
