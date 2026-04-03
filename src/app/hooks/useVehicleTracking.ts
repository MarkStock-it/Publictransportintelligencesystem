/**
 * useVehicleTracking.ts
 *
 * React hook that wraps VehicleTrackingService.
 *
 * Returns live, typed state for both taxis and jeepneys.
 * State updates are keyed by vehicle ID so that only the changed vehicle
 * triggers a re-render — not the entire list.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ConnectionState,
  NearbyVehiclesQuery,
  VehicleLocation,
  VehicleType,
  getVehicleTrackingService,
} from '../services/vehicleTrackingService';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Typed subsets of VehicleLocation. */
export type TaxiLocation = VehicleLocation & { type: 'taxi' };
export type JeepneyLocation = VehicleLocation & { type: 'jeepney' };

export interface UseVehicleTrackingResult {
  /** All jeepneys from the live feed. */
  jeepneys: JeepneyLocation[];
  /** All taxis from the live feed. */
  taxis: TaxiLocation[];
  /** Raw map of all vehicles (id → VehicleLocation). */
  vehicleMap: ReadonlyMap<string, VehicleLocation>;
  /** Current WebSocket connection state. */
  connectionState: ConnectionState;
  /** True while Supabase credentials are absent (sim-only mode). */
  isSimulationOnly: boolean;
  /** Imperatively update a vehicle's live position. */
  updateLocation: (payload: Omit<VehicleLocation, 'updatedAt'>) => Promise<void>;
  /** Query nearby vehicles on demand. */
  getNearbyVehicles: (query: NearbyVehiclesQuery) => Promise<VehicleLocation[]>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Subscribe to live vehicle tracking updates from Supabase.
 *
 * Falls back gracefully when Supabase env vars are absent — all vehicles
 * will simply be empty arrays and the connection state 'DISCONNECTED'.
 */
export function useVehicleTracking(): UseVehicleTrackingResult {
  // A Map keyed by vehicle ID for O(1) updates without full re-renders.
  const [vehicleMap, setVehicleMap] = useState<Map<string, VehicleLocation>>(
    () => new Map(),
  );
  const [connectionState, setConnectionState] = useState<ConnectionState>('CONNECTING');

  // Stable service reference — never changes after mount.
  const serviceRef = useRef(getVehicleTrackingService());
  const service = serviceRef.current;
  const isSimulationOnly = service === null;

  // ── Subscription ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!service) {
      setConnectionState('DISCONNECTED');
      return;
    }

    // Sync connection state periodically (Supabase doesn't expose a change
    // callback for connection state itself, only for channel events).
    const statePollTimer = setInterval(() => {
      setConnectionState(service.getConnectionState());
    }, 2_000);

    const unsubscribe = service.subscribe((updated) => {
      setVehicleMap((prev) => {
        // Only update if position actually changed to prevent needless renders.
        const existing = prev.get(updated.id);
        if (
          existing &&
          existing.lat === updated.lat &&
          existing.lng === updated.lng &&
          existing.updatedAt === updated.updatedAt
        ) {
          return prev;
        }
        const next = new Map(prev);
        next.set(updated.id, updated);
        return next;
      });
    });

    return () => {
      clearInterval(statePollTimer);
      unsubscribe();
    };
  }, [service]);

  // ── Derived typed slices ────────────────────────────────────────────────

  const jeepneys = useMemo<JeepneyLocation[]>(() => {
    const result: JeepneyLocation[] = [];
    for (const v of vehicleMap.values()) {
      if (v.type === 'jeepney') result.push(v as JeepneyLocation);
    }
    return result;
  }, [vehicleMap]);

  const taxis = useMemo<TaxiLocation[]>(() => {
    const result: TaxiLocation[] = [];
    for (const v of vehicleMap.values()) {
      if (v.type === 'taxi') result.push(v as TaxiLocation);
    }
    return result;
  }, [vehicleMap]);

  // ── Stable action callbacks ─────────────────────────────────────────────

  const updateLocation = useCallback(
    async (payload: Omit<VehicleLocation, 'updatedAt'>): Promise<void> => {
      if (!service) return;
      await service.updateLocation(payload);
    },
    [service],
  );

  const getNearbyVehicles = useCallback(
    async (query: NearbyVehiclesQuery): Promise<VehicleLocation[]> => {
      if (!service) return [];
      return service.getNearbyVehicles(query);
    },
    [service],
  );

  return {
    jeepneys,
    taxis,
    vehicleMap,
    connectionState,
    isSimulationOnly,
    updateLocation,
    getNearbyVehicles,
  };
}

// ─── Typed selector helpers ───────────────────────────────────────────────────

/** Filter an array of VehicleLocation to a specific type. */
export function filterByType(
  vehicles: VehicleLocation[],
  type: VehicleType,
): VehicleLocation[] {
  return vehicles.filter((v) => v.type === type);
}
