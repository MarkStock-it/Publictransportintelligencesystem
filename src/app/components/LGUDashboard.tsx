import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useJeepSimulation, type JeepVehicle, type SeatStatus } from '../hooks/useJeepSimulation';

// ─── Color / label maps ───────────────────────────────────────────────────────

const SEAT_COLOR: Record<SeatStatus, string> = {
  many: '#16a34a',
  few:  '#d97706',
  full: '#dc2626',
};
const SEAT_LABEL: Record<SeatStatus, string> = {
  many: 'Many',
  few:  'Few',
  full: 'Full',
};
const CHART_COLORS = ['#14b8a6', '#f59e0b', '#8b5cf6'];

// ─── Marker icon factories ────────────────────────────────────────────────────

function singleIcon(status: SeatStatus): DivIcon {
  return new DivIcon({
    html: `<div style="
      width:12px;height:12px;border-radius:50%;
      background:${SEAT_COLOR[status]};
      border:2px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,0.4);
    "></div>`,
    className: '',
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -10],
  });
}

function clusterIcon(count: number, dominant: SeatStatus): DivIcon {
  return new DivIcon({
    html: `<div style="
      min-width:30px;height:30px;padding:0 6px;border-radius:999px;
      background:${SEAT_COLOR[dominant]};color:#fff;
      font-size:12px;font-weight:700;
      border:2.5px solid rgba(255,255,255,0.85);
      box-shadow:0 2px 8px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;
    ">${count}</div>`,
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18],
  });
}

// ─── Grid-based clustering ────────────────────────────────────────────────────

type SingleMarker  = { type: 'single'; jeep: JeepVehicle };
type ClusterMarker = {
  type: 'cluster';
  id: string;
  lat: number;
  lng: number;
  count: number;
  dominant: SeatStatus;
};
type MapMarker = SingleMarker | ClusterMarker;

/** Groups nearby jeepneys into clusters at low zoom levels (< 13). */
function clusterize(jeeps: JeepVehicle[], zoom: number): MapMarker[] {
  if (zoom >= 13) return jeeps.map(j => ({ type: 'single', jeep: j }));

  const cellDeg = zoom <= 11 ? 0.05 : 0.025;
  const cells = new Map<string, JeepVehicle[]>();

  for (const j of jeeps) {
    const key = `${Math.floor(j.lat / cellDeg)},${Math.floor(j.lng / cellDeg)}`;
    const arr = cells.get(key) ?? [];
    arr.push(j);
    cells.set(key, arr);
  }

  const result: MapMarker[] = [];
  for (const [key, group] of cells) {
    if (group.length === 1) {
      result.push({ type: 'single', jeep: group[0] });
    } else {
      const lat = group.reduce((s, j) => s + j.lat, 0) / group.length;
      const lng = group.reduce((s, j) => s + j.lng, 0) / group.length;
      const counts: Record<SeatStatus, number> = { many: 0, few: 0, full: 0 };
      for (const j of group) counts[j.seatStatus]++;
      const dominant = (
        Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
      ) as SeatStatus;
      result.push({ type: 'cluster', id: key, lat, lng, count: group.length, dominant });
    }
  }
  return result;
}

// ─── MapOverlay ───────────────────────────────────────────────────────────────
// Must be a child of MapContainer. Manages viewport filtering, clustering,
// and marker rendering. Reports visible jeepneys to the parent via callback.

function MapOverlay({
  allJeepneys,
  onVisibleChange,
}: {
  allJeepneys: JeepVehicle[];
  onVisibleChange: (visible: JeepVehicle[]) => void;
}) {
  const map = useMap();
  // Use refs so map event handlers always read latest values without re-registering.
  const stateRef = useRef({ allJeepneys, onVisibleChange });
  stateRef.current = { allJeepneys, onVisibleChange };

  const [markers, setMarkers] = useState<MapMarker[]>([]);

  // Register moveend / zoomend handlers once on mount.
  useEffect(() => {
    const update = () => {
      const { allJeepneys: all, onVisibleChange: cb } = stateRef.current;
      const bounds = map.getBounds();
      const zoom   = map.getZoom();
      const visible = all.filter(j => bounds.contains([j.lat, j.lng] as [number, number]));
      setMarkers(clusterize(visible, zoom));
      cb(visible);
    };

    update(); // run immediately for the initial viewport
    map.on('moveend', update);
    map.on('zoomend', update);
    return () => {
      map.off('moveend', update);
      map.off('zoomend', update);
    };
  }, [map]);

  // Re-filter every time the simulation ticks (allJeepneys reference changes).
  useEffect(() => {
    const bounds = map.getBounds();
    const zoom   = map.getZoom();
    const visible = allJeepneys.filter(j => bounds.contains([j.lat, j.lng] as [number, number]));
    setMarkers(clusterize(visible, zoom));
    onVisibleChange(visible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allJeepneys]);

  return (
    <>
      {markers.map(m =>
        m.type === 'cluster' ? (
          <Marker key={m.id} position={[m.lat, m.lng]} icon={clusterIcon(m.count, m.dominant)}>
            <Popup>
              <p className="text-xs font-semibold">{m.count} jeepneys nearby</p>
            </Popup>
          </Marker>
        ) : (
          <Marker
            key={m.jeep.id}
            position={[m.jeep.lat, m.jeep.lng]}
            icon={singleIcon(m.jeep.seatStatus)}
          >
            <Popup>
              <div className="text-xs space-y-1 min-w-[148px]">
                <p className="font-mono font-bold text-sm text-gray-900">{m.jeep.id}</p>
                <p className="text-gray-500">{m.jeep.route}</p>
                <span
                  className="inline-block px-2 py-0.5 rounded-full text-white font-semibold text-[11px]"
                  style={{ background: SEAT_COLOR[m.jeep.seatStatus] }}
                >
                  {SEAT_LABEL[m.jeep.seatStatus]}
                </span>
              </div>
            </Popup>
          </Marker>
        )
      )}
    </>
  );
}

// ─── StatsPanel ───────────────────────────────────────────────────────────────

function StatsPanel({ allJeepneys }: { allJeepneys: JeepVehicle[] }) {
  const total = allJeepneys.length;
  const bySeat: Record<SeatStatus, number> = { many: 0, few: 0, full: 0 };
  for (const j of allJeepneys) bySeat[j.seatStatus]++;

  // Jeepneys per route (short name before " - ")
  const routeMap = new Map<string, number>();
  for (const j of allJeepneys) {
    const short = j.route.split(' - ')[0].trim();
    routeMap.set(short, (routeMap.get(short) ?? 0) + 1);
  }
  const chartData = Array.from(routeMap.entries()).map(([name, count]) => ({ name, count }));

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-white border-b border-gray-200 flex-shrink-0 flex-wrap">
      {/* Stat pills */}
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <div className="text-2xl font-bold text-gray-900 leading-none">{total}</div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">Total</div>
        </div>
        {(Object.keys(bySeat) as SeatStatus[]).map(s => (
          <div key={s} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: SEAT_COLOR[s] }}
            />
            <div>
              <span className="text-base font-bold text-gray-800">{bySeat[s]}</span>
              <span className="text-[11px] text-gray-400 ml-1">{SEAT_LABEL[s]}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Jeepneys per route — compact bar chart */}
      <div className="flex-1 min-w-[180px] h-12">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 2, right: 4, bottom: 0, left: -28 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} />
            <YAxis tick={{ fontSize: 9 }} allowDecimals={false} width={24} />
            <Tooltip
              contentStyle={{
                fontSize: 11, padding: '3px 8px',
                borderRadius: 6, border: '1px solid #e5e7eb',
              }}
              cursor={{ fill: '#f9fafb' }}
            />
            <Bar dataKey="count" name="Jeepneys" radius={[3, 3, 0, 0]} maxBarSize={24}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── DataTable ────────────────────────────────────────────────────────────────

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function DataTable({ jeepneys }: { jeepneys: JeepVehicle[] }) {
  return (
    <div className="flex-shrink-0 border-t border-gray-200 bg-white">
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-gray-100 bg-gray-50">
        <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
          Viewport — {jeepneys.length} jeepne{jeepneys.length === 1 ? 'y' : 'ys'}
        </h2>
        <span className="text-[10px] text-gray-400">Updates as map moves</span>
      </div>

      <div className="overflow-y-auto max-h-44">
        {jeepneys.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-5">
            No jeepneys in current viewport — pan or zoom out
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr>
                {['ID', 'Route', 'Seat Status', 'Last Updated'].map(h => (
                  <th
                    key={h}
                    className="px-4 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {jeepneys.map(j => (
                <tr key={j.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2 font-mono font-bold text-gray-800">{j.id}</td>
                  <td className="px-4 py-2 text-gray-600 max-w-[180px] truncate">{j.route}</td>
                  <td className="px-4 py-2">
                    <span
                      className="px-2 py-0.5 rounded-full text-white text-[11px] font-semibold whitespace-nowrap"
                      style={{ background: SEAT_COLOR[j.seatStatus] }}
                    >
                      {SEAT_LABEL[j.seatStatus]}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-gray-400">{fmtTime(j.lastUpdate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── LGUDashboard (main) ──────────────────────────────────────────────────────

export function LGUDashboard() {
  const { jeeps } = useJeepSimulation();
  const [visibleJeeps, setVisibleJeeps] = useState<JeepVehicle[]>([]);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // Stable callback so MapOverlay doesn't needlessly re-register
  const handleVisibleChange = useCallback((visible: JeepVehicle[]) => {
    setVisibleJeeps(visible);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-blue-900 text-white shadow-md flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-teal-500 rounded-md flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <div>
            <span className="font-bold tracking-tight text-sm">PTIS</span>
            <span className="ml-2 text-blue-300 text-xs">LGU Command View</span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs text-blue-300 hover:text-white transition-colors"
        >
          Sign out
        </button>
      </header>

      {/* ── Stats bar (full-dataset counts + per-route chart) ── */}
      <StatsPanel allJeepneys={jeeps} />

      {/* ── Map (takes remaining vertical space) ── */}
      <div className="flex-1 min-h-0">
        <MapContainer
          center={[10.3157, 123.8854]}
          zoom={14}
          className="h-full w-full"
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
            maxZoom={19}
          />
          <MapOverlay allJeepneys={jeeps} onVisibleChange={handleVisibleChange} />
        </MapContainer>
      </div>

      {/* ── Data table (viewport-filtered, scrollable) ── */}
      <DataTable jeepneys={visibleJeeps} />

    </div>
  );
}
