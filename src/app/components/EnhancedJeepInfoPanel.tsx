import React from 'react';
import { Jeep, Route } from '../data/jeepney-data';
import { TrafficStatus, JeepRecommendation, getTrafficColor } from '../data/trafficAnalysis';
import { Bus, AlertCircle, TrendingDown, Navigation } from 'lucide-react';

interface EnhancedJeepInfoPanelProps {
  jeep: Jeep;
  routeName: string;
  routeColor: string;
  trafficStatus: TrafficStatus | null;
  recommendations: JeepRecommendation[];
  onClose: () => void;
  onSelectAlternative?: (jeepId: string) => void;
}

export function EnhancedJeepInfoPanel({
  jeep,
  routeName,
  routeColor,
  trafficStatus,
  recommendations,
  onClose,
  onSelectAlternative,
}: EnhancedJeepInfoPanelProps) {
  return (
    <div
      className="absolute top-20 right-4 w-96 bg-white rounded-xl shadow-2xl p-5 z-[1000] max-h-96 overflow-y-auto"
      style={{ opacity: 1, transform: 'scale(1)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4 pb-4 border-b">
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

      {/* Basic Info */}
      <div className="space-y-3 mb-4 pb-4 border-b">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Passengers:</span>
          <span className="font-semibold text-gray-900">
            {jeep.passengerCount}/{jeep.capacity}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Speed:</span>
          <span className="font-semibold text-gray-900">{jeep.speed} km/h</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Status:</span>
          <span
            className={`px-2 py-1 rounded text-xs font-semibold ${
              jeep.occupancy === 'available'
                ? 'bg-green-100 text-green-700'
                : jeep.occupancy === 'standing'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {jeep.occupancy.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Traffic Status */}
      {trafficStatus && (
        <div
          className="rounded-lg p-4 mb-4"
          style={{ backgroundColor: getTrafficColor(trafficStatus.status) + '20', borderLeft: `4px solid ${getTrafficColor(trafficStatus.status)}` }}
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5" style={{ color: getTrafficColor(trafficStatus.status) }} />
            <div className="flex-1">
              <h4 className="font-semibold text-sm mb-1" style={{ color: getTrafficColor(trafficStatus.status) }}>
                Traffic: {trafficStatus.level}
              </h4>
              <p className="text-xs text-gray-700 mb-2">{trafficStatus.recommendation}</p>
              <div className="text-xs space-y-1">
                <p>
                  <span className="text-gray-600">Avg Speed:</span> <span className="font-semibold">{trafficStatus.avgSpeed} km/h</span>
                </p>
                <p>
                  <span className="text-gray-600">Occupancy:</span> <span className="font-semibold">{trafficStatus.occupancy}%</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alternative Routes Recommendation */}
      {recommendations.length > 0 && (
        <div className="bg-blue-50 rounded-lg p-4 mb-4">
          <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <TrendingDown className="w-4 h-4" />
            Better Alternatives Available
          </h4>
          <div className="space-y-2">
            {recommendations.map((rec, idx) => (
              <div key={idx} className="bg-white rounded p-3 text-sm border border-blue-200">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-gray-900">{rec.routeName}</p>
                    <p className="text-xs text-gray-500 mt-1">{rec.reason}</p>
                  </div>
                  <span className="text-green-600 font-semibold text-xs">+{Math.round(rec.efficiency - 50)}%</span>
                </div>
                {onSelectAlternative && (
                  <button
                    onClick={() => onSelectAlternative(rec.jeepId)}
                    className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors"
                  >
                    Switch to this jeep
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Message */}
      {recommendations.length === 0 && trafficStatus?.status === 'GREEN' && (
        <div className="bg-green-50 rounded-lg p-3 text-sm text-green-700 flex items-start gap-2">
          <span>✓</span>
          <span>This is the best available route right now!</span>
        </div>
      )}
    </div>
  );
}
