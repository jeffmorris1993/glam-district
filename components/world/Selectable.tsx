"use client";

import { useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { BoxGeometry, EdgesGeometry } from "three";
import type { Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial } from "three";
import { useStore } from "@/lib/store";
import { damp } from "@/lib/motion";
import type { BuildingId } from "@/lib/types";
import { C } from "./palette";

/* ─────────────────────────────────────────────────────────────────
   Wraps a building: hit area, soft gold selection outline, ground
   halo, and a gentle lift on hover.
   ───────────────────────────────────────────────────────────────── */

export function Selectable({
  id,
  footprint,
  height,
  children,
  disabled,
}: {
  id: BuildingId;
  footprint: [number, number];
  height: number;
  children: ReactNode;
  disabled?: boolean;
}) {
  const lift = useRef<Group>(null);
  const frame = useRef<LineSegments>(null);
  const halo = useRef<Mesh>(null);
  const [w, d] = footprint;

  useFrame((_, dt) => {
    const s = useStore.getState();
    const active = !disabled && (s.hovered === id || s.focus === id);
    const k = Math.min(0.1, dt);
    if (lift.current) {
      lift.current.position.y = damp(lift.current.position.y, active ? 0.1 : 0, 9, k);
    }
    if (frame.current) {
      const m = frame.current.material as LineBasicMaterial;
      m.opacity = damp(m.opacity, active ? 0.9 : 0, 10, k);
    }
    if (halo.current) {
      const m = halo.current.material as MeshBasicMaterial;
      m.opacity = damp(m.opacity, active ? 0.4 : 0, 10, k);
      const t = damp(halo.current.scale.x, active ? 1 : 0.9, 9, k);
      halo.current.scale.set(t, t, t);
    }
  });

  const edges = useMemo(() => {
    const g = new BoxGeometry(w + 0.16, height + 0.16, d + 0.16);
    const e = new EdgesGeometry(g);
    g.dispose();
    return e;
  }, [w, d, height]);

  const r = Math.max(w, d) * 0.62;

  return (
    <group>
      {/* ground halo */}
      <mesh ref={halo} position={[0, 0.095, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[r, r + 0.17, 72]} />
        <meshBasicMaterial color={C.gold} transparent opacity={0} />
      </mesh>

      <group ref={lift}>
        {children}

        {/* soft gold selection frame */}
        <lineSegments ref={frame} position={[0, height / 2, 0]} geometry={edges}>
          <lineBasicMaterial color={C.goldBright} transparent opacity={0} depthWrite={false} />
        </lineSegments>
      </group>

      {/* hit volume — generous, invisible */}
      {!disabled && (
        <mesh
          position={[0, height / 2, 0]}
          onPointerOver={(e) => {
            e.stopPropagation();
            useStore.getState().setHovered(id);
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            if (useStore.getState().hovered === id) useStore.getState().setHovered(null);
            document.body.style.cursor = "";
          }}
          onClick={(e) => {
            e.stopPropagation();
            document.body.style.cursor = "";
            useStore.getState().focusBuilding(id);
          }}
        >
          <boxGeometry args={[w + 0.5, height + 0.3, d + 0.5]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      )}
    </group>
  );
}

/* ── Clickable agent hit area ───────────────────────────────────── */

export function AgentHit({
  agent,
  radius = 0.34,
  height = 0.9,
}: {
  agent: "analyst" | "strategist" | "concierge";
  radius?: number;
  height?: number;
}) {
  return (
    <mesh
      position={[0, height / 2, 0]}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "";
      }}
      onClick={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "";
        const s = useStore.getState();
        const building =
          agent === "analyst" ? "fulfillment" : agent === "strategist" ? "atelier" : "boutique";
        if (s.focus !== building) s.focusBuilding(building);
        s.openAgentPanel(agent);
      }}
    >
      <cylinderGeometry args={[radius, radius, height, 10]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}
