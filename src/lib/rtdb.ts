// src/lib/rtdb.ts
import { ref, onValue, get, update, type DatabaseReference } from "firebase/database";
import { db, ensureAnonAuth } from "./firebase";

export type StationId = string | number;
export type PortId = string;

export type EnvData = { hum?: number; temp?: number; ts?: number };
export type PzemData = { e?: number; hz?: number; i?: number; p?: number; pf?: number; ts?: number; u?: number };
export type PortStatus = { isCharging?: boolean; sessionId?: string; userId?: string; startTs?: number; stopTs?: number; fault?: string; ts?: number };

const stationEnvRef = (stationId: StationId) => ref(db, `stations/${stationId}/env`);
const portPzemRef = (stationId: StationId, port: PortId) => ref(db, `stations/${stationId}/ports/${port}/pzem`);
const portStatusRef = (stationId: StationId, port: PortId) => ref(db, `stations/${stationId}/ports/${port}/status`);

// --- READ (one-shot) ---
export async function readEnv(stationId: StationId) {
  await ensureAnonAuth();
  const snap = await get(stationEnvRef(stationId));
  return (snap.val() ?? null) as EnvData | null;
}

export async function readPzem(stationId: StationId, port: PortId) {
  await ensureAnonAuth();
  const snap = await get(portPzemRef(stationId, port));
  return (snap.val() ?? null) as PzemData | null;
}

// --- LISTEN (realtime) ---
function listenRaw<T>(r: DatabaseReference, cb: (value: T | null) => void) {
  return onValue(
    r,
    (snap) => cb((snap.val() ?? null) as T | null),
    (err) => {
      const anyErr = err as unknown as { code?: string; message?: string };
      console.error("[RTDB] onValue error:", anyErr.code ?? "unknown", anyErr.message ?? String(err));
      cb(null);
    }
  );
}

// đảm bảo auth xong rồi mới subscribe
export function listenEnv(stationId: StationId, cb: (v: EnvData | null) => void) {
  let unsub: (() => void) | null = null;
  let cancelled = false;

  ensureAnonAuth()
    .then(() => {
      if (cancelled) return;
      unsub = listenRaw<EnvData>(stationEnvRef(stationId), cb);
    })
    .catch((e) => {
      console.error("[RTDB] ensureAnonAuth failed:", e);
      cb(null);
    });

  return () => {
    cancelled = true;
    if (unsub) unsub();
  };
}

export function listenPzem(stationId: StationId, port: PortId, cb: (v: PzemData | null) => void) {
  let unsub: (() => void) | null = null;
  let cancelled = false;

  ensureAnonAuth()
    .then(() => {
      if (cancelled) return;
      unsub = listenRaw<PzemData>(portPzemRef(stationId, port), cb);
    })
    .catch((e) => {
      console.error("[RTDB] ensureAnonAuth failed:", e);
      cb(null);
    });

  return () => {
    cancelled = true;
    if (unsub) unsub();
  };
}

export function listenCharging(stationId: StationId, port: PortId, cb: (v: boolean | null) => void) {
  let unsub: (() => void) | null = null;
  let cancelled = false;

  ensureAnonAuth()
    .then(() => {
      if (cancelled) return;
      unsub = listenRaw<PortStatus>(portStatusRef(stationId, port), (status) => {
        cb(status?.isCharging ?? null);
      });
    })
    .catch((e) => {
      console.error("[RTDB] ensureAnonAuth failed:", e);
      cb(null);
    });

  return () => {
    cancelled = true;
    if (unsub) unsub();
  };
}

// --- WRITE / UPDATE ---
export async function setCharging(stationId: StationId, port: PortId, isCharging: boolean) {
  await ensureAnonAuth();
  await update(portStatusRef(stationId, port), { isCharging });
}
