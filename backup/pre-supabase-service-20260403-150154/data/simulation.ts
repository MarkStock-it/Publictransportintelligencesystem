// Enhanced simulation engine with metrics tracking
import { Jeep, Route, Coordinates } from './jeepney-data';

export interface SimulationMetrics {
  routeId: string;
  avgSpeed: number;
  congestionLevel: 'LOW' | 'MODERATE' | 'HEAVY' | 'SEVERE';
  vehicleDensity: number; // jeeps per route
  avgWaitTime: number; // minutes
  avgOccupancy: number; // percentage
  efficiency: number; // percentage (0-100)
  timestamp: number;
}

export interface SystemMetrics {
  cityEfficiency: number; // 0-100
  avgPassengerWaitTime: number; // minutes
  avgJeepSpeed: number; // km/h
  overallCongestion: 'LOW' | 'MODERATE' | 'HEAVY' | 'SEVERE';
  activeJeeps: number;
  timestamp: number;
}

// Rolling average calculator for smooth metrics
export class RollingAverage {
  private values: number[] = [];
  private maxSize: number;

  constructor(windowSize: number = 30) {
    this.maxSize = windowSize;
  }

  add(value: number): void {
    this.values.push(value);
    if (this.values.length > this.maxSize) {
      this.values.shift();
    }
  }

  getAverage(): number {
    if (this.values.length === 0) return 0;
    return this.values.reduce((a, b) => a + b, 0) / this.values.length;
  }

  reset(): void {
    this.values = [];
  }
}

// Metrics tracker for each route
export class RouteMetricsTracker {
  private speedAverages = new Map<string, RollingAverage>();
  private occupancyAverages = new Map<string, RollingAverage>();
  private waitTimeAverages = new Map<string, RollingAverage>();
  private lastMetrics = new Map<string, SimulationMetrics>();

  trackJeepMetrics(routeId: string, speed: number, occupancy: number, waitTime: number): void {
    if (!this.speedAverages.has(routeId)) {
      this.speedAverages.set(routeId, new RollingAverage(30));
      this.occupancyAverages.set(routeId, new RollingAverage(30));
      this.waitTimeAverages.set(routeId, new RollingAverage(30));
    }

    this.speedAverages.get(routeId)!.add(speed);
    this.occupancyAverages.get(routeId)!.add(occupancy);
    this.waitTimeAverages.get(routeId)!.add(waitTime);
  }

  calculateRouteMetrics(routeId: string, jeepsOnRoute: number): SimulationMetrics {
    const avgSpeed = this.speedAverages.get(routeId)?.getAverage() || 0;
    const avgOccupancy = this.occupancyAverages.get(routeId)?.getAverage() || 0;
    const avgWaitTime = this.waitTimeAverages.get(routeId)?.getAverage() || 0;

    // Determine congestion level based on speed and occupancy
    let congestionLevel: 'LOW' | 'MODERATE' | 'HEAVY' | 'SEVERE' = 'LOW';
    if (avgSpeed < 10 || avgOccupancy > 85) congestionLevel = 'SEVERE';
    else if (avgSpeed < 15 || avgOccupancy > 75) congestionLevel = 'HEAVY';
    else if (avgSpeed < 20 || avgOccupancy > 60) congestionLevel = 'MODERATE';

    // Calculate efficiency: prioritize speed, then occupancy
    const speedEfficiency = Math.min(100, (avgSpeed / 25) * 100);
    const occupancyEfficiency = avgOccupancy; // Higher occupancy is good (better utilization)
    const efficiency = (speedEfficiency * 0.6 + occupancyEfficiency * 0.4);

    const metrics: SimulationMetrics = {
      routeId,
      avgSpeed,
      congestionLevel,
      vehicleDensity: jeepsOnRoute,
      avgWaitTime,
      avgOccupancy,
      efficiency: Math.round(efficiency),
      timestamp: Date.now(),
    };

    this.lastMetrics.set(routeId, metrics);
    return metrics;
  }

  getMetrics(routeId: string): SimulationMetrics | undefined {
    return this.lastMetrics.get(routeId);
  }

  getAllMetrics(): SimulationMetrics[] {
    return Array.from(this.lastMetrics.values());
  }
}

// Calculate distance between two coordinates (haversine formula)
export function calculateDistance(p1: Coordinates, p2: Coordinates): number {
  const R = 6371; // Earth's radius in km
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Smooth interpolation for steady movement
export function smoothInterpolate(start: Coordinates, end: Coordinates, progress: number): Coordinates {
  // Use easing function for smooth motion
  const easeProgress = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
  
  return {
    lat: start.lat + (end.lat - start.lat) * easeProgress,
    lng: start.lng + (end.lng - start.lng) * easeProgress,
  };
}

// System-level analytics
export function calculateSystemMetrics(
  jeeps: Jeep[],
  routeMetricsTracker: RouteMetricsTracker,
  routes: Route[]
): SystemMetrics {
  const allMetrics = routeMetricsTracker.getAllMetrics();

  const avgSpeed = allMetrics.length > 0
    ? allMetrics.reduce((sum, m) => sum + m.avgSpeed, 0) / allMetrics.length
    : 0;

  const avgWaitTime = allMetrics.length > 0
    ? allMetrics.reduce((sum, m) => sum + m.avgWaitTime, 0) / allMetrics.length
    : 0;

  const avgOccupancy = jeeps.length > 0
    ? jeeps.reduce((sum, j) => sum + (j.passengerCount / j.capacity) * 100, 0) / jeeps.length
    : 0;

  // Determine overall congestion
  const heavyCongestionCount = allMetrics.filter(m =>
    m.congestionLevel === 'HEAVY' || m.congestionLevel === 'SEVERE'
  ).length;
  const congestionRatio = allMetrics.length > 0 ? heavyCongestionCount / allMetrics.length : 0;

  let overallCongestion: 'LOW' | 'MODERATE' | 'HEAVY' | 'SEVERE' = 'LOW';
  if (congestionRatio > 0.7) overallCongestion = 'SEVERE';
  else if (congestionRatio > 0.5) overallCongestion = 'HEAVY';
  else if (congestionRatio > 0.3) overallCongestion = 'MODERATE';

  // Calculate system efficiency
  const efficiency = allMetrics.length > 0
    ? allMetrics.reduce((sum, m) => sum + m.efficiency, 0) / allMetrics.length
    : 0;

  return {
    cityEfficiency: Math.round(efficiency),
    avgPassengerWaitTime: Math.round(avgWaitTime * 10) / 10,
    avgJeepSpeed: Math.round(avgSpeed * 10) / 10,
    overallCongestion,
    activeJeeps: jeeps.length,
    timestamp: Date.now(),
  };
}
