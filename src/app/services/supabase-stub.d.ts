/**
 * Minimal type stub for @supabase/supabase-js.
 *
 * This file allows vehicleTrackingService.ts to compile before you run:
 *   npm install @supabase/supabase-js
 *
 * Once the real package is installed these declarations are superseded by the
 * official types shipped with the package.
 */
declare module '@supabase/supabase-js' {
  export type RealtimePostgresChangesPayload<T> = {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: T;
    old: Partial<T>;
    schema: string;
    table: string;
  };

  export type RealtimeChannelStatus =
    | 'SUBSCRIBED'
    | 'TIMED_OUT'
    | 'CLOSED'
    | 'CHANNEL_ERROR';

  export interface RealtimeChannel {
    on(
      type: 'postgres_changes',
      filter: {
        event: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
        schema: string;
        table: string;
      },
      callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void,
    ): RealtimeChannel;
    subscribe(callback?: (status: RealtimeChannelStatus) => void): RealtimeChannel;
  }

  export interface PostgrestFilterBuilder<T> {
    eq(
      column: string,
      value: unknown,
    ): PostgrestFilterBuilder<T>;
    order(
      column: string,
      options?: { ascending?: boolean },
    ): PostgrestFilterBuilder<T>;
    limit(count: number): PostgrestFilterBuilder<T>;
    select(columns?: string): PostgrestFilterBuilder<T>;
    upsert(
      values: Record<string, unknown>,
      options?: { onConflict?: string },
    ): PostgrestFilterBuilder<T>;
  }

  export interface SupabaseClient {
    channel(name: string): RealtimeChannel;
    removeChannel(channel: RealtimeChannel): Promise<void>;
    from(table: string): PostgrestFilterBuilder<Record<string, unknown>> & {
      then?: never;
      // Resolves to { data: unknown[] | null; error: { message: string } | null }
    };
  }

  export interface StorageError {
    message: string;
  }

  export function createClient(
    url: string,
    key: string,
    options?: {
      realtime?: { params?: { eventsPerSecond?: number } };
    },
  ): SupabaseClient;
}
