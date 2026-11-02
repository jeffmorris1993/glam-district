"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { AGENTS, briefFor } from "@/lib/agents";
import { clockLabel } from "@/lib/engine";
import { useSim } from "@/lib/store";
import type { AgentId, WorldStatus } from "@/lib/types";
import { Btn, StatusPill, TONE } from "./bits";

/* ─────────────────────────────────────────────────────────────────
   THE DECISION DESK
   The Timeline answers "what happened"; this answers "what needs you".
   Open decisions carry options into the Scenario Lab; applied plans
   carry their verify stamps. Dismissing is quiet by design.
   ───────────────────────────────────────────────────────────────── */

const SIT_TONE: Record<"watch" | "alert", WorldStatus> = {
  watch: "watch",
  alert: "critical",
};

export function ActionCenterToggle() {
  const open = useStore((s) => s.actionCenterOpen);
  const toggle = useStore((s) => s.toggleActionCenter);
  const phase = useStore((s) => s.phase);
  const pending = useStore((s) => s.situations.filter((x) => x.revealed).length);
  if (phase === "arrival") return null;

  return (
    <button
      type="button"
      onClick={toggle}
      className="pointer-events-auto flex items-center gap-2 rounded-full border border-[rgba(58,43,35,.12)] bg-[rgba(253,251,248,.78)] px-3 py-[6px] backdrop-blur-md transition-colors hover:border-[var(--gold)]"
    >
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path d="M6 1l1.4 2.9 3.1.4-2.3 2.2.6 3.1L6 8.1 3.2 9.6l.6-3.1L1.5 4.3l3.1-.4L6 1Z" stroke="#B8914F" strokeWidth=".9" strokeLinejoin="round" />
      </svg>
      <span className="label text-[9px] text-[var(--espresso)]">
        {open ? "Hide decisions" : "Decision desk"}
      </span>
      {pending > 0 && (
        <span className="num rounded-full bg-[rgba(180,85,63,.14)] px-1.5 text-[9px] text-[#9B4330]">
          {pending}
        </span>
      )}
    </button>
  );
}

function Fold({
  title,
  count,
  defaultOpen,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <section className="border-t border-[rgba(58,43,35,.07)] first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
        aria-expanded={open}
      >
        <span className="eyebrow text-[8.5px] text-[#A3927C]">{title}</span>
        <span className="flex items-center gap-2">
          {count !== undefined && count > 0 && (
            <span className="num text-[9px] text-[#A3927C]">{count}</span>
          )}
          <svg
            width="9" height="6" viewBox="0 0 10 6" fill="none" aria-hidden
            style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .3s var(--ease)" }}
          >
            <path d="M1 1l4 4 4-4" stroke="#A3927C" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </span>
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </section>
  );
}

export function ActionCenter() {
  const open = useStore((s) => s.actionCenterOpen);
  const phase = useStore((s) => s.phase);
  const situations = useStore((s) => s.situations);
  const dismissed = useStore(
    (s) => Object.values(s.situationLog).filter((x) => x.status === "dismissed").length,
  );
  const appliedPlans = useStore((s) => s.appliedPlans);
  const metrics = useStore((s) => s.metrics);
  const sim = useSim();
  const openLab = useStore((s) => s.openLab);
  const dismissSituation = useStore((s) => s.dismissSituation);
  const revertPlan = useStore((s) => s.revertPlan);
  const openAgentPanel = useStore((s) => s.openAgentPanel);
  const focusBuilding = useStore((s) => s.focusBuilding);

  const revealed = situations.filter((x) => x.revealed);
  const visible = open && phase !== "arrival";

  return (
    <div
      aria-hidden={!visible}
      className="pointer-events-none absolute left-5 top-[150px] z-30 w-[min(360px,calc(100vw-40px))] sm:left-7 sm:top-[158px]"
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
        <div className="flex items-center justify-between px-4 pb-1 pt-3">
          <span className="eyebrow text-[8.5px] text-[#A3927C]">Decision desk</span>
          <span className="text-[9px] text-[#B5A48E]">the agents advise — you decide</span>
        </div>

        <div className="scroll-fine max-h-[min(52vh,480px)] overflow-y-auto">
          {/* ── open decisions ─────────────────────────────────── */}
          <Fold title="Open decisions" count={revealed.length} defaultOpen>
            {revealed.length === 0 ? (
              <p className="py-1 text-[11px] leading-relaxed text-[#9C8B76]">
                Nothing needs a decision. When the district crosses a threshold, the
                responsible agent lays out options here.
              </p>
            ) : (
              <div className="grid gap-2">
                {revealed.map((sit) => {
                  const tone = SIT_TONE[sit.tone];
                  const agent = AGENTS[sit.agent];
                  return (
                    <div
                      key={sit.key}
                      className="rounded-[2px] border px-3 py-2.5"
                      style={{ borderColor: `${TONE[tone].dot}44`, background: TONE[tone].bg }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="flex h-[16px] w-[16px] items-center justify-center rounded-full text-[7px] font-semibold text-[#FBF7F2]"
                          style={{ background: agent.accent }}
                        >
                          {agent.mark}
                        </span>
                        <span className="label text-[7.5px]" style={{ color: TONE[tone].fg }}>
                          {agent.name}
                        </span>
                      </div>
                      <div className="mt-1.5 text-[12px] font-medium leading-snug text-[var(--espresso)]">
                        {sit.headline}
                      </div>
                      <p className="mt-1 text-[10.5px] leading-relaxed text-[#6E5C4D]">
                        {sit.whyItMatters}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        {sit.evidence.map((e) => (
                          <span key={e.label} className="num text-[9px] text-[#8C7B66]">
                            {e.label} <b className="text-[var(--espresso)]">{e.value}</b>
                          </span>
                        ))}
                      </div>
                      <div className="mt-2.5 flex items-center gap-2">
                        <Btn size="sm" variant="primary" onClick={() => openLab(sit.building, sit.key)}>
                          Explore options
                        </Btn>
                        <Btn size="sm" variant="quiet" onClick={() => openAgentPanel(sit.agent)}>
                          Ask {agent.name.split(" ").slice(-1)[0]}
                        </Btn>
                        <button
                          type="button"
                          onClick={() => dismissSituation(sit.key)}
                          className="label ml-auto text-[8px] text-[#B5A48E] transition-colors hover:text-[#8C7B66]"
                          title="Set aside quietly for a simulated day"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Fold>

          {/* ── agent briefings ────────────────────────────────── */}
          <Fold title="Agent briefings">
            <div className="grid gap-2">
              {(Object.keys(AGENTS) as AgentId[]).map((aid) => {
                const agent = AGENTS[aid];
                const brief = briefFor(aid, metrics, sim);
                return (
                  <button
                    key={aid}
                    type="button"
                    onClick={() => {
                      focusBuilding(agent.building);
                      openAgentPanel(aid);
                    }}
                    className="rounded-[2px] border border-[rgba(58,43,35,.08)] bg-[rgba(255,255,255,.45)] px-3 py-2 text-left transition-colors hover:border-[var(--champagne)]"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-[11px] font-medium text-[var(--espresso)]">
                        <span
                          className="flex h-[16px] w-[16px] items-center justify-center rounded-full text-[7px] font-semibold text-[#FBF7F2]"
                          style={{ background: agent.accent }}
                        >
                          {agent.mark}
                        </span>
                        {agent.name}
                      </span>
                      <StatusPill
                        status={brief.status === "Needs review" ? "critical" : brief.status === "Analyzing" ? "watch" : "healthy"}
                        label={brief.status}
                        small
                      />
                    </span>
                    <span className="mt-1 block text-[10.5px] leading-snug text-[#8C7B66]">
                      {brief.task}
                    </span>
                  </button>
                );
              })}
            </div>
          </Fold>

          {/* ── applied plans (the decision record) ─────────────── */}
          <Fold title="Applied plans" count={appliedPlans.length} defaultOpen={appliedPlans.length > 0}>
            {appliedPlans.length === 0 ? (
              <p className="py-1 text-[11px] leading-relaxed text-[#9C8B76]">
                Plans you apply in the Scenario Lab are recorded here with their before/after
                figures and, for buys, the day the goods landed.
              </p>
            ) : (
              <div className="grid gap-2">
                {appliedPlans.map((ap, i) => (
                  <div
                    key={ap.id}
                    className="rounded-[2px] border border-[rgba(58,43,35,.08)] bg-[rgba(255,255,255,.5)] px-3 py-2"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[11.5px] font-medium text-[var(--espresso)]">
                        {ap.label}
                      </span>
                      <span className="num shrink-0 text-[9px] text-[#B5A48E]">
                        {clockLabel(ap.minute).label}
                      </span>
                    </div>
                    <div className="num mt-0.5 text-[10px] text-[#8C7B66]">{ap.deltas}</div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="label text-[7.5px]" style={{ color: ap.poIds.length === 0 ? "#5C6B54" : ap.landedAt !== undefined ? "#5C6B54" : "#9A6523" }}>
                        {ap.poIds.length === 0
                          ? "✓ In effect"
                          : ap.landedAt !== undefined
                            ? `✓ Verified — goods landed ${clockLabel(ap.landedAt).label}`
                            : "… PO in transit — verify on arrival"}
                      </span>
                      {i === 0 && (
                        <Btn size="sm" variant="quiet" onClick={revertPlan}>
                          ↩ Revert
                        </Btn>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Fold>

          {dismissed > 0 && (
            <div className="border-t border-[rgba(58,43,35,.07)] px-4 py-2">
              <span className="text-[9.5px] text-[#B5A48E]">
                {dismissed} {dismissed === 1 ? "situation" : "situations"} dismissed — quiet for a
                simulated day, then eligible to resurface.
              </span>
            </div>
          )}
        </div>

        <div className="border-t border-[rgba(58,43,35,.08)] px-4 py-2">
          <p className="text-[9px] leading-relaxed text-[#B5A48E]">
            Simulated decisions over fictional data. Nothing here sends messages, places
            purchase orders, or changes real staffing.
          </p>
        </div>
      </div>
    </div>
  );
}
