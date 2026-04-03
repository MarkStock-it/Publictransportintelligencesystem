import { useDriverLocation } from '../context/DriverLocationContext';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const DRIVER_SPACE_STATUS_KEY = 'ptis_driver_space_status';
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

function fmt(n: number, decimals = 6): string {
  return n.toFixed(decimals);
}

export function DriverDashboard() {
  const { isSharing, location, error, startSharing, stopSharing } = useDriverLocation();
  const { user } = useAuth();
  const [driverSeatStatus, setDriverSeatStatus] = useState<'space' | 'full'>(() => {
    const stored = localStorage.getItem(DRIVER_SPACE_STATUS_KEY);
    return stored === 'full' ? 'full' : 'space';
  });

  useEffect(() => {
    localStorage.setItem(DRIVER_SPACE_STATUS_KEY, driverSeatStatus);
  }, [driverSeatStatus]);

  // ── Push real GPS to the server so commuters can see this jeep ──────────
  const postingRef = useRef(false);
  useEffect(() => {
    if (!isSharing || !location) return;

    const post = async () => {
      if (postingRef.current) return;
      postingRef.current = true;
      try {
        const token = localStorage.getItem('ptis_token');
        await fetch(`${API_BASE}/api/driver/location`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token ?? ''}`,
          },
          body: JSON.stringify({
            lat: location.lat,
            lng: location.lng,
            accuracy: location.accuracy,
            seatStatus: driverSeatStatus,
            jeepId: user?.jeepId ?? undefined,
            route: user?.route ?? undefined,
          }),
        });
      } catch {
        // network hiccup — silent, will retry next tick
      } finally {
        postingRef.current = false;
      }
    };

    post(); // send immediately on location change
    const id = setInterval(post, 3_000);
    return () => clearInterval(id);
  }, [isSharing, location, driverSeatStatus, user?.jeepId, user?.route]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-52px)] gap-6 px-6 py-8 select-none bg-slate-950">

      {/* ── Status pill ── */}
      <div
        className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold tracking-wide transition-all duration-300 border ${
          isSharing
            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-lg shadow-emerald-900/30'
            : 'bg-white/[0.06] text-white/30 border-white/10'
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full transition-colors duration-300 ${
            isSharing ? 'bg-emerald-400 animate-pulse' : 'bg-white/20'
          }`}
        />
        {isSharing ? 'Online' : 'Offline'}
      </div>

      {/* ── Main toggle button ── */}
      <button
        onClick={isSharing ? stopSharing : startSharing}
        aria-pressed={isSharing}
        className={`
          w-52 h-52 rounded-full text-white text-xl font-black tracking-wide shadow-2xl
          transition-all duration-200 active:scale-95 focus:outline-none
          focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950
          ${
            isSharing
              ? 'bg-gradient-to-br from-red-500 to-rose-600 focus-visible:ring-red-400 shadow-red-900/50'
              : 'bg-gradient-to-br from-emerald-500 to-teal-600 focus-visible:ring-emerald-400 shadow-emerald-900/50'
          }
        `}
      >
        {isSharing ? 'Stop\nSharing' : 'Start\nSharing'}
      </button>

      <div className="w-full max-w-xs bg-white/[0.05] border border-white/10 rounded-2xl px-4 py-4 space-y-2 backdrop-blur-sm">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Driver Profile</p>
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/40 text-xs">Jeep ID</span>
          <span className="font-mono font-bold text-white">{user?.jeepId ?? 'Not set'}</span>
        </div>
        <div className="flex items-start justify-between gap-3 text-sm">
          <span className="text-white/40 text-xs flex-shrink-0">Route</span>
          <span className="font-medium text-right text-white/80 text-xs">{user?.route ?? 'Not set'}</span>
        </div>
      </div>

      <div className="w-full max-w-xs bg-white/[0.05] border border-white/10 rounded-2xl px-4 py-4 space-y-3 backdrop-blur-sm">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Passenger Space</p>
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-white/[0.05] p-1">
          <button
            onClick={() => setDriverSeatStatus('space')}
            aria-pressed={driverSeatStatus === 'space'}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              driverSeatStatus === 'space'
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-900/40'
                : 'text-white/40 hover:bg-white/10'
            }`}
          >
            Space Available
          </button>
          <button
            onClick={() => setDriverSeatStatus('full')}
            aria-pressed={driverSeatStatus === 'full'}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              driverSeatStatus === 'full'
                ? 'bg-red-500 text-white shadow-lg shadow-red-900/40'
                : 'text-white/40 hover:bg-white/10'
            }`}
          >
            Full
          </button>
        </div>
        <p className="text-xs text-white/30">
          Currently: <span className="font-semibold text-white/60">{driverSeatStatus === 'full' ? 'Full' : 'Space Available'}</span>
        </p>
      </div>

      {/* ── Coordinates readout ── */}
      <div className="w-full max-w-xs bg-white/[0.05] border border-white/10 rounded-2xl px-6 py-4 space-y-3 backdrop-blur-sm">
        {location ? (
          <>
            <CoordRow label="Latitude"  value={fmt(location.lat)} />
            <CoordRow label="Longitude" value={fmt(location.lng)} />
            <CoordRow
              label="Accuracy"
              value={`±${Math.round(location.accuracy)} m`}
              muted
            />
            <CoordRow
              label="Updated"
              value={new Date(location.timestamp).toLocaleTimeString()}
              muted
            />
          </>
        ) : (
          <p className="text-center text-sm text-white/30 py-2">
            {isSharing ? 'Acquiring GPS…' : 'Not sharing location'}
          </p>
        )}
      </div>

      {/* ── Error message ── */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 max-w-xs w-full bg-red-500/10 border border-red-400/25 text-red-300 text-sm rounded-xl px-4 py-3"
        >
          <svg
            className="w-4 h-4 mt-0.5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
          {error}
        </div>
      )}
    </div>
  );
}

// ── Small helper ─────────────────────────────────────────────────────────────
function CoordRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-xs font-medium uppercase tracking-wider ${muted ? 'text-white/20' : 'text-white/40'}`}>
        {label}
      </span>
      <span className={`font-mono text-sm ${muted ? 'text-white/25' : 'text-white font-semibold'}`}>
        {value}
      </span>
    </div>
  );
}
