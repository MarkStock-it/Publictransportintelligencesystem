import { useNavigate } from 'react-router-dom';
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
    <div className="min-h-screen bg-slate-950">
      <header className="flex items-center justify-between px-5 py-3 bg-slate-900/80 backdrop-blur-md border-b border-white/[0.06] shadow-lg">
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-white tracking-tight">LarGo</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300/70 bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 rounded-full">Driver</span>
        </div>
        <button
          onClick={handleLogout}
          className="text-[11px] font-semibold text-white/30 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
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
