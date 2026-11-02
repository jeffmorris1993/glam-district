"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import type { OrthographicCamera } from "three";
import { useStore } from "@/lib/store";
import { damp } from "@/lib/motion";
import { ARRIVAL_VIEW, DISTRICT_VIEW, SITES } from "./palette";

/* ─────────────────────────────────────────────────────────────────
   A fixed isometric rig. The camera never rotates away from the
   house angle; it eases its target, its zoom, and a screen-space pan
   so a focused building sits clear of the workspace panel.
   ───────────────────────────────────────────────────────────────── */

const DIR = new Vector3(1, 0.82, 1).normalize();
const DIST = 46;

/** world-units that must fit across the viewport for each view */
const FIT = {
  arrival: { w: 46, h: 38 },
  district: { w: 47, h: 28 },
  building: { w: 26, h: 17 },
};

export function CameraRig({ reduced, compact }: { reduced: boolean; compact: boolean }) {
  const target = useRef(new Vector3(...ARRIVAL_VIEW.target));
  const zoom = useRef(10);
  const pan = useRef(0);
  const drift = useRef(0);
  const right = useRef(new Vector3(1, 0, 0));
  const up = useRef(new Vector3(0, 1, 0));
  const vert = useRef(0);
  const scratch = useRef(new Vector3());
  const started = useRef(false);

  useFrame((state, dt) => {
    const cam = state.camera as OrthographicCamera;
    const size = state.size;
    const s = useStore.getState();
    const k = Math.min(0.08, dt);

    const view = s.phase === "arrival" ? "arrival" : s.phase === "building" ? "building" : "district";
    const fit = FIT[view];

    // Workspace panels occupy the right-hand side; mirror their width so the
    // model is both fitted and panned into what is left of the viewport.
    const panelPx = Math.min(
      size.width * 0.66,
      view === "building" ? (s.openAgent ? 880 : 470) : 0,
    );

    // Fit the view to the shorter constraint so nothing is cropped.
    const usable = compact ? size.width : Math.max(320, size.width - panelPx);
    let wantZoom = Math.min(usable / fit.w, size.height / fit.h);
    if (compact) {
      wantZoom =
        view === "building"
          ? Math.min(size.width / 17, size.height / 26)
          : Math.min(size.width / 31, size.height / 30);
    }

    const site = s.focus ? SITES[s.focus] : null;
    const wantTarget =
      view === "building" && site
        ? site.target
        : view === "arrival"
          ? ARRIVAL_VIEW.target
          : DISTRICT_VIEW.target;

    const wantPan = compact ? 0 : panelPx / 2 / Math.max(1, zoom.current);
    // Vertical screen-space offset: on arrival the model sits low so the
    // wordmark has clear sky; on narrow screens it lifts clear of the sheet.
    const vertPx =
      view === "arrival"
        ? size.height * 0.19
        : compact
          ? view === "building"
            ? -size.height * 0.21
            : -size.height * 0.06
          : 0;
    const wantVert = vertPx / Math.max(1, zoom.current);

    const lambda = reduced ? 1e4 : 3.1;
    zoom.current = damp(zoom.current, wantZoom, lambda, k);
    pan.current = damp(pan.current, wantPan, lambda, k);
    vert.current = damp(vert.current, wantVert, lambda, k);
    target.current.x = damp(target.current.x, wantTarget[0], lambda, k);
    target.current.y = damp(target.current.y, wantTarget[1], lambda, k);
    target.current.z = damp(target.current.z, wantTarget[2], lambda, k);

    // A barely-there drift on the arrival screen so the model feels alive.
    if (!reduced && view === "arrival") drift.current += dt;
    const dx = view === "arrival" && !reduced ? Math.sin(drift.current * 0.17) * 0.5 : 0;
    const dz = view === "arrival" && !reduced ? Math.cos(drift.current * 0.13) * 0.3 : 0;

    right.current.setFromMatrixColumn(cam.matrix, 0).setY(0).normalize();
    up.current.setFromMatrixColumn(cam.matrix, 1).normalize();
    scratch.current
      .copy(target.current)
      .addScaledVector(right.current, pan.current)
      .addScaledVector(up.current, vert.current);
    scratch.current.x += dx;
    scratch.current.z += dz;

    cam.position.copy(scratch.current).addScaledVector(DIR, DIST);
    cam.zoom = zoom.current;
    cam.lookAt(scratch.current);
    cam.updateProjectionMatrix();

    if (!started.current) {
      started.current = true;
      // first frame: snap so there is no visible fly-in from nothing
      zoom.current = wantZoom * (reduced ? 1 : 0.86);
    }
  });

  return null;
}
