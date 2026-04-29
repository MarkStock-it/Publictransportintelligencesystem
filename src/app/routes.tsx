import { createHashRouter, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import LoginPage from "./pages/LoginPage";
import CommuterPage from "./pages/CommuterPage";
import DriverPage from "./pages/DriverPage";
import { LGUDashboard } from "./components/LGUDashboard";

export const router = createHashRouter([
  // Public: login
  {
    path: "/login",
    Component: LoginPage,
    errorElement: <ErrorBoundary />,
  },

  // Public: commuter map view
  {
    path: "/commuter",
    element: <ProtectedRoute requiredRole="commuter" />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        index: true,
        Component: CommuterPage,
      },
    ],
  },

  // Protected: driver role
  {
    path: "/driver",
    element: <ProtectedRoute requiredRole="driver" />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        index: true,
        Component: DriverPage,
      },
    ],
  },

  // Protected: lgu role
  {
    path: "/lgu",
    element: <ProtectedRoute requiredRole="lgu" />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        index: true,
        Component: LGUDashboard,
      },
    ],
  },

  // Root redirect
  {
    path: "/",
    element: <Navigate to="/login" replace />,
  },
], {
  basename: "/",
});