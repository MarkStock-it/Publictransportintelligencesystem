import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useJeepSimulation } from '../hooks/useJeepSimulation';
import { CommuterMapView } from '../components/CommuterMapView';

/**
 * Thin data-fetching page for the /commuter route.
 * Keeps CommuterMapView a pure presentational component.
 */
export default function CommuterPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { jeeps } = useJeepSimulation();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="relative">
      <CommuterMapView jeepneys={jeeps} onLogout={handleLogout} />
    </div>
  );
}
