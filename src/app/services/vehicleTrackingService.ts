/// <reference types="vite/client" />
/// <reference path="../../vite-env.d.ts" />

/**
 * vehicleTrackingService.ts
 *
 * Hybrid real-time vehicle tracking service.
 *
 * Strategy:
 *   1. Primary — Supabase Realtime WebSocket subscription on `vehicle_locations`.
 *   2. Fallback — setInterval polling that activates only when the channel
 *      state becomes 'DISCONNECTED'.
 *
 * Install dependency before use:
 *   npm install @supabase/supabase-js
 *
 * Required env vars (add to .env):
 *   VITE_SUPABASE_URL=https://<project>.supabase.co
 *   VITE_SUPABASE_ANON_KEY=<anon-key>
 *
 * Required Supabase table (run in SQL editor):
 *   CREATE TABLE vehicle_locations (
 *     id          TEXT PRIMARY KEY,
 *     type        TEXT NOT NULL CHECK (type IN ('taxi','jeepney')),
 *     lat         DOUBLE PRECISION NOT NULL,
 *     lng         DOUBLE PRECISION NOT NULL,
 *     route       TEXT,
 *     speed       DOUBLE PRECISION,
 *     heading     DOUBLE PRECISION,
 *     passenger_count INT,
 *     capacity    INT,
 *     updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *   );
 *   ALTER TABLE vehicle_locations ENABLE ROW LEVEL SECURITY;
 *   -- Allow anonymous reads (adjust to your auth policy as needed)
 *   CREATE POLICY "public read" ON vehicle_locations FOR SELECT USING (true);
 */

// ─── Inline Supabase types (replaces @supabase/supabase-js import) ────────────
// These are just enough to type-check this service. Once you run
// `npm install @supabase/supabase-js` the real package types take precedence
// at runtime and provide the full API surface.

type RealtimeChannelStatus = 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR';

interface RealtimePostgresFilter {
  event: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  schema: string;
  table: string;
}

interface RealtimeChannel {
  on(
    type: 'postgres_changes',
    filter: RealtimePostgresFilter,
    callback: (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => void,
  ): RealtimeChannel;
  subscribe(callback?: (status: RealtimeChannelStatus) => void): RealtimeChannel;
}

interface QueryBuilder {
  select(columns?: string): QueryBuilder;
  eq(column: string, value: string): QueryBuilder;
  order(column: string, opts?: { ascending: boolean }): QueryBuilder;
  limit(n: number): QueryBuilder;
  upsert(
    row: Record<string, unknown>,
    opts?: { onConflict: string },
  ): QueryBuilder;
  then(
    resolve: (result: { data: Record<string, unknown>[] | null; error: { message: string } | null }) => void,
  ): void;
}

interface ISupabaseClient {
  channel(name: string): RealtimeChannel;
  removeChannel(ch: RealtimeChannel): Promise<void>;
  from(table: string): QueryBuilder;
}

/**
 * Lazily creates a Supabase client via dynamic import so the service module
 * can load and compile even before `@supabase/supabase-js` is installed.
 * Returns null and logs a warning if the package is not available.
 */
async function createSupabaseClient(url: string, key: string): Promise<ISupabaseClient | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = await import('@supabase/supabase-js' as any) as {
      createClient: (u: string, k: string, opts?: unknown) => ISupabaseClient;
    };
    return supabase.createClient(url, key, {
      realtime: { params: { eventsPerSecond: 10 } },
    });
  } catch {
    console.error(
      '[VehicleTrackingService] @supabase/supabase-js not installed. ' +
        'Run: npm install @supabase/supabase-js',
    );
    return null;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

/** Distinct vehicle types supported by the tracking system. */
export type VehicleType = 'taxi' | 'jeepney';

/** Shape of a row in the `vehicle_locations` table. */
export interface VehicleLocation {
  id: string;
  type: VehicleType;
  lat: number;
  lng: number;
  route: string | null;
  speed: number | null;
  heading: number | null;
  passengerCount: number | null;
  capacity: number | null;
  updatedAt: string;
}

export interface NearbyVehiclesQuery {
  lat: number;
  lng: number;
  /** Search radius in kilometres. */
  radiusKm: number;
  /** Optionally restrict results to a single vehicle type. */
  type?: VehicleType;
}

/** Callback invoked whenever a vehicle location changes. */
export type LocationUpdateCallback = (updated: VehicleLocation) => void;

/** Current WebSocket connection health. */
export type ConnectionState = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED';

// ─── DB row → domain model ────────────────────────────────────────────────────

/** Raw shape returned by Supabase (snake_case columns). */
interface DbRow {
  id: string;
  type: VehicleType;
  lat: number;
  lng: number;
  route: string | null;
  speed: number | null;
  heading: number | null;
  passenger_count: number | null;
  capacity: number | null;
  updated_at: string;
}

function rowToVehicle(row: DbRow): VehicleLocation {
  return {
    id: row.id,
    type: row.type,
    lat: row.lat,
    lng: row.lng,
    route: row.route,
    speed: row.speed,
    heading: row.heading,
    passengerCount: row.passenger_count,
    capacity: row.capacity,
    updatedAt: row.updated_at,
  };
}

// ─── Haversine helper ─────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Service ──────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5_000;

export class VehicleTrackingService {
  private client: ISupabaseClient | null = null;
  private channel: RealtimeChannel | null = null;
  private connectionState: ConnectionState = 'CONNECTING';
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private subscribers: Set<LocationUpdateCallback> = new Set();

  constructor(supabaseUrl: string, supabaseAnonKey: string) {
    void this.init(supabaseUrl, supabaseAnonKey);
  }

  private async init(url: string, key: string): Promise<void> {
    this.client = await createSupabaseClient(url, key);
    if (!this.client) {
      this.connectionState = 'DISCONNECTED';
      this.startFallbackPolling();
      return;
    }
    this.startRealtimeSubscription();
  }

  // ── Realtime (primary) ────────────────────────────────────────────────────

  private startRealtimeSubscription(): void {
    if (!this.client) return;
    this.connectionState = 'CONNECTING';

    this.channel = this.client
      .channel('vehicle_locations_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vehicle_locations' },
        (payload) => {
          const row = (payload.new ?? payload.old) as DbRow | undefined;
          if (!row) return;
          const vehicle = rowToVehicle(row);
          this.notifySubscribers(vehicle);
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.connectionState = 'CONNECTED';
          this.stopFallbackPolling();
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          this.connectionState = 'DISCONNECTED';
          this.startFallbackPolling();
        }
      });
  }

  // ── Fallback polling (activates on DISCONNECTED only) ─────────────────────

  private startFallbackPolling(): void {
    if (this.pollTimer !== null) return; // already running
    this.pollTimer = setInterval(() => {
      // Re-attempt realtime connection on each poll cycle.
      if (this.connectionState === 'DISCONNECTED') {
        void this.pollAllVehicles();
        // Attempt reconnect every 3rd poll.
        if (Math.random() < 0.33) {
          this.stopRealtimeSubscription();
          this.startRealtimeSubscription();
        }
      } else {
        this.stopFallbackPolling();
      }
    }, POLL_INTERVAL_MS);
  }

  private stopFallbackPolling(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private stopRealtimeSubscription(): void {
    if (this.channel && this.client) {
      void this.client.removeChannel(this.channel);
      this.channel = null;
    }
  }

  private async pollAllVehicles(): Promise<void> {
    if (!this.client) return;
    const result = await new Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>(
      (resolve) => {
        this.client!
          .from('vehicle_locations')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(200)
          .then(resolve);
      },
    );

    if (result.error || !result.data) return;

    for (const row of result.data as DbRow[]) {
      this.notifySubscribers(rowToVehicle(row));
    }
  }

  // ── Subscriber management ─────────────────────────────────────────────────

  private notifySubscribers(vehicle: VehicleLocation): void {
    for (const cb of this.subscribers) {
      cb(vehicle);
    }
  }

  /**
   * Subscribe to live vehicle location changes.
   * Returns an unsubscribe function — call it in a useEffect cleanup.
   */
  subscribe(callback: LocationUpdateCallback): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Upsert the live position of a single vehicle. */
  async updateLocation(payload: Omit<VehicleLocation, 'updatedAt'>): Promise<void> {
    if (!this.client) return;
    const result = await new Promise<{ data: unknown; error: { message: string } | null }>(
      (resolve) => {
        this.client!
          .from('vehicle_locations')
          .upsert(
            {
              id: payload.id,
              type: payload.type,
              lat: payload.lat,
              lng: payload.lng,
              route: payload.route ?? null,
              speed: payload.speed ?? null,
              heading: payload.heading ?? null,
              passenger_count: payload.passengerCount ?? null,
              capacity: payload.capacity ?? null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' },
          )
          .then(resolve as Parameters<typeof this.client.from>['0'] extends never ? never : (v: { data: Record<string, unknown>[] | null; error: { message: string } | null }) => void);
      },
    );

    if ((result as { error: { message: string } | null }).error) {
      console.error(
        '[VehicleTrackingService] updateLocation failed:',
        (result as { error: { message: string } }).error.message,
      );
    }
  }

  /**
   * Fetch vehicles within `radiusKm` kilometres of the given coordinates.
   * Filtering is done client-side using Haversine since PostGIS may not be
   * enabled on all Supabase projects.
   */
  async getNearbyVehicles(query: NearbyVehiclesQuery): Promise<VehicleLocation[]> {
    if (!this.client) return [];

    const result = await new Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>(
      (resolve) => {
        const builder = this.client!
          .from('vehicle_locations')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(500);

        const filtered = query.type ? builder.eq('type', query.type) : builder;
        filtered.then(resolve);
      },
    );

    if (result.error || !result.data) return [];

    return (result.data as DbRow[])
      .map(rowToVehicle)
      .filter((v) => haversineKm(query.lat, query.lng, v.lat, v.lng) <= query.radiusKm);
  }

  /** Current WebSocket connection health. */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /** Tear down subscriptions and timers. Call on component unmount. */
  destroy(): void {
    this.stopFallbackPolling();
    this.stopRealtimeSubscription();
    this.subscribers.clear();
  }
}

// ─── Singleton factory ────────────────────────────────────────────────────────

let _instance: VehicleTrackingService | null = null;

/**
 * Returns a lazily-created singleton `VehicleTrackingService`.
 * Reads credentials from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
 * Returns `null` if either env var is missing (graceful degradation).
 */
export function getVehicleTrackingService(): VehicleTrackingService | null {
  if (_instance) return _instance;

  // Access env via the augmented ImportMeta (declared in vite-env.d.ts).
  const meta = import.meta as ImportMeta;
  const url = meta.env.VITE_SUPABASE_URL;
  const key = meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn(
      '[VehicleTrackingService] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set. ' +
        'Supabase tracking disabled — simulation data will be used instead.',
    );
    return null;
  }

  _instance = new VehicleTrackingService(url, key);
  return _instance;
}
