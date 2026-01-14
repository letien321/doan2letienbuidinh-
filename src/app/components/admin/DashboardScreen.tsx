import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Zap, BatteryCharging, Thermometer, Droplets, Activity, TrendingUp } from "lucide-react";
import { Button } from "../ui/button";

// ✅ IMPORT ĐÚNG
import {
  listenEnv,
  listenPzem,
  listenCharging,
  type EnvData,
  type PzemData,
  type StationId,
  type PortId,
} from "../../../lib/rtdb";

interface DashboardScreenProps {
  onViewStation: (stationId: number) => void;
}

const STATIONS = [
  { id: 1, name: "Trạm A", location: "Tầng 1, Khu A" },
  { id: 2, name: "Trạm B", location: "Tầng 2, Khu B" },
];

const PORTS: PortId[] = ["A", "B"];

type StationRealtime = {
  env: EnvData | null;
  ports: Record<string, { pzem: PzemData | null; isCharging: boolean | null }>;
};

function normalizeEnv(env: EnvData | null) {
  if (!env) return null;
  let temp = Number(env.temp ?? 0);
  let hum = Number(env.hum ?? 0);
  if (temp > 100) temp = temp / 10;
  if (hum <= 1) hum = hum * 100;
  return { ...env, temp: Math.round(temp * 10) / 10, hum: Math.round(hum) };
}

export function DashboardScreen({ onViewStation }: DashboardScreenProps) {
  const [rt, setRt] = useState<Record<number, StationRealtime>>({});

  useEffect(() => {
    const unsubs: Array<() => void> = [];

    STATIONS.forEach((s) => {
      setRt((prev) => ({
        ...prev,
        [s.id]: prev[s.id] ?? { env: null, ports: {} },
      }));

      unsubs.push(
        listenEnv(s.id as StationId, (env) => {
          setRt((prev) => ({
            ...prev,
            [s.id]: { ...(prev[s.id] ?? { env: null, ports: {} }), env: normalizeEnv(env) },
          }));
        })
      );

      PORTS.forEach((port) => {
        unsubs.push(
          listenPzem(s.id as StationId, port, (pzem) => {
            setRt((prev) => {
              const cur = prev[s.id] ?? { env: null, ports: {} };
              return {
                ...prev,
                [s.id]: {
                  ...cur,
                  ports: {
                    ...cur.ports,
                    [port]: { ...(cur.ports[port] ?? { pzem: null, isCharging: null }), pzem },
                  },
                },
              };
            });
          })
        );

        unsubs.push(
          listenCharging(s.id as StationId, port, (isCharging) => {
            setRt((prev) => {
              const cur = prev[s.id] ?? { env: null, ports: {} };
              return {
                ...prev,
                [s.id]: {
                  ...cur,
                  ports: {
                    ...cur.ports,
                    [port]: { ...(cur.ports[port] ?? { pzem: null, isCharging: null }), isCharging },
                  },
                },
              };
            });
          })
        );
      });
    });

    return () => unsubs.forEach((u) => u());
  }, []);

  // ✅ stations realtime thay cho mock
  const stations = useMemo(() => {
    return STATIONS.map((s) => {
      const data = rt[s.id];
      const env = data?.env ?? null;

      const ports = PORTS.map((pid, idx) => {
        const pd = data?.ports?.[pid];
        const isCharging = pd?.isCharging === true;
        const p = pd?.pzem;

        return {
          id: idx + 1, // UI Ổ 1/2
          status: isCharging ? "charging" : "available",
          power: Math.round(Number(p?.p ?? 0)),
          current: Number(Number(p?.i ?? 0).toFixed(2)),
          voltage: Math.round(Number(p?.u ?? 0)),
          batteryPercent: 0, // chưa có trên firebase
        };
      });

      return {
        id: s.id,
        name: s.name,
        location: s.location,
        temperature: env?.temp ?? 0,
        humidity: env?.hum ?? 0,
        ports,
      };
    });
  }, [rt]);

  // ✅ stats realtime
  const stats = useMemo(() => {
    const totalStations = STATIONS.length;
    const totalPorts = STATIONS.length * PORTS.length;

    const chargingPorts = STATIONS.reduce((sum, s) => {
      const d = rt[s.id];
      const cnt = PORTS.filter((p) => d?.ports?.[p]?.isCharging === true).length;
      return sum + cnt;
    }, 0);

    return [
      { label: "Tổng trạm sạc", value: String(totalStations), subtext: "Trạm", icon: Zap, color: "from-blue-500 to-blue-600", iconBg: "bg-blue-500" },
      { label: "Đang sạc", value: String(chargingPorts), subtext: `/${totalPorts} ổ`, icon: BatteryCharging, color: "from-green-500 to-green-600", iconBg: "bg-green-500" },
    ];
  }, [rt]);

  // ======= phần JSX UI của bạn giữ nguyên, chỉ dùng `stats` + `stations` realtime ở trên =======
  return (
    <div className="p-8 space-y-8 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            Tổng quan hệ thống
          </h1>
          <p className="text-gray-500 mt-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            Giám sát trạm sạc xe điện
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Cập nhật lần cuối</p>
          <p className="font-semibold text-gray-900">{new Date().toLocaleTimeString("vi-VN")}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden">
              <div className={`h-2 bg-gradient-to-r ${stat.color}`} />
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-gray-500 mb-2">{stat.label}</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-4xl font-bold text-gray-900">{stat.value}</p>
                      <span className="text-sm text-gray-400">{stat.subtext}</span>
                    </div>
                  </div>
                  <div className={`w-14 h-14 ${stat.iconBg} rounded-2xl flex items-center justify-center shadow-lg`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Stations Overview */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Trạm sạc</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {stations.map((station) => {
            const activeCount = station.ports.filter((p) => p.status === "charging").length;

            return (
              <Card key={station.id} className="border-0 shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300">
                <CardHeader className="bg-gradient-to-r from-green-500 to-blue-600 text-white pb-8">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-2xl mb-2">{station.name}</CardTitle>
                      <p className="text-green-50 text-sm">{station.location}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => onViewStation(station.id)}
                      className="bg-white text-blue-600 hover:bg-gray-100 shadow-lg"
                    >
                      Chi tiết →
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="p-6 space-y-5 -mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-gradient-to-br from-red-50 to-orange-50 rounded-xl border border-red-100 shadow-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <Thermometer className="w-4 h-4 text-red-500" />
                        <span className="text-xs text-gray-600 font-medium">Nhiệt độ</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{station.temperature || "--"}°C</p>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-100 shadow-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <Droplets className="w-4 h-4 text-blue-500" />
                        <span className="text-xs text-gray-600 font-medium">Độ ẩm</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{station.humidity || "--"}%</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-gray-700">Trạng thái ổ sạc</span>
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-bold">
                        {activeCount}/{station.ports.length} hoạt động
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {station.ports.map((port) => (
                        <div
                          key={port.id}
                          className={`p-4 rounded-xl border-2 transition-all ${
                            port.status === "charging"
                              ? "border-green-400 bg-gradient-to-br from-green-50 to-blue-50 shadow-md"
                              : "border-gray-200 bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-bold text-gray-900">Ổ {port.id}</span>
                            {port.status === "charging" ? (
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50" />
                            ) : (
                              <div className="w-2 h-2 bg-gray-300 rounded-full" />
                            )}
                          </div>

                          {port.status === "charging" ? (
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Công suất</span>
                                <span className="font-bold text-purple-600">{port.power}W</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Dòng điện</span>
                                <span className="font-bold text-blue-600">{port.current}A</span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 text-center py-2">Sẵn sàng</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
