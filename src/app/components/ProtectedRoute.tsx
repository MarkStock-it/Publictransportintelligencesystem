import { Navigate, Outlet } from 'react-router-dom';
import { useAuth, type Role } from '../context/AuthContext';

interface ProtectedRouteProps {
  requiredRole: Role;
}

export function ProtectedRoute({ requiredRole }: ProtectedRouteProps) {
  const { role } = useAuth();

  if (role !== requiredRole) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
