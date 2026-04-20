export type Coordinates = [number, number];

export interface Stop {
  name: string;
  coords: Coordinates;
  order: number;
}

export interface Route {
  id: string;
  name: string;
  path: Coordinates[];
  stops: Stop[];
}

export interface RouteMatch {
  routeId: string;
  boardingPoint: Coordinates;
  alightingPoint: Coordinates;
  walkDistance: number;
}

const WALKING_THRESHOLD_METERS = 500;

export function haversineDistance(a: Coordinates, b: Coordinates): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const [lat1, lng1] = a;
  const [lat2, lng2] = b;

  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const haversine =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;

  const centralAngle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return earthRadius * centralAngle;
}

function findNearestPoint(target: Coordinates, path: Coordinates[]) {
  let nearestPoint: Coordinates | null = null;
  let shortestDistance = Number.POSITIVE_INFINITY;

  for (const point of path) {
    const distance = haversineDistance(target, point);
    if (distance < shortestDistance) {
      shortestDistance = distance;
      nearestPoint = point;
    }
  }

  return nearestPoint
    ? { point: nearestPoint, distance: shortestDistance }
    : null;
}

export function findBestRoute(
  start: Coordinates,
  end: Coordinates,
  routes: Route[],
): RouteMatch | null {
  for (const route of routes) {
    const nearestStart = findNearestPoint(start, route.path);
    if (!nearestStart || nearestStart.distance >= WALKING_THRESHOLD_METERS) {
      continue;
    }

    const nearestEnd = findNearestPoint(end, route.path);
    if (!nearestEnd || nearestEnd.distance >= WALKING_THRESHOLD_METERS) {
      continue;
    }

    return {
      routeId: route.id,
      boardingPoint: nearestStart.point,
      alightingPoint: nearestEnd.point,
      walkDistance: nearestStart.distance + nearestEnd.distance,
    };
  }

  return null;
}

export const JEEPNEY_ROUTES = [
  {
    id: '21FE',
    name: '21FE Ayala - IT Park',
    path: [
      [10.3178, 123.9059],
      [10.3216, 123.9090],
      [10.3290, 123.9061],
    ],
    stops: [
      {
        name: 'Ayala Center Cebu',
        coords: [10.3178, 123.9059],
        order: 1,
      },
      {
        name: 'Cebu Business Park',
        coords: [10.3216, 123.9090],
        order: 2,
      },
      {
        name: 'IT Park Terminal',
        coords: [10.3290, 123.9061],
        order: 3,
      },
    ],
  },
] as const satisfies readonly Route[];
