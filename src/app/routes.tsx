import { createBrowserRouter } from "react-router";
import { LiveMapView } from "./components/LiveMapView";
import { RouteIntelligence } from "./components/RouteIntelligence";
import { LGUDashboard } from "./components/LGUDashboard";
import { LowBandwidthMode } from "./components/LowBandwidthMode";
import { ErrorBoundary } from "./components/ErrorBoundary";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: LiveMapView,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/intelligence",
    Component: RouteIntelligence,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/dashboard",
    Component: LGUDashboard,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/low-bandwidth",
    Component: LowBandwidthMode,
    errorElement: <ErrorBoundary />,
  },
]);
