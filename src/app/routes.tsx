import { createBrowserRouter } from "react-router";
import { LiveMapView } from "./components/LiveMapView";
import { RouteIntelligence } from "./components/RouteIntelligence";
import { LGUDashboard } from "./components/LGUDashboard";
import { LowBandwidthMode } from "./components/LowBandwidthMode";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: LiveMapView,
  },
  {
    path: "/intelligence",
    Component: RouteIntelligence,
  },
  {
    path: "/dashboard",
    Component: LGUDashboard,
  },
  {
    path: "/low-bandwidth",
    Component: LowBandwidthMode,
  },
]);
