<<<<<<< HEAD
import { createHashRouter } from "react-router-dom"; 
import { EnhancedLiveMapView } from "./components/EnhancedLiveMapView";
import { RouteIntelligence } from "./components/RouteIntelligence";
=======
import { createBrowserRouter, Navigate } from "react-router";
>>>>>>> 58da5b23 (Implement role-based PTIS dashboards and map simulation updates)
import { LGUDashboard } from "./components/LGUDashboard";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import LoginPage from "./pages/LoginPage";
import DriverPage from "./pages/DriverPage";
import CommuterPage from "./pages/CommuterPage";

<<<<<<< HEAD
export const router = createHashRouter([
  {
    path: "/",
    element: <EnhancedLiveMapView />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/intelligence",
    element: <RouteIntelligence />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/dashboard",
    element: <LGUDashboard />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/low-bandwidth",
    element: <LowBandwidthMode />,
    errorElement: <ErrorBoundary />,
=======
export const router = createBrowserRouter([
  // Public: login
  {
    path: "/login",
    Component: LoginPage,
    errorElement: <ErrorBoundary />,
  },

  // Public: commuter map view
  {
    path: "/commuter",
    Component: CommuterPage,
    errorElement: <ErrorBoundary />,
  },

  // Protected: driver role
  {
    path: "/driver",
    element: <ProtectedRoute requiredRole="driver" />,
    errorElement: <ErrorBoundary />,
    children: [
      { index: true, Component: DriverPage },
    ],
  },

  // Protected: lgu role
  {
    path: "/lgu",
    element: <ProtectedRoute requiredRole="lgu" />,
    errorElement: <ErrorBoundary />,
    children: [
      { index: true, Component: LGUDashboard },
    ],
  },

  // Root redirect
  {
    path: "/",
    element: <Navigate to="/commuter" replace />,
>>>>>>> 58da5b23 (Implement role-based PTIS dashboards and map simulation updates)
  },
], {
  basename: "/",
});