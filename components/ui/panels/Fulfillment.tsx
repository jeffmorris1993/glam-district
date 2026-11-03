"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { ASSUMPTIONS, SHIFT_START_MIN, isWorkday, timeET, weekdayOf, clockLabel } from "@/lib/sim";
import { PARCEL_UNITS, TRUCK_LOAD } from "@/lib/engine";
import { compactMoney, days, money, n, pct } from "@/lib/fmt";
import { byId } from "@/lib/catalog";
import type { PriorityPolicy, WorldStatus } from "@/lib/types";
import { BarChart, Btn, Meter, Rule, Stat, StatusPill, Swatch, TONE } from "../bits";
import { Section, SubHead } from "./shell";

const POLICY_LABEL: Record<PriorityPolicy, string> = {
  "promise-first": "Promise first",
  "value-first": "Value first",
  "express-first": "Express first",
};

/* ─────────────────────────────────────────────────────────────────
   "HOW IS THIS CALCULATED?"
   Every major figure on this panel opens into its exact formula, the
   live input values, and a plain-English reading — so a nontechnical
   owner can click any number and know where it came from.
   ───────────────────────────────────────────────────────────────── */

interface ExplainDef {
  title: string;
  formula: string;
  inputs: [string, string][];
  english: string;
}

function ExplainCard({ def, onClose }: { def: ExplainDef; onClose: () => void }) {
  return (
    <div className="mt-3 rounded-[2px] border border-[rgba(184,145,79,.35)] bg-[rgba(217,188,140,.08)] p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="label text-[8px] text-[#9A6523]">How is this calculated?</div>
          <div className="mt-0.5 text-[12px] font-medium text-[var(--espresso)]">{def.title}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close explanation"
          className="rounded-full p-1 text-[#A3927C] transition-colors hover:text-[var(--espresso)]"
        >
          <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="num mt-2.5 rounded-[2px] border border-[rgba(58,43,35,.1)] bg-white/70 px-2.5 py-2 text-[10.5px] leading-relaxed text-[var(--espresso)]">
        {def.formula}
      </div>

      <div className="mt-2.5 grid gap-1">
        {def.inputs.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 text-[10.5px]">
            <span className="text-[#8C7B66]">{k}</span>
            <span className="num text-right text-[var(--espresso)]">{v}</span>
          </div>
        ))}
      </div>

      <p className="mt-2.5 text-[11px] leading-relaxed text-[#6E5C4D]">{def.english}</p>
      <p className="mt-2 text-[9px] text-[#B5A48E]">
        Deterministic simulation over fictional data — a demonstration, not a real system.
      </p>
    </div>
  );
}

/** A Stat that advertises and toggles its own explanation. */
function XStat({
  id,
  open,
  onToggle,
  label,
  value,
  note,
  tone,
  size = "sm",
}: {
  id: string;
  open: string | null;
  onToggle: (id: string | null) => void;
  label: string;
  value: string;
  note?: string;
  tone?: WorldStatus;
  size?: "sm" | "lg";
}) {
  const active = open === id;
  return (
    <button
      type="button"
      onClick={() => onToggle(active ? null : id)}
      aria-expanded={active}
      className="group rounded-[2px] text-left transition-colors hover:bg-[rgba(217,188,140,.1)]"
    >
      <Stat label={label} value={value} note={note} tone={tone} size={size} />
      <span
        className="label mt-0.5 block text-[7px] transition-colors"
        style={{ color: active ? "var(--gold)" : "#C8B9A4" }}
      >
        ⓘ how?
      </span>
    </button>
  );
}

const fmtDur = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
};

export function FulfillmentPanel() {
  const m = useStore((s) => s.metrics.fulfillment);
  const flow = useStore((s) => s.flow);
  const staffing = useStore((s) => s.staffing);
  const demandMultiplier = useStore((s) => s.demandMultiplier);
  const priorityPolicy = useStore((s) => s.priorityPolicy);
  const openAgentPanel = useStore((s) => s.openAgentPanel);
  const openLab = useStore((s) => s.openLab);
  const revertPlan = useStore((s) => s.revertPlan);
  const applied = useStore((s) => s.appliedPlans[0] ?? null);
  const backlogKey = useStore((s) =>
    s.situations.some((x) => x.key === "fulfillment.backlog") ? "fulfillment.backlog" : undefined,
  );

  const [exp, setExp] = useState<string | null>(null);
  const queue = useMemo(() => m.queue.slice(0, 40), [m.queue]);
  const riskTone = m.status;

  const dayIdx = Math.floor(flow.minute / 1440);
  const minOfDay = flow.minute % 1440;
  const dayThroughput = Math.min(Math.max(1, m.openOrders), m.capacityPerDay);

  // When does packing next run? (used by the queue header and explainers)
  const nextPacking = (() => {
    if (flow.inShift) return null;
    if (isWorkday(dayIdx) && minOfDay < SHIFT_START_MIN)
      return `today ${timeET(SHIFT_START_MIN)}`;
    let k = 1;
    while (!isWorkday(dayIdx + k)) k++;
    return `${weekdayOf(dayIdx + k)} ${timeET(SHIFT_START_MIN)}`;
  })();

  const DEFS: Record<string, ExplainDef> = {
    openOrders: {
      title: "Open orders",
      formula: "itemized orders remaining in the book + newly arrived orders not yet itemized",
      inputs: [
        ["Itemized orders remaining", n(m.queue.length)],
        ["Newly arrived (estimated)", `≈${n(m.unlistedOrders)} orders · ${n(m.unlistedUnits)} units`],
        ["Units waiting (live queue)", `${n(m.openUnits)} units`],
        ...(m.partialPackedUnits > 0
          ? [["Order being packed now", `${n(m.partialPackedUnits)} units already done`] as [string, string]]
          : []),
      ],
      english:
        "Orders placed but not yet fully packed. The floor works the priority sequence from the top, so what remains is the back of the book plus whatever has arrived since the book was cut — those arrivals are counted but not yet itemized by name.",
    },
    atRisk: {
      title: "Orders at risk",
      formula: "count of open orders whose projected pack day lands after their promise deadline",
      inputs: [
        ["Capacity left today", `${n(m.capRemainingToday)} units (${fmtDur(m.remainingShiftMin)} of shift left)`],
        ["Full-day capacity", `${n(m.capacityUnits)} units`],
        ["Standard promise", "2 business days (VIP & Express: next business day)"],
        ["Business days", "today counts only while the floor is open · Sundays closed"],
        ["Value exposed", compactMoney(m.atRiskValue)],
      ],
      english:
        "Each order is placed into the schedule in priority order: the rest of today's shift first, then each following working day at full capacity. If an order's slot lands past its promised business day, it is at risk. The count moves with the time of day — an evening queue has no 'today' left to use.",
    },
    backlog: {
      title: "Backlog",
      formula: "units waiting ÷ full-day pack capacity",
      inputs: [
        ["Units waiting", n(m.openUnits)],
        ["Capacity per day", `${n(m.capacityUnits)} units`],
        ["Result", days(m.backlogDays)],
      ],
      english:
        "How many full shifts of work are queued — capacity-days, not calendar days. A 1.2-day backlog read at 4 PM still spills into tomorrow, because today's shift is nearly spent; the ship plan below accounts for that.",
    },
    utilization: {
      title: "Capacity utilisation",
      formula: "units arriving per day ÷ units of daily pack capacity",
      inputs: [
        ["Intake", `${n(Math.round(flow.inflowRate * 1440))} units/day`],
        ["Capacity", `${n(m.capacityUnits)} units/day`],
        ["Result", pct(m.utilization)],
      ],
      english:
        "Above 100%, orders arrive faster than the floor can pack even at full tilt, so the queue grows. Below 100%, the floor gains ground whenever the shift is running.",
    },
    packRate: {
      title: "Pack rate",
      formula: "daily capacity ÷ shift length, while the floor is open · 0 when closed",
      inputs: [
        ["Daily capacity", `${n(m.capacityUnits)} units`],
        [
          "Shift",
          `${timeET(SHIFT_START_MIN)}–${timeET(m.shiftEndMin)} (${staffing.shiftHours}h${staffing.secondShift ? " ×2 shifts" : ""})`,
        ],
        ["Right now", flow.inShift ? `${n(flow.packRate * 60)} units/hr` : "0 — floor closed"],
      ],
      english:
        "Capacity only exists while associates are on the floor. The model spreads the day's capacity evenly across the shift; outside shift hours the belt stops and the queue only grows.",
    },
    intake: {
      title: "Intake",
      formula: "Σ style velocity × demand multiplier (× event lift) ÷ 24 hours",
      inputs: [
        ["Daily intake", `${n(Math.round(flow.inflowRate * 1440))} units`],
        ["Demand multiplier", `${demandMultiplier.toFixed(2)}×`],
        ["Arrives", "around the clock, 7 days a week"],
      ],
      english:
        "Online orders arrive day and night, including Sundays when the floor is dark — that is why the queue is taller every morning than it was at close.",
    },
    packedToday: {
      title: "Packed today",
      formula: "Σ units packed since midnight ET (completed work, not a projection)",
      inputs: [
        ["Queue at midnight", `${n(flow.queueAtDayStart)} units`],
        ["+ arrived today", `${n(flow.arrivedUnitsToday)} units`],
        ["− packed today", `${n(flow.packedToday)} units`],
        ["= queue now", `${n(flow.queueUnits)} units ✓`],
      ],
      english:
        "An actual count of units the floor has finished since midnight — it only ever climbs during the shift and resets at midnight. The identity above ties it to the live queue exactly.",
    },
    vans: {
      title: "Vans dispatched",
      formula: `parcels = packed units ÷ ${PARCEL_UNITS} · a van departs at every ${TRUCK_LOAD} staged parcels`,
      inputs: [
        ["Staged at midnight", `${n(flow.stagedAtDayStart)} parcels`],
        ["+ packed today", `${n(flow.packedToday)} u ÷ ${PARCEL_UNITS} = ${n(flow.packedToday / PARCEL_UNITS)} parcels`],
        ["− dispatched", `${n(flow.trucksToday)} vans × ${TRUCK_LOAD} = ${n(flow.trucksToday * TRUCK_LOAD)} parcels`],
        ["= on the dock now", `${n(flow.stagedParcels)} parcels ✓`],
      ],
      english:
        "Vans are not on a timer: one leaves each time the dock accumulates a full load. Every parcel on a van today traces back to a unit packed on this floor — the identity above reconciles to the parcel.",
    },
    costPerOrder: {
      title: "Cost per order",
      formula: "(labour per day + overhead per day) ÷ full-day throughput + packaging",
      inputs: [
        [
          "Labour",
          `${staffing.pickers} × ${staffing.shiftHours}h${staffing.secondShift ? " ×2" : ""} × ${money(ASSUMPTIONS.laborRate, 2)}/hr = ${money(m.laborCostDay)}/day`,
        ],
        ["Facility overhead", `${money(ASSUMPTIONS.fixedOverheadDay)}/day`],
        ["Full-day throughput", `${n(dayThroughput)} orders`],
        ["Packaging", `${money(ASSUMPTIONS.packagingPerOrder, 2)}/order`],
        ["Result", money(m.costPerOrder, 2)],
      ],
      english:
        "A full-day economic figure: it spreads a complete day's labour and overhead across a complete day's orders, so it does not swing with the time of day. Adding capacity without orders to fill it raises this number; filling existing capacity lowers it.",
    },
  };

  const explain = exp ? DEFS[exp] : null;

  return (
    <>
      {/* ── headline ───────────────────────────────────────────── */}
      <Section>
        <div className="grid grid-cols-3 gap-4">
          <XStat id="openOrders" open={exp} onToggle={setExp} label="Open orders" value={n(m.openOrders)} note={`${n(m.openUnits)} units`} size="lg" />
          <XStat
            id="atRisk"
            open={exp}
            onToggle={setExp}
            label="At risk"
            value={n(m.atRisk)}
            note={m.atRisk ? compactMoney(m.atRiskValue) : "all within promise"}
            tone={m.atRisk ? (m.status === "critical" ? "critical" : "watch") : "healthy"}
            size="lg"
          />
          <XStat id="backlog" open={exp} onToggle={setExp} label="Backlog" value={days(m.backlogDays)} note={`${pct(m.onTimeRate, 1)} on time`} size="lg" />
        </div>

        <div className="mt-5">
          <button
            type="button"
            onClick={() => setExp(exp === "utilization" ? null : "utilization")}
            aria-expanded={exp === "utilization"}
            className="block w-full rounded-[2px] text-left transition-colors hover:bg-[rgba(217,188,140,.08)]"
          >
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="label text-[9.5px] text-[#8C7B66]">
                Capacity utilisation <span className="text-[7px] text-[#C8B9A4]">ⓘ how?</span>
              </span>
              <span className="num text-[11px] text-[var(--espresso)]">
                {pct(m.utilization)} · {n(m.capacityUnits)} units/day
              </span>
            </div>
            <Meter value={Math.min(1.6, m.utilization)} max={1.6} tone={riskTone} height={5} marker={1 / 1.6} />
            <div className="mt-1.5 flex justify-between text-[10px] text-[#A3927C]">
              <span>Inflow vs. capacity</span>
              <span className="num">target 100%</span>
            </div>
          </button>
        </div>

        {explain && ["openOrders", "atRisk", "backlog", "utilization"].includes(exp!) && (
          <ExplainCard def={explain} onClose={() => setExp(null)} />
        )}
      </Section>

      <Rule />

      {/* ── what the floor is doing right now ──────────────────── */}
      <LiveFloor exp={exp} setExp={setExp} defs={DEFS} nextPacking={nextPacking} />

      <Rule />

      {/* ── ship plan ──────────────────────────────────────────── */}
      <Section>
        <SubHead
          title="Ship plan"
          note="Projected pack days for the open book — 'Today' covers only what the remaining shift can still absorb."
          right={<StatusPill status={riskTone} small />}
        />
        <div className="mt-3">
          <BarChart
            height={96}
            data={m.byDay.map((d) => ({
              key: `o${d.offset}`,
              value: d.orders,
              tone:
                d.offset <= m.promiseHorizon
                  ? ("healthy" as const)
                  : d.offset === m.promiseHorizon + 1
                    ? ("watch" as const)
                    : ("critical" as const),
            }))}
            labelFor={(d) => {
              const bucket = m.byDay[Number(d.key.slice(1))];
              return bucket.closed ? `${bucket.label} ·` : bucket.label;
            }}
            valueFor={(d) => n(d.value)}
          />
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-[#8C7B66]">
            {(["healthy", "watch", "critical"] as const).map((t, i) => (
              <span key={t} className="flex items-center gap-1.5">
                <span className="h-[6px] w-[6px] rounded-[1px]" style={{ background: TONE[t].dot }} />
                {["Within standard promise", "One day over", "Beyond"][i]}
              </span>
            ))}
            <span className="ml-auto flex items-center gap-1.5 text-[9px] text-[#9A8468]">
              <span className="h-[5px] w-[5px] rounded-full bg-[var(--gold)]" />
              Projection — deterministic
            </span>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-[#A3927C]">
            {m.byDay.some((d) => d.closed && d.offset > 0) && "Days marked · are non-working days — the floor is dark on Sundays. "}
            {m.remainingShiftMin === 0
              ? `Nothing more ships today: the floor is closed. Packing resumes ${nextPacking}.`
              : `${fmtDur(m.remainingShiftMin)} of shift remains today — ${n(m.capRemainingToday)} units of today's capacity are still unspent.`}
          </p>
        </div>
      </Section>

      <Rule />

      {/* ── the active plan (decisions happen in the Scenario Lab) ── */}
      <Section>
        <SubHead
          title="Active plan"
          note="The plan the floor is running. Explore alternatives — and apply one — in the Scenario Lab."
          right={
            applied ? (
              <Btn size="sm" variant="quiet" onClick={revertPlan} title={`Revert ${applied.label}`}>
                ↩ Revert
              </Btn>
            ) : undefined
          }
        />

        <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3.5">
          <Stat label="Associates" value={n(staffing.pickers)} note={staffing.secondShift ? "two shifts" : "single shift"} size="sm" />
          <Stat
            label="Shift"
            value={`${timeET(SHIFT_START_MIN).replace(" ET", "")}–${timeET(m.shiftEndMin)}`}
            note={`${staffing.shiftHours} hrs · ${staffing.unitsPerLaborHour} u/labour-hr`}
            size="sm"
          />
          <Stat label="Queue policy" value={POLICY_LABEL[priorityPolicy]} size="sm" />
          <XStat
            id="costPerOrder"
            open={exp}
            onToggle={setExp}
            label="Cost / order"
            value={money(m.costPerOrder, 2)}
            note={`${money(m.laborCostDay)} labour/day`}
          />
        </div>
        {exp === "costPerOrder" && explain && <ExplainCard def={explain} onClose={() => setExp(null)} />}

        {applied && (
          <div className="mt-4 rounded-[2px] border border-[rgba(184,145,79,.3)] bg-[rgba(217,188,140,.1)] px-3.5 py-2.5">
            <div className="label text-[8.5px] text-[#9A6523]">Your decision · {clockLabel(applied.minute).label}</div>
            <div className="mt-1 text-[12px] font-medium text-[var(--espresso)]">{applied.label}</div>
            <div className="num mt-0.5 text-[10.5px] text-[#8C7B66]">{applied.deltas}</div>
          </div>
        )}

        <Btn variant="primary" className="mt-4" onClick={() => openLab("fulfillment", backlogKey)}>
          Open in Scenario Lab
        </Btn>
        <p className="mt-2 text-[10.5px] leading-relaxed text-[#9C8B76]">
          Sliders live in the Lab now — explore drafts freely; nothing changes here until you
          apply a plan.
        </p>
      </Section>

      <Rule />

      {/* ── priority queue ─────────────────────────────────────── */}
      <Section>
        <SubHead
          title="Priority order queue"
          note={`${n(m.openOrders)} open · showing the first 40 itemized`}
          right={
            <span className="num text-[10px] text-[#A3927C]">
              {m.packableToday > 0
                ? `${n(m.packableToday)} can still be packed today`
                : `floor ${m.remainingShiftMin === 0 ? "closed" : "at capacity"} — next packing ${nextPacking ?? "tomorrow"}`}
            </span>
          }
        />

        <div className="mt-3 overflow-hidden rounded-[2px] border border-[rgba(58,43,35,.08)]">
          <div className="grid grid-cols-[72px_1fr_56px_52px] gap-2 border-b border-[rgba(58,43,35,.08)] bg-[rgba(58,43,35,.03)] px-3 py-2">
            {["Order", "Client / items", "Value", "Packs"].map((h, i) => (
              <span key={h} className={`label text-[8.5px] text-[#A3927C] ${i >= 2 ? "text-right" : ""}`}>
                {h}
              </span>
            ))}
          </div>
          <div className="scroll-fine max-h-[290px] overflow-y-auto">
            {queue.map((o, i) => (
              <div
                key={`${o.id}-${i}`}
                className="grid grid-cols-[72px_1fr_56px_52px] items-center gap-2 border-b border-[rgba(58,43,35,.05)] px-3 py-2 last:border-0 transition-colors hover:bg-[rgba(217,188,140,.1)]"
              >
                <div className="min-w-0">
                  <div className="num truncate text-[10.5px] font-medium text-[var(--espresso)]">{o.id}</div>
                  <div
                    className="label mt-[1px] text-[7.5px]"
                    style={{
                      color:
                        o.packedUnits !== undefined
                          ? "#5C6B54"
                          : o.tier === "VIP"
                            ? "var(--gold)"
                            : o.tier === "Express"
                              ? "#8C7B66"
                              : "#B5A48E",
                    }}
                  >
                    {o.packedUnits !== undefined ? `packing · ${o.packedUnits}/${o.units} u` : o.tier}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[11px] text-[var(--espresso)]">{o.customer}</div>
                  <div className="mt-[2px] flex items-center gap-1.5">
                    {o.lines.slice(0, 3).map((l, li) => (
                      <span key={li} className="flex items-center gap-1">
                        <Swatch hex={byId(l.productId).hex} size={7} />
                        <span className="num text-[9.5px] text-[#A3927C]">×{l.qty}</span>
                      </span>
                    ))}
                    <span className="truncate text-[9.5px] text-[#BCAB95]">
                      {o.city}, {o.state}
                    </span>
                  </div>
                </div>
                <div className="num text-right text-[11px] text-[var(--espresso)]">{money(o.value)}</div>
                <div className="text-right">
                  <span
                    className="num inline-block rounded-full px-1.5 py-[2px] text-[9px]"
                    style={{
                      background: o.atRisk ? TONE.critical.bg : o.slack === 0 ? TONE.watch.bg : TONE.healthy.bg,
                      color: o.atRisk ? TONE.critical.fg : o.slack === 0 ? TONE.watch.fg : TONE.healthy.fg,
                    }}
                    title={o.atRisk ? "Projected past its promise deadline" : o.slack === 0 ? "Packs on its deadline day" : "Within promise"}
                  >
                    {o.shipLabel}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {m.unlistedOrders > 0 && (
            <div className="border-t border-[rgba(58,43,35,.08)] bg-[rgba(58,43,35,.025)] px-3 py-2 text-[10px] leading-relaxed text-[#8C7B66]">
              + ≈{n(m.unlistedOrders)} newly arrived orders ({n(m.unlistedUnits)} units) not yet
              itemized — they schedule after the book above and are included in every total.
            </div>
          )}
        </div>
        <p className="num mt-2 text-[9.5px] text-[#A3927C]">
          Reconciles: {n(m.queue.length)} itemized + ≈{n(m.unlistedOrders)} arrived ={" "}
          {n(m.openOrders)} open · {n(m.openUnits)} units = the live queue.
        </p>
      </Section>

      <Rule />

      {/* ── briefing ───────────────────────────────────────────── */}
      <Section>
        <SubHead title="AI operations briefing" note="Computed from the plan above." />
        <div className="mt-3 rounded-[2px] border border-[rgba(58,43,35,.08)] bg-[rgba(255,255,255,.5)] p-4">
          <p className="text-[12.5px] leading-relaxed text-[#5F5043]">
            {m.atRisk === 0 ? (
              <>
                The book is clean. {n(m.openOrders)} orders sit against {n(m.capacityUnits)} units of daily capacity, so
                every promise holds.{" "}
                {m.packableToday > 0
                  ? `${n(m.packableToday)} orders can still be packed before the floor closes at ${timeET(m.shiftEndMin)}; the rest are scheduled for the next working days.`
                  : `The floor is closed — packing resumes ${nextPacking}.`}{" "}
                Cost per order runs {money(m.costPerOrder, 2)}.
              </>
            ) : (
              <>
                {n(m.atRisk)} orders — {compactMoney(m.atRiskValue)} — are sequenced past their promise deadline. The book
                needs {days(m.backlogDays)} of capacity to clear and inflow is running at {pct(m.utilization)} of capacity
                {m.utilization > 1 ? ", so the queue is still growing" : ""}.{" "}
                {m.remainingShiftMin > 0
                  ? `${fmtDur(m.remainingShiftMin)} of today's shift remains (${n(m.capRemainingToday)} units).`
                  : `The floor is closed until ${nextPacking}, so nothing more moves today.`}{" "}
                VIP and Express tiers are protected by the sequencing rule.
              </>
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[
              `Promise · 2 business days standard`,
              `Labour · ${money(ASSUMPTIONS.laborRate, 2)}/hr`,
              `Packaging · ${money(ASSUMPTIONS.packagingPerOrder, 2)}/order`,
            ].map((r) => (
              <span
                key={r}
                className="rounded-sm border border-[rgba(58,43,35,.1)] bg-white/60 px-1.5 py-[2px] text-[9.5px] text-[#8C7B66]"
              >
                {r}
              </span>
            ))}
          </div>
          <Btn variant="ghost" size="sm" className="mt-4" onClick={() => openAgentPanel("analyst")}>
            Ask the Fulfillment Analyst
          </Btn>
        </div>
      </Section>

      <Rule />

      {/* ── model assumptions ──────────────────────────────────── */}
      <Section>
        <SubHead
          title="Model assumptions"
          note="Fictional parameters a real warehouse would calibrate — none are validated against live operations."
        />
        <ul className="mt-3 grid gap-1.5 text-[10.5px] leading-relaxed text-[#8C7B66]">
          {[
            `An average order is ≈${PARCEL_UNITS} units and fills exactly one parcel.`,
            `Productivity is flat: ${staffing.unitsPerLaborHour} units per labour-hour for every associate, all shift; a second shift carries an 8% penalty.`,
            "Orders arrive at a uniform rate around the clock — no evening peaks, no weekend lulls.",
            "Promises are stored as business days remaining and do not age as the clock runs; newly arrived orders are assumed standard tier (2 business days).",
            `Vans leave only on a full ${TRUCK_LOAD}-parcel load — there is no end-of-day partial dispatch.`,
            `One shift from ${timeET(SHIFT_START_MIN)}, dark on Sundays, a single Eastern time zone.`,
            `Labour ${money(ASSUMPTIONS.laborRate, 2)}/hr fully loaded · packaging ${money(ASSUMPTIONS.packagingPerOrder, 2)}/order · facility overhead ${money(ASSUMPTIONS.fixedOverheadDay)}/day.`,
            "No returns, cancellations, carrier delays, or mis-picks are modeled.",
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <span className="mt-[7px] h-[3px] w-[3px] shrink-0 rounded-full bg-[#C8B9A4]" />
              {t}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[9.5px] text-[#B5A48E]">
          Every figure on this panel is a deterministic simulation over fictional data.
        </p>
      </Section>
    </>
  );
}

/**
 * The live floor. These are the same figures the warehouse is animating:
 * the belt runs at this pack rate, the pile is this queue, and a van
 * leaves when the staged count reaches a full load.
 */
function LiveFloor({
  exp,
  setExp,
  defs,
  nextPacking,
}: {
  exp: string | null;
  setExp: (id: string | null) => void;
  defs: Record<string, ExplainDef>;
  nextPacking: string | null;
}) {
  const flow = useStore((s) => s.flow);
  const m = useStore((s) => s.metrics.fulfillment);
  const paused = useStore((s) => s.clock.paused);
  const toLoad = Math.max(0, TRUCK_LOAD - flow.stagedParcels);
  const minsToVan = flow.packRate > 0.01 ? (toLoad * PARCEL_UNITS) / flow.packRate : null;

  const dayIdx = Math.floor(flow.minute / 1440);
  const minOfDay = flow.minute % 1440;
  const workday = isWorkday(dayIdx);

  const shiftStatus = flow.inShift
    ? `open now · closes in ${fmtDur(m.shiftEndMin - minOfDay)}`
    : workday && minOfDay < SHIFT_START_MIN
      ? `opens in ${fmtDur(SHIFT_START_MIN - minOfDay)}`
      : `closed · next shift ${nextPacking}`;

  const explain = exp ? defs[exp] : null;

  return (
    <Section>
      <SubHead
        title="On the floor now"
        note="Completed activity since midnight ET — the warehouse animates these exact numbers."
        right={
          <span className="num flex items-center gap-1.5 text-[10px] text-[#A3927C]">
            <span
              className={`h-[5px] w-[5px] rounded-full ${flow.inShift && !paused ? "a-breathe" : ""}`}
              style={{ background: paused ? "#C98A3D" : flow.inShift ? TONE.healthy.dot : "#BCAB95" }}
            />
            {clockLabel(flow.minute).label}
          </span>
        }
      />

      {/* the business clock vs. the presenter's pause */}
      <div className="mt-3 rounded-[2px] border border-[rgba(58,43,35,.08)] bg-[rgba(255,255,255,.45)] px-3.5 py-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="label text-[8.5px] text-[#8C7B66]">Warehouse shift</span>
          <span className="num text-[10.5px] text-[var(--espresso)]">
            {workday ? `${timeET(SHIFT_START_MIN)} – ${timeET(m.shiftEndMin)}` : "Closed Sundays"}
          </span>
        </div>
        <div className="mt-1 text-[10.5px] text-[#9C8B76]">
          {workday ? `Floor ${shiftStatus}.` : `The floor is dark today — next shift ${nextPacking}.`}{" "}
          Orders keep arriving around the clock either way.
        </div>
        {paused && (
          <div className="mt-2 rounded-[2px] border border-[rgba(201,138,61,.4)] bg-[rgba(201,138,61,.1)] px-2.5 py-1.5 text-[10px] leading-relaxed text-[#9A6523]">
            ⏸ The presenter paused the demo clock — business time is frozen at{" "}
            {clockLabel(flow.minute).time}. This is a presentation control, not a business event:
            when the clock resumes, the business continues from this exact moment.
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4">
        <XStat
          id="packRate"
          open={exp}
          onToggle={setExp}
          label="Pack rate"
          value={flow.inShift ? `${n(flow.packRate * 60)}/hr` : "Stopped"}
          note={flow.inShift ? "units leaving the belt" : "floor closed — queue is growing"}
          tone={flow.inShift ? "healthy" : "watch"}
        />
        <XStat id="intake" open={exp} onToggle={setExp} label="Intake" value={`${n(flow.inflowRate * 60)}/hr`} note="units arriving · 24/7" />
        <XStat id="packedToday" open={exp} onToggle={setExp} label="Packed today" value={n(flow.packedToday)} note="units · completed, not projected" />
        <XStat
          id="vans"
          open={exp}
          onToggle={setExp}
          label="Vans dispatched"
          value={n(flow.trucksToday)}
          note={`${n(flow.shippedToday)} parcels today`}
        />
      </div>

      {explain && ["packRate", "intake", "packedToday", "vans"].includes(exp!) && (
        <ExplainCard def={explain} onClose={() => setExp(null)} />
      )}

      <div className="mt-4 rounded-[2px] border border-[rgba(58,43,35,.08)] bg-[rgba(255,255,255,.5)] px-3.5 py-3">
        <div className="flex items-baseline justify-between">
          <span className="label text-[9.5px] text-[#8C7B66]">Next dispatch</span>
          <span className="num text-[11px] text-[var(--espresso)]">
            {n(flow.stagedParcels)} / {TRUCK_LOAD} parcels staged
          </span>
        </div>
        <div className="mt-2">
          <Meter value={flow.stagedParcels / TRUCK_LOAD} tone="healthy" height={5} />
        </div>
        <div className="mt-2 text-[10.5px] text-[#A3927C]">
          {minsToVan === null
            ? "No van will leave while the floor is closed — parcels only stage while packing runs."
            : `A van departs when the pile reaches a full load, about ${n(minsToVan)} simulated minutes away at the current pack rate.`}
        </div>
      </div>

      {/* today's ledger — both identities, visible at all times */}
      <div className="mt-3 rounded-[2px] border border-[rgba(58,43,35,.08)] bg-[rgba(255,255,255,.4)] px-3.5 py-2.5">
        <div className="label text-[8.5px] text-[#8C7B66]">Today reconciles</div>
        <div className="num mt-1.5 text-[10px] leading-relaxed text-[#8C7B66]">
          Queue · {n(flow.queueAtDayStart)} at midnight + {n(flow.arrivedUnitsToday)} arrived −{" "}
          {n(flow.packedToday)} packed = <b className="text-[var(--espresso)]">{n(flow.queueUnits)} u</b> ✓
        </div>
        <div className="num mt-1 text-[10px] leading-relaxed text-[#8C7B66]">
          Dock · {n(flow.stagedAtDayStart)} staged + {n(flow.packedToday / PARCEL_UNITS)} packed −{" "}
          {n(flow.trucksToday * TRUCK_LOAD)} on vans ={" "}
          <b className="text-[var(--espresso)]">{n(flow.stagedParcels)} parcels</b> ✓
        </div>
      </div>
    </Section>
  );
}
