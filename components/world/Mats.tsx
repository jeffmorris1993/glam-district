"use client";

import { C } from "./palette";

/* Reusable material presets. Kept as JSX fragments so three.js can
   dedupe nothing but we keep call sites short and consistent. */

export const Marble = ({ color = C.marble }: { color?: string }) => (
  <meshStandardMaterial color={color} roughness={0.34} metalness={0.02} envMapIntensity={0.85} />
);

export const Stone = ({ color = C.stone, roughness = 0.6 }: { color?: string; roughness?: number }) => (
  <meshStandardMaterial color={color} roughness={roughness} metalness={0} envMapIntensity={0.5} />
);

export const Metal = ({ color = C.champagne, roughness = 0.24 }: { color?: string; roughness?: number }) => (
  <meshStandardMaterial color={color} roughness={roughness} metalness={0.95} envMapIntensity={1.5} />
);

export const Wood = ({ color = C.espresso }: { color?: string }) => (
  <meshStandardMaterial color={color} roughness={0.52} metalness={0.04} envMapIntensity={0.6} />
);

export const Glass = ({ color = C.glass, opacity = 0.3 }: { color?: string; opacity?: number }) => (
  <meshPhysicalMaterial
    color={color}
    transparent
    opacity={opacity}
    roughness={0.06}
    metalness={0.06}
    envMapIntensity={2.2}
    reflectivity={0.6}
    side={2}
    depthWrite={false}
  />
);

export const Lit = ({ color = C.interior, intensity = 1.5 }: { color?: string; intensity?: number }) => (
  <meshStandardMaterial
    color={color}
    emissive={color}
    emissiveIntensity={intensity}
    roughness={1}
    toneMapped={false}
  />
);

export const Fabric = ({ color = C.blush }: { color?: string }) => (
  <meshStandardMaterial color={color} roughness={0.85} metalness={0} envMapIntensity={0.35} />
);
