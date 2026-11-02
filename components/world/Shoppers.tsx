"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useStore } from "@/lib/store";
import { TICK_MINUTES, TICK_MS } from "@/lib/engine";
import { Walker, lookFor } from "./Figures";
import { Inspectable } from "./Inspectable";

/* ─────────────────────────────────────────────────────────────────
   CLIENT TRAFFIC
   Arrivals are a sample of session volume; departures carrying a bag
   are a sample of conversion. Both rates come from the clock, so the
   pavement outside the boutique fills and empties with the business.
   ───────────────────────────────────────────────────────────────── */

/** simulated minutes that pass per real second */
const SIM_MIN_PER_SEC = TICK_MINUTES / (TICK_MS / 1000);
const MAX_ON_SCREEN = 16;

interface Person {
  id: number;
  kind: "arrive" | "leave";
  lane: number;
}

const DOOR: [number, number] = [10.4, 6.05];

function arrivalPath(lane: number): [number, number][] {
  const start = 5.2 + ((lane * 2.3) % 9.4);
  const jitter = ((lane % 5) - 2) * 0.34;
  return [
    [start, 8.75],
    [start + (DOOR[0] - start) * 0.45, 7.9],
    [DOOR[0] + jitter, 7.0],
    [DOOR[0] + jitter * 0.4, DOOR[1]],
  ];
}

function departurePath(lane: number): [number, number][] {
  const end = 5.6 + ((lane * 3.1) % 9.6);
  const jitter = ((lane % 4) - 1.5) * 0.4;
  return [
    [DOOR[0] + jitter * 0.3, DOOR[1]],
    [DOOR[0] + jitter, 7.1],
    [end + (DOOR[0] - end) * 0.4, 8.0],
    [end, 8.75],
  ];
}

export function Shoppers({ animate }: { animate: boolean }) {
  const [people, setPeople] = useState<Person[]>([]);
  const nextId = useRef(1);
  const arriveDebt = useRef(0);
  const leaveDebt = useRef(0);

  useFrame((_, dt) => {
    if (!animate) return;
    const { flow } = useStore.getState();
    const simMinutes = Math.min(0.05, dt) * SIM_MIN_PER_SEC;

    arriveDebt.current += flow.shopperRate * simMinutes;
    leaveDebt.current += flow.checkoutRate * simMinutes;

    const spawn: Person[] = [];
    while (arriveDebt.current >= 1) {
      arriveDebt.current -= 1;
      spawn.push({ id: nextId.current, kind: "arrive", lane: nextId.current });
      nextId.current += 1;
    }
    while (leaveDebt.current >= 1) {
      leaveDebt.current -= 1;
      spawn.push({ id: nextId.current, kind: "leave", lane: nextId.current });
      nextId.current += 1;
    }
    if (spawn.length) {
      setPeople((p) => [...p, ...spawn].slice(-MAX_ON_SCREEN));
    }
  });

  const retire = (id: number) => setPeople((p) => p.filter((x) => x.id !== id));

  return (
    <group position={[0, 0.2, 0]}>
      {/* The forecourt itself is clickable for the traffic story. */}
      <Inspectable target="floor" size={[8, 1.2, 3.4]} position={[10.4, 0, 7.4]} />

      {people.map((p) => (
        <Walker
          key={p.id}
          mode="once"
          animate={animate}
          path={p.kind === "arrive" ? arrivalPath(p.lane) : departurePath(p.lane)}
          look={lookFor(p.lane + 2)}
          carrying={p.kind === "leave" ? "bag" : p.lane % 4 === 0 ? "bag" : null}
          speed={0.95 + (p.lane % 3) * 0.12}
          scale={0.96}
          onDone={() => retire(p.id)}
        />
      ))}
    </group>
  );
}
