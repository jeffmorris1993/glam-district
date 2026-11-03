"use client";

import { useStore } from "@/lib/store";
import { PRESETS, type PresetId } from "@/lib/presets";

/* ─────────────────────────────────────────────────────────────────
   THE PRESENTER BAR
   Replaces the hero control in Present mode: scenario presets, the
   clock (pause / step / speed), manual stage advance for the viral
   drop, and the hold-and-reveal control for situations. Everything
   here is repeatable — a preset is a full reset plus assumptions.
   ───────────────────────────────────────────────────────────────── */

const SHORT_NAME: Record<PresetId, string> = {
  normal: "Normal Day",
  "morning-start": "Morning Start",
  "viral-drop": "Viral Drop",
  "inventory-risk": "Inventory Risk",
  "service-surge": "Service Surge",
};

function IconBtn({
  label,
  onClick,
  active,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-[26px] w-[26px] items-center justify-center rounded-full transition-colors disabled:opacity-30"
      style={{
        background: active ? "var(--espresso)" : "rgba(58,43,35,.06)",
        color: active ? "#FBF7F2" : "#6E5C4D",
      }}
    >
      {children}
    </button>
  );
}

export function PresenterBar() {
  const phase = useStore((s) => s.phase);
  const scenario = useStore((s) => s.scenario);
  const stage = useStore((s) => s.viralStage);
  const clock = useStore((s) => s.clock);
  const scenarioAuto = useStore((s) => s.scenarioAuto);
  const holdSituations = useStore((s) => s.holdSituations);
  const hidden = useStore((s) => s.situations.filter((x) => !x.revealed).length);

  const applyPreset = useStore((s) => s.applyPreset);
  const pauseClock = useStore((s) => s.pauseClock);
  const resumeClock = useStore((s) => s.resumeClock);
  const setSpeed = useStore((s) => s.setSpeed);
  const stepOnce = useStore((s) => s.stepOnce);
  const setScenarioAuto = useStore((s) => s.setScenarioAuto);
  const advanceScenario = useStore((s) => s.advanceScenario);
  const setHoldSituations = useStore((s) => s.setHoldSituations);
  const releaseSituations = useStore((s) => s.releaseSituations);

  const visible = phase !== "arrival";
  const activePreset = useStore((s) => s.activePreset);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-5 pb-5 transition-all duration-700 sm:pb-6"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(16px)",
        transitionTimingFunction: "var(--ease)",
      }}
    >
      <div className="panel grain pointer-events-auto relative max-w-full overflow-x-auto rounded-[3px]">
        <div className="goldline absolute inset-x-0 top-0 h-px" />
        <div className="flex items-center gap-3 px-3 py-2">
          {/* ── presets ─────────────────────────────────────────── */}
          <div className="flex items-center gap-1">
            <span className="eyebrow mr-1 hidden text-[7.5px] text-[#B5A48E] xl:inline">Preset</span>
            {PRESETS.map((p) => {
              const active = activePreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  title={p.blurb}
                  aria-pressed={active}
                  className="label whitespace-nowrap rounded-full px-2.5 py-[6px] text-[8.5px] transition-colors duration-300"
                  style={{
                    background: active ? "var(--espresso)" : "rgba(58,43,35,.05)",
                    color: active ? "#FBF7F2" : "#6E5C4D",
                  }}
                >
                  {SHORT_NAME[p.id]}
                </button>
              );
            })}
          </div>

          <span className="h-5 w-px shrink-0 bg-[rgba(58,43,35,.12)]" />

          {/* ── clock ───────────────────────────────────────────── */}
          <div className="flex items-center gap-1.5">
            <IconBtn
              label={clock.paused ? "Resume the clock" : "Pause the clock"}
              onClick={clock.paused ? resumeClock : pauseClock}
              active={clock.paused}
            >
              {clock.paused ? (
                <svg width="9" height="10" viewBox="0 0 9 10" fill="none" aria-hidden>
                  <path d="M1 1l7 4-7 4V1Z" fill="currentColor" />
                </svg>
              ) : (
                <svg width="8" height="10" viewBox="0 0 8 10" fill="none" aria-hidden>
                  <path d="M1 1h2v8H1zM5 1h2v8H5z" fill="currentColor" />
                </svg>
              )}
            </IconBtn>
            <IconBtn label="Step one tick (5 simulated minutes)" onClick={stepOnce}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                <path d="M1 1l5 4-5 4V1Z" fill="currentColor" />
                <path d="M8 1h1.4v8H8z" fill="currentColor" />
              </svg>
            </IconBtn>
            <button
              type="button"
              onClick={() => setSpeed(clock.speed === 1 ? 2 : 1)}
              aria-label={`Clock speed ${clock.speed}× — click to toggle`}
              className="num rounded-full px-2 py-[5px] text-[9.5px] transition-colors"
              style={{
                background: clock.speed === 2 ? "var(--espresso)" : "rgba(58,43,35,.06)",
                color: clock.speed === 2 ? "#FBF7F2" : "#6E5C4D",
              }}
            >
              {clock.speed}×
            </button>
          </div>

          {/* ── viral stage control ─────────────────────────────── */}
          {scenario === "viral" && (
            <>
              <span className="h-5 w-px shrink-0 bg-[rgba(58,43,35,.12)]" />
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className="h-[6px] w-[6px] rounded-full transition-all duration-500"
                      style={{ background: stage >= i ? "var(--gold)" : "rgba(58,43,35,.16)" }}
                    />
                  ))}
                </div>
                {!scenarioAuto && stage < 4 && (
                  <button
                    type="button"
                    onClick={advanceScenario}
                    className="label whitespace-nowrap rounded-full bg-[var(--espresso)] px-2.5 py-[6px] text-[8.5px] text-[#FBF7F2] transition-colors hover:bg-[var(--ink)]"
                  >
                    Advance stage →
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setScenarioAuto(!scenarioAuto)}
                  aria-pressed={scenarioAuto}
                  title="When off, stages advance only on your click — set before launching the drop"
                  className="label whitespace-nowrap rounded-full px-2 py-[5px] text-[8px] transition-colors"
                  style={{
                    background: scenarioAuto ? "rgba(184,145,79,.16)" : "rgba(58,43,35,.06)",
                    color: scenarioAuto ? "var(--gold)" : "#8C7B66",
                  }}
                >
                  Auto {scenarioAuto ? "on" : "off"}
                </button>
              </div>
            </>
          )}

          <span className="h-5 w-px shrink-0 bg-[rgba(58,43,35,.12)]" />

          {/* ── hold & reveal ───────────────────────────────────── */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setHoldSituations(!holdSituations)}
              aria-pressed={holdSituations}
              title="New situations stay hidden until you reveal them — for narrating at your own pace"
              className="label whitespace-nowrap rounded-full px-2.5 py-[6px] text-[8.5px] transition-colors"
              style={{
                background: holdSituations ? "var(--espresso)" : "rgba(58,43,35,.05)",
                color: holdSituations ? "#FBF7F2" : "#6E5C4D",
              }}
            >
              Hold decisions
            </button>
            {hidden > 0 && (
              <button
                type="button"
                onClick={releaseSituations}
                className="label whitespace-nowrap rounded-full bg-[rgba(180,85,63,.14)] px-2.5 py-[6px] text-[8.5px] text-[#9B4330] transition-colors hover:bg-[rgba(180,85,63,.22)]"
              >
                Reveal {hidden}
              </button>
            )}
          </div>

          <span className="h-5 w-px shrink-0 bg-[rgba(58,43,35,.12)]" />

          <button
            type="button"
            onClick={() => applyPreset("normal")}
            className="label whitespace-nowrap rounded-full px-2.5 py-[6px] text-[8.5px] text-[#8C7B66] transition-colors hover:text-[var(--espresso)]"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
