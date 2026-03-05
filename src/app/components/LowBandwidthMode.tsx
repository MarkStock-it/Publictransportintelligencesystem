import { Navigation } from './Navigation';
import { useJeepSimulation } from '../hooks/useJeepSimulation';
import { ROUTES, calculateETA } from '../data/jeepney-data';
import { Bus, Clock, Users, ChevronRight, Signal } from 'lucide-react';

export function LowBandwidthMode() {
  const { jeeps } = useJeepSimulation();

  const routesWithJeeps = ROUTES.map(route => {
    const routeJeeps = jeeps
      .filter(j => j.routeId === route.id)
      .sort((a, b) => a.progress - b.progress);

    return {
      ...route,
      nextJeeps: routeJeeps.slice(0, 3),
    };
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-center gap-3">
          <Signal className="w-5 h-5 text-green-600" />
          <div>
            <h2 className="font-semibold text-green-900">Low Bandwidth Mode Active</h2>
            <p className="text-xs text-green-700">Optimized for slower connections • Text-only view</p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="text-gray-600 text-xs mb-1">Active Jeeps</div>
            <div className="text-2xl font-bold text-blue-900">{jeeps.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="text-gray-600 text-xs mb-1">Routes</div>
            <div className="text-2xl font-bold text-blue-900">{ROUTES.length}</div>
          </div>
        </div>

        {/* Route List */}
        <div className="space-y-4">
          <h3 className="font-semibold text-blue-900 text-lg">Active Routes</h3>
          
          {routesWithJeeps.map(route => (
            <div
              key={route.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
            >
              {/* Route Header */}
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center gap-3 mb-2">
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ background: route.color }}
                  ></div>
                  <h4 className="font-semibold text-gray-900 text-sm">{route.name}</h4>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-600">
                  <span className="flex items-center gap-1">
                    <Bus className="w-3 h-3" />
                    {route.nextJeeps.length} jeeps
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    ~{route.avgTripDuration} min trip
                  </span>
                </div>
              </div>

              {/* Next Arrivals */}
              {route.nextJeeps.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {route.nextJeeps.map((jeep, idx) => {
                    // Find the next stop for ETA
                    const currentStopIndex = Math.floor(jeep.progress * route.stops.length);
                    const nextStop = route.stops[Math.min(currentStopIndex + 1, route.stops.length - 1)];
                    const eta = calculateETA(jeep, nextStop);

                    return (
                      <div key={jeep.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          <div className="text-xs font-mono text-gray-400 w-8">#{jeep.id.split('-')[1]}</div>
                          <div>
                            <div className="text-sm text-gray-700">
                              Next: <span className="font-medium">{nextStop.name}</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {jeep.passengerCount}/{jeep.capacity} passengers
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-blue-900">{eta}m</div>
                          {idx === 0 && (
                            <div className="text-xs text-teal-600 font-semibold">Next</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No jeeps currently on route
                </div>
              )}

              {/* All Stops */}
              <details className="border-t border-gray-100">
                <summary className="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between text-sm text-gray-700 font-medium">
                  <span>View all stops ({route.stops.length})</span>
                  <ChevronRight className="w-4 h-4" />
                </summary>
                <div className="px-4 pb-4 space-y-2">
                  {route.stops.map((stop, idx) => (
                    <div key={stop.id} className="flex items-center gap-2 text-xs text-gray-600">
                      <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                      <span>{idx + 1}. {stop.name}</span>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          ))}
        </div>

        {/* Footer Info */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-semibold text-blue-900 text-sm mb-2">💡 Tip</h4>
          <p className="text-xs text-blue-800">
            This mode uses minimal data. Switch to Live Map view when you have better connectivity 
            to see real-time positions and interactive features.
          </p>
        </div>

        {/* Data Usage */}
        <div className="mt-4 text-center text-xs text-gray-500">
          <p>This page uses approximately 50KB of data</p>
          <p className="mt-1">Updates automatically every 10 seconds</p>
        </div>
      </div>
    </div>
  );
}
