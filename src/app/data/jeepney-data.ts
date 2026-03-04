// Core data structures and simulation logic for JeepWise

export type OccupancyLevel = 'available' | 'standing' | 'full';

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

// Manila area routes (realistic coordinates)
export const ROUTES: Route[] = [
  {
    id: 'route-1',
    name: 'Divisoria - Quiapo - Espana',
    color: '#14b8a6', // Teal
    path: [
      { lat: 14.6042, lng: 120.9822 }, // Divisoria
      { lat: 14.5995, lng: 120.9840 }, // Recto
      { lat: 14.5986, lng: 120.9864 }, // Quiapo
      { lat: 14.6000, lng: 120.9920 }, // Legarda
      { lat: 14.6065, lng: 120.9952 }, // España
      { lat: 14.6095, lng: 120.9985 }, // V. Mapa
    ],
    stops: [
      { id: 's1-1', name: 'Divisoria', coordinates: { lat: 14.6042, lng: 120.9822 } },
      { id: 's1-2', name: 'Recto LRT', coordinates: { lat: 14.5995, lng: 120.9840 } },
      { id: 's1-3', name: 'Quiapo Church', coordinates: { lat: 14.5986, lng: 120.9864 } },
      { id: 's1-4', name: 'Legarda', coordinates: { lat: 14.6000, lng: 120.9920 } },
      { id: 's1-5', name: 'España UST', coordinates: { lat: 14.6095, lng: 120.9985 } },
    ],
    avgTripDuration: 35,
    peakHours: [7, 8, 17, 18, 19],
  },
  {
    id: 'route-2',
    name: 'Cubao - SM North - Fairview',
    color: '#f59e0b', // Amber
    path: [
      { lat: 14.6199, lng: 121.0522 }, // Cubao
      { lat: 14.6282, lng: 121.0487 }, // Nepa Q-Mart
      { lat: 14.6564, lng: 121.0323 }, // SM North
      { lat: 14.6789, lng: 121.0245 }, // Lagro
      { lat: 14.7134, lng: 121.0726 }, // Fairview
    ],
    stops: [
      { id: 's2-1', name: 'Cubao Gateway', coordinates: { lat: 14.6199, lng: 121.0522 } },
      { id: 's2-2', name: 'Nepa Q-Mart', coordinates: { lat: 14.6282, lng: 121.0487 } },
      { id: 's2-3', name: 'SM North EDSA', coordinates: { lat: 14.6564, lng: 121.0323 } },
      { id: 's2-4', name: 'Lagro Market', coordinates: { lat: 14.6789, lng: 121.0245 } },
      { id: 's2-5', name: 'Fairview Center', coordinates: { lat: 14.7134, lng: 121.0726 } },
    ],
    avgTripDuration: 45,
    peakHours: [6, 7, 17, 18],
  },
  {
    id: 'route-3',
    name: 'Makati - Guadalupe - Shaw',
    color: '#8b5cf6', // Purple
    path: [
      { lat: 14.5547, lng: 121.0244 }, // Makati Ave
      { lat: 14.5623, lng: 121.0346 }, // Guadalupe
      { lat: 14.5813, lng: 121.0538 }, // Boni
      { lat: 14.5872, lng: 121.0584 }, // Shaw Blvd
    ],
    stops: [
      { id: 's3-1', name: 'Makati Avenue', coordinates: { lat: 14.5547, lng: 121.0244 } },
      { id: 's3-2', name: 'Guadalupe MRT', coordinates: { lat: 14.5623, lng: 121.0346 } },
      { id: 's3-3', name: 'Boni Avenue', coordinates: { lat: 14.5813, lng: 121.0538 } },
      { id: 's3-4', name: 'Shaw Boulevard', coordinates: { lat: 14.5872, lng: 121.0584 } },
    ],
    avgTripDuration: 25,
    peakHours: [7, 8, 9, 17, 18, 19],
  },
  {
    id: 'route-4',
    name: 'Monumento - Balintawak - Quezon Ave',
    color: '#ef4444', // Red
    path: [
      { lat: 14.6543, lng: 120.9834 }, // Monumento
      { lat: 14.6598, lng: 120.9978 }, // Balintawak
      { lat: 14.6432, lng: 121.0165 }, // Roosevelt
      { lat: 14.6398, lng: 121.0254 }, // Quezon Avenue
    ],
    stops: [
      { id: 's4-1', name: 'Monumento Circle', coordinates: { lat: 14.6543, lng: 120.9834 } },
      { id: 's4-2', name: 'Balintawak Market', coordinates: { lat: 14.6598, lng: 120.9978 } },
      { id: 's4-3', name: 'Roosevelt Station', coordinates: { lat: 14.6432, lng: 121.0165 } },
      { id: 's4-4', name: 'Quezon Avenue', coordinates: { lat: 14.6398, lng: 121.0254 } },
    ],
    avgTripDuration: 30,
    peakHours: [6, 7, 8, 17, 18],
  },
];

// Initial jeep positions
export const INITIAL_JEEPS: Jeep[] = [
  // Route 1 jeeps
  { id: 'j1-1', routeId: 'route-1', currentPosition: ROUTES[0].path[0], occupancy: 'available', speed: 15, direction: 0, lastUpdate: new Date(), progress: 0, passengerCount: 8, capacity: 18 },
  { id: 'j1-2', routeId: 'route-1', currentPosition: ROUTES[0].path[2], occupancy: 'standing', speed: 12, direction: 0, lastUpdate: new Date(), progress: 0.4, passengerCount: 22, capacity: 18 },
  { id: 'j1-3', routeId: 'route-1', currentPosition: ROUTES[0].path[4], occupancy: 'available', speed: 18, direction: 0, lastUpdate: new Date(), progress: 0.75, passengerCount: 6, capacity: 18 },
  
  // Route 2 jeeps
  { id: 'j2-1', routeId: 'route-2', currentPosition: ROUTES[1].path[0], occupancy: 'standing', speed: 14, direction: 0, lastUpdate: new Date(), progress: 0, passengerCount: 20, capacity: 18 },
  { id: 'j2-2', routeId: 'route-2', currentPosition: ROUTES[1].path[2], occupancy: 'full', speed: 10, direction: 0, lastUpdate: new Date(), progress: 0.5, passengerCount: 25, capacity: 18 },
  
  // Route 3 jeeps
  { id: 'j3-1', routeId: 'route-3', currentPosition: ROUTES[2].path[0], occupancy: 'available', speed: 20, direction: 0, lastUpdate: new Date(), progress: 0, passengerCount: 10, capacity: 18 },
  { id: 'j3-2', routeId: 'route-3', currentPosition: ROUTES[2].path[1], occupancy: 'standing', speed: 16, direction: 0, lastUpdate: new Date(), progress: 0.33, passengerCount: 19, capacity: 18 },
  { id: 'j3-3', routeId: 'route-3', currentPosition: ROUTES[2].path[3], occupancy: 'available', speed: 18, direction: 0, lastUpdate: new Date(), progress: 0.9, passengerCount: 7, capacity: 18 },
  
  // Route 4 jeeps
  { id: 'j4-1', routeId: 'route-4', currentPosition: ROUTES[3].path[0], occupancy: 'standing', speed: 13, direction: 0, lastUpdate: new Date(), progress: 0, passengerCount: 21, capacity: 18 },
  { id: 'j4-2', routeId: 'route-4', currentPosition: ROUTES[3].path[2], occupancy: 'available', speed: 17, direction: 0, lastUpdate: new Date(), progress: 0.6, passengerCount: 12, capacity: 18 },
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
  
  const stopIndex = route.stops.findIndex(s => s.id === targetStop.id);
  if (stopIndex === -1) return 0;
  
  const targetProgress = stopIndex / (route.stops.length - 1);
  const remainingProgress = targetProgress - jeep.progress;
  
  if (remainingProgress <= 0) return 0;
  
  const totalPathLength = route.path.length;
  const avgSpeed = jeep.speed || 15;
  const estimatedMinutes = (remainingProgress * totalPathLength * 0.5 / avgSpeed) * 60;
  
  return Math.max(1, Math.round(estimatedMinutes));
}
