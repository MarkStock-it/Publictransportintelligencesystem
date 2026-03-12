import { useNavigate } from 'react-router';
import { useAuth, type Role } from '../context/AuthContext';

const ROLES: { role: Role; label: string; description: string; destination: string }[] = [
  {
    role: 'commuter',
    label: 'Commuter',
    description: 'View live jeepney map & nearby routes',
    destination: '/commuter',
  },
  {
    role: 'driver',
    label: 'Driver',
    description: 'Driver dashboard, active trip & route info',
    destination: '/driver',
  },
  {
    role: 'lgu',
    label: 'LGU Officer',
    description: 'Fleet analytics, demand forecasts & route management',
    destination: '/lgu',
  },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = (role: Role, destination: string) => {
    login(role);
    navigate(destination, { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-600 mb-3">
            <svg
              className="w-7 h-7 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7h8M8 11h4m-6 8l1.5-4.5M16 19l1.5-4.5M3 7h18l-2 12H5L3 7z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">PTIS</h1>
          <p className="mt-1 text-sm text-gray-500">Public Transport Intelligence System</p>
        </div>

        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
            Select your role
          </p>
          {ROLES.map(({ role, label, description, destination }) => (
            <button
              key={role}
              onClick={() => handleLogin(role, destination)}
              className="w-full flex flex-col items-start px-4 py-3 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors text-left"
            >
              <span className="text-sm font-semibold text-gray-900">{label}</span>
              <span className="text-xs text-gray-500 mt-0.5">{description}</span>
            </button>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400">
          Demo mode — no real authentication
        </p>
      </div>
    </div>
  );
}
