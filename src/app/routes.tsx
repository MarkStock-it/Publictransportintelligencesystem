import { createHashRouter } from "react-router";
import { EnhancedLiveMapView } from "./components/EnhancedLiveMapView";
import { RouteIntelligence } from "./components/RouteIntelligence";
import { LGUDashboard } from "./components/LGUDashboard";
import { LowBandwidthMode } from "./components/LowBandwidthMode";
import { ErrorBoundary } from "./components/ErrorBoundary";

export const router = createHashRouter([
  {
    path: "/",
    Component: EnhancedLiveMapView,
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
], {
  basename: "/",
});
