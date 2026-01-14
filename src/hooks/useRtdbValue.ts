import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "@/lib/firebase";

export function useRtdbValue<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    setLoading(true);
    const r = ref(db, path);

    const unsub = onValue(
      r,
      (snap) => {
        setData((snap.val() ?? null) as T | null);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [path]);

  return { data, loading, error };
}
