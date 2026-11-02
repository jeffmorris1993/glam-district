"use client";

import { useMemo } from "react";
import { useSim, useStore } from "@/lib/store";
import { ASSUMPTIONS, derive } from "@/lib/sim";
import { compactMoney, days, money, n, pct } from "@/lib/fmt";
import { byId } from "@/lib/catalog";
import { BarChart, Btn, Meter, Rule, Slider, Stat, StatusPill, Swatch, Toggle, TONE } from "../bits";
import { Section, SubHead } from "./shell";

export function FulfillmentPanel() {
  const m = useStore((s) => s.metrics.fulfillment);
  const staffing = useStore((s) => s.staffing);
  const setStaffing = useStore((s) => s.setStaffing);
  const openAgentPanel = useStore((s) => s.openAgentPanel);
  const sim = useSim();

  /** The plan as it stood before the user touched the controls. */
  const baseline = useMemo(
    () => derive({ ...sim, staffing: { pickers: 14, shiftHours: 8, unitsPerLaborHour: 14, secondShift: false } }).fulfillment,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sim.scenario, sim.viralStage, sim.demandMultiplier],
  );
  const dirty =
    staffing.pickers !== 14 || staffing.shiftHours !== 8 || staffing.unitsPerLaborHour !== 14 || staffing.secondShift;

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

      {/* ── controls ───────────────────────────────────────────── */}
      <Section>
        <SubHead
          title="Staffing & productivity"
          note="Change the plan — the queue, the risk and the cost all re-compute."
          right={
            dirty ? (
              <Btn
                size="sm"
                variant="quiet"
                onClick={() => setStaffing({ pickers: 14, shiftHours: 8, unitsPerLaborHour: 14, secondShift: false })}
              >
                Reset plan
              </Btn>
            ) : undefined
          }
        />

        <div className="mt-4 grid gap-4">
          <Slider
            label="Pick & pack associates"
            value={staffing.pickers}
            min={6}
            max={48}
            onChange={(v) => setStaffing({ pickers: v })}
            format={(v) => `${v}`}
            hint={
              dirty && staffing.pickers !== 14
                ? `${staffing.pickers > 14 ? "+" : ""}${staffing.pickers - 14} vs. the standing roster of 14`
                : "Standing roster"
            }
          />
          <Slider
            label="Shift length"
            value={staffing.shiftHours}
            min={6}
            max={12}
            onChange={(v) => setStaffing({ shiftHours: v })}
            format={(v) => `${v} hrs`}
          />
          <Slider
            label="Units per labour hour"
            value={staffing.unitsPerLaborHour}
            min={9}
            max={22}
            onChange={(v) => setStaffing({ unitsPerLaborHour: v })}
            format={(v) => `${v}`}
            hint="Pick rate assumption for the simulated floor"
          />
          <Toggle
            label="Open a second shift"
            checked={staffing.secondShift}
            onChange={(v) => setStaffing({ secondShift: v })}
            hint="Doubles hours at a 8% productivity penalty"
          />
        </div>

        {/* live delta against the standing plan */}
        <div
          className="mt-4 overflow-hidden rounded-[2px] border transition-all duration-500"
          style={{
            borderColor: dirty ? "rgba(184,145,79,.4)" : "rgba(58,43,35,.08)",
            background: dirty ? "rgba(217,188,140,.1)" : "transparent",
            maxHeight: dirty ? 160 : 58,
          }}
        >
          <div className="grid grid-cols-3 gap-3 px-3.5 py-3">
            <Stat label="Capacity" value={`${n(m.capacityUnits)}`} note="units/day" size="sm" />
            <Stat label="Labour / day" value={money(m.laborCostDay)} size="sm" />
            <Stat label="Cost / order" value={money(m.costPerOrder, 2)} note="target $4.60" size="sm" />
          </div>
          {dirty && (
            <div className="border-t border-[rgba(184,145,79,.25)] px-3.5 py-2.5 text-[11.5px] leading-relaxed text-[#6E5C4D]">
              Against the standing roster this plan moves at-risk orders from{" "}
              <span className="num font-medium text-[var(--espresso)]">{n(baseline.atRisk)}</span> to{" "}
              <span className="num font-medium text-[var(--espresso)]">{n(m.atRisk)}</span> and the backlog from{" "}
              <span className="num">{days(baseline.backlogDays)}</span> to{" "}
              <span className="num">{days(m.backlogDays)}</span>.
            </div>
          )}
        </div>
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
