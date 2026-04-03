import React from 'react';
import { SystemMetrics, RouteMetricsTracker } from '../data/simulation';
import { DemandForecast, getDemandDescription } from '../data/demandModel';
import { SupplyRebalanceRecommendation, getTrafficColor } from '../data/trafficAnalysis';
import { TrendingUp, AlertTriangle, Zap, Users, Gauge, TrendingDown, TrendingUp as TrendingUpIcon } from 'lucide-react';

interface TransportAnalyticsProps {
  systemMetrics: SystemMetrics | null;
  demandForecasts: DemandForecast[];
  supplyRecommendations: SupplyRebalanceRecommendation[];
  simulatedHour: number;
}

export function TransportAnalytics({
  systemMetrics,
  demandForecasts,
  supplyRecommendations,
  simulatedHour,
}: TransportAnalyticsProps) {
  if (!systemMetrics) {
    return (
      <div className="p-4 bg-gray-100 rounded-lg text-center text-gray-500">
        Loading analytics...
      </div>
    );
  }

  const getCongestionColor = (congestion: string) => {
    switch (congestion) {
      case 'LOW':
        return 'text-green-600 bg-green-50';
      case 'MODERATE':
        return 'text-yellow-600 bg-yellow-50';
      case 'HEAVY':
        return 'text-orange-600 bg-orange-50';
      case 'SEVERE':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const timeString = `${Math.floor(simulatedHour)}:${String(Math.floor((simulatedHour % 1) * 60)).padStart(2, '0')}`;

  return (
    <div className="space-y-4">
      {/* System Efficiency Score Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">City Transport Efficiency</h3>
          <Gauge className="w-6 h-6" />
        </div>
        <div className="text-4xl font-bold mb-2">{systemMetrics.cityEfficiency}%</div>
        <p className="text-blue-100 text-sm">System Health Score</p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Average Wait Time */}
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-600">AVG WAIT TIME</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{systemMetrics.avgPassengerWaitTime}</div>
          <p className="text-xs text-gray-500">minutes</p>
        </div>

        {/* Average Jeep Speed */}
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-600">AVG JEEP SPEED</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{systemMetrics.avgJeepSpeed}</div>
          <p className="text-xs text-gray-500">km/h</p>
        </div>

        {/* Active Jeeps */}
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-600">ACTIVE JEEPS</span>
            <Users className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{systemMetrics.activeJeeps}</div>
          <p className="text-xs text-gray-500">vehicles</p>
        </div>

        {/* Congestion Level */}
        <div className={`rounded-lg p-4 border border-gray-200 ${getCongestionColor(systemMetrics.overallCongestion)}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold">CONGESTION LEVEL</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold">{systemMetrics.overallCongestion}</div>
          <p className="text-xs opacity-75">citywide</p>
        </div>
      </div>

      {/* Simulated Time */}
      <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-center">
        <p className="text-xs text-gray-600">Simulated Time</p>
        <p className="text-lg font-semibold text-gray-900">{timeString}</p>
      </div>

      {/* Demand Forecasts */}
      {demandForecasts.length > 0 && (
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <TrendingUpIcon className="w-4 h-4" />
            Demand Forecast (Next 30 Min)
          </h4>
          <div className="space-y-2">
            {demandForecasts.slice(0, 3).map(forecast => (
              <div key={forecast.routeId} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{forecast.demand}</p>
                  <p className="text-xs text-gray-500">{getDemandDescription(forecast.demand)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{forecast.demandPercentage}%</p>
                  <p className="text-xs text-gray-500">{forecast.predictedPassengers} pax</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Supply Rebalance Recommendations */}
      {supplyRecommendations.length > 0 && (
        <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
          <h4 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Supply Rebalancing
          </h4>
          <div className="space-y-3">
            {supplyRecommendations.map((rec, idx) => (
              <div key={idx} className="bg-white rounded p-3 text-sm">
                <p className="text-amber-900 font-medium mb-1">{rec.reason}</p>
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>Move {rec.jeepsToMove} jeep(s)</span>
                  <span className="text-green-600 font-semibold">
                    +{Math.round(rec.expectedImpactOnEfficiency)}% efficiency
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Icon component for Clock
function Clock({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
