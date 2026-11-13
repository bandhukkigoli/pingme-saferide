"use client";
// useRoutes: loads the static map data (GET /api/routes) once, and loads it again
// whenever the server says the route editor changed something (World.routesVersion).
import { useEffect, useState } from "react";
import type { BusRoute } from "@/lib/types";

export function useRoutes(routesVersion: number | undefined) {
  const [routes, setRoutes] = useState<BusRoute[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    fetch("/api/routes", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!stop && j.buses) {
          setRoutes(j.buses);
          setError(null);
        }
      })
      .catch(() => !stop && setError("Could not load the map"));
    return () => {
      stop = true;
    };
  }, [routesVersion]); // runs on first load and each time the version changes

  return { routes, error };
}
