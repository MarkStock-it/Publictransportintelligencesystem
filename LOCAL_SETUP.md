# 🚀 Quick Start - Local Setup

## Problem Summary
The code you just generated needs one critical step before it will work locally:

**You must run `npm install` to fetch the missing Supabase package.**

## 3 Simple Steps to Get It Running

### Step 1️⃣: Install Dependencies
```bash
cd /workspaces/Publictransportintelligencesystem
npm install
```

This installs:
- `@supabase/supabase-js` — Supabase client (adds ~200kb)  
- All other required packages

**Expected time:** 1-2 minutes

---

### Step 2️⃣: Add Environment Variables
Create a `.env` file in the project root:

```bash
# .env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Don't have a Supabase project yet?**  
→ The app will work fine without these! It gracefully falls back to simulation data.  
→ To enable live Supabase tracking, follow [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)

---

### Step 3️⃣: Start the Dev Server

```bash
npm run dev:full
```

This starts:
- **Backend** on `http://localhost:5001` (JWT auth server)
- **Frontend** on `http://localhost:5173` (Vite dev server)

---

## ✅ How to Know It's Working

**Terminal should show:**
```
VITE v5.x.x  ready in 425 ms

➜  Local:   http://localhost:5173/
➜  Press h to show help
```

**Browser shows:**  
✅ App loads without blank screen  
✅ No red error overlays in console  
✅ Map displays with jeepneys moving  

---

## 🔧 Troubleshooting

### "Cannot find module '@supabase/supabase-js'"  
→ **Run:** `npm install`

### "Property 'env' does not exist on type 'ImportMeta'"  
→ **Run:** `npm install` (TypeScript errors clear once dependencies resolve)

### "Port 5173 already in use"  
→ **Option A:** Kill the process: `pkill -f 'node.*vite'`  
→ **Option B:** Use a different port: `npm run dev -- --port 5174`

### No jeepneys showing on map  
→ This is normal without Supabase credentials. The simulation data hook is still working, but needs the component properly mounted.

---

## 📋 File Structure (What Was Added)

```
src/
├── app/
│   ├── services/
│   │   └── vehicleTrackingService.ts        ← Supabase hybrid real-time
│   ├── hooks/
│   │   ├── useVehicleTracking.ts             ← Live vehicle hook
│   │   └── usePinpointAlarm.ts               ← GPS alarm hook
│   ├── components/
│   │   ├── PinpointAlarm.tsx                 ← Alarm UI component
│   │   └── IntegratedMapExample.tsx          ← Example usage
│   └── vite-env.d.ts                         ← Type definitions
├── types.supabase.d.ts                       ← Supabase type stubs
└── vite-env.d.ts                             ← Env var types
```

---

## 🎯 Next Steps

1. Run the three commands above
2. Open `http://localhost:5173` in your browser
3. Check the browser console (F12) for any errors
4. To test Pinpoint Alarm: enable geolocation permissions and use the alarm panel
5. To enable Supabase live tracking: follow [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)

---

## 📞 If Issues Persist

**Try these commands in order:**

```bash
# Full clean reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
rm -rf .vite

# Run dev again
npm run dev:full
```

Then check the console output for specific errors.

---

**All set?** → Try navigating to the Live Map page and verify vehicles show up! 🗺️
