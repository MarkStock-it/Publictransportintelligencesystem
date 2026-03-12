import React, { createContext, useContext, useState, useRef, useCallback } from 'react';

export interface DriverLocation {
  lat: number;
  lng: number;
  accuracy: number; // metres
  timestamp: number;
}

interface DriverLocationState {
  isSharing: boolean;
  location: DriverLocation | null;
  error: string | null;
  startSharing: () => void;
  stopSharing: () => void;
}

const DriverLocationContext = createContext<DriverLocationState | null>(null);

export function DriverLocationProvider({ children }: { children: React.ReactNode }) {
  const [isSharing, setIsSharing] = useState(false);
  const [location, setLocation] = useState<DriverLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const startSharing = useCallback(() => {
    if (!navigator.geolocation) {
      setError('GPS is not available on this device.');
      return;
    }
    setError(null);
    setIsSharing(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
        setError(null);
      },
      (err) => {
        // Map GeolocationPositionError codes to user-friendly messages
        const messages: Record<number, string> = {
          1: 'Location permission denied.',
          2: 'Position unavailable. Check your GPS signal.',
          3: 'Location request timed out.',
        };
        setError(messages[err.code] ?? 'Unknown location error.');
        setIsSharing(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 2_000 },
    );
  }, []);

  const stopSharing = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsSharing(false);
    setLocation(null);
  }, []);

  return (
    <DriverLocationContext.Provider
      value={{ isSharing, location, error, startSharing, stopSharing }}
    >
      {children}
    </DriverLocationContext.Provider>
  );
}

export function useDriverLocation(): DriverLocationState {
  const ctx = useContext(DriverLocationContext);
  if (!ctx) throw new Error('useDriverLocation must be used within DriverLocationProvider');
  return ctx;
}
