// Demand modeling and forecasting
// Implements realistic 24-hour patterns and prediction

export interface DemandForecast {
  routeId: string;
  demand: 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  demandPercentage: number; // 0-100
  predictedPassengers: number;
  timeframe: string; // "next 30 minutes"
  confidence: number; // 0-100
}

export interface HourlyDemandPattern {
  hour: number;
  multiplier: number; // 0.3 to 1.5
}

// Realistic 24-hour demand pattern for Cebu City
export const DEMAND_PATTERN: HourlyDemandPattern[] = [
  { hour: 0, multiplier: 0.2 }, // Midnight
  { hour: 1, multiplier: 0.15 },
  { hour: 2, multiplier: 0.1 },
  { hour: 3, multiplier: 0.08 },
  { hour: 4, multiplier: 0.1 },
  { hour: 5, multiplier: 0.3 }, // Early morning
  { hour: 6, multiplier: 0.7 }, // Morning starts
  { hour: 7, multiplier: 1.2 }, // Morning rush (high)
  { hour: 8, multiplier: 1.3 }, // Morning rush peak
  { hour: 9, multiplier: 1.0 },
  { hour: 10, multiplier: 0.7 }, // Mid-morning
  { hour: 11, multiplier: 0.8 },
  { hour: 12, multiplier: 0.6 }, // Lunch dip
  { hour: 13, multiplier: 0.5 },
  { hour: 14, multiplier: 0.6 },
  { hour: 15, multiplier: 0.7 }, // Afternoon
  { hour: 16, multiplier: 0.9 },
  { hour: 17, multiplier: 1.4 }, // Evening rush starts
  { hour: 18, multiplier: 1.5 }, // Evening rush peak
  { hour: 19, multiplier: 1.1 },
  { hour: 20, multiplier: 0.8 }, // Evening easing
  { hour: 21, multiplier: 0.6 },
  { hour: 22, multiplier: 0.4 },
  { hour: 23, multiplier: 0.3 }, // Late night
];

// Route-specific demand profiles (relative popularity)
export const ROUTE_DEMAND_PROFILES: Record<string, number> = {
  'route-1': 0.9, // Lahug-Carbon: medium popularity
  'route-2': 1.1, // Bulacao-Ayala: high popularity (business district)
  'route-3': 0.8, // Mabolo-Pier: medium-low
};

// Get current demand multiplier based on simulated time
export function getDemandMultiplier(simulatedHour: number): number {
  const hour = Math.floor(simulatedHour) % 24;
  return DEMAND_PATTERN[hour]?.multiplier || 0.5;
}

// Interpolate between hourly demand values for smooth transitions
export function getSmoothedDemandMultiplier(simulatedTime: number): number {
  const hour = Math.floor(simulatedTime) % 24;
  const nextHour = (hour + 1) % 24;
  const progress = simulatedTime - Math.floor(simulatedTime);

  const currentMultiplier = DEMAND_PATTERN[hour]?.multiplier || 0.5;
  const nextMultiplier = DEMAND_PATTERN[nextHour]?.multiplier || 0.5;

  // Smooth interpolation
  return currentMultiplier + (nextMultiplier - currentMultiplier) * progress;
}

// Predict demand for a route
export function predictDemand(
  routeId: string,
  simulatedHour: number,
  currentPassengerCount: number = 0,
  jeepCapacity: number = 18
): DemandForecast {
  const baseMultiplier = getSmoothedDemandMultiplier(simulatedHour);
  const routeProfile = ROUTE_DEMAND_PROFILES[routeId] || 1.0;

  // Calculate demand percentage (0-100)
  const demandPercentage = Math.min(100, baseMultiplier * routeProfile * 100);

  // Determine demand level
  let demand: 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  if (demandPercentage < 20) demand = 'VERY_LOW';
  else if (demandPercentage < 40) demand = 'LOW';
  else if (demandPercentage < 60) demand = 'MEDIUM';
  else if (demandPercentage < 80) demand = 'HIGH';
  else demand = 'VERY_HIGH';

  // Predict passengers for next 30 minutes
  const basePredicted = (demandPercentage / 100) * jeepCapacity * 0.5; // 30 min = half of capacity
  const predictedPassengers = Math.round(Math.max(0, basePredicted - currentPassengerCount / 2));

  return {
    routeId,
    demand,
    demandPercentage: Math.round(demandPercentage),
    predictedPassengers,
    timeframe: 'next 30 minutes',
    confidence: 70 + Math.random() * 20, // 70-90% confidence
  };
}

// Forecast demand for multiple routes
export function forecastRoutesDemand(
  routeIds: string[],
  simulatedHour: number,
  jeepsByRoute: Record<string, number>
): DemandForecast[] {
  return routeIds.map(routeId =>
    predictDemand(routeId, simulatedHour, 0, 18)
  );
}

// Get trend (increasing/decreasing/stable)
export function getDemandTrend(simulatedHour: number): 'INCREASING' | 'DECREASING' | 'STABLE' {
  const current = getDemandMultiplier(simulatedHour);
  const next = getDemandMultiplier(simulatedHour + 1);

  if (next > current * 1.1) return 'INCREASING';
  if (next < current * 0.9) return 'DECREASING';
  return 'STABLE';
}

// Get demand description
export function getDemandDescription(demand: string): string {
  switch (demand) {
    case 'VERY_LOW':
      return 'Minimal passenger flow';
    case 'LOW':
      return 'Light traffic expected';
    case 'MEDIUM':
      return 'Moderate passenger demand';
    case 'HIGH':
      return 'High passenger demand';
    case 'VERY_HIGH':
      return 'Peak demand - all jeeps busy';
    default:
      return 'Unknown demand level';
  }
}
