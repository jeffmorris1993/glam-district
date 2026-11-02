"use client";

import { useRef } from "react";
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import { useStore } from "@/lib/store";
import { C, SITES, STATUS_COLOR } from "./palette";
import { Fabric, Glass, Lit, Marble, Metal, Stone, Wood } from "./Mats";
import { Handbag } from "./Props";
import { Figure, StatusBeacon, Walker, lookFor } from "./Figures";
import { AgentHit, Selectable } from "./Selectable";
import { Inspectable } from "./Inspectable";
import { damp } from "@/lib/motion";

const SITE = SITES.boutique;
const W = 8;
const D = 7.2;
const H = 4.1;
const WALL = 0.14;

/* ─────────────────────────────────────────────────────────────────
   THE GLAM BOUTIQUE
   A corner storefront: warm glass on two faces, a blush awning over
   the entrance, lit vitrines, a blade sign with a champagne monogram.
   ───────────────────────────────────────────────────────────────── */

function Storefront({
  w,
  h,
  position,
  rotation = 0,
  door,
}: {
  w: number;
  h: number;
  position: [number, number, number];
  rotation?: number;
  door?: boolean;
}) {
  const panes = 4;
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh>
        <planeGeometry args={[w, h]} />
        <Glass opacity={0.24} />
      </mesh>
      {/* frame */}
      <mesh position={[0, h / 2 - 0.03, 0.02]}>
        <boxGeometry args={[w, 0.08, 0.06]} />
        <Metal color={C.champagne} roughness={0.3} />
      </mesh>
      <mesh position={[0, -h / 2 + 0.03, 0.02]}>
        <boxGeometry args={[w, 0.08, 0.06]} />
        <Metal color={C.champagne} roughness={0.3} />
      </mesh>
      {Array.from({ length: panes + 1 }, (_, i) => (
        <mesh key={i} position={[-w / 2 + (i * w) / panes, 0, 0.02]}>
          <boxGeometry args={[0.05, h, 0.05]} />
          <Metal color={C.champagne} roughness={0.3} />
        </mesh>
      ))}
      {door && (
        <group position={[0, -h / 2 + 1.05, 0.03]}>
          <mesh>
            <planeGeometry args={[1.5, 2.1]} />
            <Glass opacity={0.16} />
          </mesh>
          <mesh position={[-0.76, 0, 0.01]}>
            <boxGeometry args={[0.06, 2.1, 0.06]} />
            <Metal color={C.gold} roughness={0.26} />
          </mesh>
          <mesh position={[0.76, 0, 0.01]}>
            <boxGeometry args={[0.06, 2.1, 0.06]} />
            <Metal color={C.gold} roughness={0.26} />
          </mesh>
          {/* handles */}
          {[-0.2, 0.2].map((x) => (
            <mesh key={x} position={[x, 0.05, 0.05]}>
              <cylinderGeometry args={[0.014, 0.014, 0.6, 8]} />
              <Metal color={C.gold} roughness={0.24} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

function Vitrine({
  position,
  rotation = 0,
  colors,
}: {
  position: [number, number, number];
  rotation?: number;
  colors: string[];
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* base */}
      <RoundedBox args={[2.1, 0.5, 0.78]} radius={0.03} smoothness={2} position={[0, 0.25, 0]} castShadow receiveShadow>
        <Marble color={C.porcelain} />
      </RoundedBox>
      <mesh position={[0, 0.51, 0]}>
        <boxGeometry args={[2.14, 0.018, 0.82]} />
        <Metal color={C.champagne} roughness={0.34} />
      </mesh>
      {/* pedestals + bags */}
      {colors.map((c, i) => {
        const h = 0.18 + (i % 2) * 0.14;
        const x = -0.7 + i * 0.7;
        return (
          <group key={i} position={[x, 0.52, 0]}>
            <mesh position={[0, h / 2, 0]} castShadow>
              <cylinderGeometry args={[0.18, 0.2, h, 16]} />
              <Marble color={C.linen} />
            </mesh>
            <Handbag position={[0, h, 0]} color={c} scale={1.15} rotation={0.5 - i * 0.4} />
          </group>
        );
      })}
      {/* vitrine spotlight wash */}
      <mesh position={[0, 0.53, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2, 0.72]} />
        <meshStandardMaterial color="#FFE8C0" transparent opacity={0.3} roughness={1} toneMapped={false} />
      </mesh>
    </group>
  );
}

function BladeSign({ pulse }: { pulse: boolean }) {
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current || !pulse) return;
    const m = ref.current.material as unknown as { emissiveIntensity: number };
    m.emissiveIntensity = 1.5 + Math.sin(clock.elapsedTime * 1.8) * 0.5;
  });
  return (
    <group position={[W / 2 + 0.24, 3.05, D / 2 - 1.2]}>
      <mesh position={[-0.14, 0, 0]}>
        <boxGeometry args={[0.28, 0.07, 0.07]} />
        <Metal color={C.champagne} roughness={0.32} />
      </mesh>
      <RoundedBox args={[0.1, 1.5, 1.05]} radius={0.04} smoothness={3} castShadow>
        <Marble color={C.espresso} />
      </RoundedBox>
      {/* champagne monogram: a ring with a bar — abstract "G" */}
      <group position={[0.07, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <mesh ref={ref}>
          <torusGeometry args={[0.3, 0.045, 10, 36, Math.PI * 1.55]} />
          <meshStandardMaterial
            color={C.goldBright}
            emissive={C.champagne}
            emissiveIntensity={1.5}
            metalness={0.9}
            roughness={0.22}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[0.22, -0.1, 0]}>
          <boxGeometry args={[0.17, 0.05, 0.05]} />
          <meshStandardMaterial
            color={C.goldBright}
            emissive={C.champagne}
            emissiveIntensity={1.5}
            metalness={0.9}
            roughness={0.22}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}

export function GlamBoutique({ animate }: { animate: boolean }) {
  const status = useStore((s) => s.metrics.boutique.status);
  const traffic = useStore((s) => s.metrics.boutique.sessions > 40000);
  /* How many clients are browsing inside is a readout of session volume. */
  const browsing = useStore((s) =>
    Math.max(1, Math.min(4, Math.round(s.metrics.boutique.sessions / 26000))),
  );
  const statusColor = STATUS_COLOR[status];

  const floorY = 0.36;

  return (
    <group position={SITE.pos}>
      <Selectable id="boutique" footprint={[W, D]} height={H}>
        {/* ── plinth + floor ──────────────────────────────────── */}
        <RoundedBox args={[W + 0.8, 0.26, D + 0.8]} radius={0.05} smoothness={2} position={[0, 0.13, 0]} receiveShadow castShadow>
          <Stone color={C.warmStone} roughness={0.55} />
        </RoundedBox>
        <RoundedBox args={[W, 0.12, D]} radius={0.02} smoothness={2} position={[0, 0.3, 0]} receiveShadow>
          <Marble color={C.marble} />
        </RoundedBox>
        {/* inlay: a champagne compass line in the floor */}
        <mesh position={[0, 0.365, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.5, 1.56, 48]} />
          <meshStandardMaterial color={C.champagne} metalness={0.9} roughness={0.3} />
        </mesh>

        {/* ── solid walls: back (-z) and left (-x) ───────────── */}
        <mesh position={[0, floorY + H / 2, -D / 2 + WALL / 2]} castShadow receiveShadow>
          <boxGeometry args={[W, H, WALL]} />
          <Marble />
        </mesh>
        <mesh position={[-W / 2 + WALL / 2, floorY + H / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[WALL, H, D]} />
          <Marble />
        </mesh>

        {/* ── storefront glazing on the two visible faces ─────── */}
        <Storefront w={W - 0.3} h={H - 0.3} position={[0, floorY + (H - 0.3) / 2 + 0.1, D / 2 - 0.06]} door />
        <Storefront
          w={D - 0.3}
          h={H - 0.3}
          rotation={Math.PI / 2}
          position={[W / 2 - 0.06, floorY + (H - 0.3) / 2 + 0.1, 0]}
        />
        <mesh position={[W / 2 - 0.07, floorY + H / 2, D / 2 - 0.07]}>
          <boxGeometry args={[0.12, H, 0.12]} />
          <Metal color={C.champagne} roughness={0.28} />
        </mesh>

        {/* ── cornice + roof: solid over the back-of-house, a thin glazed
             canopy over the salon so the room reads from above ── */}
        <mesh position={[0, floorY + H + 0.09, -D / 2 + 1.35]} castShadow receiveShadow>
          <boxGeometry args={[W + 0.44, 0.18, 2.7]} />
          <Stone color={C.warmStone} roughness={0.48} />
        </mesh>
        {/* open roof beams across the salon */}
        {[-3.1, -1.9, -0.7, 0.5, 1.7, 2.9].map((x) => (
          <mesh key={x} position={[x, floorY + H + 0.06, 1.1]} castShadow>
            <boxGeometry args={[0.07, 0.1, 4.6]} />
            <Metal color={C.champagne} roughness={0.38} />
          </mesh>
        ))}
        {/* champagne cornice frame */}
        {([
          [0, D / 2 + 0.17, W + 0.48, 0.14],
          [0, -D / 2 - 0.17, W + 0.48, 0.14],
          [W / 2 + 0.17, 0, 0.14, D + 0.48],
          [-W / 2 - 0.17, 0, 0.14, D + 0.48],
        ] as const).map(([x, z, bw, bd], i) => (
          <mesh key={i} position={[x, floorY + H + 0.06, z]} castShadow>
            <boxGeometry args={[bw, 0.16, bd]} />
            <Metal color={C.champagne} roughness={0.38} />
          </mesh>
        ))}
        {/* status band above the entrance */}
        <mesh position={[0, floorY + H - 0.16, D / 2 + 0.2]}>
          <boxGeometry args={[W - 1.4, 0.055, 0.055]} />
          <meshStandardMaterial
            color={statusColor}
            emissive={statusColor}
            emissiveIntensity={1.2}
            roughness={0.5}
            toneMapped={false}
          />
        </mesh>

        {/* ── awning over the entrance ───────────────────────── */}
        <group position={[0, floorY + 2.75, D / 2 + 0.72]}>
          <mesh rotation={[0.26, 0, 0]} castShadow>
            <boxGeometry args={[4.2, 0.07, 1.6]} />
            <Fabric color={C.blush} />
          </mesh>
          <mesh position={[0, -0.21, 0.76]}>
            <boxGeometry args={[4.24, 0.14, 0.05]} />
            <Fabric color={C.rose} />
          </mesh>
          {[-2.05, 2.05].map((x) => (
            <mesh key={x} position={[x, -0.3, -0.2]} rotation={[0, 0, 0.5]}>
              <cylinderGeometry args={[0.022, 0.022, 1.1, 8]} />
              <Metal color={C.champagne} roughness={0.34} />
            </mesh>
          ))}
          {/* under-awning downlights */}
          {[-1.3, 0, 1.3].map((x) => (
            <mesh key={x} position={[x, -0.1, 0.1]}>
              <sphereGeometry args={[0.055, 10, 8]} />
              <Lit color={C.interior} intensity={2} />
            </mesh>
          ))}
        </group>

        <BladeSign pulse={traffic && animate} />

        {/* ── window vitrines ────────────────────────────────── */}
        <group position={[0, floorY, 0]}>
          <Inspectable target="vitrine" size={[2.4, 1.2, 1.2]} position={[-2.1, 0, D / 2 - 0.85]}>
            <Vitrine position={[0, 0, 0]} colors={[C.champagne, C.rose, C.espresso]} />
          </Inspectable>
          <Vitrine position={[W / 2 - 0.85, 0, -1.9]} rotation={Math.PI / 2} colors={[C.porcelain, C.sage, C.blush]} />
        </group>

        {/* ── interior fit-out ───────────────────────────────── */}
        {/* back wall display shelving */}
        <group position={[0, floorY, -D / 2 + 0.45]}>
          {[0.75, 1.35, 1.95].map((y, li) => (
            <group key={y}>
              <mesh position={[0, y, 0]} castShadow receiveShadow>
                <boxGeometry args={[5.6, 0.05, 0.46]} />
                <Wood color={C.espressoLight} />
              </mesh>
              <mesh position={[0, y + 0.28, -0.2]}>
                <planeGeometry args={[5.6, 0.5]} />
                <meshStandardMaterial color="#FFEBCB" transparent opacity={0.22} roughness={1} toneMapped={false} />
              </mesh>
              {Array.from({ length: 5 }, (_, i) => (
                <Handbag
                  key={i}
                  position={[-2.2 + i * 1.1, y + 0.025, 0]}
                  color={[C.champagne, C.blush, C.espresso, C.sage, C.rose][(i + li) % 5]}
                  scale={0.92}
                  rotation={0.1 * i}
                />
              ))}
            </group>
          ))}
        </group>

        {/* round ottoman */}
        <group position={[-0.1, floorY, 0.9]}>
          <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.72, 0.76, 0.4, 28]} />
            <Fabric color={C.blush} />
          </mesh>
          <mesh position={[0, 0.41, 0]}>
            <cylinderGeometry args={[0.7, 0.7, 0.03, 28]} />
            <Fabric color={C.rose} />
          </mesh>
        </group>

        {/* clienteling counter */}
        <group position={[-2.6, floorY, -1.9]}>
          <RoundedBox args={[1.9, 0.86, 0.7]} radius={0.03} smoothness={2} position={[0, 0.43, 0]} castShadow receiveShadow>
            <Marble color={C.porcelain} />
          </RoundedBox>
          <mesh position={[0, 0.875, 0]}>
            <boxGeometry args={[1.98, 0.02, 0.76]} />
            <Metal color={C.champagne} roughness={0.34} />
          </mesh>
          {/* a tablet on the counter */}
          <group position={[0.5, 0.9, 0.05]} rotation={[-1.1, 0.3, 0]}>
            <mesh>
              <boxGeometry args={[0.3, 0.4, 0.015]} />
              <meshStandardMaterial color={C.charcoal} roughness={0.3} metalness={0.4} />
            </mesh>
            <mesh position={[0, 0, 0.011]}>
              <planeGeometry args={[0.26, 0.34]} />
              <Lit color="#F4E6C9" intensity={0.8} />
            </mesh>
          </group>
          {/* a flower stem */}
          <mesh position={[-0.65, 1.0, 0]}>
            <cylinderGeometry args={[0.07, 0.05, 0.22, 12]} />
            <Marble color={C.linen} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[-0.65 + (i - 1) * 0.06, 1.18 + i * 0.03, (i - 1) * 0.04]} castShadow>
              <icosahedronGeometry args={[0.06, 0] } />
              <meshStandardMaterial color={i === 1 ? C.rose : C.blush} roughness={0.85} flatShading />
            </mesh>
          ))}
        </group>

        {/* centre display plinth */}
        <group position={[2.1, floorY, 1.2]}>
          <RoundedBox args={[1.2, 0.72, 1.2]} radius={0.04} smoothness={2} position={[0, 0.36, 0]} castShadow receiveShadow>
            <Marble color={C.porcelain} />
          </RoundedBox>
          <mesh position={[0, 0.73, 0]}>
            <boxGeometry args={[1.24, 0.016, 1.24]} />
            <Metal color={C.champagne} roughness={0.34} />
          </mesh>
          <Handbag position={[-0.22, 0.74, 0.18]} color={C.champagne} scale={1.5} rotation={0.4} />
          <Handbag position={[0.26, 0.74, -0.14]} color={C.rose} scale={1.2} rotation={-0.5} />
        </group>

        {/* ── chandelier + interior light ────────────────────── */}
        <group position={[-0.1, floorY + 3.05, 0.6]}>
          <mesh position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.7, 5]} />
            <Metal color={C.champagne} roughness={0.4} />
          </mesh>
          {Array.from({ length: 9 }, (_, i) => {
            const a = (i / 9) * Math.PI * 2;
            const r = 0.3 + (i % 2) * 0.12;
            return (
              <mesh key={i} position={[Math.cos(a) * r, -(i % 3) * 0.11, Math.sin(a) * r]}>
                <sphereGeometry args={[0.045, 10, 8]} />
                <Lit color={C.interior} intensity={2.4} />
              </mesh>
            );
          })}
          <mesh>
            <torusGeometry args={[0.34, 0.012, 6, 28]} />
            <Metal color={C.gold} roughness={0.3} />
          </mesh>
        </group>
        <pointLight position={[0, floorY + 2.3, 0.6]} intensity={7} distance={9} decay={2} color="#FFE4B8" />
        <pointLight position={[0, floorY + 1.3, D / 2 - 1]} intensity={3} distance={6} decay={2} color="#FFE4B8" />

        {/* ── clients browsing inside: count tracks session volume ── */}
        <Inspectable target="floor" size={[6.4, 1.3, 5.4]} position={[0, floorY, 0.4]}>
          <group>
            {BROWSE_ROUTES.slice(0, browsing).map((path, i) => (
              <Walker
                key={i}
                animate={animate}
                path={path}
                look={lookFor(i * 5 + 7)}
                carrying={i % 2 === 0 ? "bag" : null}
                speed={0.36 + i * 0.05}
                phase={i * 0.31}
                scale={0.96}
              />
            ))}
            <group position={[-2.6, 0, -1.1]} rotation={[0, Math.PI, 0]}>
              <Figure look={lookFor(5)} scale={0.97} carrying="bag" />
            </group>
          </group>
        </Inspectable>

        {/* ── the agent: the concierge ────────────────────────── */}
        <group position={[1.15, floorY, 2.45]}>
          <Concierge animate={animate} />
          <StatusBeacon color={statusColor} y={0.62} animate={animate} />
          <AgentHit agent="concierge" />
        </group>
      </Selectable>
    </group>
  );
}

/* Interior browse loops. Which of them are occupied is set by traffic. */
const BROWSE_ROUTES: [number, number][][] = [
  [
    [1.2, 2.3],
    [2.1, 0.2],
    [-0.9, -0.6],
    [-2.4, 0.9],
    [1.2, 2.3],
  ],
  [
    [-2.3, 1.7],
    [-2.3, -0.9],
    [0.6, -1.3],
    [-2.3, 1.7],
  ],
  [
    [2.6, 2.6],
    [0.4, 2.2],
    [-1.8, 2.5],
    [2.6, 2.6],
  ],
  [
    [2.3, -1.5],
    [-1.4, -1.6],
    [-2.5, 0.4],
    [2.3, -1.5],
  ],
];

/**
 * The concierge turns toward the door when question volume is high and
 * back to the salon when it settles — a readout, not an idle animation.
 */
function Concierge({ animate }: { animate: boolean }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }, dt) => {
    if (!ref.current) return;
    const s = useStore.getState();
    const busy = s.metrics.boutique.inquiries > 300;
    const want = busy ? 1.15 : 2.5;
    ref.current.rotation.y = damp(ref.current.rotation.y, want, 2.5, Math.min(0.1, dt));
    if (animate) {
      // a small conversational shift while handling questions
      ref.current.position.x = busy ? Math.sin(clock.elapsedTime * 0.9) * 0.05 : 0;
    }
  });
  return (
    <group ref={ref} rotation={[0, 2.5, 0]}>
      <Figure
        look={{ coat: C.roseDeep, skin: "#8C5F42", hair: "#211811", cut: 2 }}
        scale={1.12}
        carrying="tablet"
      />
    </group>
  );
}
