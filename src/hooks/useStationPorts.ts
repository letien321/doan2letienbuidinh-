import { useEffect, useMemo, useState } from "react";
import { listenCharging, listenPzem, type PzemData, type PortId, type StationId } from "@/lib/rtdb";

type PortLive = {
  port: PortId;
  isCharging: boolean | null;
  pzem: PzemData | null;
};

export function useStationPorts(stationId: StationId, ports: PortId[]) {
  const [data, setData] = useState<Record<string, PortLive>>({});

  useEffect(() => {
    const unsubs: Array<() => void> = [];

    ports.forEach((port) => {
      // PZEM
      unsubs.push(
        listenPzem(stationId, port, (pzem) => {
          setData((prev) => ({
            ...prev,
            [port]: {
              port,
              isCharging: prev[port]?.isCharging ?? null,
              pzem,
            },
          }));
        })
      );

      // Status
      unsubs.push(
        listenCharging(stationId, port, (isCharging) => {
          setData((prev) => ({
            ...prev,
            [port]: {
              port,
              isCharging,
              pzem: prev[port]?.pzem ?? null,
            },
          }));
        })
      );
    });

    return () => unsubs.forEach((u) => u());
  }, [stationId, ports.join("|")]);

  const list = useMemo(
    () =>
      ports.map((p) => data[p] ?? { port: p, isCharging: null, pzem: null }),
    [data, ports]
  );

  const chargingCount = list.filter((x) => x.isCharging === true).length;
  const totalPowerW = list.reduce((sum, x) => sum + (x.pzem?.p ?? 0), 0);

  return { ports: list, chargingCount, totalPowerW };
}
