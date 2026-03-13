import { useEffect, useMemo, useState } from 'react';
import {
  ROUTES,
  Route,
  fetchRouteFromOSRM,
  initializeRoutesWithRoads,
  interpolatePosition,
} from '../data/jeepney-data';

// ─── Public types ────────────────────────────────────────────────────────────

/** Seat availability visible to passengers. No PII (no driver name, no plate). */
export type SeatStatus = 'many' | 'few' | 'full';

/**
 * Safe public representation of a jeepney.
 * Only exposes anonymous data — driver identity and plate are never included.
 */
export interface JeepVehicle {
  /** Anonymous vehicle ID in the form JEEP-XXXX (random hex). */
  id: string;
  lat: number;
  lng: number;
  /** Human-readable route name, e.g. "04L - Lahug - Carbon". */
  route: string;
  seatStatus: SeatStatus;

  // ── Backward-compat fields used by existing map & dashboard components ──
  /** Same as route id; used by components that call routes.find(). */
  routeId: string;
  passengerCount: number;
  capacity: number;
  /** Alias for { lat, lng } — kept for Leaflet marker rendering. */
  currentPosition: { lat: number; lng: number };
  /** Occupancy label mapped from seatStatus; satisfies existing components. */
  occupancy: 'available' | 'standing' | 'full';
  /** Unix timestamp (ms) of the last position update. */
  lastUpdate: number;
  /** Current simulated speed in km/h (safe operational telemetry). */
  speed: number;
}

interface SimulatedJeep extends JeepVehicle {
  /** 0..1 progress along the assigned route polyline */
  progress: number;
  /** Movement direction along the polyline. */
  direction: 1 | -1;
}

// ─── Internal constants ───────────────────────────────────────────────────────

const CEBU_CENTER = { lat: 10.3157, lng: 123.8854 };
const JEEP_COUNT = 20;
const TALAMBAN_SEED_COUNT = 5;
const CAPACITY = 18;
/** Simulation tick — jeepneys update position every 3 seconds. */
const TICK_MS = 3_000;
const TALAMBAN_ROUTE_IDS = ['route-talamban-main', 'route-talamban-banilad'] as const;

// Talamban corridor routes around Gov. M. Cuenco, USC Talamban, and Banilad junction.
const TALAMBAN_ROUTES: Route[] = [
  {
    id: TALAMBAN_ROUTE_IDS[0],
    name: '13T - Talamban - Banilad',
    color: '#22c55e',
    path: [
      { lat: 10.3374, lng: 123.9063 }, // Banilad Town Centre
      { lat: 10.3438, lng: 123.9092 }, // Gaisano Country Mall area
      { lat: 10.3489, lng: 123.9108 }, // Talamban proper
      { lat: 10.3553, lng: 123.9124 }, // USC Talamban
      { lat: 10.3607, lng: 123.9135 }, // Canduman side
      { lat: 10.3660, lng: 123.9151 }, // Pit-os approach
    ],
    stops: [
      { id: 't1-1', name: 'Banilad Town Centre', coordinates: { lat: 10.3374, lng: 123.9063 } },
      { id: 't1-2', name: 'Country Mall', coordinates: { lat: 10.3438, lng: 123.9092 } },
      { id: 't1-3', name: 'USC Talamban', coordinates: { lat: 10.3553, lng: 123.9124 } },
      { id: 't1-4', name: 'Pit-os Junction', coordinates: { lat: 10.3660, lng: 123.9151 } },
    ],
    avgTripDuration: 22,
    peakHours: [6, 7, 8, 9, 16, 17, 18, 19],
  },
  {
    id: TALAMBAN_ROUTE_IDS[1],
    name: '62B - Talamban - IT Park',
    color: '#06b6d4',
    path: [
      { lat: 10.3553, lng: 123.9124 }, // USC Talamban
      { lat: 10.3494, lng: 123.9112 }, // Talamban proper
      { lat: 10.3438, lng: 123.9092 }, // Country Mall
      { lat: 10.3361, lng: 123.9053 }, // Banilad flyover area
      { lat: 10.3310, lng: 123.9017 }, // Cebu IT Park entry
      { lat: 10.3284, lng: 123.9051 }, // IT Park terminal loop
    ],
    stops: [
      { id: 't2-1', name: 'USC Talamban', coordinates: { lat: 10.3553, lng: 123.9124 } },
      { id: 't2-2', name: 'Talamban Proper', coordinates: { lat: 10.3494, lng: 123.9112 } },
      { id: 't2-3', name: 'Banilad Flyover', coordinates: { lat: 10.3361, lng: 123.9053 } },
      { id: 't2-4', name: 'Cebu IT Park', coordinates: { lat: 10.3284, lng: 123.9051 } },
    ],
    avgTripDuration: 28,
    peakHours: [6, 7, 8, 17, 18, 19, 20],
  },
];

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function randomAnonymousId(): string {
  const hex = Math.floor(Math.random() * 0xffff)
    .toString(16)
    .toUpperCase()
    .padStart(4, '0');
  return `JEEP-${hex}`;
}

/**
 * Haversine distance between two geographic points.
 * @returns Distance in kilometres.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function seatStatusFromCount(count: number, cap: number): SeatStatus {
  const ratio = count / cap;
  if (ratio >= 1) return 'full';
  if (ratio >= 0.6) return 'few';
  return 'many';
}

function occupancyFromSeatStatus(s: SeatStatus): 'available' | 'standing' | 'full' {
  if (s === 'many') return 'available';
  if (s === 'few') return 'standing';
  return 'full';
}

function getPositionFromRoute(route: Route, progress: number): { lat: number; lng: number } {
  if (route.path.length === 0) {
    return { ...CEBU_CENTER };
  }
  if (route.path.length === 1) {
    return route.path[0];
  }

  const scaled = progress * (route.path.length - 1);
  const pathIndex = Math.floor(scaled);
  const segmentProgress = scaled % 1;
  const start = route.path[pathIndex];
  const end = route.path[Math.min(pathIndex + 1, route.path.length - 1)];
  return interpolatePosition(start, end, segmentProgress);
}

function withTalambanRoute(baseRoutes: Route[]): Route[] {
  const existingIds = new Set(baseRoutes.map((r) => r.id));
  const missingTalambanRoutes = TALAMBAN_ROUTES.filter((r) => !existingIds.has(r.id));
  if (missingTalambanRoutes.length === 0) return baseRoutes;
  return [...baseRoutes, ...missingTalambanRoutes];
}

/** Spawn 20 anonymous jeepneys, guaranteeing 5 around Talamban for alarm tests. */
function spawnJeepneys(routes: Route[]): SimulatedJeep[] {
  if (routes.length === 0) return [];

  const talambanRoutes = routes.filter((r) => TALAMBAN_ROUTE_IDS.includes(r.id as (typeof TALAMBAN_ROUTE_IDS)[number]));
  const forcedCount = talambanRoutes.length > 0 ? TALAMBAN_SEED_COUNT : 0;
  const remainingCount = Math.max(0, JEEP_COUNT - forcedCount);

  const buildJeep = (routeEntry: Route, progress: number): SimulatedJeep => {
    const pos = getPositionFromRoute(routeEntry, progress);
    const passengerCount = Math.floor(Math.random() * (CAPACITY + 1));
    const seatStatus = seatStatusFromCount(passengerCount, CAPACITY);
    const speed = 10 + Math.random() * 12;

    return {
      id: randomAnonymousId(),
      lat: pos.lat,
      lng: pos.lng,
      route: routeEntry.name,
      routeId: routeEntry.id,
      seatStatus,
      passengerCount,
      capacity: CAPACITY,
      currentPosition: pos,
      occupancy: occupancyFromSeatStatus(seatStatus),
      lastUpdate: Date.now(),
      speed,
      progress,
      direction: Math.random() > 0.5 ? 1 : -1,
    };
  };

  const talambanJeeps: SimulatedJeep[] = talambanRoutes.length > 0
    ? Array.from({ length: forcedCount }, (_, idx) => {
        // Spread test jeepneys across Talamban routes for route-specific checks.
        const routeEntry = talambanRoutes[idx % talambanRoutes.length];
        const progress = (idx + 1) / (forcedCount + 1);
        return buildJeep(routeEntry, progress);
      })
    : [];

  const randomJeeps = Array.from({ length: remainingCount }, () => {
    const routeEntry = routes[Math.floor(Math.random() * routes.length)];
    return buildJeep(routeEntry, Math.random());
  });

  return [...talambanJeeps, ...randomJeeps];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Simulates 20 anonymous jeepneys moving near Cebu City.
 *
 * @param centerLat  Filter centre latitude  (default: Cebu City)
 * @param centerLng  Filter centre longitude (default: Cebu City)
 * @param radiusKm   Only return jeepneys within this radius.
 *                   Pass `Infinity` (default) to return all vehicles.
 *
 * @example
 * // All vehicles — used by dashboard/analytics components
 * const { jeeps, routes } = useJeepSimulation();
 *
 * @example
 * // Only jeepneys within 1 km of the user's location
 * const { jeeps } = useJeepSimulation(userLat, userLng, 1);
 */
export function useJeepSimulation(
  centerLat: number = CEBU_CENTER.lat,
  centerLng: number = CEBU_CENTER.lng,
  radiusKm: number = Infinity,
): { jeeps: JeepVehicle[]; routes: Route[] } {
  const seededRoutes = withTalambanRoute(ROUTES);
  const [routes, setRoutes] = useState<Route[]>(seededRoutes);
  // Initialise once; IDs are stable for the lifetime of the component.
  const [allJeeps, setAllJeeps] = useState<SimulatedJeep[]>(() => spawnJeepneys(seededRoutes));

  // Upgrade route geometry to OSRM road-following paths.
  useEffect(() => {
    let active = true;
    initializeRoutesWithRoads()
      .then(async (roadRoutes) => {
        if (!active) return;

        // Snap Talamban overlay routes to real roads as well.
        const talambanRoadRoutes = await Promise.all(
          TALAMBAN_ROUTES.map(async (route) => {
            const roadPath = await fetchRouteFromOSRM(route.path);
            return {
              ...route,
              path: roadPath.length > 1 ? roadPath : route.path,
            };
          }),
        );

        const mergedRoutes = withTalambanRoute([
          ...roadRoutes,
          ...talambanRoadRoutes,
        ]);
        setRoutes(mergedRoutes);
        // Re-project each jeep to its exact position on the updated road path.
        setAllJeeps(prev =>
          prev.map(jeep => {
            const route = mergedRoutes.find(r => r.id === jeep.routeId);
            if (!route) return jeep;
            const pos = getPositionFromRoute(route, jeep.progress);
            return {
              ...jeep,
              route: route.name,
              lat: pos.lat,
              lng: pos.lng,
              currentPosition: pos,
              lastUpdate: Date.now(),
            };
          }),
        );
      })
      .catch(() => {
        // Keep waypoint fallback routes if OSRM fails.
      });

    return () => {
      active = false;
    };
  }, []);

  // Move every jeepney along its route polyline every TICK_MS milliseconds.
  useEffect(() => {
    const interval = setInterval(() => {
      setAllJeeps(prev =>
        prev.map(jeep => {
          const route = routes.find(r => r.id === jeep.routeId);
          if (!route || route.path.length === 0) return jeep;

          // 3-second tick progression along route; loops at the end.
          // Speed is in km/h; normalize to a modest route-progress increment.
          const speedDrift = (Math.random() - 0.5) * 0.8;
          const speed = Math.max(8, Math.min(26, jeep.speed + speedDrift));
          const progressStep = (speed / 15) * 0.006;
          let direction = jeep.direction;
          let progress = jeep.progress + progressStep * direction;

          // Reflect at route ends to avoid teleporting back to route start.
          if (progress >= 1) {
            progress = 1;
            direction = -1;
          } else if (progress <= 0) {
            progress = 0;
            direction = 1;
          }

          const pos = getPositionFromRoute(route, progress);

          // Passenger churn: ±1–3 passengers per tick
          const churn = Math.floor(Math.random() * 5) - 2;
          const passengerCount = Math.max(0, Math.min(CAPACITY, jeep.passengerCount + churn));
          const seatStatus = seatStatusFromCount(passengerCount, CAPACITY);

          return {
            ...jeep,
            route: route.name,
            lat: pos.lat,
            lng: pos.lng,
            currentPosition: pos,
            passengerCount,
            seatStatus,
            occupancy: occupancyFromSeatStatus(seatStatus),
            lastUpdate: Date.now(),
            speed,
            progress,
            direction,
          };
        }),
      );
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [routes]);

  // Apply Haversine radius filter.
  const jeeps = useMemo(() => {
    const visible =
      radiusKm === Infinity
        ? allJeeps
        : allJeeps.filter(j => haversineKm(centerLat, centerLng, j.lat, j.lng) <= radiusKm);

    // Keep internal simulation state private; expose public-safe fields only.
    return visible.map(({ progress, ...publicJeep }) => publicJeep);
  }, [allJeeps, centerLat, centerLng, radiusKm]);

  return { jeeps, routes };
}
