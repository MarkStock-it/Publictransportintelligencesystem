import { createHashRouter, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";

export const router = createHashRouter([
  // Public: login
  {
    path: "/login",
    lazy: async () => {
      const module = await import("./pages/LoginPage");
      return { Component: module.default };
    },
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
        lazy: async () => {
          const module = await import("./pages/CommuterPage");
          return { Component: module.default };
        },
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
        lazy: async () => {
          const module = await import("./pages/DriverPage");
          return { Component: module.default };
        },
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
        lazy: async () => {
          const module = await import("./components/LGUDashboard");
          return { Component: module.LGUDashboard };
        },
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