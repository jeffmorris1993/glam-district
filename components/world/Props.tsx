"use client";

import { useMemo, useRef } from "react";
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { C } from "./palette";
import { Fabric, Lit, Metal, Stone, Wood } from "./Mats";

/* ─────────────────────────────────────────────────────────────────
   Landscaping & street furniture — stylised, low-poly, warm.
   ───────────────────────────────────────────────────────────────── */

export function Tree({
  position,
  scale = 1,
  tone = 0,
  sway = 0,
}: {
  position: [number, number, number];
  scale?: number;
  tone?: number;
  sway?: number;
}) {
  const ref = useRef<Group>(null);
  const greens = [C.sage, C.olive, C.sageDeep];
  const g = greens[tone % greens.length];

  useFrame(({ clock }) => {
    if (!ref.current || sway === 0) return;
    const t = clock.elapsedTime;
    ref.current.rotation.z = Math.sin(t * 0.55 + position[0]) * 0.016 * sway;
    ref.current.rotation.x = Math.cos(t * 0.42 + position[2]) * 0.012 * sway;
  });

  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.42, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.065, 0.84, 7]} />
        <Wood color={C.espressoLight} />
      </mesh>
      <group ref={ref}>
        <mesh position={[0, 1.08, 0]} castShadow>
          <icosahedronGeometry args={[0.46, 1]} />
          <meshStandardMaterial color={g} roughness={0.85} flatShading />
        </mesh>
        <mesh position={[0.17, 0.82, 0.1]} castShadow>
          <icosahedronGeometry args={[0.29, 1]} />
          <meshStandardMaterial color={C.olive} roughness={0.85} flatShading />
        </mesh>
        <mesh position={[-0.15, 0.9, -0.12]} castShadow>
          <icosahedronGeometry args={[0.24, 1]} />
          <meshStandardMaterial color={C.sageDeep} roughness={0.85} flatShading />
        </mesh>
      </group>
    </group>
  );
}

export function Topiary({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <RoundedBox args={[0.58, 0.46, 0.58]} radius={0.05} smoothness={2} position={[0, 0.23, 0]} castShadow receiveShadow>
        <Stone color={C.porcelain} roughness={0.42} />
      </RoundedBox>
      <mesh position={[0, 0.46, 0]} castShadow>
        <boxGeometry args={[0.5, 0.05, 0.5]} />
        <Stone color={C.warmStone} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.72, 0]} castShadow>
        <icosahedronGeometry args={[0.27, 1]} />
        <meshStandardMaterial color={C.sage} roughness={0.88} flatShading />
      </mesh>
    </group>
  );
}

export function LampPost({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.06, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.13, 0.12, 10]} />
        <Metal color={C.gold} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.045, 1.7, 8]} />
        <Metal color={C.champagne} roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.78, 0]}>
        <sphereGeometry args={[0.1, 12, 10]} />
        <Lit color={C.interior} intensity={2.4} />
      </mesh>
      <mesh position={[0, 1.9, 0]} castShadow>
        <coneGeometry args={[0.15, 0.14, 10]} />
        <Metal color={C.champagne} roughness={0.28} />
      </mesh>
    </group>
  );
}

export function Bench({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <RoundedBox args={[1.5, 0.07, 0.42]} radius={0.025} smoothness={2} position={[0, 0.33, 0]} castShadow>
        <Wood color={C.espressoLight} />
      </RoundedBox>
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} position={[x, 0.17, 0]} castShadow>
          <boxGeometry args={[0.07, 0.33, 0.36]} />
          <Metal color={C.gold} roughness={0.42} />
        </mesh>
      ))}
    </group>
  );
}

export function Planter({
  position,
  w = 2.4,
  d = 0.8,
}: {
  position: [number, number, number];
  w?: number;
  d?: number;
}) {
  const buds = useMemo(
    () =>
      Array.from({ length: Math.max(3, Math.round(w * 2.2)) }, (_, i) => ({
        x: -w / 2 + 0.3 + (i * (w - 0.6)) / Math.max(1, Math.round(w * 2.2) - 1),
        z: ((i * 37) % 10) / 28 - 0.16,
        s: 0.1 + (((i * 53) % 10) / 10) * 0.07,
        c: i % 3 === 0 ? C.blush : i % 3 === 1 ? C.sage : C.rose,
      })),
    [w],
  );
  return (
    <group position={position}>
      <RoundedBox args={[w, 0.34, d]} radius={0.04} smoothness={2} position={[0, 0.17, 0]} castShadow receiveShadow>
        <Stone color={C.porcelain} roughness={0.45} />
      </RoundedBox>
      <mesh position={[0, 0.345, 0]}>
        <boxGeometry args={[w - 0.1, 0.02, d - 0.1]} />
        <meshStandardMaterial color={C.espresso} roughness={0.95} />
      </mesh>
      {buds.map((b, i) => (
        <mesh key={i} position={[b.x, 0.4 + b.s * 0.5, b.z]} castShadow>
          <icosahedronGeometry args={[b.s, 0]} />
          <meshStandardMaterial color={b.c} roughness={0.85} flatShading />
        </mesh>
      ))}
    </group>
  );
}

/* ── Delivery van: loops the boulevard and reverses into a bay ──── */

export function DeliveryVan({
  animate,
  speed = 1,
  phase = 0,
  color = C.porcelain,
}: {
  animate: boolean;
  speed?: number;
  phase?: number;
  color?: string;
}) {
  const ref = useRef<Group>(null);
  const t0 = useRef(phase);

  useFrame((_, dt) => {
    if (!ref.current) return;
    if (animate) t0.current += dt * speed * 0.055;
    const t = t0.current % 1;
    // Path: east-bound along the boulevard, then loop back west on the far lane.
    if (t < 0.5) {
      const p = t / 0.5;
      ref.current.position.set(-19 + p * 38, 0.185, 10.5);
      ref.current.rotation.y = Math.PI / 2;
    } else {
      const p = (t - 0.5) / 0.5;
      ref.current.position.set(19 - p * 38, 0.185, 8.7);
      ref.current.rotation.y = -Math.PI / 2;
    }
  });

  return (
    <group ref={ref}>
      <Van color={color} />
    </group>
  );
}

export function Van({ color = C.porcelain }: { color?: string }) {
  return (
    <group>
      {/* cargo box */}
      <RoundedBox args={[1.5, 0.78, 0.92]} radius={0.07} smoothness={3} position={[-0.26, 0.56, 0]} castShadow>
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.08} envMapIntensity={1.1} />
      </RoundedBox>
      {/* cab */}
      <RoundedBox args={[0.78, 0.6, 0.88]} radius={0.12} smoothness={3} position={[0.76, 0.47, 0]} castShadow>
        <meshStandardMaterial color={color} roughness={0.26} metalness={0.1} envMapIntensity={1.2} />
      </RoundedBox>
      {/* windshield */}
      <mesh position={[1.14, 0.56, 0]} rotation={[0, 0, -0.18]}>
        <boxGeometry args={[0.06, 0.3, 0.7]} />
        <meshStandardMaterial color="#3C4442" roughness={0.1} metalness={0.5} envMapIntensity={2} />
      </mesh>
      {/* champagne stripe + monogram band */}
      <mesh position={[-0.26, 0.42, 0.465]}>
        <boxGeometry args={[1.42, 0.07, 0.01]} />
        <Metal color={C.champagne} roughness={0.35} />
      </mesh>
      <mesh position={[-0.26, 0.42, -0.465]}>
        <boxGeometry args={[1.42, 0.07, 0.01]} />
        <Metal color={C.champagne} roughness={0.35} />
      </mesh>
      {/* wheels */}
      {([
        [0.72, 0.44],
        [0.72, -0.44],
        [-0.56, 0.44],
        [-0.56, -0.44],
      ] as const).map(([x, z], i) => (
        <mesh key={i} position={[x, 0.17, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.17, 0.17, 0.1, 14]} />
          <meshStandardMaterial color={C.charcoal} roughness={0.75} />
        </mesh>
      ))}
      {/* lamps */}
      <mesh position={[1.17, 0.33, 0.3]}>
        <boxGeometry args={[0.04, 0.08, 0.14]} />
        <Lit color="#FFF0D0" intensity={1.6} />
      </mesh>
      <mesh position={[1.17, 0.33, -0.3]}>
        <boxGeometry args={[0.04, 0.08, 0.14]} />
        <Lit color="#FFF0D0" intensity={1.6} />
      </mesh>
    </group>
  );
}

/* ── Tiny merchandise props ─────────────────────────────────────── */

export function Handbag({
  position,
  color = C.champagne,
  scale = 1,
  rotation = 0,
}: {
  position: [number, number, number];
  color?: string;
  scale?: number;
  rotation?: number;
}) {
  return (
    <group position={position} scale={scale} rotation={[0, rotation, 0]}>
      <RoundedBox args={[0.26, 0.2, 0.1]} radius={0.035} smoothness={3} position={[0, 0.1, 0]} castShadow>
        <meshStandardMaterial color={color} roughness={0.42} metalness={0.06} envMapIntensity={0.9} />
      </RoundedBox>
      {/* handle */}
      <mesh position={[0, 0.235, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.07, 0.013, 6, 14, Math.PI]} />
        <Metal color={C.gold} roughness={0.3} />
      </mesh>
      {/* clasp */}
      <mesh position={[0, 0.138, 0.052]}>
        <boxGeometry args={[0.05, 0.028, 0.012]} />
        <Metal color={C.gold} roughness={0.28} />
      </mesh>
    </group>
  );
}

export function Parcel({
  position,
  scale = 1,
  rotation = 0,
  tone = C.warmStone,
}: {
  position: [number, number, number];
  scale?: number;
  rotation?: number;
  tone?: string;
}) {
  return (
    <group position={position} scale={scale} rotation={[0, rotation, 0]}>
      <RoundedBox args={[0.3, 0.2, 0.24]} radius={0.018} smoothness={2} castShadow>
        <meshStandardMaterial color={tone} roughness={0.78} metalness={0} envMapIntensity={0.4} />
      </RoundedBox>
      {/* blush ribbon */}
      <mesh>
        <boxGeometry args={[0.055, 0.205, 0.245]} />
        <Fabric color={C.rose} />
      </mesh>
    </group>
  );
}

export function Shelf({
  position,
  rotation = 0,
  bays = 4,
  levels = 3,
  filled = 0.8,
}: {
  position: [number, number, number];
  rotation?: number;
  bays?: number;
  levels?: number;
  filled?: number;
}) {
  const boxes = useMemo(() => {
    const out: { x: number; y: number; t: string }[] = [];
    for (let b = 0; b < bays; b++) {
      for (let l = 0; l < levels; l++) {
        const seed = (b * 7 + l * 13) % 10;
        if (seed / 10 > filled) continue;
        out.push({
          x: -((bays - 1) * 0.46) / 2 + b * 0.46,
          y: 0.26 + l * 0.42,
          t: seed % 3 === 0 ? C.warmStone : seed % 3 === 1 ? C.stone : C.blush,
        });
      }
    }
    return out;
  }, [bays, levels, filled]);

  const w = bays * 0.46 + 0.1;
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* uprights */}
      {[-w / 2, w / 2].map((x) => (
        <mesh key={x} position={[x, (levels * 0.42) / 2, 0]} castShadow>
          <boxGeometry args={[0.05, levels * 0.42 + 0.18, 0.42]} />
          <Metal color={C.taupeDeep} roughness={0.6} />
        </mesh>
      ))}
      {/* decks */}
      {Array.from({ length: levels }, (_, l) => (
        <mesh key={l} position={[0, 0.14 + l * 0.42, 0]} castShadow receiveShadow>
          <boxGeometry args={[w, 0.03, 0.42]} />
          <meshStandardMaterial color={C.taupe} roughness={0.6} metalness={0.3} />
        </mesh>
      ))}
      {boxes.map((b, i) => (
        <mesh key={i} position={[b.x, b.y, 0]} castShadow>
          <boxGeometry args={[0.3, 0.2, 0.3]} />
          <meshStandardMaterial color={b.t} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

export function Workstation({
  position,
  rotation = 0,
  lit = true,
}: {
  position: [number, number, number];
  rotation?: number;
  lit?: boolean;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <RoundedBox args={[1.1, 0.05, 0.6]} radius={0.015} smoothness={2} position={[0, 0.42, 0]} castShadow>
        <Stone color={C.porcelain} roughness={0.4} />
      </RoundedBox>
      {([
        [-0.48, 0.25],
        [0.48, 0.25],
        [-0.48, -0.25],
        [0.48, -0.25],
      ] as const).map(([x, z], i) => (
        <mesh key={i} position={[x, 0.21, z]}>
          <cylinderGeometry args={[0.022, 0.022, 0.42, 6]} />
          <Metal color={C.champagne} roughness={0.4} />
        </mesh>
      ))}
      {/* monitor */}
      <mesh position={[0, 0.63, -0.22]} rotation={[-0.12, 0, 0]} castShadow>
        <boxGeometry args={[0.46, 0.3, 0.02]} />
        <meshStandardMaterial color={C.charcoal} roughness={0.4} />
      </mesh>
      {lit && (
        <mesh position={[0, 0.63, -0.207]} rotation={[-0.12, 0, 0]}>
          <planeGeometry args={[0.42, 0.26]} />
          <Lit color="#EADFC8" intensity={0.75} />
        </mesh>
      )}
      <mesh position={[0, 0.455, -0.22]}>
        <boxGeometry args={[0.14, 0.03, 0.1]} />
        <Metal color={C.taupeDeep} roughness={0.5} />
      </mesh>
    </group>
  );
}
