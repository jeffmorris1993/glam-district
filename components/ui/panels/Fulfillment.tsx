"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { ASSUMPTIONS } from "@/lib/sim";
import { PARCEL_UNITS, TRUCK_LOAD, clockLabel } from "@/lib/engine";
import { compactMoney, days, money, n, pct } from "@/lib/fmt";
import { byId } from "@/lib/catalog";
import type { PriorityPolicy } from "@/lib/types";
import { BarChart, Btn, Meter, Rule, Stat, StatusPill, Swatch, TONE } from "../bits";
import { Section, SubHead } from "./shell";

const POLICY_LABEL: Record<PriorityPolicy, string> = {
  "promise-first": "Promise first",
  "value-first": "Value first",
  "express-first": "Express first",
};

export function FulfillmentPanel() {
  const m = useStore((s) => s.metrics.fulfillment);
  const staffing = useStore((s) => s.staffing);
  const priorityPolicy = useStore((s) => s.priorityPolicy);
  const openAgentPanel = useStore((s) => s.openAgentPanel);
  const openLab = useStore((s) => s.openLab);
  const revertPlan = useStore((s) => s.revertPlan);
  const applied = useStore((s) => s.appliedPlans[0] ?? null);
  const backlogKey = useStore((s) =>
    s.situations.some((x) => x.key === "fulfillment.backlog") ? "fulfillment.backlog" : undefined,
  );

  const queue = useMemo(() => m.queue.slice(0, 40), [m.queue]);
  const riskTone = m.status;

  return (
    <>
      {/* ── headline ───────────────────────────────────────────── */}
      <Section>
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Open orders" value={n(m.openOrders)} note={`${n(m.openUnits)} units`} size="lg" />
          <Stat
            label="At risk today"
            value={n(m.atRisk)}
            note={m.atRisk ? compactMoney(m.atRiskValue) : "all within promise"}
            tone={m.atRisk ? (m.status === "critical" ? "critical" : "watch") : "healthy"}
            size="lg"
          />
          <Stat label="Backlog" value={days(m.backlogDays)} note={`${pct(m.onTimeRate, 1)} on time`} size="lg" />
        </div>

        <div className="mt-5">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="label text-[9.5px] text-[#8C7B66]">Capacity utilisation</span>
            <span className="num text-[11px] text-[var(--espresso)]">
              {pct(m.utilization)} · {n(m.capacityUnits)} units/day
            </span>
          </div>
          <Meter value={Math.min(1.6, m.utilization)} max={1.6} tone={riskTone} height={5} marker={1 / 1.6} />
          <div className="mt-1.5 flex justify-between text-[10px] text-[#A3927C]">
            <span>Inflow vs. capacity</span>
            <span className="num">target 100%</span>
          </div>
        </div>
      </Section>

      <Rule />

      {/* ── what the floor is doing right now ──────────────────── */}
      <LiveFloor />

      <Rule />

      {/* ── ship plan ──────────────────────────────────────────── */}
      <Section>
        <SubHead
          title="Ship plan"
          note="Orders sequenced by promise date, then tier, then value."
          right={<StatusPill status={riskTone} small />}
        />
        <div className="mt-3">
          <BarChart
            height={96}
            data={m.byDay.map((d) => ({
              key: `d${d.day}`,
              value: d.orders,
              tone: d.day <= 2 ? "healthy" : d.day === 3 ? "watch" : "critical",
            }))}
            labelFor={(d) => (d.key === "d6" ? "6+" : `Day ${d.key.slice(1)}`)}
            valueFor={(d) => n(d.value)}
          />
          <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-[#8C7B66]">
            {(["healthy", "watch", "critical"] as const).map((t, i) => (
              <span key={t} className="flex items-center gap-1.5">
                <span className="h-[6px] w-[6px] rounded-[1px]" style={{ background: TONE[t].dot }} />
                {["Within promise", "Day 3", "Beyond"][i]}
              </span>
            ))}
          </div>
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
          <Stat label="Shift" value={`${staffing.shiftHours} hrs`} note={`${staffing.unitsPerLaborHour} u/labour-hr`} size="sm" />
          <Stat label="Queue policy" value={POLICY_LABEL[priorityPolicy]} size="sm" />
          <Stat label="Capacity" value={`${n(m.capacityUnits)}/day`} note="units" size="sm" />
        </div>

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
          note={`${n(m.openOrders)} open · showing the first 40`}
          right={
            <span className="num text-[10px] text-[#A3927C]">
              {n(m.shippedToday)} ship today
            </span>
          }
        />

        <div className="mt-3 overflow-hidden rounded-[2px] border border-[rgba(58,43,35,.08)]">
          <div className="grid grid-cols-[72px_1fr_56px_44px] gap-2 border-b border-[rgba(58,43,35,.08)] bg-[rgba(58,43,35,.03)] px-3 py-2">
            {["Order", "Client / items", "Value", "Ship"].map((h, i) => (
              <span key={h} className={`label text-[8.5px] text-[#A3927C] ${i >= 2 ? "text-right" : ""}`}>
                {h}
              </span>
            ))}
          </div>
          <div className="scroll-fine max-h-[290px] overflow-y-auto">
            {queue.map((o, i) => (
              <div
                key={`${o.id}-${i}`}
                className="grid grid-cols-[72px_1fr_56px_44px] items-center gap-2 border-b border-[rgba(58,43,35,.05)] px-3 py-2 last:border-0 transition-colors hover:bg-[rgba(217,188,140,.1)]"
              >
                <div className="min-w-0">
                  <div className="num truncate text-[10.5px] font-medium text-[var(--espresso)]">{o.id}</div>
                  <div
                    className="label mt-[1px] text-[7.5px]"
                    style={{
                      color: o.tier === "VIP" ? "var(--gold)" : o.tier === "Express" ? "#8C7B66" : "#B5A48E",
                    }}
                  >
                    {o.tier}
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
                    className="num inline-block rounded-full px-1.5 py-[2px] text-[9.5px]"
                    style={{
                      background: o.atRisk ? TONE.critical.bg : o.slack === 0 ? TONE.watch.bg : TONE.healthy.bg,
                      color: o.atRisk ? TONE.critical.fg : o.slack === 0 ? TONE.watch.fg : TONE.healthy.fg,
                    }}
                  >
                    D{o.shipDay}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
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
                every promise holds with {days(Math.max(0, 2 - m.backlogDays))} of slack on the two-day tier.{" "}
                {n(m.shippedToday)} orders leave today at {money(m.costPerOrder, 2)} each.
              </>
            ) : (
              <>
                {n(m.atRisk)} orders — {compactMoney(m.atRiskValue)} — are sequenced past their promise date. The book
                needs {days(m.backlogDays)} to clear and inflow is running at {pct(m.utilization)} of capacity
                {m.utilization > 1 ? ", so the queue is still growing" : ""}. VIP and Express tiers are protected by the
                sequencing rule and remain inside day one.
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
    </>
  );
}

/**
 * The live floor. These are the same figures the warehouse is animating:
 * the belt runs at this pack rate, the pile is this queue, and a van
 * leaves when the staged count reaches a full load.
 */
function LiveFloor() {
  const flow = useStore((s) => s.flow);
  const capacity = useStore((s) => s.metrics.fulfillment.capacityUnits);
  const toLoad = Math.max(0, TRUCK_LOAD - flow.stagedParcels);
  const minsToVan = flow.packRate > 0.01 ? (toLoad * PARCEL_UNITS) / flow.packRate : null;

  return (
    <Section>
      <SubHead
        title="On the floor now"
        note="The warehouse animates these numbers — belt speed, pile height and the next dispatch."
        right={
          <span className="num flex items-center gap-1.5 text-[10px] text-[#A3927C]">
            <span
              className={`h-[5px] w-[5px] rounded-full ${flow.inShift ? "a-breathe" : ""}`}
              style={{ background: flow.inShift ? TONE.healthy.dot : "#BCAB95" }}
            />
            {clockLabel(flow.minute).label}
          </span>
        }
      />

      <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4">
        <Stat
          label="Pack rate"
          value={flow.inShift ? `${n(flow.packRate * 60)}/hr` : "Stopped"}
          note={flow.inShift ? "units leaving the belt" : "floor closed — queue is growing"}
          tone={flow.inShift ? "healthy" : "watch"}
          size="sm"
        />
        <Stat label="Intake" value={`${n(flow.inflowRate * 60)}/hr`} note="units arriving" size="sm" />
        <Stat label="Packed today" value={n(flow.packedToday)} note="units" size="sm" />
        <Stat
          label="Vans dispatched"
          value={n(flow.trucksToday)}
          note={`${n(flow.shippedToday)} parcels today`}
          size="sm"
        />
      </div>

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

      <div className="mt-3 flex items-baseline justify-between text-[10.5px] text-[#9C8B76]">
        <span>
          Queue <span className="num text-[var(--espresso)]">{n(flow.queueUnits)}</span> units
        </span>
        <span>
          Capacity <span className="num text-[var(--espresso)]">{n(capacity)}</span> units/day
        </span>
      </div>
    </Section>
  );
}
