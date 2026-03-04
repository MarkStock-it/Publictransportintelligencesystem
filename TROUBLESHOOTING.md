# 🔧 JeepWise Troubleshooting Guide

## Common Issues & Solutions

---

## 🗺️ Map Issues

### Issue: Map not displaying / blank screen

**Possible Causes:**
1. Leaflet CSS not loaded
2. Map container has no height
3. Invalid center coordinates

**Solutions:**

```typescript
// 1. Check that Leaflet CSS is imported in index.css
@import 'leaflet/dist/leaflet.css';

// 2. Ensure map container has height
<div className="h-screen"> {/* or h-full with parent height */}
  <MapContainer ... />
</div>

// 3. Verify center coordinates
center={[14.6091, 121.0223]} // Valid Manila coordinates
```

### Issue: Markers not appearing

**Check:**
```typescript
// Verify marker positions are valid numbers
position={[jeep.currentPosition.lat, jeep.currentPosition.lng]}

// Not:
position={[undefined, undefined]} ❌
```

### Issue: Map tiles not loading

**Solutions:**
1. Check internet connection
2. Try alternative tile provider:
```typescript
// Alternative tiles
url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
url="https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png"
```

---

## 🚌 Simulation Issues

### Issue: Jeeps not moving

**Debug Steps:**

```typescript
// 1. Check useEffect is running
useEffect(() => {
  console.log('Simulation started');
  const interval = setInterval(() => {
    console.log('Update tick');
    // ...
  }, 100);
  return () => clearInterval(interval);
}, []);

// 2. Verify progress is updating
console.log('Jeep progress:', jeep.progress);

// 3. Check interpolatePosition is called
const currentPosition = interpolatePosition(start, end, segmentProgress);
console.log('Position:', currentPosition);
```

**Common Fix:**
```typescript
// Make sure progress increments
let newProgress = jeep.progress + speedFactor;

// Not:
let newProgress = 0; // This would reset!
```

### Issue: Jeeps move too fast or too slow

**Adjust Speed Factor:**

```typescript
// Current:
const speedFactor = (jeep.speed / 15) * 0.002;

// Slower:
const speedFactor = (jeep.speed / 15) * 0.001;

// Faster:
const speedFactor = (jeep.speed / 15) * 0.004;
```

### Issue: Occupancy not changing

**Check Stop Detection:**

```typescript
const currentStop = Math.floor(newProgress * route.stops.length);
const previousStop = Math.floor(jeep.progress * route.stops.length);

if (currentStop !== previousStop) {
  console.log('Stop reached:', currentStop);
  // Update occupancy here
}
```

---

## 📊 Chart Issues

### Issue: Charts not rendering

**Solutions:**

```typescript
// 1. Ensure ResponsiveContainer has parent with height
<div className="h-[300px]"> {/* or specific pixel height */}
  <ResponsiveContainer width="100%" height={300}>
    <BarChart data={data}>
      {/* ... */}
    </BarChart>
  </ResponsiveContainer>
</div>

// 2. Verify data is correct format
console.log('Chart data:', congestionData);
// Should be: [{ name: 'Route', value: 123 }, ...]

// 3. Check data keys match
<Bar dataKey="congestion" /> // Make sure 'congestion' exists in data
```

### Issue: Tooltips not appearing

**Fix:**

```typescript
<Tooltip 
  contentStyle={{ 
    background: '#fff', 
    border: '1px solid #e5e7eb',
    borderRadius: '8px'
  }}
/>
```

---

## 🧭 Navigation Issues

### Issue: React Router not working / 404 on routes

**Solutions:**

```typescript
// 1. Verify routes.tsx is configured correctly
export const router = createBrowserRouter([
  { path: "/", Component: LiveMapView },
  { path: "/intelligence", Component: RouteIntelligence },
  // ...
]);

// 2. Check App.tsx uses RouterProvider
import { RouterProvider } from 'react-router';
import { router } from './routes';

export default function App() {
  return <RouterProvider router={router} />;
}

// 3. Use Link, not <a>
import { Link } from 'react-router';
<Link to="/intelligence">Route Intelligence</Link>
```

### Issue: Navigation works but components don't update

**Check:**
```typescript
// Use useLocation to detect route changes
import { useLocation } from 'react-router';

function MyComponent() {
  const location = useLocation();
  console.log('Current path:', location.pathname);
  // ...
}
```

---

## 🎨 Styling Issues

### Issue: Tailwind classes not applying

**Solutions:**

```typescript
// 1. Check tailwind.css is imported
// In index.css:
@import './tailwind.css';

// 2. Verify class names are correct (no typos)
className="bg-blue-900" ✅
className="bg-blue-9000" ❌

// 3. Check for class conflicts
// Use browser DevTools to see computed styles
```

### Issue: Custom colors not working

**Use inline styles for custom colors:**

```typescript
// Routes have custom colors from data
<div style={{ background: route.color }}>
  {/* content */}
</div>

// Not:
<div className="bg-[#14b8a6]"> {/* This might not work with Tailwind v4 */}
```

### Issue: Responsive classes not working

**Check breakpoints:**

```typescript
// Correct order: mobile-first
className="text-sm md:text-base lg:text-lg"

// Verify in DevTools:
// Mobile: text-sm
// ≥768px: text-base
// ≥1024px: text-lg
```

---

## ⚡ Performance Issues

### Issue: Laggy animations

**Solutions:**

```typescript
// 1. Reduce update frequency
const interval = setInterval(() => {
  // ...
}, 200); // Instead of 100ms

// 2. Use CSS transforms instead of position changes
// Already done in our implementation

// 3. Limit number of jeeps rendered
const visibleJeeps = jeeps.slice(0, 20);
```

### Issue: High memory usage

**Check for memory leaks:**

```typescript
// Always clean up intervals
useEffect(() => {
  const interval = setInterval(() => {
    // ...
  }, 100);
  
  return () => clearInterval(interval); // ✅ IMPORTANT
}, []);

// Not:
useEffect(() => {
  setInterval(() => { /* ... */ }, 100);
  // No cleanup! ❌
}, []);
```

---

## 📱 Mobile Issues

### Issue: Map not responsive on mobile

**Solutions:**

```typescript
// 1. Ensure viewport meta tag (should be in index.html)
<meta name="viewport" content="width=device-width, initial-scale=1.0">

// 2. Use proper height classes
<div className="h-screen"> {/* Full viewport height */}
  <MapContainer ... />
</div>

// 3. Test in mobile browser or DevTools mobile mode
```

### Issue: Click events not working on mobile

**Use touch events:**

```typescript
// Leaflet handles this automatically
// But for custom elements:
<button
  onClick={handleClick}
  onTouchStart={handleClick} // Add for mobile
>
  Click me
</button>
```

### Issue: Mobile menu not showing

**Check AnimatePresence:**

```typescript
import { AnimatePresence } from 'motion/react';

<AnimatePresence>
  {mobileMenuOpen && (
    <motion.div
      initial={{ height: 0 }}
      animate={{ height: 'auto' }}
      exit={{ height: 0 }}
    >
      {/* menu */}
    </motion.div>
  )}
</AnimatePresence>
```

---

## 🔌 Data Issues

### Issue: ETA calculations showing 0 or wrong values

**Debug:**

```typescript
export function calculateETA(jeep: Jeep, targetStop: JeepStop): number {
  console.log('Jeep progress:', jeep.progress);
  console.log('Target stop:', targetStop.name);
  
  const route = getRouteById(jeep.routeId);
  if (!route) {
    console.error('Route not found:', jeep.routeId);
    return 0;
  }
  
  const stopIndex = route.stops.findIndex(s => s.id === targetStop.id);
  console.log('Stop index:', stopIndex);
  
  if (stopIndex === -1) {
    console.error('Stop not in route:', targetStop.id);
    return 0;
  }
  
  // Continue debugging...
}
```

### Issue: Wrong route colors

**Check data:**

```typescript
// In jeepney-data.ts
export const ROUTES: Route[] = [
  {
    id: 'route-1',
    name: 'Divisoria - Quiapo - España',
    color: '#14b8a6', // Valid hex color
    // ...
  }
];

// Not:
color: 'teal' // Use hex, not names
```

---

## 🐛 TypeScript Issues

### Issue: Type errors with Leaflet

**Install type definitions:**

```bash
npm install --save-dev @types/leaflet
```

**Or use type assertions:**

```typescript
const map = useMap() as any; // Last resort
```

### Issue: Type errors with chart data

**Define interfaces:**

```typescript
interface ChartData {
  name: string;
  value: number;
}

const data: ChartData[] = [
  { name: 'Route 1', value: 100 }
];
```

---

## 🚨 Console Errors

### Error: "Cannot read property 'lat' of undefined"

**Fix:**

```typescript
// Add safety checks
if (!jeep.currentPosition) return null;

// Or use optional chaining
position={[jeep.currentPosition?.lat ?? 0, jeep.currentPosition?.lng ?? 0]}
```

### Error: "Maximum update depth exceeded"

**Cause:** State update in render causing infinite loop

**Fix:**

```typescript
// Wrong:
function Component() {
  const [count, setCount] = useState(0);
  setCount(count + 1); // ❌ Infinite loop!
  return <div>{count}</div>;
}

// Right:
function Component() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    setCount(count + 1); // ✅ In useEffect
  }, []);
  
  return <div>{count}</div>;
}
```

### Error: "Element type is invalid"

**Cause:** Wrong import

**Fix:**

```typescript
// Wrong:
import { Navigation } from 'react-router'; ❌

// Right:
import { Navigation } from './components/Navigation'; ✅
```

---

## 🔍 Debugging Tools

### React DevTools

```bash
# Install Chrome extension
# Navigate to Components tab
# Select component to inspect props/state
```

### Console Logging Strategy

```typescript
// Add strategic logs
console.log('🗺️ Map mounted');
console.log('🚌 Jeeps:', jeeps.length);
console.log('📍 Position update:', jeep.id, jeep.currentPosition);
console.log('⏱️ ETA calculation:', eta, 'minutes');
```

### Network Tab

```
# Check if map tiles are loading
# Look for 404 errors
# Verify CSS/JS files loaded
```

---

## 💻 Browser Compatibility

### Supported Browsers

✅ Chrome 90+
✅ Firefox 88+
✅ Safari 14+
✅ Edge 90+

### Known Issues

- **IE11:** Not supported (modern React requires modern browsers)
- **Old Android Browser:** Use Chrome instead

---

## 🛠️ Build Issues

### Issue: Build fails with Vite error

**Solutions:**

```bash
# Clear cache
rm -rf node_modules/.vite

# Reinstall dependencies
rm -rf node_modules
npm install

# Check Node version (should be 16+)
node --version
```

### Issue: "Cannot find module" error

**Fix:**

```bash
# Make sure all dependencies are installed
npm install

# Check package.json for missing packages
```

---

## 🎯 Pre-Demo Checklist

Run through this before your presentation:

- [ ] Open in Chrome (most reliable)
- [ ] Clear browser cache (Ctrl+Shift+R / Cmd+Shift+R)
- [ ] Check console for errors (F12)
- [ ] Test all navigation links
- [ ] Click a stop marker - info panel appears
- [ ] Click a jeep marker - info panel appears
- [ ] Switch to each view - all load properly
- [ ] Check responsive on mobile size
- [ ] Jeeps are moving smoothly
- [ ] Charts are rendering
- [ ] No "undefined" text visible anywhere
- [ ] Night mode toggle works
- [ ] Mobile menu works (if on mobile)

---

## 🆘 Last Resort: Nuclear Option

If everything is broken:

```bash
# 1. Delete everything
rm -rf node_modules
rm -rf .vite
rm package-lock.json

# 2. Fresh install
npm install

# 3. Restart dev server
npm run dev

# 4. Hard refresh browser
# Chrome: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
```

---

## 📞 Quick Fixes Cheat Sheet

| Problem | Quick Fix |
|---------|-----------|
| Map not showing | Check height: `h-screen` or `h-full` |
| Jeeps not moving | Check interval cleanup in useEffect |
| Charts empty | Verify data format matches dataKey |
| 404 on routes | Check RouterProvider in App.tsx |
| Styles not applying | Hard refresh browser (Ctrl+Shift+R) |
| Lag/Performance | Increase interval from 100ms to 200ms |
| Console errors | Open DevTools, read error carefully |

---

## 💡 Pro Tips

1. **Always check browser console first** - Most issues show errors there
2. **Use React DevTools** - Inspect props/state visually
3. **Test in incognito mode** - Rules out extension conflicts
4. **Keep a backup branch** - `git checkout -b backup` before major changes
5. **Take screenshots of working state** - Reference if things break

---

## 🎓 Learning from Errors

Common error patterns and what they mean:

| Error Message | Usually Means |
|---------------|---------------|
| "Cannot read property 'X' of undefined" | Missing null check |
| "X is not a function" | Wrong import or typo |
| "Maximum update depth" | Infinite render loop |
| "Hydration mismatch" | Server/client HTML difference (N/A here) |
| "Invalid hook call" | Hook called outside component |

---

## 🔄 If You Need to Start Over

```bash
# Save your current work
git add .
git commit -m "Checkpoint before reset"

# Create new branch
git checkout -b fresh-start

# Or restore specific file
git checkout HEAD -- src/app/components/LiveMapView.tsx
```

---

**Remember: Most bugs are typos or missing imports. Take a breath, read the error message, and debug systematically. 🐛→✨**

---

Need more help? Check:
- React docs: https://react.dev
- Leaflet docs: https://leafletjs.com/reference.html
- Recharts docs: https://recharts.org/en-US/api
- Tailwind docs: https://tailwindcss.com/docs

**You got this! 💪**
