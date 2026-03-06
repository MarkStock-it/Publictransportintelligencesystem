import { useState, useEffect, useRef } from 'react';
import { Jeep, INITIAL_JEEPS, ROUTES, interpolatePosition, initializeRoutesWithRoads, Route } from '../data/jeepney-data';
import { RouteMetricsTracker, calculateSystemMetrics, SystemMetrics } from '../data/simulation';
import { predictDemand, DemandForecast, getDemandTrend } from '../data/demandModel';
import { calculateTrafficStatus, findAlternativeJeeps, analyzeSupplyDemand, SupplyRebalanceRecommendation, JeepRecommendation } from '../data/trafficAnalysis';

export interface EnhancedSimulationState {
  jeeps: Jeep[];
  routes: Route[];
  routesInitialized: boolean;
  systemMetrics: SystemMetrics | null;
  demandForecasts: DemandForecast[];
  simulatedHour: number; // For demand patterns
  supplyRebalanceRecommendations: SupplyRebalanceRecommendation[];
}

export function useEnhancedJeepSimulation() {
  const [state, setState] = useState<EnhancedSimulationState>({
    jeeps: INITIAL_JEEPS,
    routes: ROUTES,
    routesInitialized: false,
    systemMetrics: null,
    demandForecasts: [],
    simulatedHour: 6, // Start at 6 AM
    supplyRebalanceRecommendations: [],
  });

  const metricsTrackerRef = useRef(new RouteMetricsTracker());
  const simulationTimeRef = useRef(0);

  // Initialize routes with actual road paths
  useEffect(() => {
    initializeRoutesWithRoads().then((roadRoutes) => {
      setState(prev => ({
        ...prev,
        routes: roadRoutes,
        routesInitialized: true,
        jeeps: prev.jeeps.map(jeep => {
          const route = roadRoutes.find(r => r.id === jeep.routeId);
          if (!route) return jeep;

          const pathIndex = Math.floor(jeep.progress * (route.path.length - 1));
          return {
            ...jeep,
            currentPosition: route.path[pathIndex],
          };
        }),
      }));
    });
  }, []);

  // Main simulation loop with enhanced features
  useEffect(() => {
    if (!state.routesInitialized) return;

    const interval = setInterval(() => {
      simulationTimeRef.current += 0.1; // Increment simulated time

      setState(prev => {
        const simulatedHour = (6 + (simulationTimeRef.current / 3600)) % 24; // Start at 6 AM, cycle every hour = 3600 ticks
        const newJeeps = prev.jeeps.map(jeep => {
          const route = prev.routes.find(r => r.id === jeep.routeId);
          if (!route) return jeep;

          // Realistic speed variation based on time of day (demand pattern)
          const demandFactor = 1 + (Math.sin((simulatedHour * Math.PI) / 12) * 0.3);
          const speedFactor = (jeep.speed / 15) * 0.0003 * (1 / demandFactor);
          let newProgress = jeep.progress + speedFactor + (Math.random() * 0.00005);

          if (newProgress >= 1) {
            newProgress = 0;
          }

          // Smooth interpolation between route points
          const pathIndex = Math.floor(newProgress * (route.path.length - 1));
          const segmentProgress = (newProgress * (route.path.length - 1)) % 1;
          const start = route.path[pathIndex];
          const end = route.path[Math.min(pathIndex + 1, route.path.length - 1)];
          const currentPosition = interpolatePosition(start, end, segmentProgress);

          // Update occupancy at stops
          let newOccupancy = jeep.occupancy;
          let newPassengerCount = jeep.passengerCount;

          const currentStop = Math.floor(newProgress * route.stops.length);
          const previousStop = Math.floor(jeep.progress * route.stops.length);

          if (currentStop !== previousStop) {
            const change = Math.floor(Math.random() * 8) - 3;
            newPassengerCount = Math.max(0, Math.min(jeep.capacity + 7, newPassengerCount + change));

            if (newPassengerCount <= jeep.capacity * 0.6) {
              newOccupancy = 'available';
            } else if (newPassengerCount <= jeep.capacity + 3) {
              newOccupancy = 'standing';
            } else {
              newOccupancy = 'full';
            }
          }

          // Track metrics for this jeep
          const occupancyPercent = (newPassengerCount / jeep.capacity) * 100;
          const waitTime = Math.max(1, 5 - Math.floor(jeep.speed / 5));
          metricsTrackerRef.current.trackJeepMetrics(jeep.routeId, jeep.speed, occupancyPercent, waitTime);

          return {
            ...jeep,
            progress: newProgress,
            currentPosition,
            lastUpdate: new Date(),
            occupancy: newOccupancy,
            passengerCount: newPassengerCount,
          };
        });

        // Calculate metrics every 10 ticks (1 second)
        const shouldUpdateMetrics = Math.floor(simulationTimeRef.current) % 10 === 0;

        let updatedMetrics = null;
        let demandForecasts: DemandForecast[] = [];
        let supplyRebalanceRecommendations: SupplyRebalanceRecommendation[] = [];

        if (shouldUpdateMetrics) {
          // Calculate route metrics
          prev.routes.forEach(route => {
            const jeepsOnRoute = newJeeps.filter(j => j.routeId === route.id).length;
            metricsTrackerRef.current.calculateRouteMetrics(route.id, jeepsOnRoute);
          });

          // Calculate system metrics
          updatedMetrics = calculateSystemMetrics(newJeeps, metricsTrackerRef.current, prev.routes);

          // Forecast demand for next 30 minutes
          demandForecasts = prev.routes.map(route => predictDemand(route.id, simulatedHour));

          // Analyze supply-demand balance
          const jeepsByRoute = new Map<string, Jeep[]>();
          const demandByRoute = new Map<string, number>();

          prev.routes.forEach(route => {
            const jeepsOn = newJeeps.filter(j => j.routeId === route.id);
            jeepsByRoute.set(route.id, jeepsOn);

            const forecast = demandForecasts.find(d => d.routeId === route.id);
            demandByRoute.set(route.id, forecast?.demandPercentage || 50);
          });

          const metricsMap = new Map<string, any>(
            prev.routes.map(route => [
              route.id,
              metricsTrackerRef.current.getMetrics(route.id) || {
                routeId: route.id,
                avgSpeed: 0,
                congestionLevel: 'LOW' as const,
                vehicleDensity: 0,
                avgWaitTime: 0,
                avgOccupancy: 0,
                efficiency: 0,
                timestamp: 0,
              },
            ])
          );

          supplyRebalanceRecommendations = analyzeSupplyDemand(
            prev.routes,
            jeepsByRoute,
            demandByRoute,
            metricsMap
          );
        }

        return {
          ...prev,
          jeeps: newJeeps,
          systemMetrics: updatedMetrics || prev.systemMetrics,
          demandForecasts: demandForecasts.length > 0 ? demandForecasts : prev.demandForecasts,
          simulatedHour,
          supplyRebalanceRecommendations:
            supplyRebalanceRecommendations.length > 0 ? supplyRebalanceRecommendations : prev.supplyRebalanceRecommendations,
        };
      });
    }, 100); // Update every 100ms for smooth animation

    return () => clearInterval(interval);
  }, [state.routesInitialized]);

  // Functions to access recommendations
  const getJeepRecommendations = (jeepId: string): JeepRecommendation[] => {
    const jeep = state.jeeps.find(j => j.id === jeepId);
    if (!jeep) return [];

    const route = state.routes.find(r => r.id === jeep.routeId);
    if (!route) return [];

    const metricsMap = new Map(
      state.routes.map(r => [r.id, { traffic: 'normal' }])
    );

    return findAlternativeJeeps(jeepId, state.jeeps, state.routes, metricsMap as any);
  };

  const getTrafficStatusForJeep = (jeepId: string) => {
    const jeep = state.jeeps.find(j => j.id === jeepId);
    if (!jeep) return null;

    const metrics = metricsTrackerRef.current.getMetrics(jeep.routeId);
    if (!metrics) return null;

    return calculateTrafficStatus(metrics);
  };

  return {
    ...state,
    getJeepRecommendations,
    getTrafficStatusForJeep,
  };
}
