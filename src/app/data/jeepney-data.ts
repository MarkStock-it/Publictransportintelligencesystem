// Core data structures and simulation logic for JeepWise

export type OccupancyLevel = 'available' | 'standing' | 'full';

// Function to fetch route from OSRM API (follows actual roads)
export async function fetchRouteFromOSRM(coordinates: Coordinates[]): Promise<Coordinates[]> {
  try {
    const coordString = coordinates.map(c => `${c.lng},${c.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.code === 'Ok' && data.routes && data.routes[0]?.geometry?.coordinates) {
      const geometry = data.routes[0].geometry.coordinates;
      if (Array.isArray(geometry) && geometry.length > 1) {
        return geometry.map((coord: number[]) => ({
          lng: coord[0],
          lat: coord[1]
        }));
      }
    }
    return coordinates; // Fallback to original if API fails
  } catch (error) {
    console.warn('OSRM routing failed, using direct path:', error);
    return coordinates; // Fallback to original if API fails
  }
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface JeepStop {
  id: string;
  name: string;
  coordinates: Coordinates;
}

export interface Route {
  id: string;
  name: string;
  color: string;
  path: Coordinates[];
  stops: JeepStop[];
  avgTripDuration: number; // minutes
  peakHours: number[]; // hours of day
}

export interface Jeep {
  id: string;
  routeId: string;
  currentPosition: Coordinates;
  occupancy: OccupancyLevel;
  speed: number; // km/h
  direction: number;
  lastUpdate: Date;
  progress: number; // 0-1, position along route
  passengerCount: number;
  capacity: number;
}

// Cebu City routes (realistic coordinates along main roads)
// These waypoints will be connected via OSRM to follow actual streets
export const ROUTE_WAYPOINTS: Route[] = [
  {
    id: 'route-1',
    name: '04L - Lahug - Carbon',
    color: '#14b8a6', // Teal
    path: [
      { lat: 10.3157, lng: 123.8854 }, // Lahug (Gorordo Ave start)
      { lat: 10.3175, lng: 123.8910 }, // Gorordo Avenue
      { lat: 10.3156, lng: 123.8945 }, // Fuente Osmena Circle
      { lat: 10.3098, lng: 123.8985 }, // Colon Street
      { lat: 10.2942, lng: 123.9012 }, // Carbon Market
    ],
    stops: [
      { id: 's1-1', name: 'Lahug Terminal', coordinates: { lat: 10.3157, lng: 123.8854 } },
      { id: 's1-2', name: 'Gorordo Avenue', coordinates: { lat: 10.3175, lng: 123.8910 } },
      { id: 's1-3', name: 'Fuente Osmena', coordinates: { lat: 10.3156, lng: 123.8945 } },
      { id: 's1-4', name: 'Colon Street', coordinates: { lat: 10.3098, lng: 123.8985 } },
      { id: 's1-5', name: 'Carbon Market', coordinates: { lat: 10.2942, lng: 123.9012 } },
    ],
    avgTripDuration: 35,
    peakHours: [7, 8, 17, 18, 19],
  },
  {
    id: 'route-2',
    name: '06B - Bulacao - Ayala',
    color: '#f59e0b', // Amber
    path: [
      { lat: 10.2756, lng: 123.8634 }, // Bulacao (N. Bacalso Ave)
      { lat: 10.2934, lng: 123.8789 }, // Plaza Independencia
      { lat: 10.3012, lng: 123.8856 }, // SM City Cebu
      { lat: 10.3167, lng: 123.8932 }, // Ayala Center
    ],
    stops: [
      { id: 's2-1', name: 'Bulacao Terminal', coordinates: { lat: 10.2756, lng: 123.8634 } },
      { id: 's2-2', name: 'Plaza Independencia', coordinates: { lat: 10.2934, lng: 123.8789 } },
      { id: 's2-3', name: 'SM City Cebu', coordinates: { lat: 10.3012, lng: 123.8856 } },
      { id: 's2-4', name: 'Ayala Center', coordinates: { lat: 10.3167, lng: 123.8932 } },
    ],
    avgTripDuration: 45,
    peakHours: [6, 7, 17, 18],
  },
  {
    id: 'route-3',
    name: '13C - Mabolo - Pier',
    color: '#8b5cf6', // Purple
    path: [
      { lat: 10.3289, lng: 123.9134 }, // Mabolo (A.S. Fortuna)
      { lat: 10.3234, lng: 123.9078 }, // Escario Street
      { lat: 10.3156, lng: 123.8945 }, // Fuente Circle
      { lat: 10.3045, lng: 123.8912 }, // Capitol
      { lat: 10.2934, lng: 123.8878 }, // Pier Area
    ],
    stops: [
      { id: 's3-1', name: 'Mabolo Church', coordinates: { lat: 10.3289, lng: 123.9134 } },
      { id: 's3-2', name: 'Escario Street', coordinates: { lat: 10.3234, lng: 123.9078 } },
      { id: 's3-3', name: 'Fuente Circle', coordinates: { lat: 10.3156, lng: 123.8945 } },
      { id: 's3-4', name: 'Capitol Building', coordinates: { lat: 10.3045, lng: 123.8912 } },
      { id: 's3-5', name: 'Pier 1', coordinates: { lat: 10.2934, lng: 123.8878 } },
    ],
    avgTripDuration: 25,
    peakHours: [7, 8, 9, 17, 18, 19],
  },
];

// This will be populated with actual road-following routes
export let ROUTES: Route[] = [...ROUTE_WAYPOINTS];

// Initialize routes with actual road paths from OSRM
export async function initializeRoutesWithRoads() {
  const routesWithRoads = await Promise.all(
    ROUTE_WAYPOINTS.map(async (route) => {
      const roadPath = await fetchRouteFromOSRM(route.path);
      return {
        ...route,
        path: roadPath.length > 1 ? roadPath : route.path,
      };
    })
  );
  ROUTES = routesWithRoads;
  return routesWithRoads;
}

// Initial jeep positions - 10 jeeps across Cebu routes
export const INITIAL_JEEPS: Jeep[] = [
  // Route 1 jeeps (04L - Lahug-Carbon) - 4 jeeps
  { id: 'j1-1', routeId: 'route-1', currentPosition: ROUTE_WAYPOINTS[0].path[0], occupancy: 'available', speed: 15, direction: 0, lastUpdate: new Date(), progress: 0, passengerCount: 8, capacity: 18 },
  { id: 'j1-2', routeId: 'route-1', currentPosition: ROUTE_WAYPOINTS[0].path[1], occupancy: 'standing', speed: 12, direction: 0, lastUpdate: new Date(), progress: 0.25, passengerCount: 22, capacity: 18 },
  { id: 'j1-3', routeId: 'route-1', currentPosition: ROUTE_WAYPOINTS[0].path[2], occupancy: 'available', speed: 18, direction: 0, lastUpdate: new Date(), progress: 0.6, passengerCount: 6, capacity: 18 },
  { id: 'j1-4', routeId: 'route-1', currentPosition: ROUTE_WAYPOINTS[0].path[3], occupancy: 'standing', speed: 14, direction: 0, lastUpdate: new Date(), progress: 0.85, passengerCount: 20, capacity: 18 },
  
  // Route 2 jeeps (06B - Bulacao-Ayala) - 3 jeeps
  { id: 'j2-1', routeId: 'route-2', currentPosition: ROUTE_WAYPOINTS[1].path[0], occupancy: 'standing', speed: 14, direction: 0, lastUpdate: new Date(), progress: 0, passengerCount: 20, capacity: 18 },
  { id: 'j2-2', routeId: 'route-2', currentPosition: ROUTE_WAYPOINTS[1].path[1], occupancy: 'full', speed: 10, direction: 0, lastUpdate: new Date(), progress: 0.4, passengerCount: 25, capacity: 18 },
  { id: 'j2-3', routeId: 'route-2', currentPosition: ROUTE_WAYPOINTS[1].path[2], occupancy: 'available', speed: 16, direction: 0, lastUpdate: new Date(), progress: 0.75, passengerCount: 11, capacity: 18 },
  
  // Route 3 jeeps (13C - Mabolo-Pier) - 3 jeeps
  { id: 'j3-1', routeId: 'route-3', currentPosition: ROUTE_WAYPOINTS[2].path[0], occupancy: 'available', speed: 20, direction: 0, lastUpdate: new Date(), progress: 0, passengerCount: 10, capacity: 18 },
  { id: 'j3-2', routeId: 'route-3', currentPosition: ROUTE_WAYPOINTS[2].path[2], occupancy: 'standing', speed: 16, direction: 0, lastUpdate: new Date(), progress: 0.45, passengerCount: 19, capacity: 18 },
  { id: 'j3-3', routeId: 'route-3', currentPosition: ROUTE_WAYPOINTS[2].path[3], occupancy: 'available', speed: 18, direction: 0, lastUpdate: new Date(), progress: 0.8, passengerCount: 7, capacity: 18 },
];

// Utility functions
export function getOccupancyColor(occupancy: OccupancyLevel): string {
  switch (occupancy) {
    case 'available': return '#10b981'; // Green
    case 'standing': return '#f59e0b'; // Yellow
    case 'full': return '#ef4444'; // Red
  }
}

export function getOccupancyLabel(occupancy: OccupancyLevel): string {
  switch (occupancy) {
    case 'available': return 'Seats Available';
    case 'standing': return 'Standing Room';
    case 'full': return 'Full';
  }
}

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

export function interpolatePosition(start: Coordinates, end: Coordinates, progress: number): Coordinates {
  return {
    lat: start.lat + (end.lat - start.lat) * progress,
    lng: start.lng + (end.lng - start.lng) * progress,
  };
}

export function getRouteById(routeId: string): Route | undefined {
  return ROUTES.find(r => r.id === routeId);
}

// Historical data simulation
export function getHistoricalWaitTime(stopId: string, hour: number): number {
  // Simulate wait times based on peak hours
  const isPeak = hour >= 6 && hour <= 9 || hour >= 17 && hour <= 19;
  return isPeak ? Math.random() * 8 + 5 : Math.random() * 15 + 8;
}

// ETA calculation
export function calculateETA(jeep: Jeep, targetStop: JeepStop): number {
  const route = getRouteById(jeep.routeId);
  if (!route) return 0;
  if (route.stops.length < 2) return 0;
  
  const stopIndex = route.stops.findIndex(s => s.id === targetStop.id);
  if (stopIndex === -1) return 0;
  
  const targetProgress = stopIndex / Math.max(1, route.stops.length - 1);
  const remainingProgress = targetProgress - jeep.progress;
  
  if (remainingProgress <= 0) return 0;
  
  const totalPathLength = Math.max(1, route.path.length);
  const avgSpeed = jeep.speed > 0 ? jeep.speed : 15;
  const estimatedMinutes = (remainingProgress * totalPathLength * 0.5 / avgSpeed) * 60;
  
  return Math.max(1, Math.round(estimatedMinutes));
}
