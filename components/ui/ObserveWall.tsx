"use client";

import { useMemo } from "react";
import { useStore, useSim, currentLive } from "@/lib/store";
import { AGENTS } from "@/lib/agents";
import { KIND_LABEL, clockLabel } from "@/lib/engine";
import { optionsFor } from "@/lib/scenarios";
import { SCENARIO_LABEL } from "@/lib/presets";
import { SITES } from "@/components/world/palette";
import { compact, n, pct, compactMoney } from "@/lib/fmt";
import type { BuildingId, WorldStatus } from "@/lib/types";
import { StatusPill, TONE } from "./bits";
import { DemoBadge, ModeSwitcher, Wordmark } from "./Chrome";

/* ─────────────────────────────────────────────────────────────────
   THE OBSERVE WALL
   A TV framing of the district: three status cards, the clock, the
   latest event, and — when the district needs a decision — a single
   strip naming it. Everything readable from across a room; any click
   escalates into Interact mode.
   ───────────────────────────────────────────────────────────────── */

const ORDER: BuildingId[] = ["fulfillment", "atelier", "boutique"];

function BigStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className="num text-[clamp(17px,1.9vw,24px)] leading-none" style={{ color: tone ?? "var(--ink)" }}>
        {value}
      </div>
      <div className="label mt-1.5 text-[8px] text-[#A3927C]">{label}</div>
    </div>
  );
}

function BuildingCard({ id }: { id: BuildingId }) {
  const m = useStore((s) => s.metrics);
  const queueUnits = useStore((s) => s.flow.queueUnits);
  const focusBuilding = useStore((s) => s.focusBuilding);
  const site = SITES[id];

  const status: WorldStatus =
    id === "fulfillment" ? m.fulfillment.status : id === "atelier" ? m.inventory.status : m.boutique.status;

  const stats =
    id === "fulfillment"
      ? [
          { label: "Units in queue", value: n(queueUnits) },
          { label: "Orders at risk", value: n(m.fulfillment.atRisk), tone: m.fulfillment.atRisk > 0 ? TONE.critical.fg : undefined },
          { label: "On-time", value: pct(m.fulfillment.onTimeRate) },
        ]
      : id === "atelier"
        ? [
            { label: "Units on hand", value: n(m.inventory.unitsOnHand) },
            { label: "Critical styles", value: n(m.inventory.critical.length), tone: m.inventory.critical.length > 0 ? TONE.critical.fg : undefined },
            { label: "Exposed revenue", value: compactMoney(m.inventory.atRiskRevenue) },
          ]
        : [
            { label: "Sessions", value: compact(m.boutique.sessions) },
            { label: "Orders today", value: n(m.boutique.ordersToday) },
            { label: "Inquiries", value: n(m.boutique.inquiries) },
          ];

  return (
    <button
      type="button"
      onClick={() => focusBuilding(id)}
      className="panel grain pointer-events-auto relative w-full overflow-hidden rounded-[3px] text-left transition-transform duration-300 hover:-translate-y-px"
      title={`Open ${site.name} in Interact mode`}
    >
      <div className="goldline absolute inset-x-0 top-0 h-px" />
      <div className="px-4 pb-3.5 pt-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="display truncate text-[15px] leading-tight text-[var(--ink)]">
              {site.name.replace("The ", "")}
            </div>
            <div className="eyebrow mt-0.5 text-[7.5px] text-[#B5A48E]">{site.agentName}</div>
          </div>
          <StatusPill status={status} label={TONE[status].label} small />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {stats.map((st) => (
            <BigStat key={st.label} label={st.label} value={st.value} tone={st.tone} />
          ))}
        </div>
      </div>
    </button>
  );
}

/** The one decision the wall surfaces — the first revealed situation. */
function DecisionStrip() {
  const situations = useStore((s) => s.situations);
  const metrics = useStore((s) => s.metrics);
  const minuteHour = useStore((s) => Math.floor(s.flow.minute / 60));
  const openLab = useStore((s) => s.openLab);
  const sim = useSim();

  const revealed = situations.filter((x) => x.revealed);
  const sit = revealed[0];

  // Option generation is a handful of derives — refresh it hourly, like the panel.
  const optionCount = useMemo(
    () => (sit ? optionsFor(sit, metrics, sim, currentLive()).length : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sit?.key, minuteHour],
  );

  if (!sit) return null;
  const agent = AGENTS[sit.agent];
  const tone = sit.tone === "alert" ? "critical" : "watch";

  return (
    <div
      className="panel grain pointer-events-auto relative overflow-hidden rounded-[3px]"
      style={{ animation: "fadeUp .55s var(--ease) both" }}
    >
      <div className="absolute inset-y-0 left-0 w-[3px]" style={{ background: TONE[tone].dot }} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 pl-5 pr-4">
        <span
          className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[7.5px] font-semibold text-[#FBF7F2]"
          style={{ background: agent.accent }}
        >
          {agent.mark}
        </span>
        <div className="min-w-0 flex-1">
          <div className="label text-[7.5px]" style={{ color: TONE[tone].fg }}>
            {agent.name} · {optionCount} options ready
          </div>
          <div className="mt-0.5 truncate text-[clamp(13px,1.4vw,16px)] font-medium leading-snug text-[var(--ink)]">
            {sit.headline}
          </div>
        </div>
        {revealed.length > 1 && (
          <span className="num hidden text-[10px] text-[#A3927C] sm:inline">
            +{revealed.length - 1} more {revealed.length === 2 ? "decision" : "decisions"}
          </span>
        )}
        <button
          type="button"
          onClick={() => openLab(sit.building, sit.key)}
          className="label shrink-0 rounded-full bg-[var(--espresso)] px-4 py-[8px] text-[9px] text-[#FBF7F2] transition-colors hover:bg-[var(--ink)]"
        >
          Explore options →
        </button>
      </div>
    </div>
  );
}

export function ObserveWall() {
  const phase = useStore((s) => s.phase);
  const minute = useStore((s) => s.flow.minute);
  const inShift = useStore((s) => s.flow.inShift);
  const scenario = useStore((s) => s.scenario);
  const latest = useStore((s) => s.events[0]);
  const { label } = clockLabel(minute);

  if (phase === "arrival") return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {/* ── header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 px-5 py-4 sm:px-7 sm:py-5">
        <div className="flex items-center gap-4">
          <Wordmark small />
          <div className="hidden items-center gap-2 rounded-full border border-[rgba(58,43,35,.1)] bg-[rgba(253,251,248,.78)] px-3.5 py-[7px] backdrop-blur-md sm:flex">
            <span
              className={`h-[5px] w-[5px] rounded-full ${inShift ? "a-breathe" : ""}`}
              style={{ background: inShift ? TONE.healthy.dot : "#BCAB95" }}
            />
            <span className="num text-[11.5px] text-[var(--espresso)]">{label}</span>
            <span className="label text-[8px] text-[#A3927C]">{inShift ? "Floor open" : "Floor closed"}</span>
          </div>
          {scenario !== "baseline" && (
            <div className="hidden items-center gap-2 rounded-full border border-[rgba(58,43,35,.1)] bg-[rgba(253,251,248,.78)] px-3.5 py-[7px] backdrop-blur-md md:flex">
              <span className="h-[5px] w-[5px] rounded-full bg-[var(--amber)] a-breathe" />
              <span className="eyebrow text-[8px] text-[#8C7B66]">{SCENARIO_LABEL[scenario]} running</span>
            </div>
          )}
        </div>
        <div className="pointer-events-auto flex items-center gap-2.5">
          <ModeSwitcher />
          <div className="hidden lg:block">
            <DemoBadge compact />
          </div>
        </div>
      </div>

      {/* ── the three buildings ────────────────────────────────── */}
      <div className="absolute left-5 top-[84px] flex w-[min(290px,calc(100vw-40px))] flex-col gap-2.5 sm:left-7 sm:top-[92px]">
        {ORDER.map((id) => (
          <BuildingCard key={id} id={id} />
        ))}
      </div>

      {/* ── decision + ticker ──────────────────────────────────── */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2.5 px-5 pb-5 sm:px-7 sm:pb-6">
        <div className="w-[min(720px,100%)]">
          <DecisionStrip />
        </div>
        <div className="flex max-w-full items-center gap-3 rounded-full border border-[rgba(58,43,35,.1)] bg-[rgba(253,251,248,.72)] px-4 py-[7px] backdrop-blur-md">
          {latest ? (
            <>
              <span className="num shrink-0 text-[9.5px] text-[#B5A48E]">{clockLabel(latest.minute).time}</span>
              <span className="label shrink-0 text-[7.5px] text-[var(--gold)]">{KIND_LABEL[latest.kind]}</span>
              <span className="truncate text-[11px] text-[#6E5C4D]">{latest.title}</span>
              <span className="eyebrow hidden shrink-0 text-[7px] text-[#C0AF98] sm:inline">
                {SITES[latest.building].name.replace("The ", "")}
              </span>
            </>
          ) : (
            <span className="text-[11px] text-[#9C8B76]">
              The district is running. Events will stream here as they happen.
            </span>
          )}
          <span className="hidden h-3 w-px shrink-0 bg-[rgba(58,43,35,.12)] sm:block" />
          <span className="eyebrow hidden shrink-0 text-[7px] text-[#B5A48E] sm:inline">Simulated data</span>
        </div>
      </div>
    </div>
  );
}
