"use client";
// usePoll: fetch a URL now and then every `ms` milliseconds (default 1.5 s), return the latest JSON.
// This is how every screen stays live without websockets.
import { useEffect, useRef, useState } from "react";

export function usePoll<T>(url: string | null, ms = 1500) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const busy = useRef(false);

  useEffect(() => {
    if (!url) return;
    let stop = false;
    const load = async () => {
      if (busy.current) return; // skip if the last request is still running
      busy.current = true;
      try {
        const res = await fetch(url, { cache: "no-store" });
        const json = await res.json();
        if (!stop) {
          if (res.ok) {
            setData(json);
            setError(null);
          } else setError(json.error || "Server error");
        }
      } catch {
        if (!stop) setError("Connection lost, retrying…");
      } finally {
        busy.current = false;
      }
    };
    load();
    const id = setInterval(load, ms);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [url, ms, tick]);

  // refresh() = fetch again right now (call it after a button press).
  return { data, error, refresh: () => setTick((t) => t + 1) };
}

// POST JSON helper. Throws an Error with the server's message if it fails.
export async function post<T = any>(url: string, body: unknown = {}, method = "POST"): Promise<T> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json as T;
}
