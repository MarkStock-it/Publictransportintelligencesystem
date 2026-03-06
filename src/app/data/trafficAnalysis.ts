// Traffic analysis and intelligent recommendations
import { Jeep, Route } from './jeepney-data';
import { SimulationMetrics } from './simulation';

export interface TrafficStatus {
  status: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
  level: 'LOW' | 'MODERATE' | 'HEAVY' | 'SEVERE';
  avgSpeed: number;
  occupancy: number;
  recommendation: string;
}

export interface JeepRecommendation {
  jeepId: string;
  routeName: string;
  reason: string;
  estimatedWaitTime: number; // minutes
  efficiency: number; // 0-100
  isBetter: boolean;
}

export interface SupplyRebalanceRecommendation {
  fromRouteId: string;
  toRouteId: string;
  jeepsToMove: number;
  reason: string;
  expectedImpactOnEfficiency: number; // +/- percentage
}

// Calculate traffic status for a route
export function calculateTrafficStatus(metrics: SimulationMetrics): TrafficStatus {
  const { avgSpeed, congestionLevel, avgOccupancy } = metrics;

  let status: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
  let recommendation: string;

  if (congestionLevel === 'SEVERE') {
    status = 'RED';
    recommendation = 'AVOID THIS ROUTE - Severe congestion detected';
  } else if (congestionLevel === 'HEAVY') {
    status = 'ORANGE';
    recommendation = 'Heavy traffic - Consider alternatives';
  } else if (congestionLevel === 'MODERATE') {
    status = 'YELLOW';
    recommendation = 'Moderate traffic - Plan ahead';
  } else {
    status = 'GREEN';
    recommendation = 'Free-flowing traffic';
  }

  return {
    status,
    level: congestionLevel,
    avgSpeed: Math.round(avgSpeed * 10) / 10,
    occupancy: Math.round(avgOccupancy),
    recommendation,
  };
}

// Find alternative jeeps with similar destinations
export function findAlternativeJeeps(
  selectedJeepId: string,
  jeeps: Jeep[],
  routes: Route[],
  routeMetrics: Map<string, SimulationMetrics>
): JeepRecommendation[] {
  const selectedJeep = jeeps.find(j => j.id === selectedJeepId);
  if (!selectedJeep) return [];

  const selectedRoute = routes.find(r => r.id === selectedJeep.routeId);
  if (!selectedRoute) return [];

  // Get selected route metrics
  const selectedMetrics = routeMetrics.get(selectedJeep.routeId);
  if (!selectedMetrics) return [];

  // Find alternative routes with lower congestion going to similar destination areas
  const alternatives = jeeps
    .filter(j => j.id !== selectedJeepId)
    .map(jeep => {
      const route = routes.find(r => r.id === jeep.routeId);
      const metrics = routeMetrics.get(jeep.routeId);

      if (!route || !metrics) return null;

      // Avoid suggesting same route
      if (jeep.routeId === selectedJeep.routeId) return null;

      // Calculate how much better this alternative is
      const speedDifference = metrics.avgSpeed - selectedMetrics.avgSpeed;
      const occupancyDifference = selectedMetrics.avgOccupancy - metrics.avgOccupancy;
      const efficiencyDifference = metrics.efficiency - selectedMetrics.efficiency;

      // Only suggest if significantly better
      if (efficiencyDifference < 10) return null;

      const estimatedWaitTime = Math.max(1, 5 - Math.floor(metrics.avgSpeed / 5));
      const isBetter = metrics.efficiency > selectedMetrics.efficiency;

      return {
        jeepId: jeep.id,
        routeName: route.name,
        reason: `${isBetter ? 'Faster route' : 'Less congested'} - ${Math.round(efficiencyDifference)}% more efficient`,
        estimatedWaitTime,
        efficiency: metrics.efficiency,
        isBetter,
      } as JeepRecommendation;
    })
    .filter((r): r is JeepRecommendation => r !== null)
    .sort((a, b) => b.efficiency - a.efficiency)
    .slice(0, 2); // Return top 2 alternatives

  return alternatives;
}

// Analyze supply-demand imbalance and suggest redistribution
export function analyzeSupplyDemand(
  routes: Route[],
  jeepsByRoute: Map<string, Jeep[]>,
  demandByRoute: Map<string, number>,
  metricsMap: Map<string, SimulationMetrics>
): SupplyRebalanceRecommendation[] {
  const recommendations: SupplyRebalanceRecommendation[] = [];

  const routeStats = routes.map(route => {
    const jeeps = jeepsByRoute.get(route.id) || [];
    const demand = demandByRoute.get(route.id) || 50;
    const metrics = metricsMap.get(route.id);
    const efficiency = metrics?.efficiency || 50;

    return {
      routeId: route.id,
      name: route.name,
      jeepCount: jeeps.length,
      demand,
      efficiency,
      supplyDemandRatio: jeeps.length > 0 ? demand / jeeps.length : 0,
    };
  });

  // Find overcrowded routes
  routeStats.forEach(route => {
    if (route.efficiency < 40 && route.demand > 75) {
      // This route needs more jeeps
      // Find routes with excess capacity
      const underutilized = routeStats.find(
        other =>
          other.routeId !== route.routeId &&
          other.efficiency < 50 &&
          other.demand < 40 &&
          other.jeepCount > 1
      );

      if (underutilized) {
        recommendations.push({
          fromRouteId: underutilized.routeId,
          toRouteId: route.routeId,
          jeepsToMove: 1,
          reason: `Move jeep from ${underutilized.name} (${underutilized.efficiency}% efficiency) to ${route.name} (${route.efficiency}% efficiency)`,
          expectedImpactOnEfficiency: 15 + Math.random() * 10,
        });
      }
    }
  });

  return recommendations;
}

// Calculate optimal routing suggestion
export function getRoutingAdvice(
  jeep: Jeep,
  route: Route,
  routeMetrics: SimulationMetrics,
  currentPosition: any
): string {
  const trafficStatus = calculateTrafficStatus(routeMetrics);

  if (trafficStatus.status === 'RED') {
    return `⚠️  SEVERE CONGESTION on ${route.name}. Consider alternative routes or delay trip.`;
  } else if (trafficStatus.status === 'ORANGE') {
    return `⚠️  Heavy traffic ahead on ${route.name}. Average speed: ${trafficStatus.avgSpeed} km/h`;
  } else if (trafficStatus.status === 'YELLOW') {
    return `📊 Moderate traffic on ${route.name}. Occupancy: ${trafficStatus.occupancy}%`;
  } else {
    return `✅ Good conditions on ${route.name}. All clear!`;
  }
}

// Traffic color coding
export function getTrafficColor(status: string): string {
  switch (status) {
    case 'GREEN':
      return '#10b981'; // Green
    case 'YELLOW':
      return '#fbbf24'; // Yellow
    case 'ORANGE':
      return '#f97316'; // Orange
    case 'RED':
      return '#ef4444'; // Red
    default:
      return '#6b7280'; // Gray
  }
}

// Congestion forecast
export function forecastCongestion(
  currentSpeed: number,
  occupancy: number
): 'WORSENING' | 'STABLE' | 'IMPROVING' {
  // Simulate congestion trend based on current conditions
  if (occupancy > 85 && currentSpeed < 15) return 'WORSENING';
  if (occupancy < 50 && currentSpeed > 20) return 'IMPROVING';
  return 'STABLE';
}
