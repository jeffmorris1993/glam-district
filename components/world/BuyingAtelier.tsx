"use client";

import { RoundedBox } from "@react-three/drei";
import { useStore } from "@/lib/store";
import { C, SITES, STATUS_COLOR } from "./palette";
import { Fabric, Glass, Lit, Marble, Metal, Stone, Wood } from "./Mats";
import { Handbag, Workstation } from "./Props";
import { Figure, StatusBeacon, Walker, lookFor } from "./Figures";
import { AgentHit, Selectable } from "./Selectable";

const SITE = SITES.atelier;
const W = 8.4;
const D = 7;
const H = 4.6;
const WALL = 0.14;

/* ─────────────────────────────────────────────────────────────────
   THE BUYING ATELIER
   A two-storey glass studio. Floor-to-ceiling glazing on the two
   faces the camera sees, marble on the two it does not, a mezzanine
   over the rear half so both levels read from above.
   ───────────────────────────────────────────────────────────────── */

function Mullions({
  w,
  h,
  cols,
  rows,
  rotation = 0,
  position,
}: {
  w: number;
  h: number;
  cols: number;
  rows: number;
  rotation?: number;
  position: [number, number, number];
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh>
        <planeGeometry args={[w, h]} />
        <Glass opacity={0.22} />
      </mesh>
      {Array.from({ length: cols + 1 }, (_, i) => (
        <mesh key={`v${i}`} position={[-w / 2 + (i * w) / cols, 0, 0.012]}>
          <boxGeometry args={[0.045, h, 0.045]} />
          <Metal color={C.champagne} roughness={0.3} />
        </mesh>
      ))}
      {Array.from({ length: rows + 1 }, (_, i) => (
        <mesh key={`h${i}`} position={[0, -h / 2 + (i * h) / rows, 0.012]}>
          <boxGeometry args={[w, 0.04, 0.04]} />
          <Metal color={C.champagne} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function MoodBoard({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  const swatches: [number, number, string][] = [
    [-0.42, 0.34, C.blush],
    [-0.14, 0.34, C.champagne],
    [0.14, 0.34, C.espresso],
    [0.42, 0.34, C.sage],
    [-0.42, 0.04, C.rose],
    [-0.14, 0.04, C.porcelain],
    [0.14, 0.04, C.taupe],
    [0.42, 0.04, C.gold],
    [-0.28, -0.28, C.stone],
    [0.06, -0.28, C.roseDeep],
    [0.4, -0.28, C.olive],
  ];
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh castShadow>
        <boxGeometry args={[1.18, 1.0, 0.05]} />
        <Stone color={C.porcelain} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.028]}>
        <planeGeometry args={[1.1, 0.92]} />
        <Fabric color={C.linen} />
      </mesh>
      {swatches.map(([x, y, c], i) => (
        <mesh key={i} position={[x, y, 0.036]} rotation={[0, 0, (i % 3) * 0.04 - 0.04]}>
          <planeGeometry args={[0.2, 0.24]} />
          <Fabric color={c} />
        </mesh>
      ))}
      {/* champagne frame */}
      {([
        [0, 0.51, 1.2, 0.035],
        [0, -0.51, 1.2, 0.035],
      ] as const).map(([x, y, w, h], i) => (
        <mesh key={`f${i}`} position={[x, y, 0.03]}>
          <boxGeometry args={[w, h, 0.05]} />
          <Metal color={C.champagne} roughness={0.32} />
        </mesh>
      ))}
    </group>
  );
}

function SampleTable({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <RoundedBox args={[1.9, 0.07, 0.82]} radius={0.02} smoothness={3} position={[0, 0.5, 0]} castShadow receiveShadow>
        <Marble color={C.porcelain} />
      </RoundedBox>
      {([
        [-0.82, 0.32],
        [0.82, 0.32],
        [-0.82, -0.32],
        [0.82, -0.32],
      ] as const).map(([x, z], i) => (
        <mesh key={i} position={[x, 0.25, z]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 0.5, 8]} />
          <Metal color={C.champagne} roughness={0.34} />
        </mesh>
      ))}
      {/* samples laid out */}
      <Handbag position={[-0.62, 0.535, 0.05]} color={C.champagne} scale={1.05} rotation={0.3} />
      <Handbag position={[-0.05, 0.535, -0.1]} color={C.rose} scale={1} rotation={-0.2} />
      <Handbag position={[0.52, 0.535, 0.08]} color={C.espresso} scale={1.1} rotation={0.6} />
      {/* spec sheets */}
      <mesh position={[0.78, 0.542, -0.24]} rotation={[-Math.PI / 2, 0, 0.3]}>
        <planeGeometry args={[0.3, 0.38]} />
        <meshStandardMaterial color={C.porcelain} roughness={0.9} />
      </mesh>
    </group>
  );
}

function DisplayPedestal({
  position,
  color,
  h = 0.62,
}: {
  position: [number, number, number];
  color: string;
  h?: number;
}) {
  return (
    <group position={position}>
      <RoundedBox args={[0.52, h, 0.52]} radius={0.03} smoothness={2} position={[0, h / 2, 0]} castShadow receiveShadow>
        <Marble color={C.porcelain} />
      </RoundedBox>
      <mesh position={[0, h + 0.008, 0]}>
        <boxGeometry args={[0.54, 0.016, 0.54]} />
        <Metal color={C.champagne} roughness={0.35} />
      </mesh>
      <Handbag position={[0, h + 0.016, 0]} color={color} scale={1.25} rotation={0.4} />
    </group>
  );
}

export function BuyingAtelier({ animate }: { animate: boolean }) {
  const status = useStore((s) => s.metrics.inventory.status);
  const critical = useStore((s) => s.metrics.inventory.critical.length);
  const statusColor = STATUS_COLOR[status];

  const mezzY = 2.3;

  return (
    <group position={SITE.pos}>
      <Selectable id="atelier" footprint={[W, D]} height={H}>
        {/* ── plinth + ground floor ───────────────────────────── */}
        <RoundedBox args={[W + 0.7, 0.26, D + 0.7]} radius={0.05} smoothness={2} position={[0, 0.13, 0]} receiveShadow castShadow>
          <Stone color={C.warmStone} roughness={0.55} />
        </RoundedBox>
        <RoundedBox args={[W, 0.12, D]} radius={0.02} smoothness={2} position={[0, 0.3, 0]} receiveShadow>
          <Marble color={C.marble} />
        </RoundedBox>

        {/* ── solid walls: back (-z) and left (-x) ────────────── */}
        <mesh position={[0, 0.36 + H / 2, -D / 2 + WALL / 2]} castShadow receiveShadow>
          <boxGeometry args={[W, H, WALL]} />
          <Marble />
        </mesh>
        <mesh position={[-W / 2 + WALL / 2, 0.36 + H / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[WALL, H, D]} />
          <Marble />
        </mesh>

        {/* ── glazing: front (+z) and right (+x) ──────────────── */}
        <Mullions w={W - 0.3} h={H - 0.2} cols={6} rows={3} position={[0, 0.36 + H / 2, D / 2 - 0.05]} />
        <Mullions
          w={D - 0.3}
          h={H - 0.2}
          cols={5}
          rows={3}
          rotation={Math.PI / 2}
          position={[W / 2 - 0.05, 0.36 + H / 2, 0]}
        />
        {/* corner post */}
        <mesh position={[W / 2 - 0.06, 0.36 + H / 2, D / 2 - 0.06]}>
          <boxGeometry args={[0.1, H, 0.1]} />
          <Metal color={C.champagne} roughness={0.28} />
        </mesh>

        {/* ── roof: a slab over the mezzanine only — the double-height
             showroom stays open to the sky, as an architectural model would ── */}
        <mesh position={[0, 0.36 + H + 0.07, -D / 4 - 0.45]} castShadow receiveShadow>
          <boxGeometry args={[W + 0.3, 0.14, D / 2 + 0.4]} />
          <Stone color={C.warmStone} roughness={0.48} />
        </mesh>
        {/* champagne parapet — a frame around the whole footprint */}
        {([
          [0, D / 2 + 0.15, W + 0.42, 0.14],
          [0, -D / 2 - 0.15, W + 0.42, 0.14],
          [W / 2 + 0.15, 0, 0.14, D + 0.42],
          [-W / 2 - 0.15, 0, 0.14, D + 0.42],
        ] as const).map(([x, z, bw, bd], i) => (
          <mesh key={i} position={[x, 0.36 + H + 0.09, z]} castShadow>
            <boxGeometry args={[bw, 0.14, bd]} />
            <Metal color={C.champagne} roughness={0.4} />
          </mesh>
        ))}
        {/* status band under the roof slab */}
        <mesh position={[0, 0.36 + H - 0.04, D / 2 + 0.07]}>
          <boxGeometry args={[W - 0.6, 0.06, 0.06]} />
          <meshStandardMaterial
            color={statusColor}
            emissive={statusColor}
            emissiveIntensity={1.2}
            roughness={0.5}
            toneMapped={false}
          />
        </mesh>
        {/* roof-garden topiaries, read as tiny green dots from above */}
        {([-2.9, -1.6, 2.1, 3.2] as const).map((x, i) => (
          <group key={x} position={[x, 0.36 + H + 0.26, i % 2 === 0 ? -2.7 : -1.6]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.16, 0.18, 0.18, 10]} />
              <Stone color={C.porcelain} roughness={0.45} />
            </mesh>
            <mesh position={[0, 0.24, 0]} castShadow>
              <icosahedronGeometry args={[0.18, 1]} />
              <meshStandardMaterial color={C.sage} roughness={0.88} flatShading />
            </mesh>
          </group>
        ))}

        {/* ── mezzanine over the rear half ────────────────────── */}
        <group>
          <mesh position={[0, mezzY, -D / 4 - 0.3] } castShadow receiveShadow>
            <boxGeometry args={[W - WALL * 2, 0.14, D / 2 - 0.6]} />
            <Marble color={C.porcelain} />
          </mesh>
          {/* mezzanine edge in champagne */}
          <mesh position={[0, mezzY + 0.18, -0.57]}>
            <boxGeometry args={[W - WALL * 2, 0.5, 0.025]} />
            <Glass opacity={0.2} />
          </mesh>
          <mesh position={[0, mezzY + 0.43, -0.57]}>
            <boxGeometry args={[W - WALL * 2, 0.04, 0.06]} />
            <Metal color={C.champagne} roughness={0.3} />
          </mesh>
          {/* stair */}
          {Array.from({ length: 8 }, (_, i) => (
            <mesh key={i} position={[W / 2 - 0.95, 0.42 + i * 0.235, -0.1 - i * 0.2]} castShadow>
              <boxGeometry args={[1.1, 0.05, 0.22]} />
              <Marble color={C.porcelain} />
            </mesh>
          ))}
        </group>

        {/* ── ground-floor showroom ──────────────────────────── */}
        <SampleTable position={[0.5, 0.36, 1.6]} />
        <DisplayPedestal position={[-2.6, 0.36, 1.9]} color={C.champagne} h={0.7} />
        <DisplayPedestal position={[-2.6, 0.36, 0.5]} color={C.rose} h={0.55} />
        <DisplayPedestal position={[2.9, 0.36, 2.1]} color={C.porcelain} h={0.64} />

        {/* accessory shelving on the solid left wall */}
        <group position={[-W / 2 + 0.42, 0.36, -1.4]}>
          {[0.6, 1.1, 1.6].map((y, li) => (
            <group key={y}>
              <mesh position={[0, y, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.44, 0.04, 2.6]} />
                <Wood color={C.espressoLight} />
              </mesh>
              {Array.from({ length: 4 }, (_, i) => (
                <Handbag
                  key={i}
                  position={[0, y + 0.02, -1 + i * 0.66]}
                  color={[C.champagne, C.blush, C.espresso, C.sage][(i + li) % 4]}
                  scale={0.78}
                  rotation={Math.PI / 2}
                />
              ))}
            </group>
          ))}
        </group>

        {/* ── mezzanine: the planner's desk + trend wall ──────── */}
        <group position={[0, mezzY + 0.07, 0]}>
          <Workstation position={[-1.3, 0, -2.3]} rotation={Math.PI} />
          <Workstation position={[0.9, 0, -2.3]} rotation={Math.PI} />
          <MoodBoard position={[-2.3, 0.95, -D / 2 + 0.25]} />
          <MoodBoard position={[1.8, 0.95, -D / 2 + 0.25]} />
          {/* a rail of samples */}
          <mesh position={[2.9, 1.1, -1.9]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.02, 0.02, 1.7, 8]} />
            <Metal color={C.champagne} roughness={0.3} />
          </mesh>
          {[-0.6, -0.2, 0.2, 0.6].map((z, i) => (
            <Handbag
              key={z}
              position={[2.9, 0.78, -1.9 + z]}
              color={[C.rose, C.champagne, C.taupe, C.porcelain][i]}
              scale={0.85}
              rotation={Math.PI / 2}
            />
          ))}
        </group>

        {/* ── lighting: pendants + interior wash ──────────────── */}
        {([
          [-2, 1.9, 1.9],
          [0.5, 1.9, 1.6],
          [2.9, 1.9, 2.1],
        ] as const).map(([x, y, z], i) => (
          <group key={i} position={[x, 0.36, z]}>
            <mesh position={[0, y + 0.55, 0]}>
              <cylinderGeometry args={[0.006, 0.006, 1.1, 5]} />
              <Metal color={C.champagne} roughness={0.4} />
            </mesh>
            <mesh position={[0, y, 0]}>
              <coneGeometry args={[0.14, 0.18, 14, 1, true]} />
              <Metal color={C.goldBright} roughness={0.3} />
            </mesh>
            <mesh position={[0, y - 0.06, 0]}>
              <sphereGeometry args={[0.07, 12, 10]} />
              <Lit color={C.interior} intensity={2.2} />
            </mesh>
          </group>
        ))}
        <pointLight position={[0, 1.9, 1.4]} intensity={6} distance={9} decay={2} color="#FFE9C6" />
        <pointLight position={[0, mezzY + 1.2, -2]} intensity={3.4} distance={7} decay={2} color="#FFE9C6" />

        {/* alert lamp on the mezzanine when a style is at risk */}
        {critical > 0 && (
          <mesh position={[2.2, mezzY + 0.75, -2.3]}>
            <sphereGeometry args={[0.055, 10, 8]} />
            <Lit color={C.alert} intensity={2.6} />
          </mesh>
        )}

        {/* ── people ──────────────────────────────────────────── */}
        {/* a buyer reviewing the sample table */}
        <group position={[0.5, 0.36, 2.5]} rotation={[0, Math.PI, 0]}>
          <Figure look={lookFor(4)} scale={1} carrying="swatch" />
        </group>
        {/* an assistant crossing the showroom */}
        <group position={[0, 0.36, 0]}>
          <Walker
            animate={animate}
            path={[
              [-1.6, 0.3],
              [2.4, 0.4],
              [2.4, 2.6],
              [-1.6, 2.4],
              [-1.6, 0.3],
            ]}
            look={lookFor(9)}
            carrying="bag"
            speed={0.5}
            scale={0.97}
          />
        </group>

        {/* ── the agent: studying the trend wall on the mezzanine ── */}
        <group position={[-0.25, mezzY + 0.07, -1.55]}>
          <group rotation={[0, 0.2, 0]}>
            <Figure
              look={{ coat: C.sageDeep, skin: "#C79B76", hair: "#2B1B13", cut: 2 }}
              scale={1.12}
              carrying="tablet"
            />
          </group>
          <StatusBeacon color={statusColor} y={0.64} animate={animate} />
          <AgentHit agent="strategist" />
        </group>
      </Selectable>
    </group>
  );
}
