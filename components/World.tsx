"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { ACESFilmicToneMapping } from "three";
import { useStore } from "@/lib/store";
import { useIsCompact, usePrefersReducedMotion } from "@/lib/motion";
import { Scene } from "./world/Scene";

export default function World() {
  const reduced = usePrefersReducedMotion();
  const compact = useIsCompact();

  return (
    <div className="absolute inset-0">
      {/* sky / backdrop — a warm studio gradient behind the model */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 8%, #FFFCF8 0%, #F7F1E9 38%, #EDE2D6 68%, #E2D4C5 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 45% at 72% 72%, rgba(233,211,205,.5) 0%, rgba(233,211,205,0) 70%)",
        }}
      />

      <Canvas
        shadows
        dpr={[1, compact ? 1.5 : 1.9]}
        orthographic
        camera={{ position: [30, 25, 30], zoom: 24, near: -100, far: 200 }}
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: ACESFilmicToneMapping,
          toneMappingExposure: 0.94,
          powerPreference: "high-performance",
        }}
        onPointerMissed={() => {
          const s = useStore.getState();
          if (s.phase === "building") {
            if (s.openAgent) s.openAgentPanel(null);
            else s.focusBuilding(null);
          }
        }}
        style={{ position: "absolute", inset: 0 }}
      >
        <Suspense fallback={null}>
          <Scene reduced={reduced} compact={compact} />
        </Suspense>
      </Canvas>

      {/* vignette — keeps the eye on the model */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(110% 80% at 50% 45%, rgba(0,0,0,0) 55%, rgba(58,43,35,.10) 82%, rgba(58,43,35,.20) 100%)",
        }}
      />
    </div>
  );
}
