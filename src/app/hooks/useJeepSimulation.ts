import { useState, useEffect } from 'react';
import { Jeep, INITIAL_JEEPS, ROUTES, getRouteById, interpolatePosition, OccupancyLevel, initializeRoutesWithRoads, Route } from '../data/jeepney-data';

export function useJeepSimulation() {
  const [jeeps, setJeeps] = useState<Jeep[]>(INITIAL_JEEPS);
  const [routes, setRoutes] = useState<Route[]>(ROUTES);
  const [routesInitialized, setRoutesInitialized] = useState(false);

  // Initialize routes with actual road paths on mount
  useEffect(() => {
    initializeRoutesWithRoads().then((roadRoutes) => {
      setRoutes(roadRoutes);
      setRoutesInitialized(true);
      
      // Update initial jeep positions to match the new route paths
      setJeeps(prevJeeps => 
        prevJeeps.map(jeep => {
          const route = roadRoutes.find(r => r.id === jeep.routeId);
          if (!route || route.path.length === 0) return jeep;
          
          const pathIndex = Math.min(
            route.path.length - 1,
            Math.max(0, Math.floor(jeep.progress * Math.max(1, route.path.length - 1)))
          );
          return {
            ...jeep,
            currentPosition: route.path[pathIndex],
          };
        })
      );
    });
  }, []);

  useEffect(() => {
    if (!routesInitialized) return;
    
    const interval = setInterval(() => {
      setJeeps(prevJeeps => 
        prevJeeps.map(jeep => {
          const route = routes.find(r => r.id === jeep.routeId);
          if (!route || route.path.length === 0) return jeep;

          // Update progress (with speed variation) - SLOWED DOWN
          const speedFactor = (jeep.speed / 15) * 0.0003;
          let newProgress = jeep.progress + speedFactor + (Math.random() * 0.00005);
          
          // Loop back to start when reaching end
          if (newProgress >= 1) {
            newProgress = 0;
          }

          // Calculate position along path
          const maxPathIndex = Math.max(1, route.path.length - 1);
          const pathIndex = Math.min(route.path.length - 1, Math.floor(newProgress * maxPathIndex));
          const segmentProgress = (newProgress * maxPathIndex) % 1;
          const start = route.path[pathIndex];
          const end = route.path[Math.min(pathIndex + 1, route.path.length - 1)];
          const currentPosition = interpolatePosition(start, end, segmentProgress);

          // Simulate occupancy changes at stops
          let newOccupancy = jeep.occupancy;
          let newPassengerCount = jeep.passengerCount;
          
          // Check if near a stop
          const currentStop = Math.floor(newProgress * route.stops.length);
          const previousStop = Math.floor(jeep.progress * route.stops.length);
          
          if (currentStop !== previousStop) {
            // At a stop, simulate passenger changes
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

          return {
            ...jeep,
            progress: newProgress,
            currentPosition,
            lastUpdate: new Date(),
            occupancy: newOccupancy,
            passengerCount: newPassengerCount,
          };
        })
      );
    }, 100); // Update every 100ms for smooth animation

    return () => clearInterval(interval);
  }, [routesInitialized, routes]);

  return { jeeps, routes };
}
