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
      <button
        onClick={handleLogout}
        className="absolute right-4 top-4 z-[1500] rounded-md bg-white/90 px-3 py-1.5 text-xs font-semibold text-gray-600 shadow hover:bg-white"
      >
        Sign out
      </button>
      <CommuterMapView jeepneys={jeeps} />
    </div>
  );
}
