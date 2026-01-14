import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { DollarSign, Thermometer } from "lucide-react";

import { db, ensureAnonAuth } from "../../../lib/firebase";
import { onValue, ref, update } from "firebase/database";

type AppSettings = {
  priceVndPerKwh?: number;
  tempThresholdC?: number;
  updatedTs?: number;
};

export function SettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [rtdbError, setRtdbError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [electricityPrice, setElectricityPrice] = useState("4500");
  const [tempThreshold, setTempThreshold] = useState("40");

  const priceNumber = useMemo(() => {
    const n = Number(electricityPrice);
    return Number.isFinite(n) ? n : 0;
  }, [electricityPrice]);

  const tempNumber = useMemo(() => {
    const n = Number(tempThreshold);
    return Number.isFinite(n) ? n : 0;
  }, [tempThreshold]);

  useEffect(() => {
    let off: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setRtdbError(null);

        // ✅ đảm bảo auth xong rồi mới listen
        await ensureAnonAuth();

        if (cancelled) return;

        const settingsRef = ref(db, "settings");

        off = onValue(
          settingsRef,
          (snap) => {
            const v = (snap.val() ?? {}) as AppSettings;

            if (typeof v.priceVndPerKwh === "number") setElectricityPrice(String(v.priceVndPerKwh));
            if (typeof v.tempThresholdC === "number") setTempThreshold(String(v.tempThresholdC));

            setLoading(false);
          },
          (err) => {
            console.error("RTDB settings listen error:", err);
            setRtdbError(err?.message || String(err));
            setLoading(false);
          }
        );
      } catch (e: any) {
        console.error("ensureAnonAuth failed:", e);
        setRtdbError(e?.message || String(e));
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (off) off();
    };
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setRtdbError(null);

      await ensureAnonAuth();

      await update(ref(db, "settings"), {
        priceVndPerKwh: Math.round(priceNumber),
        tempThresholdC: tempNumber,
        updatedTs: Date.now(),
      });

      alert("Đã lưu lên Firebase!");
    } catch (e: any) {
      console.error("Save settings error:", e);
      setRtdbError(e?.message || String(e));
      alert("Lưu thất bại! Xem lỗi ở console / dòng đỏ trên màn hình.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  if (rtdbError) {
    return (
      <div className="p-8">
        <div className="text-red-600 font-semibold">RTDB error</div>
        <div className="mt-2 text-sm text-gray-700 break-all">{rtdbError}</div>
        <div className="mt-4 text-sm text-gray-500">
          Nếu lỗi kiểu <b>PERMISSION_DENIED</b> → xem lại RTDB Rules (đọc/ghi phải cho auth != null).
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Cài đặt hệ thống</h1>
        <p className="text-gray-500 mt-1">Chỉnh giá điện và ngưỡng nhiệt độ cảnh báo</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-orange-600" />
              <CardTitle>Giá điện</CardTitle>
            </div>
            <CardDescription>Cấu hình giá điện áp dụng cho các phiên sạc</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="price">Giá điện (đồng/kWh)</Label>
              <Input
                id="price"
                type="number"
                value={electricityPrice}
                onChange={(e) => setElectricityPrice(e.target.value)}
                placeholder="4500"
                min="0"
              />
              <p className="text-sm text-gray-500">
                Giá hiện tại: {Math.round(priceNumber).toLocaleString("vi-VN")} đ/kWh
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Thermometer className="w-5 h-5 text-red-600" />
              <CardTitle>Ngưỡng nhiệt độ</CardTitle>
            </div>
            <CardDescription>Cảnh báo khi nhiệt độ môi trường vượt ngưỡng</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="temp">Ngưỡng cảnh báo (°C)</Label>
              <Input
                id="temp"
                type="number"
                value={tempThreshold}
                onChange={(e) => setTempThreshold(e.target.value)}
                placeholder="40"
                min="0"
                max="120"
              />
              <p className="text-sm text-gray-500">
                Khi nhiệt độ &gt;= <span className="font-semibold">{tempNumber}°C</span> sẽ cảnh báo.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-4">
        <Button variant="outline">Hủy</Button>
        <Button
          disabled={saving}
          onClick={handleSave}
          className="bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700"
        >
          {saving ? "Đang lưu..." : "Lưu cài đặt"}
        </Button>
      </div>
    </div>
  );
}
