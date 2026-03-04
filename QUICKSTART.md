# ⚡ JeepWise Quick Start Guide

Get your demo running in 5 minutes.

---

## 🚀 Installation

### 1. Install Dependencies

```bash
npm install
```

This installs:
- React + TypeScript
- React Router for navigation
- Leaflet for maps
- Recharts for data visualization
- Motion for animations
- Tailwind CSS for styling

### 2. Start Development Server

```bash
npm run dev
```

The app should open at `http://localhost:5173`

---

## 🎯 First Look

### What You'll See

1. **Live Map View** (Default)
   - Interactive map centered on Manila
   - 10 jeeps moving on 4 routes
   - Click stops to see arrivals
   - Click jeeps to see details

2. **Navigation Bar** (Top)
   - Live Map
   - Route Intelligence
   - LGU Dashboard
   - Low Bandwidth Mode

3. **Route Legend** (Top Left)
   - 4 color-coded routes
   - Active jeep count per route

4. **Stats Bar** (Bottom)
   - Total active jeeps
   - Live tracking indicator

---

## 🧪 Test Each Feature

### Live Map View

✅ **Watch jeeps move**
- Jeeps should smoothly animate along routes
- Different colors = different occupancy levels

✅ **Click a stop marker** (blue dots)
- Info panel slides up from bottom
- Shows next 3 arrivals with ETA
- Shows occupancy per jeep

✅ **Click a jeep marker** (colored circles)
- Info panel appears on right
- Shows route name, occupancy, speed
- Shows passenger count

✅ **Toggle night mode** (moon icon, top right)
- Map switches to dark tiles

### Route Intelligence

Navigate: Click "Route Intelligence" in nav bar

✅ **System metrics** (top row)
- 4 cards with totals
- Numbers should be animated

✅ **Route performance cards**
- 4 route cards in 2x2 grid
- Each shows: active jeeps, interval, duration, reliability
- Occupancy bar animates
- Peak hours show as chips

✅ **Predictive insights** (bottom)
- Blue gradient panel
- 3 insight cards

### LGU Dashboard

Navigate: Click "LGU Dashboard" in nav bar

✅ **Key metrics** (top row)
- 4 gradient cards
- Animated numbers

✅ **Imbalance alerts** (if visible)
- Yellow/amber alert box
- Shows understaffed/overstaffed routes

✅ **Charts** (should all render)
- Bar chart: Route congestion
- Pie chart: Fleet distribution  
- Area chart: 24-hour demand
- Horizontal bar: Wait times

✅ **Policy recommendations** (bottom)
- Blue gradient panel
- 3 recommendation cards

### Low Bandwidth Mode

Navigate: Click "Low Bandwidth Mode" in nav bar

✅ **Route list**
- Text-only interface
- Each route shows next arrivals
- Click "View all stops" to expand

✅ **Quick stats** (top)
- Active jeeps count
- Routes count

---

## 📊 Expected Numbers

Your simulation should show approximately:

- **Total Jeeps:** 10 active
- **Routes:** 4 routes
- **Current Passengers:** ~150-180 total
- **Active Stops:** 18 stops
- **Avg Wait Time:** ~8-9 minutes
- **System Efficiency:** ~89%

Numbers will vary slightly due to randomization.

---

## 🎨 Visual Check

### Colors

- **Routes:**
  - Teal: Route 1 (Divisoria-Quiapo-España)
  - Amber/Orange: Route 2 (Cubao-SM North-Fairview)
  - Purple: Route 3 (Makati-Guadalupe-Shaw)
  - Red: Route 4 (Monumento-Balintawak-Quezon Ave)

- **Occupancy:**
  - Green circle: Seats available
  - Yellow circle: Standing room
  - Red circle: Full

- **Brand:**
  - Navy blue: Primary (navigation, headings)
  - Teal: Accent (logo, highlights)
  - White: Cards and panels

### Layout

- **Desktop:** Side-by-side layouts, full charts
- **Mobile:** Stacked layouts, hamburger menu

---

## ⚠️ Common First-Time Issues

### Issue: Map tiles not loading

**Fix:** Check internet connection. Map requires online tile service.

### Issue: Jeeps not moving

**Fix:** Refresh page (Ctrl+R). Animation starts on page load.

### Issue: Console errors

**Fix:** Open DevTools (F12), check console. Most common: missing imports.

### Issue: Charts not showing

**Fix:** Hard refresh (Ctrl+Shift+R). Recharts may need cache clear.

---

## 🎬 Demo Prep

Before your presentation:

### 5 Minutes Before

1. **Close unnecessary tabs** - Keep only demo tab open
2. **Zoom to 100%** - Reset browser zoom (Ctrl+0)
3. **Go fullscreen** - F11 on Windows, Cmd+Ctrl+F on Mac
4. **Brightness to max** - Ensure visibility on projector
5. **Clear console** - F12, then clear (might look cluttered)

### 1 Minute Before

1. **Refresh page** - Fresh start, reset simulation
2. **Start on Live Map** - Default view, most impressive
3. **Check jeeps moving** - Verify animation working
4. **Close DevTools** - F12 to close console view

### During Demo

1. **Navigate slowly** - Give viewers time to see features
2. **Point at screen** - Physically indicate what you're showing
3. **Use demo script** - Follow DEMO_SCRIPT.md talking points

---

## 🎯 Demo Flow Reminder

**3-Minute Version:**

```
1. Live Map (30s)
   - Show moving jeeps
   - Click stop → show ETA panel
   - Click jeep → show occupancy info

2. Route Intelligence (30s)
   - Point to system metrics
   - Show route performance cards
   - Point to predictive insights

3. LGU Dashboard (30s)
   - Show key metrics
   - Point to charts (congestion, demand)
   - Show policy recommendations

4. Wrap-up (90s)
   - Quick mention of low-bandwidth mode
   - State impact: "Commuters get visibility, LGUs get data"
   - Close: "This is an ecosystem, not just a tracker"
```

---

## 🔧 Developer Tips

### Hot Reload

- Vite HMR is enabled
- Edit files and see changes instantly
- No need to refresh browser

### Inspect State

```typescript
// Add to any component
console.log('Jeeps:', jeeps);
console.log('Routes:', routes);
console.log('Selected Stop:', selectedStop);
```

### Modify Simulation Speed

In `useJeepSimulation.ts`:

```typescript
// Faster movement
const speedFactor = (jeep.speed / 15) * 0.004; // was 0.002

// Slower movement  
const speedFactor = (jeep.speed / 15) * 0.001; // was 0.002

// Update frequency
setInterval(() => { /* ... */ }, 50); // was 100ms
```

### Change Routes/Jeeps

Edit `src/app/data/jeepney-data.ts`:

```typescript
// Add more jeeps to INITIAL_JEEPS array
// Add more routes to ROUTES array
// Modify stop locations
```

---

## 📱 Mobile Testing

### Test on Real Device

```bash
# Get your local IP
# Windows: ipconfig
# Mac/Linux: ifconfig

# Your local IP might be like: 192.168.1.100
# Access on mobile: http://192.168.1.100:5173
```

### Mobile DevTools

```
Chrome DevTools → Toggle device toolbar (Ctrl+Shift+M)
Test different screen sizes:
- iPhone SE (375px)
- iPad (768px)
- Desktop (1024px+)
```

---

## 🏗️ Build for Production

### Create Production Build

```bash
npm run build
```

Output goes to `/dist` folder.

### Test Production Build Locally

```bash
# Install serve
npm install -g serve

# Serve dist folder
serve -s dist

# Open http://localhost:3000
```

### Deploy

**Vercel:**
```bash
npm install -g vercel
vercel
```

**Netlify:**
```bash
npm install -g netlify-cli
netlify deploy
```

**GitHub Pages:**
```bash
# Build
npm run build

# Deploy dist folder to gh-pages branch
```

---

## 📚 File Structure Reference

```
jeepwise/
├── src/
│   ├── app/
│   │   ├── App.tsx              ← Main app entry
│   │   ├── routes.tsx           ← Router config
│   │   ├── components/
│   │   │   ├── LiveMapView.tsx  ← Main map
│   │   │   ├── RouteIntelligence.tsx
│   │   │   ├── LGUDashboard.tsx
│   │   │   ├── LowBandwidthMode.tsx
│   │   │   └── Navigation.tsx   ← Top nav bar
│   │   ├── data/
│   │   │   └── jeepney-data.ts  ← Routes, jeeps, calcs
│   │   └── hooks/
│   │       └── useJeepSimulation.ts ← Live updates
│   └── styles/
│       └── index.css            ← CSS imports
├── README.md                    ← Project overview
├── DEMO_SCRIPT.md              ← Presentation guide
├── TECHNICAL.md                ← Deep dive docs
├── TROUBLESHOOTING.md          ← Debug help
└── package.json                ← Dependencies
```

---

## 🎓 Key Concepts

### Real-time Simulation

Jeeps update every 100ms:
- Progress increments along route
- GPS coordinates interpolated
- Occupancy changes at stops

### ETA Calculation

```typescript
// Simplified formula
ETA = (remaining_distance / speed) * 60 minutes
```

### Occupancy Levels

- **Available:** ≤60% capacity (green)
- **Standing:** 60-110% capacity (yellow)
- **Full:** >110% capacity (red)

---

## ✅ Ready Checklist

Before presenting:

- [ ] npm install completed successfully
- [ ] npm run dev starts without errors
- [ ] Browser shows Live Map with moving jeeps
- [ ] All 4 navigation links work
- [ ] Stop click shows info panel
- [ ] Jeep click shows info panel
- [ ] Charts render in LGU Dashboard
- [ ] Low Bandwidth Mode loads
- [ ] No console errors (F12 to check)
- [ ] Mobile view works (DevTools responsive mode)
- [ ] Reviewed DEMO_SCRIPT.md
- [ ] Practiced demo flow at least once

---

## 🆘 Emergency Contacts

If something breaks during presentation:

1. **Refresh page** (Ctrl+R)
2. **Hard refresh** (Ctrl+Shift+R)
3. **Close and reopen browser**
4. **Have backup deployed version** (Vercel URL as fallback)

---

## 🎉 You're Ready!

Your JeepWise demo is production-ready. Key strengths:

✅ **Complete system** - Not just one feature
✅ **Visual appeal** - Smooth animations, modern UI
✅ **Real-world thinking** - LGU dashboard, low-bandwidth mode
✅ **Social impact** - Commuter safety, urban planning
✅ **Technical depth** - React Router, Leaflet, Recharts, TypeScript

**This isn't just a tracker. It's an ecosystem.**

Now go dominate that hackathon! 🏆

---

## 📞 Quick Reference

| Need | Command |
|------|---------|
| Install | `npm install` |
| Run | `npm run dev` |
| Build | `npm run build` |
| DevTools | `F12` |
| Refresh | `Ctrl+R` |
| Hard Refresh | `Ctrl+Shift+R` |
| Fullscreen | `F11` |
| Zoom Reset | `Ctrl+0` |

---

**Last updated:** Ready for demo! ✨
