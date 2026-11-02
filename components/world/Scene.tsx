"use client";

import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import { CameraRig } from "./CameraRig";
import { Ground } from "./Ground";
import { Bench, LampPost, Planter, Topiary, Tree } from "./Props";
import { Walker, lookFor } from "./Figures";
import { Fleet } from "./Fleet";
import { Shoppers } from "./Shoppers";
import { FulfillmentHouse } from "./FulfillmentHouse";
import { BuyingAtelier } from "./BuyingAtelier";
import { GlamBoutique } from "./GlamBoutique";
import { SiteLabels } from "./SiteLabels";

/* ─────────────────────────────────────────────────────────────────
   The district. One lighting setup, one plinth, three destinations.
   ───────────────────────────────────────────────────────────────── */

function Lighting() {
  return (
    <>
      <ambientLight intensity={0.26} color="#FFF4E6" />
      <hemisphereLight args={["#FFF7EC", "#A8957F", 0.45]} />
      <directionalLight
        position={[21, 23, -5]}
        intensity={3.4}
        color="#FFF2DC"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.022}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={24}
        shadow-camera-bottom={-24}
        shadow-camera-near={1}
        shadow-camera-far={70}
      />
      {/* cool bounce from the opposite side keeps the marble from going flat */}
      <directionalLight position={[-14, 9, -12]} intensity={0.3} color="#C9DCE6" />
      {/* a warm kicker low to the front */}
      <directionalLight position={[4, 3, 20]} intensity={0.22} color="#FFE2BE" />

      <Environment resolution={256} frames={1}>
        <Lightformer
          form="rect"
          intensity={2.4}
          color="#FFF1DC"
          scale={[14, 12, 1]}
          position={[0, 9, 10]}
          rotation={[-Math.PI / 3.2, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={1.1}
          color="#E2EBEF"
          scale={[12, 9, 1]}
          position={[-11, 6, -8]}
          rotation={[0, Math.PI / 2.6, 0]}
        />
        <Lightformer form="ring" intensity={1.5} color="#FFE3B6" scale={5} position={[9, 6, 9]} />
        <Lightformer
          form="rect"
          intensity={0.7}
          color="#F6E8D6"
          scale={[20, 20, 1]}
          position={[0, 14, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      </Environment>
    </>
  );
}

function Landscape({ animate }: { animate: boolean }) {
  return (
    <group>
      {/* boulevard tree line */}
      {[-15.6, -11.2, -5.4, 0.2, 5.6, 11.4, 16].map((x, i) => (
        <Tree key={`bt${x}`} position={[x, 0.19, 12.3]} scale={1.05 + (i % 3) * 0.08} tone={i} sway={animate ? 1 : 0} />
      ))}
      {/* sidewalk trees on the district side */}
      {[-14.6, -3.4, 5.4, 15.2].map((x, i) => (
        <Tree key={`st${x}`} position={[x, 0.23, 6.95]} scale={0.95 + (i % 2) * 0.1} tone={i + 1} sway={animate ? 1 : 0} />
      ))}
      {/* courtyard grove */}
      {([
        [-6.4, 4.4],
        [-2.9, 1.0],
        [5.9, 3.4],
        [5.2, -0.4],
        [-3.1, -4.4],
        [-0.9, -8.2],
      ] as const).map(([x, z], i) => (
        <Tree key={`ct${i}`} position={[x, 0.19, z]} scale={1.12 + (i % 3) * 0.1} tone={i} sway={animate ? 1 : 0} />
      ))}
      {/* back screen of trees */}
      {[-15.2, -12.8, -4.2, 9.4, 12.4, 15.4].map((x, i) => (
        <Tree key={`bk${x}`} position={[x, 0.19, -11]} scale={1.2 + (i % 3) * 0.12} tone={i + 2} sway={animate ? 1 : 0} />
      ))}

      {/* lamps */}
      {[-13, -7.6, -2.2, 3.2, 8.6, 14].map((x) => (
        <LampPost key={`lp${x}`} position={[x, 0.23, 7.1]} />
      ))}
      <LampPost position={[-4.4, 0.19, 2.9]} />
      <LampPost position={[3.6, 0.19, 2.9]} />
      <LampPost position={[14.6, 0.19, 4.4]} />

      {/* benches facing the pool */}
      <Bench position={[-3.2, 0.19, 4.6]} rotation={Math.PI} />
      <Bench position={[1.4, 0.19, 4.6]} rotation={Math.PI} />
      <Bench position={[-3.2, 0.19, 0.1]} />
      <Bench position={[1.4, 0.19, 0.1]} />

      {/* planters + topiary */}
      <Planter position={[-9.6, 0.19, -6.4]} w={6.4} d={1} />
      <Planter position={[7.2, 0.19, -9.4]} w={4.4} d={1} />
      <Planter position={[15.2, 0.19, -1.4]} w={1} d={5.4} />
      <Topiary position={[6.4, 0.19, 6.9]} />
      <Topiary position={[14.4, 0.19, 6.9]} />
      <Topiary position={[-14.4, 0.19, 2.4]} scale={1.1} />
      <Topiary position={[-14.4, 0.19, -2.4]} scale={1.1} />
      <Topiary position={[11.2, 0.19, -5.2]} />
      <Topiary position={[8.6, 0.19, -5.2]} />
    </group>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Ambient life only. Vehicles and client traffic are driven by the
   clock (see Fleet and Shoppers); these two figures are atmosphere —
   people crossing a district — and make no business claim.
   ───────────────────────────────────────────────────────────────── */
function Ambient({ animate }: { animate: boolean }) {
  return (
    <group position={[0, 0.19, 0]}>
      <Walker
        animate={animate}
        mode="pingpong"
        path={[
          [-15, 7.1],
          [1.5, 7.1],
        ]}
        look={lookFor(1)}
        speed={0.55}
      />
      <Walker
        animate={animate}
        mode="pingpong"
        path={[
          [-6, 2.2],
          [-0.4, 2.2],
          [3.2, 2.2],
        ]}
        look={lookFor(11)}
        speed={0.42}
        phase={0.35}
      />
    </group>
  );
}

export function Scene({ reduced, compact }: { reduced: boolean; compact: boolean }) {
  const animate = !reduced;

  return (
    <>
      <CameraRig reduced={reduced} compact={compact} />
      <Lighting />

      <group>
        <Ground />
        <Landscape animate={animate} />
        <Ambient animate={animate} />
        <Fleet animate={animate} />
        <Shoppers animate={animate} />

        <FulfillmentHouse animate={animate} />
        <BuyingAtelier animate={animate} />
        <GlamBoutique animate={animate} />
        <SiteLabels />
      </group>

      <ContactShadows
        position={[0, -1.42, -0.4]}
        scale={56}
        resolution={1024}
        far={5}
        blur={2.6}
        opacity={0.42}
        color="#3A2B23"
        frames={1}
      />
    </>
  );
}
