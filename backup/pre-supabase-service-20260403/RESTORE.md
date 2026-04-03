# Backup — Pre-Supabase Service Layer (2026-04-03)

Files backed up before adding:
- `src/app/services/vehicleTrackingService.ts` (new)
- `src/app/hooks/useVehicleTracking.ts` (new)
- `src/app/hooks/usePinpointAlarm.ts` (new)
- `src/app/components/PinpointAlarm.tsx` (new)

## Restore

```bash
cp backup/pre-supabase-service-20260403/useJeepSimulation.ts src/app/hooks/useJeepSimulation.ts
cp backup/pre-supabase-service-20260403/useJeepAlarm.ts      src/app/hooks/useJeepAlarm.ts
cp backup/pre-supabase-service-20260403/useEnhancedJeepSimulation.ts src/app/hooks/useEnhancedJeepSimulation.ts
# Then delete the new files added:
rm src/app/services/vehicleTrackingService.ts
rm src/app/hooks/useVehicleTracking.ts
rm src/app/hooks/usePinpointAlarm.ts
rm src/app/components/PinpointAlarm.tsx
```
