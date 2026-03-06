import { createHashRouter } from "react-router-dom"; 
import { EnhancedLiveMapView } from "./components/EnhancedLiveMapView";
import { RouteIntelligence } from "./components/RouteIntelligence";
import { LGUDashboard } from "./components/LGUDashboard";
import { LowBandwidthMode } from "./components/LowBandwidthMode";
import { ErrorBoundary } from "./components/ErrorBoundary";

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
  },
], {
  basename: "/",
});