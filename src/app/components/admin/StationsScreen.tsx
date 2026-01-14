import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { MapPin, Thermometer, Droplets, Activity, BatteryCharging, Zap, Eye } from "lucide-react";

// IMPORT TỪ RELATIVE ĐỂ ĐỠ LỖI ALIAS "@/..."
import {
  listenEnv,
  listenPzem,
  listenCharging,
  type EnvData,
  type PzemData,
  type StationId,
  type PortId,
} from "../../../lib/rtdb";

interface StationsScreenProps {
  onViewDetail: (stationId: number) => void;
}

// ====== cấu hình nhanh trạm/ports ======
const STATIONS = [
  { id: 1, name: "Trạm A", location: "Tầng 1, Khu A" },
  { id: 2, name: "Trạm B", location: "Tầng 2, Khu B" },
];

const PORTS: PortId[] = ["A", "B"]; // đổi nếu firebase dùng "1","2"

// ====== normalize (nếu thiết bị gửi dạng khác) ======
function normalizeEnv(env: EnvData | null) {
  if (!env) return null;
  let temp = Number(env.temp);
  let hum = Number(env.hum);

  if (temp > 100) temp = temp / 10; // 280 -> 28
  if (hum <= 1) hum = hum * 100;    // 0.65 -> 65

  return { ...env, temp: Math.round(temp * 10) / 10, hum: Math.round(hum) };
}

function normalizePzem(p: PzemData | null) {
  if (!p) return null;

  const powerW = Number(p.p ?? 0);   // W
  const currentA = Number(p.i ?? 0); // A
  const voltageV = Number(p.u ?? 0); // V
  const energyKwh = Number(p.e ?? 0);// kWh

  return { powerW, currentA, voltageV, energyKwh };
}

type StationRealtime = {
  env: EnvData | null;
  ports: Record<string, { pzem: PzemData | null; isCharging: boolean | null }>;
};

export function StationsScreen({ onViewDetail }: StationsScreenProps) {
  const [rt, setRt] = useState<Record<number, StationRealtime>>({});

  useEffect(() => {
    const unsubs: Array<() => void> = [];

    STATIONS.forEach((s) => {
      // init state
      setRt((prev) => ({
        ...prev,
        [s.id]: prev[s.id] ?? { env: null, ports: {} },
      }));

      // listen env
      unsubs.push(
        listenEnv(s.id as StationId, (env) => {
          setRt((prev) => ({
            ...prev,
            [s.id]: { ...(prev[s.id] ?? { env: null, ports: {} }), env: normalizeEnv(env) },
          }));
        })
      );

      // listen each port: pzem + charging
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

  const stations = useMemo(() => {
    return STATIONS.map((s) => {
      const data = rt[s.id];
      const env = data?.env ?? null;

      const ports = PORTS.map((pid, idx) => {
        const portData = data?.ports?.[pid];
        const isCharging = portData?.isCharging === true;
        const p = normalizePzem(portData?.pzem ?? null);

        return {
          id: idx + 1, // UI bạn đang hiển thị Ổ sạc 1/2
          status: isCharging ? "charging" : "available",
          power: Math.round(p?.powerW ?? 0),
          current: Number((p?.currentA ?? 0).toFixed(2)),
          voltage: Math.round(p?.voltageV ?? 0),
          batteryPercent: 0, // firebase chưa có thì để 0
          energy: Number((p?.energyKwh ?? 0).toFixed(3)),
        };
      });

      const activePorts = ports.filter((p) => p.status === "charging").length;
      const totalPorts = ports.length;
      const totalPower = ports.reduce((sum, p) => sum + (p.power || 0), 0);
      const totalEnergy = Number(ports.reduce((sum, p) => sum + (p.energy || 0), 0).toFixed(3));

      return {
        id: s.id,
        name: s.name,
        location: s.location,
        temperature: env?.temp ?? 0,
        humidity: env?.hum ?? 0,
        totalPorts,
        activePorts,
        totalPower,
        totalEnergy,
        ports,
      };
    });
  }, [rt]);

  return (
    <div className="p-8 space-y-8 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      <div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
          Quản lý trạm sạc
        </h1>
        <p className="text-gray-500 mt-2">Danh sách và trạng thái các trạm sạc</p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {stations.map((station) => (
          <Card key={station.id} className="overflow-hidden border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-green-500 via-green-600 to-blue-600 text-white p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <CardTitle className="text-3xl font-bold">{station.name}</CardTitle>
                  <div className="flex items-center gap-2 text-green-50">
                    <MapPin className="w-4 h-4" />
                    <span>{station.location}</span>
                  </div>
                </div>
                <Button
                  onClick={() => onViewDetail(station.id)}
                  className="bg-white text-blue-600 hover:bg-gray-100 shadow-lg px-6"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Xem chi tiết
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-4 space-y-4">
                  <h3 className="font-bold text-gray-900 text-lg mb-4">Thông tin chung</h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-gradient-to-br from-red-50 to-orange-50 rounded-xl border-2 border-red-100 shadow-sm">
                      <Thermometer className="w-5 h-5 text-red-500 mb-2" />
                      <p className="text-xs text-gray-600 mb-1">Nhiệt độ</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {station.temperature ? `${station.temperature}°C` : "--"}
                      </p>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border-2 border-blue-100 shadow-sm">
                      <Droplets className="w-5 h-5 text-blue-500 mb-2" />
                      <p className="text-xs text-gray-600 mb-1">Độ ẩm</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {station.humidity ? `${station.humidity}%` : "--"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className="w-5 h-5 text-green-600" />
                        <span className="text-xs text-gray-600 font-semibold">Trạng thái</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-bold text-green-600">{station.activePorts}</p>
                        <span className="text-gray-600">/ {station.totalPorts} ổ đang sạc</span>
                      </div>
                    </div>

                    <div className="p-4 bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl border-2 border-purple-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-5 h-5 text-purple-600" />
                        <span className="text-xs text-gray-600 font-semibold">Công suất</span>
                      </div>
                      <p className="text-3xl font-bold text-purple-600">{station.totalPower}W</p>
                    </div>

                    <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border-2 border-orange-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <BatteryCharging className="w-5 h-5 text-orange-600" />
                        <span className="text-xs text-gray-600 font-semibold">Điện năng</span>
                      </div>
                      <p className="text-3xl font-bold text-orange-600">{station.totalEnergy}</p>
                      <p className="text-xs text-gray-500">kWh</p>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-8 space-y-4">
                  <h3 className="font-bold text-gray-900 text-lg mb-4">Chi tiết ổ sạc</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {station.ports.map((port) => (
                      <Card
                        key={port.id}
                        className={`overflow-hidden transition-all duration-300 ${
                          port.status === "charging"
                            ? "border-2 border-green-400 shadow-lg shadow-green-100"
                            : "border-2 border-gray-200"
                        }`}
                      >
                        <CardHeader
                          className={`p-4 ${
                            port.status === "charging"
                              ? "bg-gradient-to-r from-green-400 to-blue-500"
                              : "bg-gray-100"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <CardTitle
                              className={`text-lg ${
                                port.status === "charging" ? "text-white" : "text-gray-700"
                              }`}
                            >
                              Ổ sạc {port.id}
                            </CardTitle>

                            {port.status === "charging" ? (
                              <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                <span className="text-xs font-bold text-green-600">Đang sạc</span>
                              </div>
                            ) : (
                              <div className="px-3 py-1.5 bg-gray-300 text-gray-700 rounded-full text-xs font-semibold">
                                Sẵn sàng
                              </div>
                            )}
                          </div>
                        </CardHeader>

                        <CardContent className="p-4">
                          {port.status === "charging" ? (
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                                  <p className="text-xs text-gray-600 mb-1">Công suất</p>
                                  <p className="font-bold text-purple-600">{port.power} W</p>
                                </div>
                                <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
                                  <p className="text-xs text-gray-600 mb-1">Điện áp</p>
                                  <p className="font-bold text-orange-600">{port.voltage} V</p>
                                </div>
                                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                                  <p className="text-xs text-gray-600 mb-1">Dòng điện</p>
                                  <p className="font-bold text-blue-600">{port.current} A</p>
                                </div>
                                <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                                  <p className="text-xs text-gray-600 mb-1">Điện năng</p>
                                  <p className="font-bold text-green-600">{port.energy} kWh</p>
                                </div>
                              </div>

                              {/* batteryPercent bạn chưa có trên firebase => tạm ẩn hoặc để 0 */}
                            </div>
                          ) : (
                            <div className="text-center py-8">
                              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <BatteryCharging className="w-8 h-8 text-gray-300" />
                              </div>
                              <p className="text-sm text-gray-500 font-medium">Không có hoạt động</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
