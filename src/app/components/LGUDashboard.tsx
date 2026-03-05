import { Navigation } from './Navigation';
import { useJeepSimulation } from '../hooks/useJeepSimulation';
import { ROUTES } from '../data/jeepney-data';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Building2, TrendingUp, AlertTriangle, Clock, MapPin, Users } from 'lucide-react';

export function LGUDashboard() {
  const { jeeps } = useJeepSimulation();

  // Congestion data by route
  const congestionData = ROUTES.map(route => {
    const routeJeeps = jeeps.filter(j => j.routeId === route.id);
    const avgOccupancy = routeJeeps.reduce((acc, j) => acc + j.passengerCount, 0) / routeJeeps.length;
    const congestionLevel = (avgOccupancy / 18) * 100;

    return {
      name: route.name.split('-')[0].trim(),
      congestion: Math.round(congestionLevel),
      jeeps: routeJeeps.length,
      demand: Math.round(avgOccupancy * routeJeeps.length),
    };
  });

  // Time-of-day demand (simulated hourly data)
  const hourlyDemand = Array.from({ length: 24 }, (_, i) => {
    const isPeak = (i >= 6 && i <= 9) || (i >= 17 && i <= 19);
    const baseDemand = isPeak ? 180 : 80;
    const variance = Math.random() * 30;
    return {
      hour: i,
      label: `${i}:00`,
      demand: Math.round(baseDemand + variance),
      capacity: 200,
    };
  });

  // Route distribution
  const routeDistribution = ROUTES.map(route => ({
    name: route.name.split('-')[0].trim(),
    value: jeeps.filter(j => j.routeId === route.id).length,
    color: route.color,
  }));

  // Wait time analysis by area
  const waitTimeData = [
    { area: 'Divisoria', avgWait: 8, peak: 12, offPeak: 5 },
    { area: 'Cubao', avgWait: 10, peak: 15, offPeak: 6 },
    { area: 'Makati', avgWait: 7, peak: 11, offPeak: 4 },
    { area: 'Monumento', avgWait: 9, peak: 14, offPeak: 6 },
  ];

  // Imbalance alerts
  const imbalanceAlerts = ROUTES.map(route => {
    const routeJeeps = jeeps.filter(j => j.routeId === route.id);
    const avgOccupancy = routeJeeps.reduce((acc, j) => acc + j.passengerCount, 0) / routeJeeps.length;
    const optimalJeeps = Math.ceil((avgOccupancy * routeJeeps.length) / 15);
    const imbalance = optimalJeeps - routeJeeps.length;

    return {
      route: route.name,
      current: routeJeeps.length,
      optimal: optimalJeeps,
      imbalance: Math.abs(imbalance),
      status: imbalance > 0 ? 'understaffed' : imbalance < 0 ? 'overstaffed' : 'balanced',
    };
  }).filter(alert => alert.status !== 'balanced');

  const COLORS = ['#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444'];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-8 h-8 text-blue-900" />
            <h1 className="text-3xl font-bold text-blue-900">LGU Planning Dashboard</h1>
          </div>
          <p className="text-gray-600">Infrastructure intelligence and urban transport analytics</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div
            className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl shadow-lg p-6 text-white"
          >
            <div className="flex items-center justify-between mb-2">
              <Users className="w-8 h-8 opacity-80" />
              <div className="text-right">
                <div className="text-3xl font-bold">
                  {Math.round(jeeps.reduce((acc, j) => acc + j.passengerCount, 0))}
                </div>
                <div className="text-sm opacity-90">Current Passengers</div>
              </div>
            </div>
            <div className="text-xs opacity-75 mt-2">+12% vs last week</div>
          </div>

          <div
            className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white"
          >
            <div className="flex items-center justify-between mb-2">
              <MapPin className="w-8 h-8 opacity-80" />
              <div className="text-right">
                <div className="text-3xl font-bold">
                  {ROUTES.reduce((acc, r) => acc + r.stops.length, 0)}
                </div>
                <div className="text-sm opacity-90">Active Stops</div>
              </div>
            </div>
            <div className="text-xs opacity-75 mt-2">Across {ROUTES.length} routes</div>
          </div>

          <div
            className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-lg p-6 text-white"
          >
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-8 h-8 opacity-80" />
              <div className="text-right">
                <div className="text-3xl font-bold">8.5m</div>
                <div className="text-sm opacity-90">Avg Wait Time</div>
              </div>
            </div>
            <div className="text-xs opacity-75 mt-2">-2m improvement</div>
          </div>

          <div
            className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white"
          >
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-8 h-8 opacity-80" />
              <div className="text-right">
                <div className="text-3xl font-bold">89%</div>
                <div className="text-sm opacity-90">System Efficiency</div>
              </div>
            </div>
            <div className="text-xs opacity-75 mt-2">Optimal range</div>
          </div>
        </div>

        {/* Imbalance Alerts */}
        {imbalanceAlerts.length > 0 && (
          <div
            className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-8"
          >
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-amber-900 mb-1">Route Imbalance Detected</h3>
                <p className="text-sm text-amber-800">The following routes need fleet redistribution:</p>
              </div>
            </div>
            <div className="space-y-2">
              {imbalanceAlerts.map(alert => (
                <div key={alert.route} className="bg-white rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{alert.route}</div>
                    <div className="text-sm text-gray-600">
                      Current: {alert.current} jeeps • Optimal: {alert.optimal} jeeps
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    alert.status === 'understaffed' 
                      ? 'bg-red-100 text-red-700' 
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {alert.status === 'understaffed' ? `+${alert.imbalance} needed` : `-${alert.imbalance} excess`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Route Congestion */}
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-blue-900 mb-4">Route Congestion Levels</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={congestionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    background: '#fff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                  }}
                />
                <Bar dataKey="congestion" fill="#14b8a6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 text-xs text-gray-500">
              Congestion measured by average occupancy percentage
            </div>
          </div>

          {/* Fleet Distribution */}
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-blue-900 mb-4">Fleet Distribution</h3>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={routeDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {routeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Time-of-Day Demand */}
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 lg:col-span-2">
            <h3 className="text-lg font-semibold text-blue-900 mb-4">24-Hour Demand Pattern</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={hourlyDemand}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    background: '#fff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                  }}
                />
                <Area type="monotone" dataKey="demand" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
                <Area type="monotone" dataKey="capacity" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-4 flex items-center gap-6 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ background: '#8b5cf6' }}></div>
                <span>Actual Demand</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ background: '#10b981' }}></div>
                <span>System Capacity</span>
              </div>
            </div>
          </div>

          {/* Wait Time Comparison */}
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 lg:col-span-2">
            <h3 className="text-lg font-semibold text-blue-900 mb-4">Average Wait Times by Area</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={waitTimeData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="area" type="category" width={100} tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    background: '#fff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                  }}
                />
                <Bar dataKey="peak" fill="#ef4444" radius={[0, 4, 4, 0]} name="Peak Hours" />
                <Bar dataKey="offPeak" fill="#10b981" radius={[0, 4, 4, 0]} name="Off-Peak" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Policy Recommendations */}
        <div className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-xl shadow-xl p-8 text-white">
          <h2 className="text-2xl font-bold mb-6">Policy Recommendations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white/10 backdrop-blur rounded-lg p-5">
              <div className="text-teal-400 text-sm font-semibold mb-2">INFRASTRUCTURE</div>
              <h3 className="font-semibold mb-2 text-lg">Add Stops in High-Demand Areas</h3>
              <p className="text-sm text-blue-100 mb-3">
                Fairview and Cubao corridors show consistent overcrowding during peak hours
              </p>
              <div className="text-xs text-teal-400">Estimated 18% wait time reduction</div>
            </div>

            <div className="bg-white/10 backdrop-blur rounded-lg p-5">
              <div className="text-amber-400 text-sm font-semibold mb-2">OPERATIONS</div>
              <h3 className="font-semibold mb-2 text-lg">Implement Dynamic Dispatch</h3>
              <p className="text-sm text-blue-100 mb-3">
                Redistribute jeeps in real-time based on demand patterns
              </p>
              <div className="text-xs text-amber-400">Potential 25% efficiency gain</div>
            </div>

            <div className="bg-white/10 backdrop-blur rounded-lg p-5">
              <div className="text-purple-400 text-sm font-semibold mb-2">SUSTAINABILITY</div>
              <h3 className="font-semibold mb-2 text-lg">Route Optimization Program</h3>
              <p className="text-sm text-blue-100 mb-3">
                Reduce overlapping routes to minimize emissions and fuel costs
              </p>
              <div className="text-xs text-purple-400">12% carbon reduction projected</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
