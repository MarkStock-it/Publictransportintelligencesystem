import { useState, useEffect } from 'react';
import { Jeep, INITIAL_JEEPS, ROUTES, getRouteById, interpolatePosition, OccupancyLevel } from '../data/jeepney-data';

export function useJeepSimulation() {
  const [jeeps, setJeeps] = useState<Jeep[]>(INITIAL_JEEPS);

  useEffect(() => {
    const interval = setInterval(() => {
      setJeeps(prevJeeps => 
        prevJeeps.map(jeep => {
          const route = getRouteById(jeep.routeId);
          if (!route) return jeep;

          // Update progress (with speed variation)
          const speedFactor = (jeep.speed / 15) * 0.002;
          let newProgress = jeep.progress + speedFactor + (Math.random() * 0.0005);
          
          // Loop back to start when reaching end
          if (newProgress >= 1) {
            newProgress = 0;
          }

          // Calculate position along path
          const pathIndex = Math.floor(newProgress * (route.path.length - 1));
          const segmentProgress = (newProgress * (route.path.length - 1)) % 1;
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
  }, []);

  return { jeeps, routes: ROUTES };
}
