/**
 * types.supabase.d.ts
 *
 * Type stubs for @supabase/supabase-js to allow compilation before package installation.
 * These are superseded by real package types once npm install completes.
 */

declare module '@supabase/supabase-js' {
  export type RealtimeChannelStatus =
    | 'SUBSCRIBED'
    | 'TIMED_OUT'
    | 'CLOSED'
    | 'CHANNEL_ERROR';

  export interface RealtimePostgresPayload<T = Record<string, unknown>> {
    new: T;
    old: Partial<T>;
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    schema: string;
    table: string;
  }

  export interface RealtimeChannel {
    on(
      type: 'postgres_changes',
      filter: {
        event: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
        schema: string;
        table: string;
      },
      callback: (payload: RealtimePostgresPayload) => void,
    ): RealtimeChannel;
    subscribe(callback?: (status: RealtimeChannelStatus) => void): RealtimeChannel;
  }

  export interface QueryBuilder {
    select(columns?: string): QueryBuilder;
    eq(column: string, value: unknown): QueryBuilder;
    order(column: string, opts?: { ascending?: boolean }): QueryBuilder;
    limit(n: number): QueryBuilder;
    upsert(
      row: Record<string, unknown>,
      opts?: { onConflict?: string },
    ): QueryBuilder;
    then(
      resolve: (result: { data: Record<string, unknown>[] | null; error: { message: string } | null }) => void,
    ): void;
  }

  export interface SupabaseClientOptions {
    realtime?: { params?: { eventsPerSecond?: number } };
  }

  export interface SupabaseClient {
    channel(name: string): RealtimeChannel;
    removeChannel(channel: RealtimeChannel): Promise<void>;
    from(table: string): QueryBuilder;
  }

  export function createClient(
    url: string,
    key: string,
    options?: SupabaseClientOptions,
  ): SupabaseClient;
}
