import { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import { DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEnhancedJeepSimulation } from '../hooks/useEnhancedJeepSimulation';
import { Navigation } from './Navigation';
import { TransportAnalytics } from './TransportAnalytics';
import { EnhancedJeepInfoPanel } from './EnhancedJeepInfoPanel';
import { getOccupancyColor, getOccupancyLabel, JeepStop, Jeep as JeepType } from '../data/jeepney-data';

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

export function EnhancedLiveMapView() {
  const {
    jeeps,
    routes,
    routesInitialized,
    systemMetrics,
    demandForecasts,
    simulatedHour,
    supplyRebalanceRecommendations,
    getJeepRecommendations,
    getTrafficStatusForJeep,
  } = useEnhancedJeepSimulation();

  const [selectedStop, setSelectedStop] = useState<JeepStop | null>(null);
  const [selectedJeep, setSelectedJeep] = useState<JeepType | null>(null);
  const [nightMode, setNightMode] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const isInFigma = window.location.href.includes('figma.com');

  const selectedJeepRoute = useMemo(
    () => routes.find(r => r.id === selectedJeep?.routeId),
    [selectedJeep, routes]
  );

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Navigation />

      <div className="flex-1 relative flex">
        {/* Main Map */}
        <div className="flex-1 relative">
          {isInFigma ? (
            <div className="h-full flex items-center justify-center bg-gray-100">
              <div className="text-center p-8">
                <div className="text-6xl mb-4">🗺️</div>
                <h2 className="text-xl font-semibold text-gray-700 mb-2">Interactive Map</h2>
                <p className="text-gray-500">View the live jeepney tracking map in the web version.</p>
              </div>
            </div>
          ) : (
            <>
              <MapContainer
                center={[10.3157, 123.8854] as any}
                zoom={13}
                className="h-full w-full"
                zoomControl={false}
              >
                <TileLayer
                  url={nightMode
                    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  }
                  attribution='&copy; OpenStreetMap'
                />

                {/* Route paths */}
                {routes.map(route => (
                  <Polyline
                    key={route.id}
                    positions={route.path.map(p => [p.lat, p.lng]) as any}
                    pathOptions={{ color: route.color, weight: 4, opacity: 0.7 }}
                  />
                ))}

                {/* Stops */}
                {routes.flatMap(route =>
                  route.stops.map(stop => (
                    <Marker
                      key={stop.id}
                      position={[stop.coordinates.lat, stop.coordinates.lng] as any}
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
                      position={[jeep.currentPosition.lat, jeep.currentPosition.lng] as any}
                      icon={jeepIcon(getOccupancyColor(jeep.occupancy))}
                      eventHandlers={{
                        click: () => setSelectedJeep(jeep),
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

              {/* Night Mode Toggle */}
              <button
                onClick={() => setNightMode(!nightMode)}
                className="absolute top-4 right-4 z-50 px-4 py-2 bg-white rounded-lg shadow hover:shadow-md border border-gray-300 text-gray-900 font-semibold text-sm transition-all"
              >
                {nightMode ? '☀️ Day' : '🌙 Night'}
              </button>
            </>
          )}
        </div>

        {/* Side Panel - Analytics */}
        <div className={`${showAnalytics ? 'w-96' : 'w-0'} transition-all duration-300 overflow-hidden bg-white border-l border-gray-200 shadow-lg`}>
          {showAnalytics && (
            <div className="h-full overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Transport Analytics</h3>
                <button
                  onClick={() => setShowAnalytics(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  ✕
                </button>
              </div>
              <TransportAnalytics
                systemMetrics={systemMetrics}
                demandForecasts={demandForecasts}
                supplyRecommendations={supplyRebalanceRecommendations}
                simulatedHour={simulatedHour}
              />
            </div>
          )}
        </div>

        {/* Toggle Analytics Button */}
        <button
          onClick={() => setShowAnalytics(!showAnalytics)}
          className={`absolute bottom-4 right-4 z-50 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
            showAnalytics
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-white text-gray-900 border border-gray-300 shadow hover:shadow-md'
          }`}
        >
          {showAnalytics ? 'Hide' : 'Show'} Analytics
        </button>
      </div>

      {/* Enhanced Jeep Info Panel */}
      {selectedJeep && selectedJeepRoute && (
        <EnhancedJeepInfoPanel
          jeep={selectedJeep}
          routeName={selectedJeepRoute.name}
          routeColor={selectedJeepRoute.color}
          trafficStatus={getTrafficStatusForJeep(selectedJeep.id)}
          recommendations={getJeepRecommendations(selectedJeep.id)}
          onClose={() => setSelectedJeep(null)}
          onSelectAlternative={(jeepId) => {
            const altJeep = jeeps.find(j => j.id === jeepId);
            if (altJeep) setSelectedJeep(altJeep);
          }}
        />
      )}
    </div>
  );
}
