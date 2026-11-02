"use client";

import { useMemo, useRef } from "react";
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { useStore } from "@/lib/store";
import { PARCEL_UNITS, TRUCK_LOAD } from "@/lib/engine";
import { damp } from "@/lib/motion";
import { C, SITES, STATUS_COLOR } from "./palette";
import { Glass, Lit, Marble, Metal, Stone } from "./Mats";
import { Handbag, Parcel, Shelf, Workstation } from "./Props";
import { Figure, StatusBeacon, Walker, WORKER_LOOK } from "./Figures";
import { AgentHit, Selectable } from "./Selectable";
import { Inspectable } from "./Inspectable";

const SITE = SITES.fulfillment;
const W = 11.2;
const D = 7.6;
const H = 2.9;
const WALL = 0.16;
/** the dock-facing wall is kept low so the floor reads from the camera */
const FRONT_H = 2.05;

/** One box in the queue pile stands for this many waiting units. */
const UNITS_PER_BOX = 230;
/** One box on the dock stands for this many staged parcels. */
const PARCELS_PER_BOX = 16;

/** How many stations and aisle pickers a given headcount puts on the floor. */
const stationsFor = (pickers: number) => Math.max(1, Math.min(5, Math.round(pickers / 7)));
const pickersFor = (pickers: number) => Math.max(1, Math.min(4, Math.round(pickers / 9)));

/* ─────────────────────────────────────────────────────────────────
   THE FULFILLMENT HOUSE
   Everything inside is a readout of the district clock: the belt runs
   at the floor's pack rate, the pile at the stations is the backlog,
   the dock pile is the load building toward the next departure, and
   the number of associates tracks the staffing control.
   ───────────────────────────────────────────────────────────────── */

function Conveyor() {
  const COUNT = 9;
  const LEN = 6.4;
  const refs = useRef<(Group | null)[]>([]);
  const t = useRef(0);
  const shown = useRef(0);

  useFrame((_, dt) => {
    const { flow } = useStore.getState();
    // packRate is units per simulated minute; the belt carries parcels.
    const parcels = flow.packRate / PARCEL_UNITS;
    t.current += Math.min(0.05, dt) * Math.min(0.55, parcels * 0.04);

    const want = Math.max(0, Math.min(COUNT, Math.round(parcels * 0.55)));
    shown.current = damp(shown.current, want, 2.5, Math.min(0.1, dt));

    refs.current.forEach((r, i) => {
      if (!r) return;
      const on = i < Math.round(shown.current);
      r.visible = on;
      if (!on) return;
      const u = (t.current + i / COUNT) % 1;
      r.position.x = -LEN / 2 + u * LEN;
      r.position.y = Math.sin(u * Math.PI * 6) * 0.004;
    });
  });

  return (
    <group>
      <RoundedBox args={[LEN + 0.3, 0.1, 0.56]} radius={0.03} smoothness={2} position={[0, 0.5, 0]} castShadow receiveShadow>
        <Stone color={C.taupe} roughness={0.5} />
      </RoundedBox>
      <mesh position={[0, 0.558, 0]}>
        <boxGeometry args={[LEN + 0.22, 0.012, 0.46]} />
        <meshStandardMaterial color={C.charcoal} roughness={0.85} />
      </mesh>
      {[-LEN / 2 + 0.3, 0, LEN / 2 - 0.3].map((x) => (
        <mesh key={x} position={[x, 0.24, 0]}>
          <boxGeometry args={[0.07, 0.48, 0.4]} />
          <Metal color={C.taupeDeep} roughness={0.55} />
        </mesh>
      ))}
      <group position={[0, 0.63, 0]}>
        {Array.from({ length: COUNT }, (_, i) => (
          <group key={i} ref={(el) => void (refs.current[i] = el)}>
            <Parcel position={[0, 0, 0]} scale={0.62} rotation={i * 0.4} />
          </group>
        ))}
      </group>
    </group>
  );
}

/** A pile whose height is a live readout; boxes ease in rather than pop. */
function Pile({
  slots,
  read,
  scale = 0.95,
  tone,
}: {
  slots: [number, number, number][];
  read: () => number;
  scale?: number;
  tone?: string;
}) {
  const refs = useRef<(Group | null)[]>([]);
  const shown = useRef(0);

  useFrame((_, dt) => {
    shown.current = damp(shown.current, read(), 2.2, Math.min(0.1, dt));
    refs.current.forEach((r, i) => {
      if (!r) return;
      const k = Math.max(0, Math.min(1, shown.current - i));
      r.visible = k > 0.02;
      r.scale.setScalar(scale * k);
    });
  });

  return (
    <group>
      {slots.map((p, i) => (
        <group key={i} position={p} ref={(el) => void (refs.current[i] = el)}>
          <Parcel position={[0, 0, 0]} rotation={(i % 5) * 0.3} tone={tone} />
        </group>
      ))}
    </group>
  );
}

function stackSlots(
  count: number,
  origin: [number, number],
  perRow = 4,
  gap = 0.36,
): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let i = 0; i < count; i++) {
    const level = Math.floor(i / (perRow * 2));
    const within = i % (perRow * 2);
    const row = Math.floor(within / perRow);
    const col = within % perRow;
    out.push([origin[0] + col * gap, 0.1 + level * 0.21, origin[1] + row * 0.32]);
  }
  return out;
}

function DockBay({ x, index }: { x: number; index: number }) {
  const shutter = useRef<Group>(null);
  useFrame((_, dt) => {
    if (!shutter.current) return;
    const { flow, staffing } = useStore.getState();
    const bays = Math.max(1, Math.min(3, Math.round(staffing.pickers / 9)));
    const want = flow.inShift && index < bays ? 2.0 : 1.25;
    shutter.current.position.y = damp(shutter.current.position.y, want, 3.5, Math.min(0.1, dt));
  });

  return (
    <group position={[x, 0, D / 2 - WALL / 2]}>
      <mesh position={[0, 0.95, -0.06]}>
        <boxGeometry args={[1.9, 1.7, 0.1]} />
        <meshStandardMaterial color="#241D19" roughness={0.95} />
      </mesh>
      <group ref={shutter} position={[0, 1.3, 0.02]}>
        <mesh>
          <boxGeometry args={[1.94, 1.3, 0.05]} />
          <meshStandardMaterial color={C.stone} roughness={0.42} metalness={0.45} envMapIntensity={1.1} />
        </mesh>
      </group>
      <mesh position={[0, 1.88, 0.06]}>
        <boxGeometry args={[2.06, 0.18, 0.16]} />
        <Metal color={C.champagne} roughness={0.35} />
      </mesh>
      {[-0.98, 0.98].map((bx) => (
        <mesh key={bx} position={[bx, 0.42, 0.1]}>
          <boxGeometry args={[0.1, 0.22, 0.14]} />
          <meshStandardMaterial color={C.espresso} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/** A packer at a station. Present if staffed, moving only while packing. */
function Packer({ x, index, animate }: { x: number; index: number; animate: boolean }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }, dt) => {
    if (!ref.current) return;
    const { flow, staffing } = useStore.getState();
    const staffed = index < stationsFor(staffing.pickers);
    const working = staffed && flow.inShift && flow.packRate > 0.01;
    const k = Math.min(0.1, dt);
    const sc = damp(ref.current.scale.x, staffed ? 0.95 : 0.001, 4, k);
    ref.current.scale.setScalar(sc);
    ref.current.visible = sc > 0.02;
    if (!animate) return;
    const pace = working ? 1.4 + Math.min(2.4, flow.packRate * 0.14) : 0;
    ref.current.rotation.y = Math.sin(clock.elapsedTime * pace + index) * (working ? 0.24 : 0.02);
    ref.current.position.y = working
      ? Math.abs(Math.sin(clock.elapsedTime * pace * 1.6 + index)) * 0.012
      : 0;
  });
  return (
    <group position={[x, 0, 0.55]} rotation={[0, Math.PI, 0]}>
      <group ref={ref}>
        <Figure look={WORKER_LOOK(index + 1)} />
      </group>
    </group>
  );
}

const AISLES: [number, number][][] = [
  [
    [-4.4, -1.4],
    [-1, -1.4],
    [-1, 1],
    [2.4, 1],
    [2.4, -1.4],
    [-4.4, -1.4],
  ],
  [
    [3.9, 0.9],
    [3.9, -1.6],
    [-2.2, -1.6],
    [-2.2, 0.9],
    [3.9, 0.9],
  ],
  [
    [-3.2, 0.5],
    [1.4, 0.5],
    [1.4, -2],
    [-3.2, -2],
    [-3.2, 0.5],
  ],
  [
    [4.4, -0.4],
    [0.6, -0.4],
    [0.6, 1.3],
    [4.4, 1.3],
    [4.4, -0.4],
  ],
];

/** How many pickers walk the aisles is a function of staffing, not decoration. */
function Pickers({ animate }: { animate: boolean }) {
  const count = useStore((s) => pickersFor(s.staffing.pickers));
  const running = useStore((s) => s.flow.inShift);
  return (
    <group position={[0, 0.2, 0]}>
      {AISLES.slice(0, count).map((path, i) => (
        <Walker
          key={i}
          animate={animate && running}
          path={path}
          look={WORKER_LOOK(i + 2)}
          carrying="parcel"
          speed={0.85 + i * 0.08}
          phase={i * 0.27}
          scale={0.95}
        />
      ))}
    </group>
  );
}

/** Moves parcels out to the dock only while a load is building. */
function DockHand({ animate }: { animate: boolean }) {
  const active = useStore((s) => s.flow.stagedParcels > TRUCK_LOAD * 0.1 && s.flow.inShift);
  if (!active) return null;
  return (
    <group position={[0, 0.44, 0]}>
      <Walker
        animate={animate}
        path={[
          [-1.2, D / 2 + 0.72],
          [1.8, D / 2 + 0.72],
        ]}
        look={WORKER_LOOK(3)}
        carrying="parcel"
        speed={0.5}
        mode="pingpong"
        scale={0.95}
      />
    </group>
  );
}

function StationDesk({ x, index }: { x: number; index: number }) {
  const lit = useStore((s) => index < stationsFor(s.staffing.pickers));
  return <Workstation position={[x, 0, 0]} lit={lit} />;
}

export function FulfillmentHouse({ animate }: { animate: boolean }) {
  const status = useStore((s) => s.metrics.fulfillment.status);
  const statusColor = STATUS_COLOR[status];

  const floorY = 0.1;
  const insideW = W - WALL * 2;

  const queueSlots = useMemo(() => stackSlots(32, [-4.5, 0.1], 8, 0.55), []);
  const dockSlots = useMemo(() => stackSlots(14, [2.3, -0.3], 5, 0.4), []);

  return (
    <group position={SITE.pos}>
      <Selectable id="fulfillment" footprint={[W, D]} height={H}>
        {/* ── floor plate ─────────────────────────────────────── */}
        <RoundedBox args={[W, 0.2, D]} radius={0.04} smoothness={2} position={[0, 0.1, 0]} receiveShadow>
          <Stone color={C.porcelain} roughness={0.5} />
        </RoundedBox>
        {[-1.9, 0.5].map((z) => (
          <mesh key={z} position={[0, 0.205, z]}>
            <boxGeometry args={[insideW - 0.6, 0.006, 0.05]} />
            <meshStandardMaterial color={C.stone} roughness={0.7} />
          </mesh>
        ))}

        {/* ── walls ───────────────────────────────────────────── */}
        <mesh position={[0, floorY + H / 2, -D / 2 + WALL / 2]} castShadow receiveShadow>
          <boxGeometry args={[W, H, WALL]} />
          <Marble />
        </mesh>
        {[-W / 2 + WALL / 2, W / 2 - WALL / 2].map((x) => (
          <mesh key={x} position={[x, floorY + H / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[WALL, H, D]} />
            <Marble />
          </mesh>
        ))}
        {/* The dock wall stops at bay height so the floor stays readable. */}
        {([
          [-4.65, 1.7],
          [-1.65, 1.1],
          [1.65, 1.1],
          [4.65, 1.7],
        ] as const).map(([x, w]) => (
          <mesh key={x} position={[x, floorY + FRONT_H / 2, D / 2 - WALL / 2]} castShadow receiveShadow>
            <boxGeometry args={[w, FRONT_H, WALL]} />
            <Marble />
          </mesh>
        ))}
        <mesh position={[0, floorY + FRONT_H + 0.06, D / 2 - WALL / 2]} castShadow>
          <boxGeometry args={[W, 0.12, WALL + 0.06]} />
          <Metal color={C.champagne} roughness={0.42} />
        </mesh>

        {/* ── status band + cornice ───────────────────────────── */}
        <mesh position={[0, floorY + FRONT_H + 0.16, D / 2 - WALL / 2 - 0.02]}>
          <boxGeometry args={[W - 0.3, 0.07, 0.07]} />
          <meshStandardMaterial
            color={statusColor}
            emissive={statusColor}
            emissiveIntensity={1.1}
            roughness={0.5}
            toneMapped={false}
          />
        </mesh>
        {([
          [0, D / 2, W + 0.18, 0.16],
          [0, -D / 2, W + 0.18, 0.16],
          [W / 2, 0, 0.16, D + 0.18],
          [-W / 2, 0, 0.16, D + 0.18],
        ] as const).map(([x, z, bw, bd], i) => (
          <mesh key={i} position={[x, floorY + H + 0.03, z]} castShadow>
            <boxGeometry args={[bw, 0.12, bd]} />
            <Metal color={C.champagne} roughness={0.42} />
          </mesh>
        ))}

        {/* ── clerestory roof over the rear ───────────────────── */}
        <group position={[0, floorY + H, -D / 2 + 1.35]}>
          <mesh position={[0, 0.06, 0]} receiveShadow castShadow>
            <boxGeometry args={[W - 0.2, 0.12, 2.1]} />
            <Stone color={C.warmStone} roughness={0.5} />
          </mesh>
          {[-3.5, -1.2, 1.2, 3.5].map((x) => (
            <group key={x} position={[x, 0.12, 0]}>
              <mesh position={[0, 0.3, 0.3]} rotation={[0.52, 0, 0]} castShadow>
                <boxGeometry args={[2.1, 0.05, 1.5]} />
                <Stone color={C.warmStone} roughness={0.46} />
              </mesh>
              <mesh position={[0, 0.3, -0.5]} rotation={[-0.35, 0, 0]}>
                <boxGeometry args={[2.06, 0.03, 1.2]} />
                <Glass opacity={0.26} />
              </mesh>
            </group>
          ))}
        </group>

        {/* ── racking: the on-hand position ───────────────────── */}
        <Inspectable target="racking" size={[10.6, 1.9, 1.7]} position={[0, 0.2, -2.35]}>
          <Shelf position={[-3.5, 0, 0]} bays={5} levels={3} filled={0.9} />
          <Shelf position={[0.1, 0, 0]} bays={5} levels={3} filled={0.75} />
          <Shelf position={[3.7, 0, 0]} bays={4} levels={3} filled={0.6} />
        </Inspectable>
        <group position={[-4.6, 0.2, 0.3]} rotation={[0, Math.PI / 2, 0]}>
          <Shelf position={[0, 0, 0]} bays={4} levels={2} filled={0.8} />
        </group>

        {/* ── the belt, paced by the live pack rate ───────────── */}
        <Inspectable target="conveyor" size={[7.2, 1.2, 1.1]} position={[0.6, 0.2, -1.15]}>
          <Conveyor />
        </Inspectable>

        {/* ── the backlog, made physical ──────────────────────── */}
        <Inspectable target="queue" size={[10, 1.3, 1.6]} position={[0, 0.2, 0.2]}>
          <Pile
            slots={queueSlots}
            read={() => useStore.getState().flow.queueUnits / UNITS_PER_BOX}
            scale={1.1}
            tone={C.stone}
          />
        </Inspectable>

        {/* ── packing stations, lit by staffing ───────────────── */}
        <Inspectable target="packline" size={[10.6, 1.4, 1.5]} position={[0, 0.2, 1.6]}>
          {[-4.1, -2.05, 0, 2.05, 4.1].map((x, i) => (
            <StationDesk key={x} x={x} index={i} />
          ))}
          {[-4.1, -2.05, 0, 2.05, 4.1].map((x, i) => (
            <Packer key={`p${x}`} x={x} index={i} animate={animate} />
          ))}
        </Inspectable>

        <group position={[4.4, 0.85, 1.5]}>
          <Handbag position={[0, 0, 0]} scale={0.95} color={C.champagne} rotation={0.4} />
        </group>

        <pointLight position={[0, 1.9, 0.8]} intensity={5} distance={9} decay={2} color="#FFE6BE" />
        <pointLight position={[-3.4, 1.5, -2]} intensity={2.4} distance={6} decay={2} color="#FFE6BE" />

        {/* ── dock ────────────────────────────────────────────── */}
        <DockBay x={-3.15} index={0} />
        <DockBay x={0} index={1} />
        <DockBay x={3.15} index={2} />

        <RoundedBox args={[W + 0.4, 0.44, 1.5]} radius={0.04} smoothness={2} position={[0, 0.22, D / 2 + 0.68]} castShadow receiveShadow>
          <Stone color={C.warmStone} roughness={0.6} />
        </RoundedBox>
        <mesh position={[0, 0.45, D / 2 + 1.43]}>
          <boxGeometry args={[W + 0.4, 0.03, 0.06]} />
          <Metal color={C.champagne} roughness={0.4} />
        </mesh>

        {/* staged parcels — the load building toward the next departure */}
        <Inspectable target="dock" size={[3, 1.1, 1.5]} position={[1.4, 0.44, D / 2 + 0.6]}>
          <Pile
            slots={dockSlots}
            read={() => useStore.getState().flow.stagedParcels / PARCELS_PER_BOX}
            tone={C.warmStone}
          />
        </Inspectable>

        {/* ── dock lighting: mounted on the wall so the floor stays open ── */}
        {[-3.15, 0, 3.15].map((x) => (
          <group key={x} position={[x, 0, D / 2 + 0.1]}>
            <mesh position={[0, FRONT_H + 0.02, 0]} castShadow>
              <boxGeometry args={[2.1, 0.07, 0.34]} />
              <Metal color={C.champagne} roughness={0.34} />
            </mesh>
            <mesh position={[0, FRONT_H - 0.03, 0.06]}>
              <boxGeometry args={[1.7, 0.03, 0.14]} />
              <Lit color={C.interior} intensity={1.6} />
            </mesh>
          </group>
        ))}

        {/* ── people ──────────────────────────────────────────── */}
        <Pickers animate={animate} />
        <DockHand animate={animate} />

        {/* ── the agent ───────────────────────────────────────── */}
        <group position={[4.9, 0.2, -0.2]}>
          <group rotation={[0, -0.5, 0]}>
            <Figure
              look={{ coat: C.espresso, skin: "#7A5239", hair: "#1B130E", cut: 0 }}
              scale={1.12}
              carrying="tablet"
            />
          </group>
          <StatusBeacon color={statusColor} y={0.62} animate={animate} />
          <AgentHit agent="analyst" />
        </group>
      </Selectable>
    </group>
  );
}
