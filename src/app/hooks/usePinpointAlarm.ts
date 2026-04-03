/**
 * usePinpointAlarm.ts
 *
 * Hook that lets the user drop a pin at any map coordinate, configure a
 * radius, then watches the device's GPS position and fires an alarm the
 * moment the user enters the radius.
 *
 * Features
 * ─────────
 * • Tracks real GPS position via `navigator.geolocation.watchPosition`
 * • Plays a multi-beep audio alert using the Web Audio API
 * • Sends a browser notification (requests permission on first alarm)
 * • One-shot: alarm fires once and then must be reset manually
 * • Works independently of Supabase — pure client-side logic
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PinLocation {
  lat: number;
  lng: number;
  label?: string;
}

export interface UsePinpointAlarmResult {
  /** The currently pinned location, or null if no pin is set. */
  pin: PinLocation | null;
  /** Alarm radius in metres. */
  radiusMeters: number;
  /** Live distance from user to pin (metres). Null when GPS unavailable. */
  distanceMeters: number | null;
  /** True when an alarm is armed and waiting to fire. */
  isArmed: boolean;
  /** True once the alarm has fired for the current pin/radius config. */
  hasTriggered: boolean;
  /** True while waiting for the first GPS fix. */
  isLocating: boolean;
  /** GeolocationPositionError code (1=denied, 2=unavail, 3=timeout), or null. */
  geoError: number | null;
  /** User's current GPS position. */
  userPosition: { lat: number; lng: number } | null;
  /** Set or update the pin location. Arms the alarm automatically. */
  setPin: (location: PinLocation) => void;
  /** Update the alarm radius (in metres). Min 50 m, max 10 000 m. */
  setRadiusMeters: (meters: number) => void;
  /** Disarm and clear the alarm (keeps the pin in place). */
  cancelAlarm: () => void;
  /** Remove the pin and disarm the alarm. */
  clearPin: () => void;
  /** Re-arm the alarm for the current pin after it has triggered. */
  resetAlarm: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000; // Earth radius in metres
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function playAlarmBeeps(count = 3): void {
  const AudioCtx =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;

  const ctx = new AudioCtx();

  for (let i = 0; i < count; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const startAt = ctx.currentTime + i * 0.4;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046, startAt); // C6

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.22, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startAt);
    osc.stop(startAt + 0.32);

    // Release AudioContext after last beep
    if (i === count - 1) {
      osc.onended = () => void ctx.close();
    }
  }
}

function sendNotification(title: string, body: string): void {
  if (!('Notification' in window)) return;

  const show = () =>
    new Notification(title, { body, tag: 'ptis-pinpoint-alarm' });

  if (Notification.permission === 'granted') {
    show();
  } else if (Notification.permission !== 'denied') {
    void Notification.requestPermission().then((p) => {
      if (p === 'granted') show();
    });
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const DEFAULT_RADIUS_M = 300;
const MIN_RADIUS_M = 50;
const MAX_RADIUS_M = 10_000;

export function usePinpointAlarm(): UsePinpointAlarmResult {
  const [pin, setPin_] = useState<PinLocation | null>(null);
  const [radiusMeters, setRadiusMeters_] = useState(DEFAULT_RADIUS_M);
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [isArmed, setIsArmed] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState<number | null>(null);

  // Keep a ref to the latest armed state so the geolocation callback doesn't
  // stale-close over the initial value.
  const alarmStateRef = useRef({ isArmed, hasTriggered, pin, radiusMeters });
  alarmStateRef.current = { isArmed, hasTriggered, pin, radiusMeters };

  // ── Geolocation watcher ────────────────────────────────────────────────

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError(2); // POSITION_UNAVAILABLE
      return;
    }

    setIsLocating(true);

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;

        setUserPosition({ lat: userLat, lng: userLng });
        setIsLocating(false);
        setGeoError(null);

        const { isArmed: armed, hasTriggered: triggered, pin: p, radiusMeters: r } =
          alarmStateRef.current;

        if (!p) {
          setDistanceMeters(null);
          return;
        }

        const dist = haversineMeters(userLat, userLng, p.lat, p.lng);
        setDistanceMeters(dist);

        if (armed && !triggered && dist <= r) {
          // Alarm fires!
          setHasTriggered(true);
          setIsArmed(false);

          const label = p.label ?? 'your pinned location';
          const message = `You have reached ${label}!`;

          playAlarmBeeps(3);
          sendNotification('PTIS Pinpoint Alarm', message);
          toast.success(message, { duration: 6000 });
        }
      },
      (err) => {
        setGeoError(err.code);
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 5_000,
      },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []); // run once — state is read via ref

  // ── Recalculate distance when pin or user position changes ────────────

  useEffect(() => {
    if (!pin || !userPosition) {
      setDistanceMeters(null);
      return;
    }
    setDistanceMeters(haversineMeters(userPosition.lat, userPosition.lng, pin.lat, pin.lng));
  }, [pin, userPosition]);

  // ── Public actions ─────────────────────────────────────────────────────

  const setPin = useCallback((location: PinLocation) => {
    setPin_(location);
    setHasTriggered(false);
    setIsArmed(true);
  }, []);

  const setRadiusMeters = useCallback((meters: number) => {
    const clamped = Math.max(MIN_RADIUS_M, Math.min(MAX_RADIUS_M, Math.round(meters)));
    setRadiusMeters_(clamped);
    // Re-arm when radius changes so the updated threshold takes effect.
    setHasTriggered(false);
    setIsArmed(true);
  }, []);

  const cancelAlarm = useCallback(() => {
    setIsArmed(false);
    setHasTriggered(true);
  }, []);

  const clearPin = useCallback(() => {
    setPin_(null);
    setIsArmed(false);
    setHasTriggered(false);
    setDistanceMeters(null);
  }, []);

  const resetAlarm = useCallback(() => {
    setHasTriggered(false);
    setIsArmed(true);
  }, []);

  return {
    pin,
    radiusMeters,
    distanceMeters,
    isArmed,
    hasTriggered,
    isLocating,
    geoError,
    userPosition,
    setPin,
    setRadiusMeters,
    cancelAlarm,
    clearPin,
    resetAlarm,
  };
}
