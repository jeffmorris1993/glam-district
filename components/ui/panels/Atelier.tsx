"use client";

import { useStore } from "@/lib/store";
import { ASSUMPTIONS } from "@/lib/sim";
import { compactMoney, money, n, pct } from "@/lib/fmt";
import type { ProductMetrics } from "@/lib/types";
import { Btn, Meter, RankedBars, Rule, Slider, Spark, Stat, StatusPill, Swatch } from "../bits";
import { Section, SubHead } from "./shell";

function riskTone(r: ProductMetrics["risk"]) {
  return r === "critical" ? "critical" : r === "watch" ? "watch" : "healthy";
}

function ProductRow({ i }: { i: ProductMetrics }) {
  const staged = useStore((s) => s.staged[i.product.id] ?? 0);
  const stage = useStore((s) => s.stageReorder);
  const tone = riskTone(i.risk);
  const coverPct = Math.min(1, i.stockoutInDays / (i.leadTime + 21));

  return (
    <div className="border-b border-[rgba(58,43,35,.06)] px-3.5 py-3 last:border-0 transition-colors hover:bg-[rgba(217,188,140,.07)]">
      <div className="flex items-start gap-3">
        <span
          className="mt-[3px] h-9 w-7 shrink-0 rounded-[2px]"
          style={{
            background: `linear-gradient(150deg, ${i.product.hex}, color-mix(in srgb, ${i.product.hex} 72%, #3A2B23))`,
            boxShadow: "inset 0 0 0 1px rgba(58,43,35,.14)",
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-[12.5px] font-medium text-[var(--espresso)]">{i.product.name}</div>
              <div className="mt-[2px] flex items-center gap-1.5 text-[10px] text-[#A3927C]">
                <Swatch hex={i.product.hex} size={7} />
                {i.product.colorway} · {money(i.product.price)}
              </div>
            </div>
            <StatusPill status={tone} small label={i.risk === "healthy" ? "Healthy" : i.risk === "watch" ? "Watch" : "Critical"} />
          </div>

          <div className="mt-2.5 grid grid-cols-[1fr_auto] items-end gap-3">
            <div>
              <div className="flex items-baseline justify-between text-[10px] text-[#8C7B66]">
                <span className="num">
                  {n(i.onHandEff)} on hand
                  {i.product.inbound > 0 && ` · ${n(i.product.inbound)} in transit`}
                </span>
                <span className="num">{n(i.effVelocity)}/day</span>
              </div>
              <div className="mt-1.5">
                <Meter value={coverPct} tone={tone} height={3} marker={i.leadTime / (i.leadTime + 21)} />
              </div>
              <div className="mt-1 flex justify-between text-[9.5px] text-[#B5A48E]">
                <span className="num">{i.stockoutInDays.toFixed(1)} days of cover</span>
                <span className="num">{i.leadTime}-day lead time</span>
              </div>
            </div>
            <Spark values={i.trend} tone={tone} width={64} height={24} />
          </div>

          {i.suggestedReorder > 0 && (
            <div className="mt-2.5 flex items-center justify-between gap-2 rounded-[2px] bg-[rgba(217,188,140,.14)] px-2.5 py-2">
              <div className="min-w-0">
                <div className="label text-[8.5px] text-[#9A6523]">Suggested reorder</div>
                <div className="num mt-[1px] text-[12px] text-[var(--espresso)]">
                  {n(i.suggestedReorder)} units · {compactMoney(i.suggestedReorder * i.product.cost)}
                </div>
              </div>
              <Btn
                size="sm"
                variant={staged ? "quiet" : "ghost"}
                onClick={() => stage(i.product.id, staged ? 0 : i.suggestedReorder)}
              >
                {staged ? "Staged ✓" : "Stage"}
              </Btn>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AtelierPanel() {
  const inv = useStore((s) => s.metrics.inventory);
  const demand = useStore((s) => s.demandMultiplier);
  const cover = useStore((s) => s.coverDays);
  const leadAdj = useStore((s) => s.leadTimeAdj);
  const setDemand = useStore((s) => s.setDemand);
  const setCover = useStore((s) => s.setCover);
  const setLeadAdj = useStore((s) => s.setLeadAdj);
  const clearStaged = useStore((s) => s.clearStaged);
  const openAgentPanel = useStore((s) => s.openAgentPanel);

  const ranked = inv.items.slice().sort((a, b) => a.stockoutInDays - b.stockoutInDays);
  const best = inv.items.slice().sort((a, b) => b.revenue7d - a.revenue7d);
  const otbUsed = inv.stagedCost / inv.openToBuy;

  return (
    <>
      <Section>
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Units on hand" value={n(inv.unitsOnHand)} note={`${inv.skuCount} styles`} size="lg" />
          <Stat
            label="Stockout risk"
            value={n(inv.critical.length)}
            note={inv.critical.length ? `${compactMoney(inv.atRiskRevenue)} exposed` : "none below lead time"}
            tone={inv.critical.length ? "critical" : "healthy"}
            size="lg"
          />
          <Stat label="At retail" value={compactMoney(inv.retailValue)} note={`${inv.watch.length} on watch`} size="lg" />
        </div>

        {inv.critical.length > 0 && (
          <div
            className="mt-5 overflow-hidden rounded-[2px] border px-3.5 py-3"
            style={{ borderColor: "rgba(180,85,63,.3)", background: "rgba(180,85,63,.07)" }}
          >
            <div className="flex items-start gap-2.5">
              <span className="mt-[5px] h-[6px] w-[6px] shrink-0 rounded-full bg-[var(--alert)]" />
              <div className="min-w-0">
                <div className="label text-[9px] text-[#9B4330]">Potential stockout</div>
                <p className="mt-1 text-[12px] leading-relaxed text-[#6E5043]">
                  {inv.critical.map((c) => c.product.name).join(", ")} sell
                  {inv.critical.length === 1 ? "s" : ""} through in{" "}
                  <span className="num">{inv.critical[0].stockoutInDays.toFixed(1)} days</span> against a{" "}
                  <span className="num">{inv.critical[0].leadTime}-day</span> lead time — a{" "}
                  <span className="num">
                    {Math.max(0, inv.critical[0].leadTime - inv.critical[0].stockoutInDays).toFixed(0)}-day
                  </span>{" "}
                  gap with nothing to sell.
                </p>
              </div>
            </div>
          </div>
        )}
      </Section>

      <Rule />

      {/* ── bestsellers ───────────────────────────────────────── */}
      <Section>
        <SubHead title="Selling now" note="Seven-day revenue at the current velocity." />
        <div className="mt-3.5">
          <RankedBars
            rows={best.map((i) => ({
              key: i.product.id,
              label: i.product.name,
              value: i.revenue7d,
              display: compactMoney(i.revenue7d),
              tone: riskTone(i.risk),
              hex: i.product.hex,
            }))}
          />
        </div>
      </Section>

      <Rule />

      {/* ── assumptions ───────────────────────────────────────── */}
      <Section>
        <SubHead
          title="Planning assumptions"
          note="Move these and every cover figure, warning and reorder quantity re-computes."
          right={
            demand !== 1 || cover !== 14 || leadAdj !== 0 ? (
              <Btn
                size="sm"
                variant="quiet"
                onClick={() => {
                  setDemand(1);
                  setCover(14);
                  setLeadAdj(0);
                }}
              >
                Reset
              </Btn>
            ) : undefined
          }
        />
        <div className="mt-4 grid gap-4">
          <Slider
            label="Demand forecast"
            value={demand}
            min={0.5}
            max={3}
            step={0.05}
            onChange={setDemand}
            format={(v) => `${v.toFixed(2)}×`}
            hint={demand === 1 ? "Current run rate" : `${demand > 1 ? "Above" : "Below"} the current run rate`}
          />
          <Slider
            label="Forward cover target"
            value={cover}
            min={0}
            max={45}
            onChange={setCover}
            format={(v) => `${v} days`}
            hint="Buffer held beyond the supplier lead time"
          />
          <Slider
            label="Supplier lead-time shift"
            value={leadAdj}
            min={-14}
            max={28}
            onChange={setLeadAdj}
            format={(v) => `${v > 0 ? "+" : ""}${v} days`}
            hint={leadAdj === 0 ? "Quoted lead times, 26–45 days" : "Applied to every style"}
          />
        </div>
      </Section>

      <Rule />

      {/* ── inventory table ───────────────────────────────────── */}
      <Section>
        <SubHead
          title="Inventory & reorder scenarios"
          note="Quantities sized to lead time + cover at planning velocity, rounded to case packs."
        />
        <div className="mt-3 overflow-hidden rounded-[2px] border border-[rgba(58,43,35,.08)] bg-[rgba(255,255,255,.4)]">
          {ranked.map((i) => (
            <ProductRow key={i.product.id} i={i} />
          ))}
        </div>

        {/* open-to-buy */}
        <div className="mt-4 rounded-[2px] border border-[rgba(58,43,35,.1)] bg-[rgba(255,255,255,.55)] px-3.5 py-3">
          <div className="flex items-baseline justify-between">
            <span className="label text-[9.5px] text-[#8C7B66]">Open-to-buy</span>
            <span className="num text-[11px] text-[var(--espresso)]">
              {compactMoney(inv.stagedCost)} / {compactMoney(inv.openToBuy)}
            </span>
          </div>
          <div className="mt-2">
            <Meter value={Math.min(1, otbUsed)} tone={otbUsed > 1 ? "critical" : otbUsed > 0.8 ? "watch" : "healthy"} height={5} />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10.5px] text-[#A3927C]">
              {inv.stagedUnits > 0
                ? `${n(inv.stagedUnits)} units staged across ${Object.keys(useStore.getState().staged).length} ${
                    Object.keys(useStore.getState().staged).length === 1 ? "style" : "styles"
                  }`
                : "Nothing staged"}
            </span>
            {inv.stagedUnits > 0 && (
              <Btn size="sm" variant="quiet" onClick={clearStaged}>
                Clear
              </Btn>
            )}
          </div>
        </div>
      </Section>

      <Rule />

      <Section>
        <SubHead title="AI planning briefing" note="Computed from the assumptions above." />
        <div className="mt-3 rounded-[2px] border border-[rgba(58,43,35,.08)] bg-[rgba(255,255,255,.5)] p-4">
          <p className="text-[12.5px] leading-relaxed text-[#5F5043]">
            {inv.critical.length ? (
              <>
                {inv.critical[0].product.name} is selling {n(inv.critical[0].effVelocity)} units a day against{" "}
                {n(inv.critical[0].onHandEff)} on hand. Sized to {inv.critical[0].leadTime} days of lead time plus{" "}
                {cover} days of cover — at a planning velocity of {n(inv.critical[0].planVelocity)}/day rather than
                today&rsquo;s spike rate — the scenario is {n(inv.critical[0].suggestedReorder)} units at{" "}
                {compactMoney(inv.critical[0].suggestedReorder * inv.critical[0].product.cost)}, or{" "}
                {pct(
                  (inv.critical[0].suggestedReorder * inv.critical[0].product.cost) / ASSUMPTIONS.openToBuy,
                )}{" "}
                of open-to-buy.
              </>
            ) : (
              <>
                All {inv.skuCount} styles hold cover beyond their lead time at {demand.toFixed(2)}× demand.{" "}
                {inv.watch.length
                  ? `${inv.watch.map((w) => w.product.name).join(" and ")} sit just inside the reorder point.`
                  : "Nothing needs a buy this week."}
              </>
            )}
          </p>
          <p className="mt-3 border-t border-[rgba(58,43,35,.08)] pt-3 text-[11px] leading-relaxed text-[#9C8B76]">
            These are simulated planning scenarios over fictional product and supplier data. They are not purchasing
            advice and no ordering system is connected.
          </p>
          <Btn variant="ghost" size="sm" className="mt-4" onClick={() => openAgentPanel("strategist")}>
            Ask the Inventory Strategist
          </Btn>
        </div>
      </Section>
    </>
  );
}
