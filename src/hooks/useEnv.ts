import { useEffect, useState } from "react";
import { listenEnv, type EnvData, type StationId } from "@/lib/rtdb";

// normalize để hiển thị đúng (0.65 -> 65%, 280 -> 28°C...)
function normalizeEnv(env: EnvData | null) {
  if (!env) return null;

  let temp = Number(env.temp);
  let hum = Number(env.hum);

  if (temp > 100) temp = temp / 10; // nếu thiết bị gửi x10
  if (hum <= 1) hum = hum * 100;    // nếu thiết bị gửi dạng 0..1

  return { ...env, temp: Math.round(temp * 10) / 10, hum: Math.round(hum) };
}

export function useEnv(stationId: StationId) {
  const [env, setEnv] = useState<EnvData | null>(null);

  useEffect(() => {
    const unsub = listenEnv(stationId, (v) => setEnv(normalizeEnv(v)));
    return () => unsub();
  }, [stationId]);

  return env;
}