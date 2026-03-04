import { useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import { Icon, DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useJeepSimulation } from '../hooks/useJeepSimulation';
import { Navigation } from './Navigation';
import { getOccupancyColor, getOccupancyLabel, calculateETA, JeepStop, Jeep as JeepType } from '../data/jeepney-data';
import { Bus, Clock, Users, MapPin, Navigation as NavigationIcon } from 'lucide-react';
import { motion } from 'motion/react';

// Custom marker icons
const jeepIcon = (color: string) => new DivIcon({
  html: `<div style="background: ${color}; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2">
      <rect x="3" y="11" width="18" height="10" rx="2"/>
      <path d="M7 11V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4"/>
      <circle cx="8" cy="18" r="1"/>
      <circle cx="16" cy="18" r="1"/>
    </svg>
  </div>`,
  className: 'jeep-marker',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const stopIcon = new DivIcon({
  html: `<div style="background: #1e40af; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.3);"></div>`,
  className: 'stop-marker',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

interface StopInfoPanelProps {
  stop: JeepStop;
  jeeps: JeepType[];
  onClose: () => void;
}

function StopInfoPanel({ stop, jeeps, onClose }: StopInfoPanelProps) {
  // Find jeeps on the same route
  const relevantJeeps = jeeps
    .filter(j => {
      const route = useJeepSimulation().routes.find(r => r.id === j.routeId);
      return route?.stops.some(s => s.id === stop.id);
    })
    .map(j => ({
      jeep: j,
      eta: calculateETA(j, stop),
    }))
    .filter(item => item.eta > 0)
    .sort((a, b) => a.eta - b.eta)
    .slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute bottom-24 left-4 right-4 md:left-auto md:w-96 bg-white rounded-xl shadow-2xl p-6 z-[1000]"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="w-5 h-5 text-blue-900" />
            <h3 className="font-semibold text-blue-900">{stop.name}</h3>
          </div>
          <p className="text-sm text-gray-600">Next arrivals</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          ✕
        </button>
      </div>

      {relevantJeeps.length > 0 ? (
        <div className="space-y-3">
          {relevantJeeps.map(({ jeep, eta }, idx) => {
            const route = useJeepSimulation().routes.find(r => r.id === jeep.routeId);
            return (
              <div key={jeep.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-2 h-12 rounded" style={{ background: route?.color }}></div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{route?.name}</div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-xs text-gray-600">
                      <Clock className="w-3 h-3" />
                      {eta} min
                    </span>
                    <span 
                      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                      style={{ 
                        background: `${getOccupancyColor(jeep.occupancy)}20`,
                        color: getOccupancyColor(jeep.occupancy)
                      }}
                    >
                      <Users className="w-3 h-3" />
                      {getOccupancyLabel(jeep.occupancy)}
                    </span>
                  </div>
                </div>
                {idx === 0 && (
                  <div className="text-xs font-semibold text-teal-600 bg-teal-50 px-2 py-1 rounded">
                    Next
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-4 text-gray-500 text-sm">
          No jeeps approaching this stop
        </div>
      )}

      <div className="mt-4 pt-4 border-t text-xs text-gray-500">
        Historical avg wait: {Math.round(Math.random() * 5 + 8)} minutes
      </div>
    </motion.div>
  );
}

interface JeepInfoPanelProps {
  jeep: JeepType;
  routeName: string;
  routeColor: string;
  onClose: () => void;
}

function JeepInfoPanel({ jeep, routeName, routeColor, onClose }: JeepInfoPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="absolute top-20 right-4 w-80 bg-white rounded-xl shadow-2xl p-5 z-[1000]"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: routeColor }}
          >
            <Bus className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-blue-900">{routeName}</h3>
            <p className="text-xs text-gray-500">Jeep #{jeep.id.split('-')[1]}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          ✕
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-600 mb-1">Occupancy</div>
          <div 
            className="font-semibold text-sm"
            style={{ color: getOccupancyColor(jeep.occupancy) }}
          >
            {getOccupancyLabel(jeep.occupancy)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {jeep.passengerCount}/{jeep.capacity} seats
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-600 mb-1">Speed</div>
          <div className="font-semibold text-sm text-blue-900">
            {jeep.speed} km/h
          </div>
        </div>
      </div>

      <div className="mt-3 p-3 bg-teal-50 rounded-lg border border-teal-200">
        <div className="flex items-center gap-2 text-xs text-teal-900">
          <NavigationIcon className="w-3 h-3" />
          <span>Active on route • GPS updated {Math.round(Math.random() * 5 + 1)}s ago</span>
        </div>
      </div>
    </motion.div>
  );
}

export function LiveMapView() {
  const { jeeps, routes } = useJeepSimulation();
  const [selectedStop, setSelectedStop] = useState<JeepStop | null>(null);
  const [selectedJeep, setSelectedJeep] = useState<{ jeep: JeepType; route: any } | null>(null);
  const [nightMode, setNightMode] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Navigation />
      
      <div className="flex-1 relative">
        <MapContainer
          center={[14.6091, 121.0223]}
          zoom={12}
          className="h-full w-full"
          zoomControl={false}
        >
          <TileLayer
            url={nightMode 
              ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            }
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          {/* Route paths */}
          {routes.map(route => (
            <Polyline
              key={route.id}
              positions={route.path.map(p => [p.lat, p.lng])}
              color={route.color}
              weight={4}
              opacity={0.7}
            />
          ))}

          {/* Stops */}
          {routes.flatMap(route =>
            route.stops.map(stop => (
              <Marker
                key={stop.id}
                position={[stop.coordinates.lat, stop.coordinates.lng]}
                icon={stopIcon}
                eventHandlers={{
                  click: () => setSelectedStop(stop),
                }}
              >
                <Popup>
                  <div className="text-sm">
                    <strong>{stop.name}</strong>
                  </div>
                </Popup>
              </Marker>
            ))
          )}

          {/* Jeeps */}
          {jeeps.map(jeep => {
            const route = routes.find(r => r.id === jeep.routeId);
            if (!route) return null;

            return (
              <Marker
                key={jeep.id}
                position={[jeep.currentPosition.lat, jeep.currentPosition.lng]}
                icon={jeepIcon(getOccupancyColor(jeep.occupancy))}
                eventHandlers={{
                  click: () => setSelectedJeep({ jeep, route }),
                }}
              >
                <Popup>
                  <div className="text-sm">
                    <strong>{route.name}</strong><br />
                    {getOccupancyLabel(jeep.occupancy)}<br />
                    Speed: {jeep.speed} km/h
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Legend */}
        <div className="absolute top-20 left-4 bg-white rounded-xl shadow-lg p-4 z-[1000] max-w-xs">
          <h3 className="font-semibold text-sm text-blue-900 mb-3">Active Routes</h3>
          <div className="space-y-2">
            {routes.map(route => {
              const activeJeeps = jeeps.filter(j => j.routeId === route.id);
              return (
                <div key={route.id} className="flex items-center gap-2 text-xs">
                  <div className="w-4 h-4 rounded" style={{ background: route.color }}></div>
                  <span className="flex-1 text-gray-700">{route.name}</span>
                  <span className="text-gray-500">{activeJeeps.length} jeeps</span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t space-y-2">
            <div className="text-xs font-medium text-gray-600 mb-2">Occupancy</div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-gray-700">Seats Available</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <span className="text-gray-700">Standing Room</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-gray-700">Full</span>
            </div>
          </div>
        </div>

        {/* Night Mode Toggle */}
        <button
          onClick={() => setNightMode(!nightMode)}
          className="absolute top-20 right-4 bg-white rounded-lg shadow-lg p-3 z-[1000] hover:bg-gray-50"
        >
          <span className="text-sm">{nightMode ? '☀️' : '🌙'}</span>
        </button>

        {/* Info Panels */}
        {selectedStop && (
          <StopInfoPanel
            stop={selectedStop}
            jeeps={jeeps}
            onClose={() => setSelectedStop(null)}
          />
        )}

        {selectedJeep && (
          <JeepInfoPanel
            jeep={selectedJeep.jeep}
            routeName={selectedJeep.route.name}
            routeColor={selectedJeep.route.color}
            onClose={() => setSelectedJeep(null)}
          />
        )}

        {/* Stats Bar */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-900 text-white rounded-full px-6 py-3 shadow-xl z-[1000]">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Bus className="w-4 h-4" />
              <span className="font-semibold">{jeeps.length}</span>
              <span className="text-blue-200">Active</span>
            </div>
            <div className="w-px h-4 bg-blue-700"></div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span className="text-blue-200">Live Tracking</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
