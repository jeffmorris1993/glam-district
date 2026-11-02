"use client";

import { useEffect } from "react";
import { useStore, type Mode } from "@/lib/store";

/* ─────────────────────────────────────────────────────────────────
   Mode wiring that never renders anything:
   - boot: read ?mode= from the URL so a TV can open straight into the
     Observe wall (window.location, not useSearchParams — the app runs
     under cacheComponents and everything here is client-side anyway)
   - sync: keep ?mode= shareable as the mode changes
   - hotkey: P toggles Presenter ↔ Interact
   ───────────────────────────────────────────────────────────────── */

const isMode = (v: string | null): v is Mode =>
  v === "observe" || v === "interact" || v === "present";

export function ModeInit() {
  // Boot from the URL once.
  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("mode");
    if (isMode(m)) {
      useStore.getState().setMode(m);
      // The TV should land in the district, not on the arrival screen.
      if (m !== "interact") useStore.getState().enter();
    }
  }, []);

  // Keep the URL shareable — replaceState, no navigation, no re-render.
  useEffect(() => {
    let last = useStore.getState().mode;
    return useStore.subscribe((s) => {
      if (s.mode === last) return;
      last = s.mode;
      const url = new URL(window.location.href);
      if (s.mode === "interact") url.searchParams.delete("mode");
      else url.searchParams.set("mode", s.mode);
      window.history.replaceState(null, "", url);
    });
  }, []);

  // P toggles Presenter; ignored while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "p" && e.key !== "P") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const s = useStore.getState();
      s.setMode(s.mode === "present" ? "interact" : "present");
      if (s.phase === "arrival") s.enter();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}
