"use client";

import { useEffect } from "react";
import { useSim, useStore } from "@/lib/store";
import { AGENTS } from "@/lib/agents";
import { KIND_LABEL, clockLabel, inspect } from "@/lib/engine";
import { SITES } from "@/components/world/palette";
import type { WorldStatus } from "@/lib/types";
import { Btn, GoldRule, Rule, TONE } from "./bits";

/* ─────────────────────────────────────────────────────────────────
   Click anything the district animates and this explains it: the
   event that drove it, the live numbers, and the causal reason.
   ───────────────────────────────────────────────────────────────── */

const TONE_OF: Record<string, WorldStatus> = {
  info: "healthy",
  good: "healthy",
  watch: "watch",
  alert: "critical",
};

export function Inspector() {
  const key = useStore((s) => s.inspecting);
  const close = useStore((s) => s.inspectObject);
  const metrics = useStore((s) => s.metrics);
  const flow = useStore((s) => s.flow);
  const events = useStore((s) => s.events);
  const openAgentPanel = useStore((s) => s.openAgentPanel);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && useStore.getState().inspecting) close(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const open = !!key;
  const sim = useSim();

  const info = key ? inspect(key, metrics, flow, sim) : null;
  const last = key ? events.find((e) => e.focus === key) : undefined;
  const agent = info?.agent ? AGENTS[info.agent] : null;

  return (
    <aside
      aria-hidden={!open}
      className="pointer-events-none absolute inset-x-0 bottom-0 top-[22%] z-40 flex justify-end sm:inset-y-0 sm:left-auto sm:right-0 sm:top-0 sm:w-[min(420px,92vw)] xl:right-[clamp(400px,33vw,520px)] xl:w-[clamp(340px,27vw,430px)]"
    >
      <div
        className="panel grain pointer-events-auto relative flex h-full w-full flex-col overflow-hidden rounded-t-[14px] border-t sm:rounded-none sm:border-l sm:border-t-0"
        style={{
          transform: open ? "none" : "var(--ap-closed, translateY(106%))",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "transform .6s var(--ease), opacity .35s var(--ease)",
          borderColor: "rgba(58,43,35,.1)",
        }}
      >
        {info && key && (
          <>
            <div className="relative shrink-0 px-5 pb-4 pt-5">
              <div className="goldline absolute inset-x-0 top-0 h-px" />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="eyebrow text-[8.5px] text-[#A3927C]">
                    {SITES[info.building].name.replace("The ", "")} · {info.system}
                  </div>
                  <h2 className="display mt-1.5 text-[24px] leading-tight text-[var(--ink)]">
                    {info.title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => close(null)}
                  className="-mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-[#A3927C] transition-colors hover:bg-[rgba(58,43,35,.06)] hover:text-[var(--espresso)]"
                  aria-label="Close"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                    <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>

            <Rule />

            <div className="scroll-fine min-h-0 flex-1 overflow-y-auto px-5 py-5">
              {/* live numbers */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                {info.metrics.map((d) => (
                  <div key={d.label} className="min-w-0">
                    <div className="label text-[8.5px] text-[#A3927C]">{d.label}</div>
                    <div className="display num mt-0.5 truncate text-[19px] text-[var(--ink)]">
                      {d.value}
                    </div>
                    {d.note && <div className="truncate text-[10px] text-[#A3927C]">{d.note}</div>}
                  </div>
                ))}
              </div>

              <div className="my-5">
                <GoldRule className="opacity-50" />
              </div>

              <Block title="What you are watching">
                <p className="text-[12.5px] leading-relaxed text-[#5F5043]">{info.what}</p>
              </Block>

              <Block title="Why it is doing that">
                <p className="text-[12.5px] leading-relaxed text-[#5F5043]">{info.why}</p>
              </Block>

              {last && (
                <Block title="Most recent event here">
                  <div
                    className="rounded-[2px] border px-3 py-2.5"
                    style={{
                      borderColor: `${TONE[TONE_OF[last.tone]].dot}44`,
                      background: TONE[TONE_OF[last.tone]].bg,
                    }}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="num text-[9.5px] text-[#A3927C]">
                        {clockLabel(last.minute).label}
                      </span>
                      <span
                        className="label text-[8px]"
                        style={{ color: TONE[TONE_OF[last.tone]].fg }}
                      >
                        {KIND_LABEL[last.kind]}
                      </span>
                    </div>
                    <div
                      className="mt-1 text-[12px] font-medium leading-snug"
                      style={{ color: TONE[TONE_OF[last.tone]].fg }}
                    >
                      {last.title}
                    </div>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-[#6E5C4D]">{last.detail}</p>
                    <p className="mt-1.5 border-t border-[rgba(58,43,35,.09)] pt-1.5 text-[11px] leading-relaxed text-[#8C7B66]">
                      {last.why}
                    </p>
                  </div>
                </Block>
              )}

              {agent && (
                <Btn variant="ghost" size="sm" className="mt-5" onClick={() => openAgentPanel(agent.id)}>
                  Ask the {agent.name.split(" ").slice(-1)[0]}
                </Btn>
              )}

              <p className="mt-5 text-[10px] leading-relaxed text-[#B5A48E]">
                This object is a readout of the shared simulation — it has no schedule of its own.
                Simulated data only; no external system is connected.
              </p>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="pt-4 first:pt-0">
      <div className="mb-2 flex items-center gap-2.5">
        <span className="eyebrow text-[8.5px] text-[#A3927C]">{title}</span>
        <span className="h-px flex-1 bg-[rgba(58,43,35,.08)]" />
      </div>
      {children}
    </section>
  );
}
