import { useDriverLocation } from '../context/DriverLocationContext';
import { useEffect, useState } from 'react';

const DRIVER_SPACE_STATUS_KEY = 'ptis_driver_space_status';

function fmt(n: number, decimals = 6): string {
  return n.toFixed(decimals);
}

export function DriverDashboard() {
  const { isSharing, location, error, startSharing, stopSharing } = useDriverLocation();
  const [driverSeatStatus, setDriverSeatStatus] = useState<'space' | 'full'>(() => {
    const stored = localStorage.getItem(DRIVER_SPACE_STATUS_KEY);
    return stored === 'full' ? 'full' : 'space';
  });

  useEffect(() => {
    localStorage.setItem(DRIVER_SPACE_STATUS_KEY, driverSeatStatus);
  }, [driverSeatStatus]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8 px-6 select-none">

      {/* ── Status pill ── */}
      <div
        className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors duration-300 ${
          isSharing
            ? 'bg-green-100 text-green-700'
            : 'bg-gray-100 text-gray-500'
        }`}
      >
        <span
          className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
            isSharing ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
          }`}
        />
        {isSharing ? 'Online' : 'Offline'}
      </div>

      {/* ── Main toggle button ── */}
      <button
        onClick={isSharing ? stopSharing : startSharing}
        aria-pressed={isSharing}
        className={`
          w-48 h-48 rounded-full text-white text-xl font-bold shadow-lg
          transition-all duration-200 active:scale-95 focus:outline-none
          focus-visible:ring-4 focus-visible:ring-offset-2
          ${
            isSharing
              ? 'bg-red-500 hover:bg-red-600 focus-visible:ring-red-400'
              : 'bg-green-500 hover:bg-green-600 focus-visible:ring-green-400'
          }
        `}
      >
        {isSharing ? 'Stop\nSharing' : 'Start\nSharing'}
      </button>

      <div className="w-full max-w-xs bg-white border border-gray-200 rounded-2xl shadow-sm px-4 py-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Passenger Space Status</p>
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
          <button
            onClick={() => setDriverSeatStatus('space')}
            aria-pressed={driverSeatStatus === 'space'}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              driverSeatStatus === 'space'
                ? 'bg-green-600 text-white shadow'
                : 'text-gray-600 hover:bg-white'
            }`}
          >
            Space Available
          </button>
          <button
            onClick={() => setDriverSeatStatus('full')}
            aria-pressed={driverSeatStatus === 'full'}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              driverSeatStatus === 'full'
                ? 'bg-red-600 text-white shadow'
                : 'text-gray-600 hover:bg-white'
            }`}
          >
            Full
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Current: <span className="font-semibold text-gray-700">{driverSeatStatus === 'full' ? 'Full' : 'Space Available'}</span>
        </p>
      </div>

      {/* ── Coordinates readout ── */}
      <div className="w-full max-w-xs bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4 space-y-3">
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
          <p className="text-center text-sm text-gray-400 py-2">
            {isSharing ? 'Acquiring GPS…' : 'Not sharing location'}
          </p>
        )}
      </div>

      {/* ── Error message ── */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 max-w-xs w-full bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3"
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
      <span className={`text-xs font-medium uppercase tracking-wider ${muted ? 'text-gray-400' : 'text-gray-500'}`}>
        {label}
      </span>
      <span className={`font-mono text-sm ${muted ? 'text-gray-400' : 'text-gray-900 font-semibold'}`}>
        {value}
      </span>
    </div>
  );
}
