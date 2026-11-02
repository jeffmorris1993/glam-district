"use client";

import { useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh, MeshBasicMaterial } from "three";
import { useStore } from "@/lib/store";
import { damp } from "@/lib/motion";
import type { FocusKey } from "@/lib/engine";
import { C } from "./palette";

/* ─────────────────────────────────────────────────────────────────
   Anything the district animates can be clicked for its story: which
   event drove it, the live numbers, and why it is behaving this way.
   ───────────────────────────────────────────────────────────────── */

export function Inspectable({
  target,
  size,
  position = [0, 0, 0],
  children,
}: {
  target: FocusKey;
  /** hit volume, [w, h, d] */
  size: [number, number, number];
  position?: [number, number, number];
  children?: ReactNode;
}) {
  const ring = useRef<Mesh>(null);
  const hovered = useRef(false);
  const [w, h, d] = size;
  const r = Math.max(w, d) * 0.6;

  useFrame((_, dt) => {
    if (!ring.current) return;
    const active = hovered.current || useStore.getState().inspecting === target;
    const m = ring.current.material as MeshBasicMaterial;
    m.opacity = damp(m.opacity, active ? 0.55 : 0, 12, Math.min(0.1, dt));
  });

  return (
    <group position={position}>
      {children}
      <mesh ref={ring} position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[r, r + 0.08, 48]} />
        <meshBasicMaterial color={C.gold} transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh
        position={[0, h / 2, 0]}
        onPointerOver={(e) => {
          e.stopPropagation();
          hovered.current = true;
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          hovered.current = false;
          document.body.style.cursor = "";
        }}
        onClick={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "";
          const s = useStore.getState();
          if (s.phase !== "building") s.focusBuilding(buildingOf(target));
          s.inspectObject(target);
        }}
      >
        <boxGeometry args={[w, h, d]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
}

function buildingOf(target: FocusKey) {
  if (target === "floor" || target === "vitrine") return "boutique" as const;
  if (target === "samples" || target === "trendwall" || target === "inbound") return "atelier" as const;
  return "fulfillment" as const;
}
