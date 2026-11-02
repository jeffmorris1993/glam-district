"use client";

import { RoundedBox } from "@react-three/drei";
import { C } from "./palette";
import { Metal, Stone } from "./Mats";

/* ─────────────────────────────────────────────────────────────────
   The plaza: a single carved stone block the district sits on, with
   a boulevard, sidewalks, pathways and a still reflecting pool.
   ───────────────────────────────────────────────────────────────── */

function Slab({
  w,
  d,
  h = 0.08,
  pos,
  color,
  roughness = 0.6,
  radius = 0.05,
  receive = true,
}: {
  w: number;
  d: number;
  h?: number;
  pos: [number, number, number];
  color: string;
  roughness?: number;
  radius?: number;
  receive?: boolean;
}) {
  // RoundedBoxGeometry requires radius <= half of the smallest dimension;
  // these slabs are thin, so clamp or the geometry collapses.
  const r = Math.min(radius, h / 2 - 0.002, w / 2 - 0.002, d / 2 - 0.002);
  return (
    <RoundedBox args={[w, h, d]} radius={Math.max(0.004, r)} smoothness={2} position={pos} receiveShadow={receive}>
      <Stone color={color} roughness={roughness} />
    </RoundedBox>
  );
}

export function Ground() {
  return (
    <group>
      {/* base block — the architectural model plinth */}
      <RoundedBox
        args={[37, 1.4, 25.4]}
        radius={0.16}
        smoothness={3}
        position={[0, -0.72, -0.4]}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial color={C.linen} roughness={0.72} metalness={0} envMapIntensity={0.4} />
      </RoundedBox>

      {/* plinth reveal — a thin champagne band around the base */}
      <mesh position={[0, -1.4, -0.4]}>
        <boxGeometry args={[37.3, 0.07, 25.7]} />
        <Metal color={C.champagne} roughness={0.4} />
      </mesh>

      {/* plaza surface */}
      <Slab w={36.6} d={25} h={0.18} pos={[0, 0.0, -0.4]} color={C.ivory} roughness={0.68} radius={0.08} />

      {/* ── boulevard ───────────────────────────────────────────── */}
      <Slab w={36.6} d={2.9} h={0.14} pos={[0, 0.115, 9.6]} color={C.asphalt} roughness={0.78} />
      {/* centre dashes */}
      {Array.from({ length: 17 }, (_, i) => (
        <mesh key={i} position={[-16 + i * 2.05, 0.19, 9.6]}>
          <boxGeometry args={[0.92, 0.012, 0.085]} />
          <meshStandardMaterial color={C.goldBright} roughness={0.5} metalness={0.3} />
        </mesh>
      ))}
      {/* kerbs */}
      <Slab w={36.6} d={0.22} h={0.26} pos={[0, 0.13, 8.04]} color={C.warmStone} />
      <Slab w={36.6} d={0.22} h={0.26} pos={[0, 0.13, 11.16]} color={C.warmStone} />
      {/* sidewalk */}
      <Slab w={36.6} d={1.5} h={0.22} pos={[0, 0.11, 7]} color={C.stone} radius={0.03} />

      {/* ── loading apron in front of the Fulfillment House ─────── */}
      <Slab w={8.4} d={5.6} h={0.15} pos={[-9.6, 0.115, 5]} color={C.asphaltLight} roughness={0.8} />
      {/* bay guide lines */}
      {[-2.6, 0, 2.6].map((x) => (
        <mesh key={x} position={[-9.6 + x, 0.195, 4.4]}>
          <boxGeometry args={[0.05, 0.012, 4]} />
          <meshStandardMaterial color={C.stone} roughness={0.7} />
        </mesh>
      ))}

      {/* ── pathways ────────────────────────────────────────────── */}
      {/* boutique forecourt */}
      <Slab w={7.6} d={3.6} h={0.2} pos={[10.4, 0.1, 7.3]} color={C.porcelain} radius={0.04} />
      {/* boutique → courtyard */}
      <Slab w={9.4} d={1.9} h={0.2} pos={[4.4, 0.1, 5.2]} color={C.porcelain} radius={0.04} />
      {/* atelier approach */}
      <Slab w={2.2} d={6} h={0.2} pos={[2.2, 0.1, -0.6]} color={C.porcelain} radius={0.04} />
      {/* fulfillment → courtyard walk */}
      <Slab w={9} d={1.5} h={0.2} pos={[-5.6, 0.1, 2.2]} color={C.porcelain} radius={0.04} />

      {/* lawn panels — the only green in the ground plane */}
      {([
        [-6.8, 2.2, 4.2, 5.2],
        [6.0, 1.8, 3.6, 5.0],
        [-9.6, -6.8, 8.6, 2.2],
        [13.6, -2.2, 4.0, 7.0],
      ] as const).map(([x, z, w, d], i) => (
        <group key={`lawn${i}`}>
          <Slab w={w} d={d} h={0.22} pos={[x, 0.11, z]} color="#7E9072" roughness={0.92} radius={0.05} />
          <Slab w={w + 0.16} d={d + 0.16} h={0.2} pos={[x, 0.1, z]} color={C.stone} radius={0.05} />
        </group>
      ))}

      {/* herringbone hint on the courtyard */}
      <Slab w={11} d={5} h={0.19} pos={[-0.4, 0.095, 2.3]} color={C.linen} radius={0.06} />

      {/* ── reflecting pool ─────────────────────────────────────── */}
      <group position={[-0.4, 0, 2.3]}>
        {/* basin surround, sitting just proud of the courtyard */}
        <RoundedBox args={[6.9, 0.22, 3.2]} radius={0.06} smoothness={3} position={[0, 0.1, 0]} receiveShadow>
          <Stone color={C.warmStone} roughness={0.45} />
        </RoundedBox>
        <mesh position={[0, 0.214, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[6.1, 2.42]} />
          <meshStandardMaterial
            color="#3B4541"
            roughness={0.22}
            metalness={0.12}
            envMapIntensity={0.55}
          />
        </mesh>
        {/* champagne rim — four thin bars so the water stays visible */}
        {([
          [0, 1.3, 6.4, 0.08],
          [0, -1.3, 6.4, 0.08],
          [3.16, 0, 0.08, 2.68],
          [-3.16, 0, 0.08, 2.68],
        ] as const).map(([x, z, w, d], i) => (
          <mesh key={i} position={[x, 0.218, z]}>
            <boxGeometry args={[w, 0.014, d]} />
            <Metal color={C.champagne} roughness={0.35} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
