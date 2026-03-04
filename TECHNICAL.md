# 🏗️ JeepWise Technical Architecture

## System Overview

JeepWise is built as a single-page application (SPA) with client-side routing and simulated real-time data updates. The architecture is designed to be production-ready with minimal changes needed for live deployment.

---

## 🗂️ Project Structure

```
/src
├── /app
│   ├── App.tsx                    # Main app with RouterProvider
│   ├── routes.tsx                 # React Router configuration
│   │
│   ├── /components
│   │   ├── Navigation.tsx         # Top nav bar with routing
│   │   ├── LiveMapView.tsx        # Main map with jeep tracking
│   │   ├── RouteIntelligence.tsx  # Analytics and insights
│   │   ├── LGUDashboard.tsx       # Government planning dashboard
│   │   └── LowBandwidthMode.tsx   # Text-only view
│   │
│   ├── /data
│   │   └── jeepney-data.ts        # Routes, jeeps, calculations
│   │
│   └── /hooks
│       └── useJeepSimulation.ts   # Real-time position updates
│
└── /styles
    ├── index.css                   # Main CSS with Leaflet imports
    ├── tailwind.css                # Tailwind v4 directives
    ├── theme.css                   # Design tokens
    └── fonts.css                   # Font imports
```

---

## 🎯 Core Components

### 1. LiveMapView.tsx
**Purpose:** Main interactive map with real-time jeep tracking

**Key Features:**
- React Leaflet map container
- Custom jeep and stop markers
- Click handlers for stops and jeeps
- Info panels (StopInfoPanel, JeepInfoPanel)
- Night mode toggle
- Route legend
- Live stats bar

**State Management:**
- `selectedStop` - Currently selected stop
- `selectedJeep` - Currently selected jeep
- `nightMode` - Dark/light map toggle

**Data Flow:**
```
useJeepSimulation() 
  ↓ 
{ jeeps, routes } 
  ↓ 
Map rendering + Markers
  ↓
User clicks
  ↓
Info panels display
```

### 2. RouteIntelligence.tsx
**Purpose:** Analytics and predictive insights

**Key Features:**
- System-wide metrics (total jeeps, routes, duration, passengers)
- Per-route performance cards
- Reliability scores
- Occupancy bars
- Peak hour chips
- Predictive insights panel

**Data Calculations:**
```typescript
const routeStats = ROUTES.map(route => {
  const routeJeeps = jeeps.filter(j => j.routeId === route.id);
  const avgOccupancy = routeJeeps.reduce((acc, j) => acc + j.passengerCount, 0) / routeJeeps.length;
  const occupancyPercentage = (avgOccupancy / 18) * 100;
  const avgInterval = route.avgTripDuration / routeJeeps.length;
  const reliability = Math.round(85 + Math.random() * 12);
  
  return { ...route, activeJeeps, avgOccupancy, occupancyPercentage, avgInterval, reliability };
});
```

### 3. LGUDashboard.tsx
**Purpose:** Government planning and infrastructure intelligence

**Key Features:**
- 4 gradient metric cards
- Imbalance alerts
- 5 Recharts visualizations:
  - Bar chart (route congestion)
  - Pie chart (fleet distribution)
  - Area chart (24-hour demand)
  - Horizontal bar chart (wait times)
- Policy recommendations

**Chart Types:**
```typescript
<BarChart>      // Congestion levels
<PieChart>      // Fleet distribution
<AreaChart>     // Demand patterns
<BarChart>      // Wait time comparison
```

### 4. LowBandwidthMode.tsx
**Purpose:** Accessible text-only view for slow connections

**Key Features:**
- Text-based route list
- ETA display
- Passenger counts
- Expandable stop lists
- Minimal data usage (~50KB)

---

## 🔄 Data Flow

### Simulation Architecture

```
useJeepSimulation()
    ↓
setInterval(100ms)
    ↓
Update jeep positions:
  - progress += speedFactor
  - interpolate GPS coordinates
  - check for stops
  - update occupancy
    ↓
Return { jeeps, routes }
    ↓
Components re-render
```

### Position Calculation

```typescript
// Convert progress (0-1) to GPS coordinates
const pathIndex = Math.floor(progress * (route.path.length - 1));
const segmentProgress = (progress * (route.path.length - 1)) % 1;
const start = route.path[pathIndex];
const end = route.path[pathIndex + 1];
const currentPosition = interpolatePosition(start, end, segmentProgress);
```

### Occupancy Simulation

```typescript
// At each stop, randomly change passengers
if (currentStop !== previousStop) {
  const change = Math.floor(Math.random() * 8) - 3;
  newPassengerCount = Math.max(0, Math.min(capacity + 7, passengerCount + change));
  
  if (newPassengerCount <= capacity * 0.6) newOccupancy = 'available';
  else if (newPassengerCount <= capacity + 3) newOccupancy = 'standing';
  else newOccupancy = 'full';
}
```

### ETA Calculation

```typescript
export function calculateETA(jeep: Jeep, targetStop: JeepStop): number {
  const route = getRouteById(jeep.routeId);
  const stopIndex = route.stops.findIndex(s => s.id === targetStop.id);
  const targetProgress = stopIndex / (route.stops.length - 1);
  const remainingProgress = targetProgress - jeep.progress;
  
  if (remainingProgress <= 0) return 0;
  
  const totalPathLength = route.path.length;
  const avgSpeed = jeep.speed || 15;
  const estimatedMinutes = (remainingProgress * totalPathLength * 0.5 / avgSpeed) * 60;
  
  return Math.max(1, Math.round(estimatedMinutes));
}
```

---

## 🎨 Styling Architecture

### Tailwind v4 Setup

```css
/* index.css */
@import './tailwind.css';
@import './theme.css';
@import 'leaflet/dist/leaflet.css';
```

### Color System

```typescript
// Route colors
const ROUTE_COLORS = {
  route1: '#14b8a6', // Teal
  route2: '#f59e0b', // Amber
  route3: '#8b5cf6', // Purple
  route4: '#ef4444', // Red
};

// Occupancy colors
const OCCUPANCY_COLORS = {
  available: '#10b981', // Green
  standing: '#f59e0b',  // Yellow
  full: '#ef4444',      // Red
};

// Brand colors
const BRAND_COLORS = {
  primary: '#1e3a8a',   // Navy
  accent: '#14b8a6',    // Teal
  background: '#f9fafb' // Gray-50
};
```

### Responsive Breakpoints

```
sm:  640px
md:  768px
lg:  1024px
xl:  1280px
```

---

## 🗺️ Map Implementation

### Leaflet Setup

```typescript
<MapContainer
  center={[14.6091, 121.0223]}  // Manila center
  zoom={12}
  className="h-full w-full"
  zoomControl={false}
>
  <TileLayer url={nightMode ? darkTiles : lightTiles} />
  
  {/* Route polylines */}
  <Polyline positions={route.path} color={route.color} />
  
  {/* Stop markers */}
  <Marker position={stop.coordinates} icon={stopIcon} />
  
  {/* Jeep markers */}
  <Marker position={jeep.currentPosition} icon={jeepIcon(color)} />
</MapContainer>
```

### Custom Markers

```typescript
// Jeep marker - SVG injected into DivIcon
const jeepIcon = (color: string) => new DivIcon({
  html: `<div style="background: ${color}; width: 32px; height: 32px; 
         border-radius: 50%; border: 3px solid white; 
         box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
    <svg><!-- jeep icon SVG --></svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

// Stop marker - Simple circle
const stopIcon = new DivIcon({
  html: `<div style="background: #1e40af; width: 16px; height: 16px; 
         border-radius: 50%; border: 2px solid white;"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});
```

---

## 📊 Chart Implementation

### Recharts Configuration

```typescript
// Responsive container wrapper
<ResponsiveContainer width="100%" height={300}>
  <BarChart data={congestionData}>
    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
    <YAxis tick={{ fontSize: 12 }} />
    <Tooltip contentStyle={{ 
      background: '#fff', 
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
    }} />
    <Bar dataKey="congestion" fill="#14b8a6" radius={[8, 8, 0, 0]} />
  </BarChart>
</ResponsiveContainer>
```

---

## 🎬 Animation Strategy

### Motion (Framer Motion) Usage

```typescript
// Stagger animations
{items.map((item, index) => (
  <motion.div
    key={item.id}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.1 }}
  >
    {/* content */}
  </motion.div>
))}

// Slide-in panels
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
>
  {/* panel content */}
</motion.div>

// Mobile menu
<AnimatePresence>
  {menuOpen && (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
    >
      {/* menu items */}
    </motion.div>
  )}
</AnimatePresence>
```

---

## 🔌 Production Backend Architecture

### What Would Change for Production

**Current (Demo):**
- Client-side simulation
- Static route data
- In-memory state

**Production:**
```
Frontend (React)
    ↓ WebSocket
Backend API Server
    ↓
Real-time Database (Firebase/Supabase)
    ↑
Driver Mobile App (GPS + Passenger Input)
```

### API Endpoints Needed

```
GET  /api/routes              # All routes
GET  /api/routes/:id          # Single route
GET  /api/jeeps               # All jeeps
GET  /api/jeeps/:id           # Single jeep
POST /api/jeeps/:id/location  # Update GPS (from driver app)
POST /api/jeeps/:id/passengers # Update count
GET  /api/stops/:id/arrivals  # ETA predictions
GET  /api/analytics/routes    # LGU dashboard data
WS   /ws/tracking             # Real-time updates
```

### Database Schema

```typescript
// Routes table
interface Route {
  id: string;
  name: string;
  color: string;
  path: GeoJSON;
  stops: Stop[];
}

// Jeeps table
interface Jeep {
  id: string;
  routeId: string;
  driverId: string;
  location: { lat: number; lng: number };
  passengerCount: number;
  capacity: number;
  lastUpdate: timestamp;
}

// Historical data
interface TripLog {
  id: string;
  jeepId: string;
  routeId: string;
  startTime: timestamp;
  endTime: timestamp;
  avgSpeed: number;
  passengerCount: number[];
}
```

---

## 🔒 Security Considerations

### For Production

1. **Authentication**
   - JWT tokens for driver app
   - API keys for LGU dashboard access
   - Public read-only for commuter view

2. **Data Validation**
   - GPS coordinates must be within route bounds
   - Speed limits (max 60 km/h)
   - Passenger count cannot exceed capacity + 10

3. **Rate Limiting**
   - Driver app: 1 GPS update per 5 seconds
   - Public API: 100 requests per minute per IP

4. **Privacy**
   - No driver personal data exposed
   - Location data retained for 30 days max
   - Aggregated analytics only for LGU

---

## 📱 Mobile Responsive Design

### Breakpoint Strategy

```typescript
// Desktop (lg+): Full dashboard layout
// Tablet (md): Stacked charts, side panels
// Mobile (sm): Hamburger menu, bottom stats bar, full-width cards

// Example:
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
className="hidden md:flex" // Hide on mobile
className="md:hidden" // Show only on mobile
```

### Touch Optimization

- Marker size increased for touch targets (32px minimum)
- Click handlers work with both click and touch events
- Mobile menu with swipe-friendly interactions

---

## ⚡ Performance Optimizations

### Implemented

1. **Memoization**: None needed yet (small dataset)
2. **Lazy Loading**: Routes loaded on demand via React Router
3. **Animation Throttling**: 100ms interval for position updates
4. **Chart Optimization**: Recharts handles rendering efficiently

### For Production

1. **Virtualization**: For large jeep lists (react-window)
2. **WebSocket**: Replace polling with push updates
3. **CDN**: Static assets and map tiles
4. **Code Splitting**: Per-route chunks
5. **Service Worker**: Offline support

---

## 🧪 Testing Strategy

### Unit Tests (Not Implemented Yet)

```typescript
// data/jeepney-data.test.ts
describe('calculateETA', () => {
  it('should return ETA in minutes', () => {
    const jeep = { progress: 0.2, speed: 15, ... };
    const stop = { id: 's1-3', ... };
    expect(calculateETA(jeep, stop)).toBeGreaterThan(0);
  });
});

// hooks/useJeepSimulation.test.ts
describe('useJeepSimulation', () => {
  it('should update jeep positions', () => {
    const { result } = renderHook(() => useJeepSimulation());
    act(() => { /* advance timers */ });
    expect(result.current.jeeps[0].progress).toBeGreaterThan(0);
  });
});
```

### Integration Tests

```typescript
// components/LiveMapView.test.tsx
describe('LiveMapView', () => {
  it('should display stop info on click', () => {
    render(<LiveMapView />);
    fireEvent.click(screen.getByTestId('stop-s1-1'));
    expect(screen.getByText(/Next arrivals/i)).toBeInTheDocument();
  });
});
```

---

## 🚀 Deployment

### Current Setup

- Built with Vite
- Static SPA
- Can deploy to: Vercel, Netlify, GitHub Pages, etc.

### Build Command

```bash
npm run build
# Outputs to /dist
```

### Environment Variables (Production)

```env
VITE_API_URL=https://api.jeepwise.com
VITE_WS_URL=wss://api.jeepwise.com/ws
VITE_MAP_TILE_URL=https://tiles.jeepwise.com/{z}/{x}/{y}.png
```

---

## 📚 Dependencies

### Core

- `react` - UI library
- `react-dom` - React rendering
- `react-router` - Client-side routing
- `leaflet` - Map library
- `react-leaflet` - React bindings for Leaflet

### UI

- `tailwindcss` - Utility-first CSS
- `lucide-react` - Icon library
- `motion` - Animation library (Framer Motion)

### Charts

- `recharts` - React charting library

### Utilities

- `date-fns` - Date manipulation (included but not used yet)
- `clsx` - Class name utility
- `tailwind-merge` - Merge Tailwind classes

---

## 🔧 Development Workflow

### Running Locally

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

### File Watching

Vite HMR (Hot Module Replacement) enabled - changes reflect instantly

---

## 📖 Code Standards

### TypeScript

- Strict mode enabled
- Interfaces for all data structures
- Proper type imports

### React

- Functional components only
- Hooks for state management
- Props interfaces defined

### Naming Conventions

- Components: PascalCase (LiveMapView)
- Functions: camelCase (calculateETA)
- Constants: UPPER_SNAKE_CASE (ROUTE_COLORS)
- Files: Match component name (LiveMapView.tsx)

---

## 🎯 Next Steps for Production

### Phase 1: Backend Setup
1. Set up API server (Node.js/Express or Python/FastAPI)
2. Configure database (PostgreSQL + PostGIS for geo queries)
3. Implement WebSocket for real-time updates
4. Set up authentication (JWT)

### Phase 2: Driver App
1. Build React Native mobile app
2. GPS tracking implementation
3. Passenger count interface
4. Trip logging

### Phase 3: Advanced Features
1. Machine learning for ETA prediction
2. Route optimization algorithms
3. SMS notifications
4. Emergency features

### Phase 4: Scale
1. Multi-city support
2. API for third parties
3. Open data platform
4. Mobile web PWA

---

## 🏆 Technical Achievements

This demo showcases:

✅ **Full-stack thinking** - Architected for real production
✅ **Modern React patterns** - Hooks, context, composition
✅ **Complex state management** - Real-time simulation
✅ **Responsive design** - Mobile-first approach
✅ **Data visualization** - Multiple chart types
✅ **Geospatial computation** - GPS interpolation, distance calc
✅ **Performance** - Smooth 100ms updates
✅ **Accessibility** - Low-bandwidth mode
✅ **User experience** - Intuitive interactions

**This isn't a prototype. It's a foundation.**

---

Built with 💪 for hackathon domination
