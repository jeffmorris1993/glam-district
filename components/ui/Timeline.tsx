"use client";

import { useStore } from "@/lib/store";
import { KIND_LABEL, clockLabel } from "@/lib/engine";
import { SITES } from "@/components/world/palette";
import { n } from "@/lib/fmt";
import type { WorldStatus } from "@/lib/types";
import { TONE } from "./bits";
import { ActionCenterToggle } from "./ActionCenter";

/* ─────────────────────────────────────────────────────────────────
   THE DISTRICT TIMELINE
   Everything that has happened, across all three buildings, newest
   first. Each entry names the building, the magnitude and the cause,
   and jumps to the object that produced it.
   ───────────────────────────────────────────────────────────────── */

const TONE_OF: Record<string, WorldStatus> = {
  info: "healthy",
  good: "healthy",
  watch: "watch",
  alert: "critical",
};

export function TimelineToggle() {
  const open = useStore((s) => s.timelineOpen);
  const toggle = useStore((s) => s.toggleTimeline);
  const phase = useStore((s) => s.phase);
  const count = useStore((s) => s.events.length);
  const minute = useStore((s) => s.flow.minute);
  const inShift = useStore((s) => s.flow.inShift);
  const paused = useStore((s) => s.clock.paused);
  if (phase === "arrival") return null;

  const { label } = clockLabel(minute);

  return (
    <div className="pointer-events-none absolute left-5 top-[76px] z-30 flex flex-col items-start gap-2 sm:left-7 sm:top-[84px]">
      {/* the business clock — distinct from the presenter's pause control */}
      <div
        className="flex items-center gap-2 rounded-full border bg-[rgba(253,251,248,.78)] px-3 py-[6px] backdrop-blur-md"
        style={{ borderColor: paused ? "rgba(201,138,61,.45)" : "rgba(58,43,35,.1)" }}
        title={
          paused
            ? "The presenter paused the demo clock — business time is frozen; nothing moves until it resumes."
            : "The simulated business clock (Eastern Time). The floor packs only during its shift; orders arrive around the clock."
        }
      >
        <span
          className={`h-[5px] w-[5px] rounded-full ${inShift && !paused ? "a-breathe" : ""}`}
          style={{ background: paused ? "#C98A3D" : inShift ? TONE.healthy.dot : "#BCAB95" }}
        />
        <span className="num text-[10.5px] text-[var(--espresso)]">{label}</span>
        <span className="label text-[8px]" style={{ color: paused ? "#9A6523" : "#A3927C" }}>
          {paused ? "Paused — presenter" : inShift ? "Floor open" : "Floor closed"}
        </span>
      </div>

      <ActionCenterToggle />

      <button
        type="button"
        onClick={toggle}
        className="pointer-events-auto flex items-center gap-2 rounded-full border border-[rgba(58,43,35,.12)] bg-[rgba(253,251,248,.78)] px-3 py-[6px] backdrop-blur-md transition-colors hover:border-[var(--gold)]"
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
          <circle cx="2" cy="2" r="1.3" fill="#B8914F" />
          <circle cx="2" cy="6" r="1.3" fill="#B8914F" opacity=".6" />
          <circle cx="2" cy="10" r="1.3" fill="#B8914F" opacity=".35" />
          <path d="M5 2h6M5 6h5M5 10h3.5" stroke="#8C7B66" strokeWidth=".9" strokeLinecap="round" />
        </svg>
        <span className="label text-[9px] text-[var(--espresso)]">
          {open ? "Hide activity" : "District activity"}
        </span>
        {count > 0 && (
          <span className="num rounded-full bg-[rgba(184,145,79,.18)] px-1.5 text-[9px] text-[var(--gold)]">
            {count}
          </span>
        )}
      </button>
    </div>
  );
}

export function Timeline() {
  const open = useStore((s) => s.timelineOpen);
  const phase = useStore((s) => s.phase);
  const events = useStore((s) => s.events);
  const focusBuilding = useStore((s) => s.focusBuilding);
  const inspectObject = useStore((s) => s.inspectObject);
  const toggle = useStore((s) => s.toggleTimeline);
  const visible = open && phase !== "arrival";

  return (
    <div
      aria-hidden={!visible}
      className="pointer-events-none absolute left-5 top-[150px] z-30 w-[min(330px,calc(100vw-40px))] sm:left-7 sm:top-[158px]"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(-10px)",
        transition: "opacity .4s var(--ease), transform .5s var(--ease)",
      }}
    >
      <div
        className="panel grain relative overflow-hidden rounded-[3px]"
        style={{ pointerEvents: visible ? "auto" : "none" }}
      >
        <div className="goldline absolute inset-x-0 top-0 h-px" />
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <span className="eyebrow text-[8.5px] text-[#A3927C]">District activity</span>
          <button
            type="button"
            onClick={toggle}
            className="rounded-full p-1 text-[#A3927C] transition-colors hover:text-[var(--espresso)]"
            aria-label="Hide activity"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="scroll-fine max-h-[min(46vh,420px)] overflow-y-auto px-2 pb-2">
          {events.length === 0 ? (
            <p className="px-2 pb-3 pt-1 text-[11.5px] leading-relaxed text-[#9C8B76]">
              The clock is running. Orders arrive, the floor packs, vans dispatch — every change will
              be logged here with the reason it happened.
            </p>
          ) : (
            <ol className="relative pl-5">
              <span className="absolute left-[9px] top-2 h-[calc(100%-16px)] w-px bg-[rgba(58,43,35,.1)]" />
              {events.map((e, i) => {
                const tone = TONE_OF[e.tone];
                return (
                  <li key={e.id} className="relative" style={{ animation: i < 3 ? "fadeUp .5s var(--ease) both" : undefined }}>
                    <span
                      className="absolute -left-[14px] top-[11px] h-[7px] w-[7px] rounded-full border-2 border-[#FBF7F2]"
                      style={{ background: TONE[tone].dot }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        focusBuilding(e.building);
                        if (e.focus) inspectObject(e.focus);
                      }}
                      className="w-full rounded-[2px] px-2 py-2 text-left transition-colors hover:bg-[rgba(217,188,140,.14)]"
                    >
                      <span className="flex items-baseline gap-2">
                        <span className="num text-[9px] text-[#B5A48E]">
                          {clockLabel(e.minute).time}
                        </span>
                        <span className="label text-[7.5px]" style={{ color: TONE[tone].fg }}>
                          {KIND_LABEL[e.kind]}
                        </span>
                        <span className="eyebrow ml-auto text-[7px] text-[#C0AF98]">
                          {SITES[e.building].name.replace("The ", "").split(" ")[0]}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[11.5px] font-medium leading-snug text-[var(--espresso)]">
                        {e.title}
                      </span>
                      <span className="mt-0.5 block text-[10.5px] leading-snug text-[#9C8B76]">
                        {e.detail.length > 96 ? `${e.detail.slice(0, 94)}…` : e.detail}
                      </span>
                      {e.magnitude !== undefined && (
                        <span className="num mt-1 inline-block rounded-sm bg-[rgba(58,43,35,.05)] px-1.5 py-[1px] text-[9px] text-[#8C7B66]">
                          {n(e.magnitude)}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="border-t border-[rgba(58,43,35,.08)] px-4 py-2">
          <p className="text-[9.5px] leading-relaxed text-[#B5A48E]">
            Every entry is a simulated event from the shared clock. Nothing here reflects a real
            order, shipment or system.
          </p>
        </div>
      </div>
    </div>
  );
}
