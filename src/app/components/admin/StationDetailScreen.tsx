import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { ArrowLeft, MapPin, Thermometer, Droplets, Activity, Zap, BatteryCharging } from "lucide-react";

import { ref, onValue, type Unsubscribe } from "firebase/database";
import { db } from "../../../lib/firebase";
import { listenEnv, listenPzem, listenRfidUid, listenUser, type EnvData, type PzemData, type UserInfo } from "../../../lib/rtdb";

interface StationDetailScreenProps {
  stationId: number;
  onBack: () => void;
}

const META: Record<number, { name: string; location: string }> = {
  1: { name: "Trạm A", location: "Tầng 1, Khu A" },
  2: { name: "Trạm B", location: "Tầng 2, Khu B" },
};

const PRICE_VND_PER_KWH = 4500;
const PORTS = ["A", "B"] as const;
type PortName = (typeof PORTS)[number];

type PortStatus = {
  isCharging?: boolean;
  sessionId?: string;
  userId?: string; // cardId (RFID)
  startTs?: number;
  stopTs?: number;
  fault?: string;
  ts?: number;
};

type SessionData = {
  costVnd?: number;
  energyKwh?: number;
  startTs?: number;
  stopTs?: number;
  userId?: string; // cardId (RFID) hoặc uid, tuỳ bạn ghi
};

function tsToMs(ts?: number) {
  if (!ts) return null;
  if (ts > 1_000_000_000_000) return ts;
  if (ts > 1_000_000_000) return ts * 1000;
  return null;
}
function formatTime(ts?: number) {
  const ms = tsToMs(ts);
  if (!ms) return "-";
  return new Date(ms).toLocaleTimeString("vi-VN", { hour12: false });
}
function formatDuration(startTs?: number, stopTs?: number) {
  const s = tsToMs(startTs);
  const e = tsToMs(stopTs) ?? Date.now();
  if (!s) return "-";
  const diff = Math.max(0, e - s);
  const totalSec = Math.floor(diff / 1000);
  const hh = String(Math.floor(totalSec / 3600)).padStart(2, "0");
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function StationDetailScreen({ stationId, onBack }: StationDetailScreenProps) {
  const meta = META[stationId] ?? { name: `Trạm ${stationId}`, location: "-" };

  const [env, setEnv] = useState<EnvData | null>(null);
  const [pzem, setPzem] = useState<Record<PortName, PzemData | null>>({ A: null, B: null });
  const [status, setStatus] = useState<Record<PortName, PortStatus | null>>({ A: null, B: null });
  const [sessions, setSessions] = useState<Record<PortName, SessionData | null>>({ A: null, B: null });

  const [resolvedUidByPort, setResolvedUidByPort] = useState<Record<PortName, string | null>>({ A: null, B: null });
  const [userInfoByPort, setUserInfoByPort] = useState<Record<PortName, UserInfo | null>>({ A: null, B: null });

  const sessionUnsubRef = useRef<Record<PortName, Unsubscribe | null>>({ A: null, B: null });
  const lastSessionIdRef = useRef<Record<PortName, string | null>>({ A: null, B: null });

  const rfidUnsubRef = useRef<Record<PortName, Unsubscribe | null>>({ A: null, B: null });
  const lastRfidRef = useRef<Record<PortName, string | null>>({ A: null, B: null });

  const userUnsubRef = useRef<Record<PortName, Unsubscribe | null>>({ A: null, B: null });
  const lastUidRef = useRef<Record<PortName, string | null>>({ A: null, B: null });

  useEffect(() => {
    const offEnv = listenEnv(stationId, (v) => setEnv(v));
    const offs: Array<() => void> = [];

    PORTS.forEach((port) => {
      offs.push(
        listenPzem(stationId, port, (v) => {
          setPzem((prev) => ({ ...prev, [port]: v }));
        })
      );

      const stRef = ref(db, `stations/${stationId}/ports/${port}/status`);
      const offSt = onValue(stRef, (snap) => {
        const st = (snap.val() ?? null) as PortStatus | null;
        setStatus((prev) => ({ ...prev, [port]: st }));

        const newSessionId = st?.sessionId ?? null;

        if (lastSessionIdRef.current[port] !== newSessionId) {
          lastSessionIdRef.current[port] = newSessionId;

          if (sessionUnsubRef.current[port]) {
            sessionUnsubRef.current[port]!();
            sessionUnsubRef.current[port] = null;
          }

          if (!newSessionId) {
            setSessions((prev) => ({ ...prev, [port]: null }));
            return;
          }

          const sRef = ref(db, `sessions/${newSessionId}`);
          const offS = onValue(sRef, (ss) => {
            setSessions((prev) => ({ ...prev, [port]: (ss.val() ?? null) as SessionData | null }));
          });
          sessionUnsubRef.current[port] = offS;
        }
      });

      offs.push(offSt);
    });

    return () => {
      offEnv?.();
      offs.forEach((u) => u?.());

      PORTS.forEach((port) => {
        if (sessionUnsubRef.current[port]) sessionUnsubRef.current[port]!();
        sessionUnsubRef.current[port] = null;
        lastSessionIdRef.current[port] = null;

        if (rfidUnsubRef.current[port]) rfidUnsubRef.current[port]!();
        rfidUnsubRef.current[port] = null;
        lastRfidRef.current[port] = null;

        if (userUnsubRef.current[port]) userUnsubRef.current[port]!();
        userUnsubRef.current[port] = null;
        lastUidRef.current[port] = null;
      });
    };
  }, [stationId]);

  // cardId -> uid (rfidMap)
  useEffect(() => {
    PORTS.forEach((port) => {
      const cardId = (sessions[port]?.userId ?? status[port]?.userId ?? null) as string | null;

      if (lastRfidRef.current[port] === cardId) return;
      lastRfidRef.current[port] = cardId;

      if (rfidUnsubRef.current[port]) {
        rfidUnsubRef.current[port]!();
        rfidUnsubRef.current[port] = null;
      }

      if (!cardId) {
        setResolvedUidByPort((prev) => ({ ...prev, [port]: null }));
        return;
      }

      rfidUnsubRef.current[port] = listenRfidUid(cardId, (uid) => {
        setResolvedUidByPort((prev) => ({ ...prev, [port]: uid ?? null }));
      });
    });
  }, [sessions, status]);

  // uid -> users/{uid}
  useEffect(() => {
    PORTS.forEach((port) => {
      const uid = resolvedUidByPort[port];

      if (lastUidRef.current[port] === uid) return;
      lastUidRef.current[port] = uid;

      if (userUnsubRef.current[port]) {
        userUnsubRef.current[port]!();
        userUnsubRef.current[port] = null;
      }

      if (!uid) {
        setUserInfoByPort((prev) => ({ ...prev, [port]: null }));
        return;
      }

      userUnsubRef.current[port] = listenUser(uid, (u) => {
        setUserInfoByPort((prev) => ({ ...prev, [port]: u }));
      });
    });
  }, [resolvedUidByPort]);

  const chargingCount = useMemo(() => PORTS.filter((p) => status[p]?.isCharging).length, [status]);
  const totalPowerW = useMemo(() => Math.round((pzem.A?.p ?? 0) + (pzem.B?.p ?? 0)), [pzem]);

  const temp = env?.temp ?? 0;
  const hum = env?.hum ?? 0;

  const list = useMemo(
    () => [
      { id: 1, key: "A" as const },
      { id: 2, key: "B" as const },
    ],
    []
  );

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" onClick={onBack} className="mb-2 -ml-2">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Quay lại
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">{meta.name}</h1>
          <div className="flex items-center gap-2 text-gray-600 mt-1">
            <MapPin className="w-4 h-4" />
            <span>{meta.location}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center">
                <Thermometer className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Nhiệt độ</p>
                <p className="text-2xl font-bold text-gray-900">{Number.isFinite(temp) ? `${temp.toFixed(1)}°C` : "-"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                <Droplets className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Độ ẩm</p>
                <p className="text-2xl font-bold text-gray-900">{Number.isFinite(hum) ? `${hum.toFixed(1)}%` : "-"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                <Activity className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Ổ đang sạc</p>
                <p className="text-2xl font-bold text-gray-900">{chargingCount}/2</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Tổng công suất</p>
                <p className="text-2xl font-bold text-gray-900">{totalPowerW}W</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-bold text-gray-900">Chi tiết các ổ sạc</h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {list.map(({ id, key }) => {
            const st = status[key];
            const isCharging = !!st?.isCharging;

            const pm = pzem[key];
            const ses = sessions[key];

            const cardId = (ses?.userId ?? st?.userId ?? "") as string;
            const uid = resolvedUidByPort[key];
            const u = userInfoByPort[key];

            const userName = u?.name ?? (uid ? uid : cardId) ?? "-";
            const userEmail = u?.email ?? "-";

            const powerW = Number(pm?.p ?? 0);
            const voltageV = Number(pm?.u ?? 0);
            const currentA = Number(pm?.i ?? 0);

            const energyKwh = Number(ses?.energyKwh ?? pm?.e ?? 0);
            const costVnd = Math.round(Number(ses?.costVnd ?? energyKwh * PRICE_VND_PER_KWH));

            const startTs = ses?.startTs ?? st?.startTs;
            const stopTs = ses?.stopTs ?? st?.stopTs;

            return (
              <Card key={key} className={isCharging ? "border-2 border-green-500" : "border-2 border-gray-200"}>
                <CardHeader className={isCharging ? "bg-gradient-to-r from-green-50 to-blue-50" : "bg-gray-50"}>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">Ổ sạc {id}</CardTitle>
                    {isCharging ? (
                      <div className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-full text-sm font-semibold">
                        <Activity className="w-4 h-4 animate-pulse" />
                        Đang sạc
                      </div>
                    ) : (
                      <div className="px-4 py-2 bg-gray-300 text-gray-700 rounded-full text-sm font-semibold">Sẵn sàng</div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-6 space-y-6">
                  {isCharging ? (
                    <>
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <h4 className="font-semibold text-gray-900 mb-2">Thông tin khách hàng</h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Người dùng:</span>
                            <span className="font-semibold">{userName}</span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-gray-600">UID:</span>
                            <span className="font-semibold">{uid ?? "-"}</span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-gray-600">Thẻ:</span>
                            <span className="font-semibold">{cardId || "-"}</span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-gray-600">Email:</span>
                            <span className="font-semibold break-all">{userEmail}</span>
                          </div>

                          {!uid && cardId && <div className="mt-2 text-xs text-orange-700">Chưa bind thẻ → uid (thiếu rfidMap/{cardId})</div>}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="font-semibold text-gray-900">Thông tin sạc</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-600 mb-1">Bắt đầu</p>
                            <p className="font-bold text-gray-900">{formatTime(startTs)}</p>
                          </div>
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-600 mb-1">Thời lượng</p>
                            <p className="font-bold text-gray-900">{formatDuration(startTs, stopTs)}</p>
                          </div>
                          <div className="p-3 bg-gray-50 rounded-lg col-span-2">
                            <p className="text-xs text-gray-600 mb-1">Session</p>
                            <p className="font-bold text-gray-900 break-all">{st?.sessionId || "-"}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="font-semibold text-gray-900">Thông số kỹ thuật</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                            <p className="text-xs text-gray-600 mb-1">Công suất</p>
                            <p className="font-bold text-gray-900">{Math.round(powerW)} W</p>
                          </div>
                          <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                            <p className="text-xs text-gray-600 mb-1">Điện áp</p>
                            <p className="font-bold text-gray-900">{voltageV.toFixed(1)} V</p>
                          </div>
                          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <p className="text-xs text-gray-600 mb-1">Dòng điện</p>
                            <p className="font-bold text-gray-900">{currentA.toFixed(2)} A</p>
                          </div>
                          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                            <p className="text-xs text-gray-600 mb-1">Điện năng</p>
                            <p className="font-bold text-gray-900">{energyKwh.toFixed(3)} kWh</p>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <BatteryCharging className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">Ổ sạc đang rảnh</p>
                      <p className="text-sm text-gray-400 mt-1">Sẵn sàng phục vụ</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
