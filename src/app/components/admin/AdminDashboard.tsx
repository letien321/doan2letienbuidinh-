import { useEffect } from "react";
import { ensureAnonAuth } from "@/lib/firebase";
import { useRtdbValue } from "@/hooks/useRtdbValue";

type Stations = Record<
  string,
  {
    env?: { hum?: number; temp?: number; ts?: number };
    ports?: Record<
      string,
      {
        pzem?: { u?: number; i?: number; p?: number; e?: number; hz?: number; pf?: number; ts?: number };
        status?: { isCharging?: boolean; sessionId?: string; userId?: string; startTs?: number; stopTs?: number; ts?: number; fault?: string };
      }
    >;
    daily?: any;
    users?: Record<string, { name?: string; email?: string }>;
  }
>;

export default function AdminDashboard() {
  useEffect(() => {
    ensureAnonAuth().catch(console.error);
  }, []);

  const { data: stations, loading } = useRtdbValue<Stations>("stations");

  if (loading) return <div>Loading...</div>;
  if (!stations) return <div>No data</div>;

  return (
    <div>
      <pre style={{ fontSize: 12 }}>{JSON.stringify(stations, null, 2)}</pre>
    </div>
  );
}
