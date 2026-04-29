import * as L from 'leaflet';

export type LatLng = [number, number];

const ROUTE_PANE = 'route';

function clampIndex(index: number, max: number): number {
  return Math.max(0, Math.min(index, max));
}

function createEndpointIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: 'route-endpoint-marker',
    html: `<div style="width:14px;height:14px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.35);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

export function drawRouteSegment(
  map: L.Map,
  fullPath: LatLng[],
  startIdx: number,
  endIdx: number,
): L.LayerGroup {
  if (!map.getPane(ROUTE_PANE)) {
    const pane = map.createPane(ROUTE_PANE);
    pane.style.zIndex = '450';
  }

  map.eachLayer((layer) => {
    const paneName = (layer as L.Layer & { options?: { pane?: string } }).options?.pane;
    if (paneName === ROUTE_PANE) {
      map.removeLayer(layer);
    }
  });

  if (fullPath.length === 0) {
    return L.layerGroup().addTo(map);
  }

  const lastIndex = fullPath.length - 1;
  const from = clampIndex(Math.min(startIdx, endIdx), lastIndex);
  const to = clampIndex(Math.max(startIdx, endIdx), lastIndex);
  const activeSegment = fullPath.slice(from, to + 1);

  const fullRouteLine = L.polyline(fullPath, {
    pane: ROUTE_PANE,
    color: '#0ea5e9',
    dashArray: '8 8',
    weight: 3,
    opacity: 0.75,
    className: 'route-walk-line',
  });

  const activeRouteLine = L.polyline(activeSegment, {
    pane: ROUTE_PANE,
    color: '#ef4444',
    weight: 5,
    lineCap: 'round',
    lineJoin: 'round',
    className: 'route-active-line',
  });

  const startMarker = L.marker(fullPath[from], {
    pane: ROUTE_PANE,
    icon: createEndpointIcon('#22c55e'),
  });

  const endMarker = L.marker(fullPath[to], {
    pane: ROUTE_PANE,
    icon: createEndpointIcon('#ef4444'),
  });

  const layerGroup = L.layerGroup([
    fullRouteLine,
    activeRouteLine,
    startMarker,
    endMarker,
  ]).addTo(map);

  if (activeSegment.length > 0) {
    map.fitBounds(L.latLngBounds(activeSegment), {
      padding: [24, 24],
    });
  }

  return layerGroup;
}
