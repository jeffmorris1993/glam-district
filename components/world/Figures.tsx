"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import type { Group, Mesh } from "three";
import { C } from "./palette";
import { Fabric, Lit, Metal } from "./Mats";

/* ─────────────────────────────────────────────────────────────────
   Miniature people. ~0.5 units tall — the scale of an architectural
   model figure. Stylised, no faces, soft silhouettes.
   ───────────────────────────────────────────────────────────────── */

export interface FigureLook {
  coat: string;
  skin: string;
  hair: string;
  bag?: string;
  /** 0 = long coat, 1 = short jacket, 2 = dress */
  cut?: number;
}

export function Figure({
  look,
  scale = 1,
  carrying,
}: {
  look: FigureLook;
  scale?: number;
  carrying?: "bag" | "parcel" | "tablet" | "swatch" | null;
}) {
  const cut = look.cut ?? 0;
  const bodyH = cut === 1 ? 0.2 : 0.26;
  return (
    <group scale={scale}>
      {/* legs */}
      <mesh position={[0, 0.09, 0]} castShadow>
        <cylinderGeometry args={[0.038, 0.032, 0.18, 8]} />
        <meshStandardMaterial color={C.charcoal} roughness={0.75} />
      </mesh>
      {/* body */}
      <mesh position={[0, 0.18 + bodyH / 2, 0]} castShadow>
        <capsuleGeometry args={[0.058, bodyH - 0.04, 4, 10]} />
        <Fabric color={look.coat} />
      </mesh>
      {cut === 2 && (
        <mesh position={[0, 0.22, 0]} castShadow>
          <coneGeometry args={[0.085, 0.14, 10]} />
          <Fabric color={look.coat} />
        </mesh>
      )}
      {/* head */}
      <mesh position={[0, 0.2 + bodyH + 0.055, 0]} castShadow>
        <sphereGeometry args={[0.052, 14, 12]} />
        <meshStandardMaterial color={look.skin} roughness={0.6} />
      </mesh>
      {/* hair */}
      <mesh position={[0, 0.215 + bodyH + 0.055, -0.012]} castShadow>
        <sphereGeometry args={[0.055, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.72]} />
        <meshStandardMaterial color={look.hair} roughness={0.72} />
      </mesh>

      {carrying === "bag" && (
        <group position={[0.082, 0.21, 0.02]} rotation={[0, 0, 0.1]}>
          <RoundedBox args={[0.07, 0.055, 0.03]} radius={0.012} smoothness={2} castShadow>
            <meshStandardMaterial color={look.bag ?? C.champagne} roughness={0.4} metalness={0.05} />
          </RoundedBox>
          <mesh position={[0, 0.042, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.02, 0.005, 5, 10, Math.PI]} />
            <Metal color={C.gold} roughness={0.3} />
          </mesh>
        </group>
      )}
      {carrying === "parcel" && (
        <RoundedBox
          args={[0.13, 0.1, 0.11]}
          radius={0.01}
          smoothness={2}
          position={[0, 0.3, 0.08]}
          castShadow
        >
          <meshStandardMaterial color={C.warmStone} roughness={0.8} />
        </RoundedBox>
      )}
      {carrying === "tablet" && (
        <group position={[0.07, 0.28, 0.07]} rotation={[-0.5, 0.3, 0.1]}>
          <mesh castShadow>
            <boxGeometry args={[0.1, 0.13, 0.008]} />
            <meshStandardMaterial color={C.charcoal} roughness={0.35} metalness={0.4} />
          </mesh>
          <mesh position={[0, 0, 0.006]}>
            <planeGeometry args={[0.085, 0.11]} />
            <Lit color="#F2E4C8" intensity={0.7} />
          </mesh>
        </group>
      )}
      {carrying === "swatch" && (
        <group position={[0.075, 0.26, 0.06]} rotation={[0, 0, -0.25]}>
          {[C.blush, C.champagne, C.sage, C.espresso].map((c, i) => (
            <mesh key={c} position={[i * 0.012, 0, i * 0.004]} rotation={[0, 0, i * 0.12]} castShadow>
              <boxGeometry args={[0.05, 0.1, 0.004]} />
              <Fabric color={c} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

/* ── Path walker ────────────────────────────────────────────────── */

export type Path = [number, number][];

function pathLength(p: Path) {
  let L = 0;
  for (let i = 0; i < p.length - 1; i++) {
    L += Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]);
  }
  return L;
}

export function Walker({
  path,
  look,
  speed = 0.35,
  phase = 0,
  scale = 1,
  carrying = null,
  animate = true,
  pingPong = false,
  pauseAt,
}: {
  path: Path;
  look: FigureLook;
  speed?: number;
  phase?: number;
  scale?: number;
  carrying?: "bag" | "parcel" | "tablet" | "swatch" | null;
  animate?: boolean;
  pingPong?: boolean;
  /** fraction of the loop spent standing still at the end of the path */
  pauseAt?: number;
}) {
  const ref = useRef<Group>(null);
  const inner = useRef<Group>(null);
  const t = useRef(phase);
  const total = useMemo(() => pathLength(path), [path]);
  const segs = useMemo(() => {
    const out: { a: [number, number]; b: [number, number]; len: number; acc: number }[] = [];
    let acc = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const len = Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]);
      out.push({ a: path[i], b: path[i + 1], len, acc });
      acc += len;
    }
    return out;
  }, [path]);

  useFrame((_, dt) => {
    if (!ref.current) return;
    if (animate) t.current += (dt * speed) / Math.max(0.001, total);
    let u = t.current % 1;
    const pause = pauseAt ?? 0;
    if (pause > 0) {
      const active = 1 - pause;
      u = u < active ? u / active : 1;
    }
    if (pingPong) u = u < 0.5 ? u * 2 : (1 - u) * 2;

    const dist = u * total;
    let seg = segs[segs.length - 1];
    for (const s of segs) {
      if (dist <= s.acc + s.len) {
        seg = s;
        break;
      }
    }
    const local = seg.len === 0 ? 0 : (dist - seg.acc) / seg.len;
    const x = seg.a[0] + (seg.b[0] - seg.a[0]) * local;
    const z = seg.a[1] + (seg.b[1] - seg.a[1]) * local;
    ref.current.position.set(x, 0, z);
    const ang = Math.atan2(seg.b[0] - seg.a[0], seg.b[1] - seg.a[1]);
    // ease toward heading so corners are not snapped
    const cur = ref.current.rotation.y;
    let d = ang - cur;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    ref.current.rotation.y = cur + d * Math.min(1, dt * 6);

    if (inner.current) {
      const moving = !(pause > 0 && u >= 1);
      inner.current.position.y = animate && moving ? Math.abs(Math.sin(t.current * total * 7.5)) * 0.012 : 0;
      inner.current.rotation.z = animate && moving ? Math.sin(t.current * total * 7.5) * 0.03 : 0;
    }
  });

  return (
    <group ref={ref}>
      <group ref={inner}>
        <Figure look={look} scale={scale} carrying={carrying} />
      </group>
    </group>
  );
}

/* ── Looks ──────────────────────────────────────────────────────── */

const SKINS = ["#6E4B36", "#8C5F42", "#C79B76", "#E3C3A3", "#4E3324", "#A87651"];
const HAIRS = ["#211811", "#3A251A", "#120D0A", "#4A2E1C", "#2B1B13"];
const COATS = [C.blush, C.porcelain, C.taupe, C.rose, C.stone, C.espresso, C.sage, C.champagne];
const BAGS = [C.champagne, C.espresso, C.rose, C.porcelain, C.taupe];

export function lookFor(i: number): FigureLook {
  return {
    skin: SKINS[i % SKINS.length],
    hair: HAIRS[(i * 3) % HAIRS.length],
    coat: COATS[(i * 5) % COATS.length],
    bag: BAGS[(i * 7) % BAGS.length],
    cut: i % 3,
  };
}

export const WORKER_LOOK = (i: number): FigureLook => ({
  skin: SKINS[(i * 2 + 1) % SKINS.length],
  hair: HAIRS[(i * 2) % HAIRS.length],
  coat: i % 2 === 0 ? C.porcelain : C.stone,
  cut: 1,
});

/* ── Status beacon over an agent ────────────────────────────────── */

export function StatusBeacon({
  color,
  y = 0.78,
  animate = true,
}: {
  color: string;
  y?: number;
  animate?: boolean;
}) {
  const ring = useRef<Mesh>(null);
  const dot = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!animate) return;
    const t = clock.elapsedTime;
    if (dot.current) dot.current.position.y = y + Math.sin(t * 1.7) * 0.022;
    if (ring.current) {
      const k = (t % 2.4) / 2.4;
      ring.current.scale.setScalar(0.5 + k * 1.5);
      const m = ring.current.material as { opacity: number };
      m.opacity = 0.45 * (1 - k);
    }
  });
  return (
    <group>
      <mesh ref={dot} position={[0, y, 0]}>
        <sphereGeometry args={[0.045, 12, 10]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.4}
          roughness={0.5}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={ring} position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.3, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} />
      </mesh>
      <mesh position={[0, 0.011, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.33, 40]} />
        <meshBasicMaterial color={C.gold} transparent opacity={0.4} />
      </mesh>
    </group>
  );
}
