import { useJeepSimulation } from '../hooks/useJeepSimulation';
import { CommuterMapView } from '../components/CommuterMapView';

/**
 * Thin data-fetching page for the /commuter route.
 * Keeps CommuterMapView a pure presentational component.
 */
export default function CommuterPage() {
  const { jeeps } = useJeepSimulation();
  return <CommuterMapView jeepneys={jeeps} />;
}
