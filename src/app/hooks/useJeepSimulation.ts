import { useEffect, useMemo, useState } from 'react';
import {
  ROUTES,
  Route,
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
}

// ─── Internal constants ───────────────────────────────────────────────────────

const CEBU_CENTER = { lat: 10.3157, lng: 123.8854 };
const JEEP_COUNT = 20;
const TALAMBAN_SEED_COUNT = 5;
const CAPACITY = 18;
/** Simulation tick — jeepneys update position every 3 seconds. */
const TICK_MS = 3_000;
const TALAMBAN_ROUTE_ID = 'route-talamban-main';

// Test corridor near USC Talamban along Gov. M. Cuenco Ave (main road)
const TALAMBAN_TEST_ROUTE: Route = {
  id: TALAMBAN_ROUTE_ID,
  name: '13T - Talamban Main Road',
  color: '#22c55e',
  path: [
    { lat: 10.3439, lng: 123.9094 },
    { lat: 10.3475, lng: 123.9106 },
    { lat: 10.3515, lng: 123.9117 },
    { lat: 10.3553, lng: 123.9124 },
    { lat: 10.3586, lng: 123.9130 },
    { lat: 10.3620, lng: 123.9138 },
  ],
  stops: [
    { id: 't-1', name: 'Bacayan Junction', coordinates: { lat: 10.3439, lng: 123.9094 } },
    { id: 't-2', name: 'USC Talamban', coordinates: { lat: 10.3553, lng: 123.9124 } },
    { id: 't-3', name: 'Pit-os', coordinates: { lat: 10.3620, lng: 123.9138 } },
  ],
  avgTripDuration: 18,
  peakHours: [7, 8, 9, 17, 18, 19],
};

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
  if (baseRoutes.some((r) => r.id === TALAMBAN_ROUTE_ID)) {
    return baseRoutes;
  }
  return [...baseRoutes, TALAMBAN_TEST_ROUTE];
}

/** Spawn 20 anonymous jeepneys, guaranteeing 5 around Talamban for alarm tests. */
function spawnJeepneys(routes: Route[]): SimulatedJeep[] {
  if (routes.length === 0) return [];

  const talambanRoute = routes.find((r) => r.id === TALAMBAN_ROUTE_ID);
  const forcedCount = talambanRoute ? TALAMBAN_SEED_COUNT : 0;
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
    };
  };

  const talambanJeeps: SimulatedJeep[] = talambanRoute
    ? Array.from({ length: forcedCount }, (_, idx) => {
        // Spread test jeepneys along the Talamban main road corridor.
        const progress = (idx + 1) / (forcedCount + 1);
        return buildJeep(talambanRoute, progress);
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
<<<<<<< HEAD
    initializeRoutesWithRoads().then((roadRoutes) => {
      setRoutes(roadRoutes);
      setRoutesInitialized(true);
      
      // Update initial jeep positions to match the new route paths
      setJeeps(prevJeeps => 
        prevJeeps.map(jeep => {
          const route = roadRoutes.find(r => r.id === jeep.routeId);
          if (!route || route.path.length === 0) return jeep;
          
          const pathIndex = Math.min(
            route.path.length - 1,
            Math.max(0, Math.floor(jeep.progress * Math.max(1, route.path.length - 1)))
          );
          return {
            ...jeep,
            currentPosition: route.path[pathIndex],
          };
        })
      );
    });
=======
    let active = true;
    initializeRoutesWithRoads()
      .then((roadRoutes) => {
        if (!active) return;
        const mergedRoutes = withTalambanRoute(roadRoutes);
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
>>>>>>> 58da5b23 (Implement role-based PTIS dashboards and map simulation updates)
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
          let progress = jeep.progress + progressStep;
          if (progress >= 1) progress -= 1;
          const pos = getPositionFromRoute(route, progress);

<<<<<<< HEAD
          // Calculate position along path
          const maxPathIndex = Math.max(1, route.path.length - 1);
          const pathIndex = Math.min(route.path.length - 1, Math.floor(newProgress * maxPathIndex));
          const segmentProgress = (newProgress * maxPathIndex) % 1;
          const start = route.path[pathIndex];
          const end = route.path[Math.min(pathIndex + 1, route.path.length - 1)];
          const currentPosition = interpolatePosition(start, end, segmentProgress);

          // Simulate occupancy changes at stops
          let newOccupancy = jeep.occupancy;
          let newPassengerCount = jeep.passengerCount;
          
          // Check if near a stop
          const currentStop = Math.floor(newProgress * route.stops.length);
          const previousStop = Math.floor(jeep.progress * route.stops.length);
          
          if (currentStop !== previousStop) {
            // At a stop, simulate passenger changes
            const change = Math.floor(Math.random() * 8) - 3;
            newPassengerCount = Math.max(0, Math.min(jeep.capacity + 7, newPassengerCount + change));
            
            if (newPassengerCount <= jeep.capacity * 0.6) {
              newOccupancy = 'available';
            } else if (newPassengerCount <= jeep.capacity + 3) {
              newOccupancy = 'standing';
            } else {
              newOccupancy = 'full';
            }
          }
=======
          // Passenger churn: ±1–3 passengers per tick
          const churn = Math.floor(Math.random() * 5) - 2;
          const passengerCount = Math.max(0, Math.min(CAPACITY, jeep.passengerCount + churn));
          const seatStatus = seatStatusFromCount(passengerCount, CAPACITY);
>>>>>>> 58da5b23 (Implement role-based PTIS dashboards and map simulation updates)

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
