import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { DriverDashboard } from '../components/DriverDashboard';

export default function DriverPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Minimal header — no system-wide data visible to driver */}
      <header className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-100 shadow-sm">
        <div>
          <span className="text-sm font-bold text-gray-800">PTIS</span>
          <span className="ml-2 text-xs text-gray-400">Driver</span>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs text-gray-400 hover:text-red-500 transition-colors"
        >
          Sign out
        </button>
      </header>

      <main>
        <DriverDashboard />
      </main>
    </div>
  );
}
