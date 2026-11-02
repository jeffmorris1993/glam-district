"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { C } from "./palette";
import { RoutedVan, Van, type Route } from "./Props";
import { Inspectable } from "./Inspectable";

/* ─────────────────────────────────────────────────────────────────
   THE FLEET
   Vans exist only because the clock dispatched or received a load.
   A departure happens when staged parcels reach a full load; an
   arrival happens when an open purchase order reaches its ETA.
   Nothing here is on a timer.
   ───────────────────────────────────────────────────────────────── */

/* Dock bays sit at x = -12.75 / -9.6 / -6.45, apron z 2.2–7.8.
   The boulevard runs east at z = 10.4 and west at z = 8.8. */

const DEPART: Route = [
  [-12.75, 4.3],
  [-12.75, 8.3],
  [-12.1, 9.7],
  [-10.8, 10.4],
  [26, 10.4],
];

const ARRIVE_IN: Route = [
  [27, 8.8],
  [-4.4, 8.8],
  [-5.7, 7.6],
  [-6.45, 6.2],
  [-6.45, 4.4],
];

const ARRIVE_OUT: Route = [
  [-6.45, 4.4],
  [-6.45, 6.4],
  [-8.2, 8.8],
  [-27, 8.8],
];

interface Vehicle {
  id: number;
  kind: "depart" | "arrive-in" | "arrive-out";
}

/** Watch a monotonic counter on the store and fire on each increment. */
function useTicket(
  pick: (s: ReturnType<typeof useStore.getState>) => number,
  onTick: (n: number) => void,
  onReset?: () => void,
) {
  useEffect(() => {
    let last = pick(useStore.getState());
    return useStore.subscribe((s) => {
      const v = pick(s);
      if (v > last) {
        for (let i = last + 1; i <= v; i++) onTick(i);
        last = v;
      } else if (v < last) {
        last = v; // a preset or reset rewound the counter
        onReset?.();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function Fleet({ animate }: { animate: boolean }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const staged = useStore((s) => s.flow.stagedParcels);

  // A rewound counter means the simulation was reset — any vans still driving
  // belong to the previous run, and their ticket ids are about to be re-issued.
  const clear = () => setVehicles([]);
  const push = (veh: Vehicle) =>
    setVehicles((v) => [...v.slice(-4).filter((x) => x.id !== veh.id), veh]);

  useTicket((s) => s.flow.departures, (i) => push({ id: i * 10, kind: "depart" }), clear);
  useTicket((s) => s.flow.arrivals, (i) => push({ id: i * 10 + 1, kind: "arrive-in" }), clear);

  const retire = (id: number) => setVehicles((v) => v.filter((x) => x.id !== id));
  const advance = (id: number) =>
    setVehicles((v) => v.map((x) => (x.id === id ? { ...x, kind: "arrive-out" } : x)));

  // A van waits at bay one while parcels stage, unless one is pulling out.
  const departing = vehicles.some((v) => v.kind === "depart");
  const loading = staged > 12 && !departing;

  return (
    <group>
      {loading && (
        <Inspectable target="dock" size={[2.6, 1.4, 2.2]} position={[-12.75, 0, 4.3]}>
          <group position={[0, 0.185, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <Van color={C.porcelain} />
          </group>
        </Inspectable>
      )}

      {vehicles.map((v) =>
        v.kind === "depart" ? (
          <RoutedVan
            key={v.id}
            route={DEPART}
            speed={3.6}
            animate={animate}
            color={C.porcelain}
            onDone={() => retire(v.id)}
          />
        ) : v.kind === "arrive-in" ? (
          <RoutedVan
            key={v.id}
            route={ARRIVE_IN}
            speed={3.4}
            hold={5}
            animate={animate}
            color={C.blush}
            onDone={() => advance(v.id)}
          />
        ) : (
          <RoutedVan
            key={`${v.id}-out`}
            route={ARRIVE_OUT}
            speed={3.2}
            animate={animate}
            color={C.blush}
            onDone={() => retire(v.id)}
          />
        ),
      )}
    </group>
  );
}
