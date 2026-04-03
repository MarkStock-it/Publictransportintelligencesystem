import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

export interface AlarmJeepney {
  id: string;
  lat: number;
  lng: number;
  route: string;
}

interface UseJeepAlarmArgs {
  targetJeepId: string | null;
  thresholdKm: number;
  userLat: number | null;
  userLng: number | null;
  allJeepneys: AlarmJeepney[];
}

interface UseJeepAlarmResult {
  isActive: boolean;
  hasTriggered: boolean;
  trackedJeep: AlarmJeepney | null;
  distanceKm: number | null;
  cancelAlarm: () => void;
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function triggerBrowserNotification(title: string, body: string): void {
  if (!('Notification' in window)) return;

  const show = () => {
    new Notification(title, { body, tag: `ptis-alarm-${Date.now()}` });
  };

  if (Notification.permission === 'granted') {
    show();
    return;
  }

  if (Notification.permission !== 'denied') {
    void Notification.requestPermission().then((permission) => {
      if (permission === 'granted') show();
    });
  }
}

function playAlertBeep(): void {
  const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;

  const ctx = new AudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, ctx.currentTime);

  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.3);

  osc.onended = () => {
    void ctx.close();
  };
}

export function useJeepAlarm({
  targetJeepId,
  thresholdKm,
  userLat,
  userLng,
  allJeepneys,
}: UseJeepAlarmArgs): UseJeepAlarmResult {
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [hasTriggered, setHasTriggered] = useState(false);

  const trackedJeep = useMemo(
    () => (targetJeepId ? allJeepneys.find((j) => j.id === targetJeepId) ?? null : null),
    [allJeepneys, targetJeepId],
  );

  // Reset one-time trigger state when alarm target/threshold changes.
  useEffect(() => {
    setHasTriggered(false);
    setDistanceKm(null);
  }, [targetJeepId, thresholdKm]);

  useEffect(() => {
    if (!targetJeepId || userLat === null || userLng === null || hasTriggered) return;

    const runCheck = () => {
      const jeep = allJeepneys.find((j) => j.id === targetJeepId);
      if (!jeep) {
        setDistanceKm(null);
        return;
      }

      const km = haversineKm(userLat, userLng, jeep.lat, jeep.lng);
      setDistanceKm(km);

      if (km <= thresholdKm) {
        const message = `${jeep.id} is arriving soon!`;
        triggerBrowserNotification('PTIS Jeepney Alarm', message);
        playAlertBeep();
        toast.success(message);
        setHasTriggered(true); // one-time alert
      }
    };

    runCheck();
    const interval = window.setInterval(runCheck, 3000);

    return () => window.clearInterval(interval);
  }, [allJeepneys, hasTriggered, targetJeepId, thresholdKm, userLat, userLng]);

  const isActive = Boolean(targetJeepId) && !hasTriggered;

  const cancelAlarm = () => {
    setHasTriggered(true);
    setDistanceKm(null);
  };

  return {
    isActive,
    hasTriggered,
    trackedJeep,
    distanceKm,
    cancelAlarm,
  };
}
