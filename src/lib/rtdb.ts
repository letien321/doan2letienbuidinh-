import { ref, onValue, get, update, push, type DatabaseReference } from "firebase/database";
import { db, ensureAnonAuth } from "./firebase";

export type StationId = string | number;
export type PortId = string;

export type EnvData = { hum?: number; temp?: number; ts?: number };
export type PzemData = { e?: number; hz?: number; i?: number; p?: number; pf?: number; ts?: number; u?: number };
export type PortStatus = {
  isCharging?: boolean;
  sessionId?: string;
  userId?: string; // thường là RFID/cardId
  startTs?: number;
  stopTs?: number;
  fault?: string;
  ts?: number;
};

export type UserInfo = { name?: string; email?: string };

export type SessionData = {
  costVnd?: number;
  energyKwh?: number;
  port?: string;
  reason?: string;
  startTs?: number;
  stopTs?: number;
  updatedTs?: number;
  userId?: string; // có thể là RFID hoặc uid tuỳ bạn ghi
  stationId?: number;
};

const stationEnvRef = (stationId: StationId) => ref(db, `stations/${stationId}/env`);
const portPzemRef = (stationId: StationId, port: PortId) => ref(db, `stations/${stationId}/ports/${port}/pzem`);
const portStatusRef = (stationId: StationId, port: PortId) => ref(db, `stations/${stationId}/ports/${port}/status`);

const sessionRef = (sessionId: string) => ref(db, `sessions/${sessionId}`);
const userRef = (uid: string) => ref(db, `users/${uid}`);
const rfidMapRef = (rfid: string) => ref(db, `rfidMap/${rfid}`);

type Settings = {
  tempThresholdC?: number;
  priceVndPerKwh?: number;
};
const settingsRef = () => ref(db, "settings");

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

export async function readSettings() {
  await ensureAnonAuth();
  const snap = await get(settingsRef());
  return (snap.val() ?? null) as Settings | null;
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
function listenWithAuth<T>(r: DatabaseReference, cb: (v: T | null) => void) {
  let unsub: (() => void) | null = null;
  let cancelled = false;

  ensureAnonAuth()
    .then(() => {
      if (cancelled) return;
      unsub = listenRaw<T>(r, cb);
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

export function listenEnv(stationId: StationId, cb: (v: EnvData | null) => void) {
  return listenWithAuth<EnvData>(stationEnvRef(stationId), cb);
}

export function listenPzem(stationId: StationId, port: PortId, cb: (v: PzemData | null) => void) {
  return listenWithAuth<PzemData>(portPzemRef(stationId, port), cb);
}

export function listenCharging(stationId: StationId, port: PortId, cb: (v: boolean | null) => void) {
  return listenWithAuth<PortStatus>(portStatusRef(stationId, port), (status) => {
    cb(status?.isCharging ?? null);
  });
}

// ✅ mới: listen full status
export function listenStatus(stationId: StationId, port: PortId, cb: (v: PortStatus | null) => void) {
  return listenWithAuth<PortStatus>(portStatusRef(stationId, port), cb);
}

// ✅ mới: listen session theo sessionId
export function listenSession(sessionId: string, cb: (v: SessionData | null) => void) {
  return listenWithAuth<SessionData>(sessionRef(sessionId), cb);
}

// ✅ mới: map RFID -> uid (rfidMap/{rfid} = uid)
export function listenRfidUid(rfid: string, cb: (uid: string | null) => void) {
  return listenWithAuth<string>(rfidMapRef(rfid), (v) => cb(v ?? null));
}

// ✅ mới: listen users/{uid}
export function listenUser(uid: string, cb: (v: UserInfo | null) => void) {
  return listenWithAuth<UserInfo>(userRef(uid), cb);
}

export function listenSettings(cb: (v: Settings | null) => void) {
  return listenWithAuth<Settings>(settingsRef(), cb);
}

// --- WRITE / UPDATE ---
export async function setCharging(stationId: StationId, port: PortId, isCharging: boolean) {
  await ensureAnonAuth();
  await update(portStatusRef(stationId, port), { isCharging });
}

export async function setTempThresholdC(tempThresholdC: number) {
  await ensureAnonAuth();
  await update(settingsRef(), { tempThresholdC });
}

// --- BIND RFID -> UID (AUTO) ---
// cardId = mã thẻ (vd: 637E2256)
// uid = uid của user (vd: 6531312 hoặc username/login id)
export async function rebindCardToUid(params: {
  cardId: string;
  uid: string;
  name?: string;
  email?: string;
}) {
  const cardId = (params.cardId || "").trim();
  const uid = (params.uid || "").trim();
  if (!cardId) throw new Error("Missing cardId");
  if (!uid) throw new Error("Missing uid");

  await ensureAnonAuth();

  // update nhiều path 1 lần
  await update(ref(db), {
    [`rfidMap/${cardId}`]: uid,              // ✅ thẻ -> uid
    ...(params.name ? { [`users/${uid}/name`]: params.name } : {}),
    ...(params.email ? { [`users/${uid}/email`]: params.email } : {}),
    [`users/${uid}/cardId`]: cardId,         // (optional) lưu ngược lại
    [`users/${uid}/updatedTs`]: Date.now(),
  });

  return true;
}

// --- CREATE USER (AUTO UID) + BIND CARD ---
// Tạo user mới (uid tự sinh) và bind thẻ -> uid đó
export async function createUserAndBindCard(params: {
  cardId: string;
  name: string;
  email?: string;
}) {
  const cardId = (params.cardId || "").trim();
  const name = (params.name || "").trim();
  const email = (params.email || "").trim();

  if (!cardId) throw new Error("Missing cardId");
  if (!name) throw new Error("Missing name");

  await ensureAnonAuth();

  // ✅ uid tự sinh (unique)
  const uid = push(ref(db, "users")).key;
  if (!uid) throw new Error("Cannot generate uid");

  await update(ref(db), {
    // user profile
    [`users/${uid}/name`]: name,
    ...(email ? { [`users/${uid}/email`]: email } : {}),
    [`users/${uid}/cardId`]: cardId,
    [`users/${uid}/createdTs`]: Date.now(),
    [`users/${uid}/updatedTs`]: Date.now(),

    // ✅ bind thẻ -> uid mới
    [`rfidMap/${cardId}`]: uid,
  });

  return { uid };
}