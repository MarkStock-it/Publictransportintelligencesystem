# Supabase Vehicle Tracking & Pinpoint Alarm Setup Guide

Generated: 2026-04-03

## 📦 New Files Created

### Service Layer
- **`src/app/services/vehicleTrackingService.ts`** — Hybrid real-time vehicle tracking with Supabase Realtime (WebSocket) + fallback polling
- **Inline types** — Supabase types are declared inline so the service compiles without the package installed

### React Hooks  
- **`src/app/hooks/useVehicleTracking.ts`** — Hook for subscribing to live vehicle updates (typed for 'taxi' and 'jeepney')
- **`src/app/hooks/usePinpointAlarm.ts`** — Hook for pinpoint location alarm (set pin, radius, alarm on entry)

### Components
- **`src/app/components/PinpointAlarm.tsx`** — UI component for pinpoint alarm (drop pins on map, radius slider, status panel)

### Type Definitions
- **`src/vite-env.d.ts`** — Added Supabase env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## ⚙️ Setup Steps

### Step 1: Install Supabase Package
```bash
npm install @supabase/supabase-js
```

### Step 2: Add Environment Variables
Create a `.env` file in the project root:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Get these from your Supabase project dashboard: **Settings → API**

### Step 3: Create Supabase Table
In your Supabase project, run this SQL in the **SQL Editor**:

```sql
-- Create vehicle_locations table
CREATE TABLE vehicle_locations (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('taxi', 'jeepney')),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  route TEXT,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  passenger_count INT,
  capacity INT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE vehicle_locations ENABLE ROW LEVEL SECURITY;

-- Allow public reads (adjust policy for your auth as needed)
CREATE POLICY "public_read_all" ON vehicle_locations
  FOR SELECT
  USING (true);

-- Allow public writes (for demo; restrict in production)
CREATE POLICY "public_write_all" ON vehicle_locations
  FOR INSERT
  WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE vehicle_locations;

-- Create index on type and updated_at for queries
CREATE INDEX idx_vehicle_locations_type ON vehicle_locations(type);
CREATE INDEX idx_vehicle_locations_updated_at ON vehicle_locations(updated_at DESC);
```

### Step 4: Integrate Into Your App
The service runs as a **singleton** that connects on first use. To use it:

```typescript
import { useVehicleTracking } from '@/hooks/useVehicleTracking';
import { usePinpointAlarm } from '@/hooks/usePinpointAlarm';
import { PinpointAlarm } from '@/components/PinpointAlarm';

function MyMapComponent() {
  const { jeepneys, taxis, connectionState, updateLocation } = useVehicleTracking();

  return (
    <MapContainer ...>
      <TileLayer ... />
      <PinpointAlarm />
      {/* Render jeepneys as markers, etc. */}
    </MapContainer>
  );
}
```

## 🚀 Features

### Vehicle Tracking Service
✅ **Hybrid Real-Time**  
- Primary: Supabase Realtime (WebSocket)  
- Fallback: Polling every 5s if WebSocket disconnected

✅ **Typed by Vehicle Type**  
- Separate arrays for 'taxi' vs 'jeepney' via `useVehicleTracking()`

✅ **Optimized Updates**  
- Map-keyed state prevents re-renders unless position actually changed

✅ **Two Core Methods**
- `updateLocation()` — Upsert a vehicle's live position
- `getNearbyVehicles()` — Query vehicles within a radius

### Pinpoint Alarm Feature
✅ **GPS-Powered**  
- Uses `navigator.geolocation.watchPosition()` for live geolocation

✅ **Visual Map Interface**  
- Click "Set Pin" then tap the map to drop a pin  
- Live circle overlay shows alarm radius (50m - 10km)

✅ **Audio + Notifications**
- 3-beep alarm via Web Audio API (1046 Hz, C6)
- Browser notification (requests permission on first alarm)

✅ **One-Shot Alarm**  
- Fires once when user enters radius  
- "Reset" button to re-arm after trigger

## 🔌 API Examples

### Subscribe to Live Vehicle Updates
```typescript
const { jeepneys, taxis, connectionState } = useVehicleTracking();

useEffect(() => {
  console.log('Jeepneys near me:', jeepneys.length);
}, [jeepneys]);
```

### Update a Vehicle's Position
```typescript
const { updateLocation } = useVehicleTracking();

await updateLocation({
  id: 'jeep-A123',
  type: 'jeepney',
  lat: 10.3157,
  lng: 123.8854,
  route: '04L - Lahug - Carbon',
  speed: 25.5,
  heading: 180,
  passengerCount: 12,
  capacity: 18,
});
```

### Query Nearby Vehicles
```typescript
const { getNearbyVehicles } = useVehicleTracking();

const nearby = await getNearbyVehicles({
  lat: 10.3157,
  lng: 123.8854,
  radiusKm: 1,
  type: 'jeepney', // optional
});
```

### Use Pinpoint Alarm
```typescript
const alarm = usePinpointAlarm();

// User clicks map to set pin, then uses UI to adjust radius
// When user moves into the radius zone:
// → 3 beeps play, notification fires, isArmed becomes false

// Manually set a pin:
alarm.setPin({ lat: 10.3157, lng: 123.8854, label: 'My Office' });
alarm.setRadiusMeters(300);

// Check current distance:
console.log(`Distance to pin: ${alarm.distanceMeters} m`);
```

## 🎯 Graceful Degradation

If `@supabase/supabase-js` is not installed or env vars are missing:
- `getVehicleTrackingService()` returns `null`
- `useVehicleTracking()` returns empty arrays and `isSimulationOnly: true`
- The app continues using simulated data
- No errors or warnings besides a console message

## 🔒 Production Checklist

- [ ] Supabase RLS policies are set correctly (don't expose private vehicle data)
- [ ] API keys used are **anon keys** only (never expose service/admin keys)
- [ ] Environment variables are in `.env.local` (not committed)
- [ ] Test failover: stop Supabase, confirm polling kicks in
- [ ] Geolocation permissions requested gracefully  
- [ ] Audio/notification permissions requested on first alarm
- [ ] Deploy `.env.production` with real Supabase credentials

## 📚 Further Reading

- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)
- [Supabase JS Client](https://supabase.com/docs/reference/javascript)
- [react-leaflet API](https://react-leaflet.js.org/)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)

---

**Backup location:** `backup/pre-supabase-service-20260403/`  
Restore via: See `backup/pre-supabase-service-20260403/RESTORE.md`
