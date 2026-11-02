"use client";

import { useRef } from "react";
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { useStore } from "@/lib/store";
import { C, SITES, STATUS_COLOR } from "./palette";
import { Glass, Lit, Marble, Metal, Stone } from "./Mats";
import { Handbag, Parcel, Shelf, Van, Workstation } from "./Props";
import { Figure, StatusBeacon, Walker, WORKER_LOOK } from "./Figures";
import { AgentHit, Selectable } from "./Selectable";

const SITE = SITES.fulfillment;
const W = 11.2;
const D = 7.6;
const H = 2.9;
const WALL = 0.16;

/* ─────────────────────────────────────────────────────────────────
   THE FULFILLMENT HOUSE
   A low marble warehouse volume, open to the sky over the packing
   floor so the operation is legible from the isometric camera.
   Three dock bays face the boulevard under a champagne canopy.
   ───────────────────────────────────────────────────────────────── */

function Conveyor({ animate, busy }: { animate: boolean; busy: boolean }) {
  const group = useRef<Group>(null);
  const COUNT = 7;
  const LEN = 6.4;
  const refs = useRef<(Group | null)[]>([]);
  const t = useRef(0);

  useFrame((_, dt) => {
    if (animate) t.current += dt * (busy ? 0.3 : 0.16);
    refs.current.forEach((r, i) => {
      if (!r) return;
      const u = (t.current + i / COUNT) % 1;
      r.position.x = -LEN / 2 + u * LEN;
      r.position.y = 0.1 + Math.sin(u * Math.PI * 6) * 0.004;
    });
  });

  return (
    <group ref={group}>
      {/* belt bed */}
      <RoundedBox args={[LEN + 0.3, 0.1, 0.56]} radius={0.03} smoothness={2} position={[0, 0.5, 0]} castShadow receiveShadow>
        <Stone color={C.taupe} roughness={0.5} />
      </RoundedBox>
      <mesh position={[0, 0.558, 0]}>
        <boxGeometry args={[LEN + 0.22, 0.012, 0.46]} />
        <meshStandardMaterial color={C.charcoal} roughness={0.85} />
      </mesh>
      {/* legs */}
      {[-LEN / 2 + 0.3, 0, LEN / 2 - 0.3].map((x) => (
        <mesh key={x} position={[x, 0.24, 0]}>
          <boxGeometry args={[0.07, 0.48, 0.4]} />
          <Metal color={C.taupeDeep} roughness={0.55} />
        </mesh>
      ))}
      {/* parcels riding the belt */}
      <group position={[0, 0.465, 0]}>
        {Array.from({ length: COUNT }, (_, i) => (
          <group key={i} ref={(el) => void (refs.current[i] = el)}>
            <Parcel position={[0, 0, 0]} scale={0.62} rotation={i * 0.4} />
          </group>
        ))}
      </group>
    </group>
  );
}

function DockBay({ x, open }: { x: number; open: boolean }) {
  return (
    <group position={[x, 0, D / 2 - WALL / 2]}>
      {/* recessed opening */}
      <mesh position={[0, 0.95, -0.06]}>
        <boxGeometry args={[1.9, 1.7, 0.1]} />
        <meshStandardMaterial color="#241D19" roughness={0.95} />
      </mesh>
      {/* rolling shutter, partially down when the bay is idle */}
      <mesh position={[0, open ? 1.9 : 1.1, 0.02]}>
        <boxGeometry args={[1.94, open ? 0.5 : 1.75, 0.05]} />
        <meshStandardMaterial color={C.stone} roughness={0.42} metalness={0.45} envMapIntensity={1.1} />
      </mesh>
      {/* shutter housing */}
      <mesh position={[0, 1.93, 0.06]}>
        <boxGeometry args={[2.06, 0.22, 0.16]} />
        <Metal color={C.champagne} roughness={0.35} />
      </mesh>
      {/* dock bumpers */}
      {[-0.98, 0.98].map((bx) => (
        <mesh key={bx} position={[bx, 0.42, 0.1]}>
          <boxGeometry args={[0.1, 0.22, 0.14]} />
          <meshStandardMaterial color={C.espresso} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

export function FulfillmentHouse({ animate }: { animate: boolean }) {
  const status = useStore((s) => s.metrics.fulfillment.status);
  const busy = useStore((s) => s.metrics.fulfillment.backlogDays > 2);
  const statusColor = STATUS_COLOR[status];

  const floorY = 0.1;
  const insideW = W - WALL * 2;

  return (
    <group position={SITE.pos}>
      <Selectable id="fulfillment" footprint={[W, D]} height={H}>
        {/* ── floor plate ─────────────────────────────────────── */}
        <RoundedBox args={[W, 0.2, D]} radius={0.04} smoothness={2} position={[0, 0.1, 0]} receiveShadow>
          <Stone color={C.porcelain} roughness={0.5} />
        </RoundedBox>
        {/* pick-lane markings */}
        {[-1.9, 0.5].map((z) => (
          <mesh key={z} position={[0, 0.205, z]}>
            <boxGeometry args={[insideW - 0.6, 0.006, 0.05]} />
            <meshStandardMaterial color={C.stone} roughness={0.7} />
          </mesh>
        ))}

        {/* ── walls (back + sides full, front segmented for docks) ── */}
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
        {/* front wall piers between the three dock bays */}
        {([
          [-4.65, 1.7],
          [-1.65, 1.1],
          [1.65, 1.1],
          [4.65, 1.7],
        ] as const).map(([x, w]) => (
          <mesh key={x} position={[x, floorY + H / 2, D / 2 - WALL / 2]} castShadow receiveShadow>
            <boxGeometry args={[w, H, WALL]} />
            <Marble />
          </mesh>
        ))}
        {/* lintel above the bays */}
        <mesh position={[0, floorY + H - 0.32, D / 2 - WALL / 2]} castShadow>
          <boxGeometry args={[W, 0.64, WALL]} />
          <Marble />
        </mesh>

        {/* ── status band at the roofline ──────────────────────── */}
        <mesh position={[0, floorY + H + 0.06, D / 2 - WALL / 2 - 0.02]}>
          <boxGeometry args={[W - 0.3, 0.07, 0.07]} />
          <meshStandardMaterial
            color={statusColor}
            emissive={statusColor}
            emissiveIntensity={1.1}
            roughness={0.5}
            toneMapped={false}
          />
        </mesh>
        {/* champagne cornice — four bars, the pack floor stays open to the sky */}
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

        {/* ── clerestory + sawtooth roof over the rear third ───── */}
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

        {/* ── interior fit-out ─────────────────────────────────── */}
        {/* racking along the back wall */}
        <group position={[0, 0.2, -2.35]}>
          <Shelf position={[-3.5, 0, 0]} bays={5} levels={3} filled={0.9} />
          <Shelf position={[0.1, 0, 0]} bays={5} levels={3} filled={0.75} />
          <Shelf position={[3.7, 0, 0]} bays={4} levels={3} filled={0.6} />
        </group>
        {/* second run, rotated */}
        <group position={[-4.6, 0.2, 0.3]} rotation={[0, Math.PI / 2, 0]}>
          <Shelf position={[0, 0, 0]} bays={4} levels={2} filled={0.8} />
        </group>

        {/* conveyor down the middle of the pack floor */}
        <group position={[0.6, 0.2, -0.75]}>
          <Conveyor animate={animate} busy={busy} />
        </group>

        {/* packing stations facing the docks */}
        <group position={[0, 0.2, 1.5]}>
          <Workstation position={[-3.3, 0, 0]} />
          <Workstation position={[-1, 0, 0]} />
          <Workstation position={[1.3, 0, 0]} />
          <Workstation position={[3.6, 0, 0]} lit={busy} />
        </group>

        {/* staged pallets near the docks */}
        <group position={[0, 0.2, 2.6]}>
          {([
            [-4.3, 0, 0.2],
            [-4.3, 0.21, 0.2],
            [-4.3, 0.42, 0.2],
            [4.4, 0, -0.1],
            [4.4, 0.21, -0.1],
            [4.75, 0, 0.3],
          ] as const).map(([x, y, z], i) => (
            <Parcel key={i} position={[x, y + 0.1, z]} scale={0.95} rotation={i * 0.35} />
          ))}
        </group>

        {/* a handbag on the QC table, lit */}
        <group position={[3.6, 0.65, 1.5]}>
          <Handbag position={[0, 0, 0]} scale={0.95} color={C.champagne} rotation={0.4} />
        </group>

        <pointLight position={[0, 1.9, 0.8]} intensity={5} distance={9} decay={2} color="#FFE6BE" />
        <pointLight position={[-3.4, 1.5, -2]} intensity={2.4} distance={6} decay={2} color="#FFE6BE" />

        {/* ── dock bays + canopy ──────────────────────────────── */}
        <DockBay x={-3.15} open />
        <DockBay x={0} open={busy} />
        <DockBay x={3.15} open={false} />

        {/* dock platform */}
        <RoundedBox args={[W + 0.4, 0.44, 1.5] } radius={0.04} smoothness={2} position={[0, 0.22, D / 2 + 0.68]} castShadow receiveShadow>
          <Stone color={C.warmStone} roughness={0.6} />
        </RoundedBox>
        <mesh position={[0, 0.45, D / 2 + 1.43]}>
          <boxGeometry args={[W + 0.4, 0.03, 0.06]} />
          <Metal color={C.champagne} roughness={0.4} />
        </mesh>

        {/* canopy */}
        <group position={[0, 0, D / 2 + 0.9]}>
          {/* a slim marquee over the bay openings only */}
          <group rotation={[0.12, 0, 0]} position={[0, 0, -0.62]}>
            <mesh position={[0, 2.26, 0]} castShadow>
              <boxGeometry args={[W - 0.5, 0.07, 0.86]} />
              <Marble color={C.porcelain} />
            </mesh>
            <mesh position={[0, 2.22, 0.42]}>
              <boxGeometry args={[W - 0.48, 0.09, 0.09]} />
              <Metal color={C.champagne} roughness={0.32} />
            </mesh>
            {[-4.8, 0, 4.8].map((x) => (
              <mesh key={x} position={[x, 2.26, 0]} castShadow>
                <boxGeometry args={[0.09, 0.1, 0.9]} />
                <Metal color={C.champagne} roughness={0.34} />
              </mesh>
            ))}
          </group>
          {[-5.1, 5.1].map((x) => (
            <mesh key={x} position={[x, 1.2, -0.35]} castShadow>
              <cylinderGeometry args={[0.05, 0.06, 2.1, 10]} />
              <Metal color={C.champagne} roughness={0.35} />
            </mesh>
          ))}
          {/* downlights */}
          {[-3.15, 0, 3.15].map((x) => (
            <mesh key={x} position={[x, 1.86, -0.62]}>
              <cylinderGeometry args={[0.1, 0.1, 0.03, 12]} />
              <Lit color={C.interior} intensity={1.7} />
            </mesh>
          ))}
        </group>

        {/* parked van at the left bay, nose out */}
        <group position={[-3.2, 0.19, D / 2 + 2.9]} rotation={[0, Math.PI / 2, 0]}>
          <Van color={C.porcelain} />
        </group>

        {/* ── people ──────────────────────────────────────────── */}
        {/* packers at stations */}
        <group position={[-3.3, 0.2, 2.05]} rotation={[0, Math.PI, 0]}>
          <Figure look={WORKER_LOOK(1)} scale={0.95} />
        </group>
        <group position={[1.3, 0.2, 2.05]} rotation={[0, Math.PI, 0]}>
          <Figure look={WORKER_LOOK(4)} scale={0.95} />
        </group>
        {/* a picker walking the aisle with a parcel */}
        <group position={[0, 0.2, 0]}>
          <Walker
            animate={animate}
            path={[
              [-4.4, -1.4],
              [-1, -1.4],
              [-1, 1],
              [2.4, 1],
              [2.4, -1.4],
              [-4.4, -1.4],
            ]}
            look={WORKER_LOOK(2)}
            carrying="parcel"
            speed={0.95}
            scale={0.95}
          />
          <Walker
            animate={animate}
            path={[
              [3.9, 0.9],
              [3.9, -1.6],
              [-2.2, -1.6],
              [-2.2, 0.9],
              [3.9, 0.9],
            ]}
            look={WORKER_LOOK(5)}
            carrying="parcel"
            speed={0.8}
            phase={0.4}
            scale={0.93}
          />
        </group>
        {/* a dock associate loading the van */}
        <group position={[0, 0.44, 0]}>
          <Walker
            animate={animate}
            path={[
              [-4.2, D / 2 + 0.75],
              [-2.1, D / 2 + 0.75],
              [-4.2, D / 2 + 0.75],
            ]}
            look={WORKER_LOOK(3)}
            carrying="parcel"
            speed={0.6}
            phase={0.25}
            scale={0.95}
          />
        </group>

        {/* ── the agent ───────────────────────────────────────── */}
        <group position={[2.9, 0.2, 0.15]}>
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
