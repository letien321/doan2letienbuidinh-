import { useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Calendar, Clock, BatteryCharging, DollarSign, User, Zap, MapPin } from "lucide-react";

import { ensureAnonAuth } from "../../../lib/firebase";
import { useRtdbValue } from "../../../hooks/useRtdbValue";

const PORTS = ["A", "B"] as const;
type PortName = (typeof PORTS)[number];

type Stations = Record<
  string,
  {
    users?: Record<string, { name?: string; email?: string }>;
  }
>;

type SessionItem = {
  stationId?: string | number;
  port?: string; // "A" | "B"
  userId?: string;
  startTs?: number; // uptime ms hoặc epoch
  stopTs?: number;  // uptime ms hoặc epoch
  updatedTs?: number;
  energyKwh?: number;
  costVnd?: number;
  batteryStart?: number;
  batteryEnd?: number;
  reason?: string;
};

type SessionsIndex = Record<string, SessionItem>;

function isEpoch(ts?: number) {
  return typeof ts === "number" && ts > 1_000_000_000; // > 2001-09-09 (seconds) hoặc ms epoch
}

function toMsEpoch(ts?: number) {
  if (!ts) return null;
  // ms epoch
  if (ts > 1_000_000_000_000) return ts;
  // s epoch
  if (ts > 1_000_000_000) return ts * 1000;
  return null; // uptime ms -> không đổi được ra date
}

function fmtDate(ms: number | null) {
  if (!ms) return "-";
  return new Date(ms).toLocaleDateString("vi-VN");
}
function fmtTime(ms: number | null) {
  if (!ms) return "-";
  return new Date(ms).toLocaleTimeString("vi-VN", { hour12: false });
}
function fmtDurationFromMs(ms?: number) {
  if (!ms || ms <= 0) return "-";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function portNoFromKey(port?: string) {
  if (!port) return 0;
  if (port === "A") return 1;
  if (port === "B") return 2;
  // fallback nếu bạn đổi key sau này
  const n = Number(port);
  return Number.isFinite(n) ? n : 0;
}

export function HistoryScreen() {
  useEffect(() => {
    ensureAnonAuth().catch(console.error);
  }, []);

  // ✅ đọc sessions trực tiếp (vì bạn đang lưu nó ở root)
  const { data: sessions, loading, error } = useRtdbValue<SessionsIndex>("sessions");

  // optional: lấy users để show tên
  const { data: stations } = useRtdbValue<Stations>("stations");

  const history = useMemo(() => {
    if (!sessions) return [];

    const rows = Object.entries(sessions)
      .map(([id, s]) => {
        const stopTs = s.stopTs ?? 0;
        const startTs = s.startTs ?? 0;

        // ✅ điều kiện “phiên đã hoàn thành”:
        // chỉ cần stopTs > 0 là lấy (dù uptime ms hay epoch)
        if (!stopTs || stopTs <= 0) return null;

        const stationId = String(s.stationId ?? "");
        const portKey = String(s.port ?? "");
        const portNo = portNoFromKey(portKey);

        const userId = s.userId ?? "";
        const userName =
          (stationId && userId && stations?.[stationId]?.users?.[userId]?.name) ||
          userId ||
          "-";

        // thời lượng: nếu uptime ms thì stop-start cũng ra duration đúng
        const durationMs =
          startTs && stopTs && stopTs > startTs ? (stopTs - startTs) : 0;

        // hiển thị date/time: chỉ show khi là epoch
        const stopMsEpoch = toMsEpoch(stopTs);
        const startMsEpoch = toMsEpoch(startTs);

        const energyKwh = Number(s.energyKwh ?? 0);
        const costVnd = Number(s.costVnd ?? 0);

        return {
          id,
          stationId,
          stationName: stationId ? `Trạm ${stationId}` : "Trạm -",
          portKey,
          portNo,
          userId,
          userName,
          startMsEpoch,
          stopMsEpoch,
          durationMs,
          energyKwh,
          costVnd,
          batteryStart: s.batteryStart,
          batteryEnd: s.batteryEnd,
          reason: s.reason,
          sortKey: Number(s.updatedTs ?? s.stopTs ?? 0),
        };
      })
      .filter(Boolean) as any[];

    rows.sort((a, b) => b.sortKey - a.sortKey);
    return rows;
  }, [sessions, stations]);

  const stats = useMemo(() => {
    const totalSessions = history.length;
    const totalTimeMs = history.reduce((sum, x) => sum + (x.durationMs ?? 0), 0);
    const totalEnergy = history.reduce((sum, x) => sum + (x.energyKwh ?? 0), 0);
    const totalRevenue = history.reduce((sum, x) => sum + (x.costVnd ?? 0), 0);

    const totalMin = Math.floor(totalTimeMs / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;

    return {
      totalSessions,
      totalTimeText: totalSessions ? `${h}h ${m}m` : "--",
      totalEnergy: Number(totalEnergy.toFixed(3)),
      totalRevenue,
    };
  }, [history]);

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-600">RTDB error</div>;
  if (!sessions) return <div className="p-8">No sessions</div>;

  return (
    <div className="p-8 space-y-8 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      <div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
          Lịch sử sạc
        </h1>
        <p className="text-gray-500 mt-2">Phiên đã hoàn thành (stopTs &gt; 0)</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-blue-500 to-blue-600" />
          <CardContent className="p-6 flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-2">Tổng phiên sạc</p>
              <p className="text-4xl font-bold text-gray-900">{stats.totalSessions}</p>
              <p className="text-sm text-gray-400">phiên</p>
            </div>
            <div className="w-14 h-14 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
              <BatteryCharging className="w-7 h-7 text-white" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-green-500 to-green-600" />
          <CardContent className="p-6 flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-2">Tổng thời gian</p>
              <p className="text-4xl font-bold text-gray-900">{stats.totalTimeText}</p>
            </div>
            <div className="w-14 h-14 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Clock className="w-7 h-7 text-white" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-purple-500 to-purple-600" />
          <CardContent className="p-6 flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-2">Tổng điện năng</p>
              <p className="text-4xl font-bold text-gray-900">{stats.totalEnergy}</p>
              <p className="text-sm text-gray-400">kWh</p>
            </div>
            <div className="w-14 h-14 bg-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Zap className="w-7 h-7 text-white" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-orange-500 to-orange-600" />
          <CardContent className="p-6 flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-2">Tổng doanh thu</p>
              <p className="text-4xl font-bold text-gray-900">
                {Math.round(stats.totalRevenue / 1000)}K
              </p>
              <p className="text-sm text-gray-400">đồng</p>
            </div>
            <div className="w-14 h-14 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
              <DollarSign className="w-7 h-7 text-white" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-xl">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b">
          <CardTitle className="text-xl">Danh sách phiên sạc</CardTitle>
        </CardHeader>

        <CardContent className="p-6">
          {history.length === 0 ? (
            <div className="text-gray-500">Chưa có phiên nào (stopTs &gt; 0).</div>
          ) : (
            <div className="space-y-4">
              {history.map((it, idx) => (
                <div key={it.id} className="p-5 border-2 border-gray-200 rounded-xl bg-white">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-blue-500 rounded-lg flex items-center justify-center text-white font-bold shadow-md">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                            <Calendar className="w-4 h-4" />
                            <span>{fmtDate(it.stopMsEpoch)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-blue-500" />
                            <h4 className="font-bold text-gray-900">
                              {it.stationName} - Ổ {it.portNo} ({it.portKey})
                            </h4>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg border border-blue-100">
                        <div className="flex items-start gap-2">
                          <User className="w-4 h-4 text-blue-600 mt-0.5" />
                          <div className="text-sm">
                            <p className="font-semibold text-gray-900">{it.userName}</p>
                            <p className="text-gray-600 break-all">{it.userId || "-"}</p>
                          </div>
                        </div>
                      </div>

                      {!!it.reason && (
                        <div className="text-xs text-gray-500">Lý do: {it.reason}</div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="p-4 bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl border-2 border-purple-100 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                          <Clock className="w-5 h-5 text-purple-600" />
                          <span className="text-sm font-bold text-gray-900">Thời gian</span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Bắt đầu:</span>
                            <span className="font-semibold">{fmtTime(it.startMsEpoch)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Kết thúc:</span>
                            <span className="font-semibold">{fmtTime(it.stopMsEpoch)}</span>
                          </div>
                          <div className="flex justify-between pt-2 border-t-2 border-purple-200">
                            <span className="text-gray-700 font-medium">Thời lượng:</span>
                            <span className="font-bold text-purple-600">
                              {fmtDurationFromMs(it.durationMs)}
                            </span>
                          </div>

                          {!isEpoch(it.stopMsEpoch ?? undefined) && (
                            <div className="text-xs text-gray-400 pt-2">
                              * startTs/stopTs đang là uptime ms nên không hiện được ngày/giờ, nhưng **thời lượng vẫn đúng**.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className="w-5 h-5 text-blue-600" />
                          <span className="text-sm font-bold text-gray-900">Điện năng</span>
                        </div>
                        <p className="text-4xl font-bold text-blue-600">{Number(it.energyKwh).toFixed(3)}</p>
                        <p className="text-sm text-gray-600 mt-1">kWh</p>
                      </div>

                      <div className="p-4 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border-2 border-orange-300 shadow-md">
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="w-5 h-5 text-orange-600" />
                          <span className="text-sm font-bold text-gray-900">Chi phí</span>
                        </div>
                        <p className="text-3xl font-bold text-orange-600">
                          {Math.round(it.costVnd).toLocaleString("vi-VN")} đ
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
