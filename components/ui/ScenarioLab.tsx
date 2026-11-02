"use client";

import { useEffect, useMemo, useState } from "react";
import { byId } from "@/lib/catalog";
import { currentLive, useStore } from "@/lib/store";
import { compareRows, project, type ScenarioDraft } from "@/lib/scenarios";
import { compactMoney, days, money, n } from "@/lib/fmt";
import { AGENTS } from "@/lib/agents";
import type { AgentId, ConciergePlaybook, PriorityPolicy, SimState } from "@/lib/types";
import { Btn, GoldRule, RefChip, Rule, Slider, Swatch, Toggle, TONE } from "./bits";

/* ─────────────────────────────────────────────────────────────────
   THE SCENARIO LAB
   Drafts, sliders and side-by-side comparison. Nothing in here touches
   the live district — projections are computed against the live flow,
   but only "Apply to Demo" commits a plan, and Revert undoes it.
   ───────────────────────────────────────────────────────────────── */

const POLICY_LABEL: Record<PriorityPolicy, string> = {
  "promise-first": "Promise first",
  "value-first": "Value first",
  "express-first": "Express first",
};
const PLAYBOOK_LABEL: Record<ConciergePlaybook, string> = {
  standard: "Standard",
  "protect-promise": "Protect the promise",
  "waitlist-first": "Waitlist first",
};

function Segmented<T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
  hint,
}: {
  label: string;
  value: T;
  options: T[];
  labels: Record<T, string>;
  onChange: (v: T) => void;
  hint?: string;
}) {
  return (
    <div>
      <div className="label mb-1.5 text-[10px] text-[#8C7B66]">{label}</div>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className="label rounded-full border px-2.5 py-[5px] text-[9px] transition-colors duration-200"
            style={{
              borderColor: value === o ? "var(--gold)" : "rgba(58,43,35,.14)",
              background: value === o ? "rgba(217,188,140,.14)" : "transparent",
              color: value === o ? "var(--gold)" : "#8C7B66",
            }}
          >
            {labels[o]}
          </button>
        ))}
      </div>
      {hint && <div className="mt-1 text-[10.5px] text-[#9C8B76]">{hint}</div>}
    </div>
  );
}

/* ── Scenario list row ────────────────────────────────────────────── */

function ScenarioRow({ sc, agent }: { sc: ScenarioDraft; agent?: AgentId }) {
  const activeId = useStore((s) => s.lab.activeId);
  const compareIds = useStore((s) => s.lab.compareIds);
  const setCompare = useStore((s) => s.setCompare);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(sc.name);
  const rename = useStore((s) => s.renameScenario);
  const duplicate = useStore((s) => s.duplicateScenario);
  const discard = useStore((s) => s.discardScenario);

  const active = activeId === sc.id;
  const compared = sc.locked || compareIds.includes(sc.id);
  // The situation's agent names agent drafts; the guess covers chat-created ones.
  const sourceLabel =
    sc.source === "baseline" ? "LIVE" : sc.source === "agent" ? AGENTS[agent ?? guessAgent(sc)].mark : "YOU";

  return (
    <div
      className="group rounded-[3px] border px-2.5 py-2 transition-colors"
      style={{
        borderColor: active ? "var(--gold)" : "rgba(58,43,35,.1)",
        background: active ? "rgba(217,188,140,.1)" : "rgba(255,255,255,.4)",
      }}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          aria-label={compared ? `Remove ${sc.name} from comparison` : `Compare ${sc.name}`}
          disabled={sc.locked}
          onClick={() => {
            if (sc.locked) return;
            setCompare(
              compared ? compareIds.filter((x) => x !== sc.id) : [...compareIds, sc.id].slice(-3),
            );
          }}
          className="mt-[3px] flex h-[13px] w-[13px] shrink-0 items-center justify-center rounded-[3px] border transition-colors"
          style={{
            borderColor: compared ? "var(--gold)" : "rgba(58,43,35,.25)",
            background: compared ? "var(--gold)" : "transparent",
          }}
          title={sc.locked ? "The live plan is always compared" : "Compare side-by-side"}
        >
          {compared && (
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden>
              <path d="M1.5 4.2 3.2 6 6.5 2" stroke="#FBF7F2" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          )}
        </button>

        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => useStore.setState((s) => ({ lab: { ...s.lab, activeId: sc.id } }))}
        >
          <span className="flex items-center gap-1.5">
            <span
              className="label shrink-0 rounded-sm px-1 py-[1px] text-[7px]"
              style={{
                background: sc.locked ? "rgba(58,43,35,.08)" : sc.source === "agent" ? "rgba(142,156,133,.18)" : "rgba(217,188,140,.2)",
                color: sc.locked ? "#8C7B66" : sc.source === "agent" ? "#5C6B54" : "#9A6523",
              }}
            >
              {sourceLabel}
            </span>
            {editing ? (
              <input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={() => {
                  rename(sc.id, draftName.trim() || sc.name);
                  setEditing(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") setEditing(false);
                }}
                className="min-w-0 flex-1 rounded-sm border border-[var(--gold)] bg-white/80 px-1 text-[11.5px] text-[var(--espresso)] outline-none"
              />
            ) : (
              <span className="truncate text-[11.5px] font-medium text-[var(--espresso)]">
                {sc.name}
              </span>
            )}
            {sc.preferredWhy && (
              <span className="shrink-0 text-[10px] text-[var(--gold)]" title={sc.preferredWhy}>
                ◆
              </span>
            )}
          </span>
        </button>
      </div>

      {!sc.locked && (
        <div className="mt-1 flex items-center gap-1 pl-[21px] opacity-0 transition-opacity group-hover:opacity-100">
          <button type="button" onClick={() => { setDraftName(sc.name); setEditing(true); }} className="label rounded px-1 py-[2px] text-[8px] text-[#9C8B76] hover:text-[var(--espresso)]">
            Rename
          </button>
          <button type="button" onClick={() => duplicate(sc.id)} className="label rounded px-1 py-[2px] text-[8px] text-[#9C8B76] hover:text-[var(--espresso)]">
            Duplicate
          </button>
          <button type="button" onClick={() => discard(sc.id)} className="label rounded px-1 py-[2px] text-[8px] text-[#A4553F] hover:brightness-75">
            Discard
          </button>
        </div>
      )}
    </div>
  );
}

function guessAgent(sc: ScenarioDraft): "analyst" | "strategist" | "concierge" {
  if (sc.assumptions.conciergePlaybook !== "standard") return "concierge";
  if (Object.keys(sc.assumptions.staged).length) return "strategist";
  return "analyst";
}

/* ── Draft editor ─────────────────────────────────────────────────── */

function DraftEditor({ sc }: { sc: ScenarioDraft }) {
  const update = useStore((s) => s.updateDraft);
  const minute = useStore((s) => s.flow.minute);
  const situationKey = useStore((s) => s.lab.situationKey);
  const a = sc.assumptions;
  const ro = !!sc.locked;

  const proj = useMemo(
    () => project(a, currentLive()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [a, minute],
  );

  const patch = (p: Partial<SimState>) => !ro && update(sc.id, p);
  const stockoutId = situationKey?.startsWith("inventory.stockout:")
    ? situationKey.split(":")[1]
    : null;
  const stagedEntries = Object.entries(a.staged);

  return (
    <div className="flex min-h-0 flex-col">
      {/* live projection strip — deterministic, recomputes on every nudge */}
      <div className="mb-4 grid grid-cols-4 gap-3 rounded-[3px] border border-[rgba(58,43,35,.08)] bg-[rgba(255,255,255,.55)] px-3.5 py-2.5">
        {(
          [
            ["Capacity", `${n(proj.fulfillment.capacityUnits)}/d`],
            ["At risk", n(proj.fulfillment.atRisk)],
            ["Backlog", days(proj.fulfillment.backlogDays)],
            ["Cost / order", money(proj.fulfillment.costPerOrder, 2)],
          ] as const
        ).map(([l, v]) => (
          <div key={l} className="min-w-0">
            <div className="label text-[8px] text-[#A3927C]">{l}</div>
            <div className="display num mt-0.5 truncate text-[16px] text-[var(--ink)]">{v}</div>
          </div>
        ))}
        <div className="col-span-4 -mt-1 flex items-center gap-1.5">
          <span className="label text-[7px] text-[#9FB294]">● Projection — deterministic</span>
        </div>
      </div>

      {ro && (
        <p className="mb-4 rounded-[3px] bg-[rgba(58,43,35,.05)] px-3 py-2 text-[11px] leading-relaxed text-[#8C7B66]">
          This is the live plan the district is running. Duplicate it to make changes.
        </p>
      )}

      <div className="scroll-fine min-h-0 flex-1 space-y-5 overflow-y-auto pr-1" style={{ opacity: ro ? 0.55 : 1, pointerEvents: ro ? "none" : "auto" }}>
        <div>
          <div className="eyebrow mb-2.5 text-[8px] text-[#A3927C]">Staffing</div>
          <div className="grid gap-3.5">
            <Slider label="Pick & pack associates" value={a.staffing.pickers} min={6} max={48} onChange={(v) => patch({ staffing: { ...a.staffing, pickers: v } })} format={(v) => `${v}`} />
            <Slider label="Shift length" value={a.staffing.shiftHours} min={6} max={12} onChange={(v) => patch({ staffing: { ...a.staffing, shiftHours: v } })} format={(v) => `${v} hrs`} />
            <Slider label="Units per labour hour" value={a.staffing.unitsPerLaborHour} min={9} max={22} onChange={(v) => patch({ staffing: { ...a.staffing, unitsPerLaborHour: v } })} format={(v) => `${v}`} />
            <Toggle label="Second shift" checked={a.staffing.secondShift} onChange={(v) => patch({ staffing: { ...a.staffing, secondShift: v } })} hint="Doubles hours at an 8% productivity penalty" />
          </div>
        </div>

        <Rule />

        <div>
          <div className="eyebrow mb-2.5 text-[8px] text-[#A3927C]">Planning assumptions</div>
          <div className="grid gap-3.5">
            <Slider label="Demand forecast" value={a.demandMultiplier} min={0.5} max={3} step={0.05} onChange={(v) => patch({ demandMultiplier: v })} format={(v) => `${v.toFixed(2)}×`} />
            <Slider label="Forward cover target" value={a.coverDays} min={0} max={45} onChange={(v) => patch({ coverDays: v })} format={(v) => `${v} days`} />
            <Slider label="Supplier lead-time shift" value={a.leadTimeAdj} min={-14} max={28} onChange={(v) => patch({ leadTimeAdj: v })} format={(v) => `${v > 0 ? "+" : ""}${v} days`} />
          </div>
        </div>

        <Rule />

        <div className="grid gap-4">
          <Segmented
            label="Queue priority"
            value={a.priorityPolicy}
            options={["promise-first", "value-first", "express-first"]}
            labels={POLICY_LABEL}
            onChange={(v) => patch({ priorityPolicy: v })}
            hint="How the pick queue is sequenced — trades promises against revenue or tier"
          />
          <Segmented
            label="Concierge playbook"
            value={a.conciergePlaybook}
            options={["standard", "protect-promise", "waitlist-first"]}
            labels={PLAYBOOK_LABEL}
            onChange={(v) => patch({ conciergePlaybook: v })}
            hint="Qualitative — changes how scarce styles are discussed, not the numbers"
          />
        </div>

        {(stockoutId || stagedEntries.length > 0) && (
          <>
            <Rule />
            <div>
              <div className="eyebrow mb-2.5 text-[8px] text-[#A3927C]">Planned buys</div>
              {stockoutId && (
                <StagedSlider
                  productId={stockoutId}
                  qty={a.staged[stockoutId] ?? 0}
                  onChange={(q) => {
                    const staged = { ...a.staged };
                    if (q <= 0) delete staged[stockoutId];
                    else staged[stockoutId] = q;
                    patch({ staged });
                  }}
                />
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {stagedEntries.map(([pid, qty]) => (
                  <span key={pid} className="flex items-center gap-1.5 rounded-full border border-[rgba(58,43,35,.12)] bg-white/60 px-2 py-[3px] text-[10px] text-[#6E5C4D]">
                    <Swatch hex={byId(pid).hex} size={7} />
                    {byId(pid).name} · <span className="num">{n(qty)}</span>
                    <span className="num text-[#A3927C]">{compactMoney(qty * byId(pid).cost)}</span>
                  </span>
                ))}
                {!stagedEntries.length && (
                  <span className="text-[10.5px] text-[#9C8B76]">No buys in this draft.</span>
                )}
              </div>
            </div>
          </>
        )}

        {/* agent commentary — visibly narrative, not computed */}
        {(sc.note || sc.pros?.length || sc.cons?.length) && (
          <>
            <Rule />
            <div className="rounded-[3px] border border-[rgba(58,43,35,.08)] bg-[rgba(233,211,205,.12)] px-3.5 py-3">
              <div className="label mb-1.5 text-[7.5px] text-[#A3927C]">Agent commentary — narrative</div>
              {sc.note && <p className="text-[11.5px] italic leading-relaxed text-[#6E5C4D]">{sc.note}</p>}
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {!!sc.pros?.length && (
                  <ul className="m-0 list-none space-y-1 p-0">
                    {sc.pros.map((x) => (
                      <li key={x} className="flex gap-1.5 text-[10.5px] leading-snug text-[#5C6B54]">
                        <span>+</span> {x}
                      </li>
                    ))}
                  </ul>
                )}
                {!!sc.cons?.length && (
                  <ul className="m-0 list-none space-y-1 p-0">
                    {sc.cons.map((x) => (
                      <li key={x} className="flex gap-1.5 text-[10.5px] leading-snug text-[#9B4330]">
                        <span>−</span> {x}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {sc.preferredWhy && (
                <p className="mt-2 border-t border-[rgba(58,43,35,.08)] pt-2 text-[10.5px] leading-relaxed text-[#9A6523]">
                  ◆ {sc.preferredWhy}
                </p>
              )}
            </div>
          </>
        )}

        {/* assumptions provenance */}
        <div className="flex flex-wrap gap-1 pb-2">
          <RefChip>Demand ×{a.demandMultiplier.toFixed(2)}</RefChip>
          <RefChip>Pick rate {a.staffing.unitsPerLaborHour} u/hr</RefChip>
          <RefChip>Labor $21.50/hr</RefChip>
          <RefChip>Lead {a.leadTimeAdj >= 0 ? "+" : ""}{a.leadTimeAdj}d</RefChip>
          <RefChip>Spike settles at 2.4×</RefChip>
        </div>
      </div>
    </div>
  );
}

function StagedSlider({
  productId,
  qty,
  onChange,
}: {
  productId: string;
  qty: number;
  onChange: (q: number) => void;
}) {
  const p = byId(productId);
  const metrics = useStore((s) => s.metrics);
  const item = metrics.inventory.items.find((i) => i.product.id === productId);
  const max = Math.max(p.casePack * 4, (item?.suggestedReorder ?? p.casePack) * 2);
  return (
    <Slider
      label={`${p.name} reorder`}
      value={qty}
      min={0}
      max={max}
      step={p.casePack}
      onChange={onChange}
      format={(v) => (v === 0 ? "None" : `${n(v)} u · ${compactMoney(v * p.cost)}`)}
      hint={`Case pack ${p.casePack} · suggested ${n(item?.suggestedReorder ?? 0)}`}
    />
  );
}

/* ── Comparison table ─────────────────────────────────────────────── */

function CompareTable() {
  const lab = useStore((s) => s.lab);
  const minute = useStore((s) => s.flow.minute);
  const appliedPlans = useStore((s) => s.appliedPlans);
  const applyScenario = useStore((s) => s.applyScenario);
  const revertPlan = useStore((s) => s.revertPlan);
  const [confirming, setConfirming] = useState<string | null>(null);

  const picked = useMemo(() => {
    const baseline = lab.scenarios.find((x) => x.locked);
    const rest = lab.compareIds
      .map((id) => lab.scenarios.find((x) => x.id === id))
      .filter((x): x is ScenarioDraft => !!x && !x.locked);
    return baseline ? [baseline, ...rest] : rest;
  }, [lab.scenarios, lab.compareIds]);

  const rows = useMemo(
    () => (picked.length ? compareRows(picked, currentLive(), true) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [picked, minute],
  );

  if (picked.length < 2) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <p className="max-w-[36ch] text-[12px] leading-relaxed text-[#9C8B76]">
          Tick the compare box on one or more drafts to see them side by side against the
          current plan.
        </p>
      </div>
    );
  }

  return (
    <div className="scroll-fine h-full overflow-auto">
      <table className="w-full min-w-[520px] border-collapse text-[11.5px]" style={{ fontVariantNumeric: "tabular-nums" }}>
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-10 bg-[var(--surface-solid,#FBF7F2)] px-3 py-2 text-left">
              <span className="label text-[8px] text-[#A3927C]">Projection</span>
            </th>
            {picked.map((sc) => (
              <th key={sc.id} className="sticky top-0 bg-[var(--surface-solid,#FBF7F2)] px-3 py-2 text-left align-top">
                <div className="max-w-[150px]">
                  <div className="truncate text-[11px] font-semibold text-[var(--ink)]" title={sc.name}>
                    {sc.name}
                    {sc.preferredWhy && <span className="ml-1 text-[var(--gold)]" title={sc.preferredWhy}>◆</span>}
                  </div>
                  {sc.locked ? (
                    appliedPlans.length > 0 ? (
                      <button
                        type="button"
                        onClick={revertPlan}
                        className="label mt-1 rounded-full border border-[rgba(58,43,35,.18)] px-2 py-[3px] text-[8px] text-[#8C7B66] transition-colors hover:border-[var(--gold)] hover:text-[var(--gold)]"
                      >
                        ↩ Revert to previous
                      </button>
                    ) : (
                      <span className="label mt-1 inline-block text-[7.5px] text-[#A3927C]">Live baseline</span>
                    )
                  ) : confirming === sc.id ? (
                    <span className="mt-1 flex gap-1">
                      <Btn size="sm" variant="primary" onClick={() => { applyScenario(sc.id); setConfirming(null); }}>
                        Confirm
                      </Btn>
                      <Btn size="sm" variant="quiet" onClick={() => setConfirming(null)}>
                        Keep exploring
                      </Btn>
                    </span>
                  ) : (
                    <Btn size="sm" variant="ghost" className="mt-1" onClick={() => setConfirming(sc.id)}>
                      Apply to Demo
                    </Btn>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-[rgba(58,43,35,.06)]">
              <td className="sticky left-0 bg-[var(--surface-solid,#FBF7F2)] px-3 py-2 align-top">
                <span className="label text-[8.5px] text-[#8C7B66]">{row.label}</span>
              </td>
              {row.cells.map((c, i) => (
                <td key={i} className="px-3 py-2 align-top">
                  {row.narrative ? (
                    <span className="block max-w-[170px] text-[10px] italic leading-snug text-[#8C7B66]">
                      {c.value}
                    </span>
                  ) : (
                    <>
                      <span
                        className="num text-[12px] font-medium"
                        style={{ color: c.tone ? TONE[c.tone].fg : "var(--espresso)" }}
                      >
                        {c.value}
                      </span>
                      {c.range && (
                        <span className="num mt-[1px] block text-[9px] text-[#A3927C]" title="Sensitivity: productivity −15% & demand +25% ↔ +10% & −10%">
                          ({c.range})
                        </span>
                      )}
                    </>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 py-2 text-[9px] leading-relaxed text-[#B5A48E]">
        Ranges show sensitivity to uncertain inputs: productivity −15% with demand +25%
        (pessimistic) through productivity +10% with demand −10% (optimistic).
      </p>
    </div>
  );
}

/* ── The Lab ──────────────────────────────────────────────────────── */

export function ScenarioLab() {
  const open = useStore((s) => s.lab.open);
  const lab = useStore((s) => s.lab);
  const closeLab = useStore((s) => s.closeLab);
  const createScenario = useStore((s) => s.createScenario);
  const situations = useStore((s) => s.situations);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && useStore.getState().lab.open) {
        e.stopPropagation();
        closeLab();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [closeLab]);

  const active = lab.scenarios.find((x) => x.id === lab.activeId) ?? lab.scenarios[0];
  const situation = lab.situationKey ? situations.find((x) => x.key === lab.situationKey) : null;

  return (
    <div
      aria-hidden={!open}
      className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center sm:p-6"
      style={{ opacity: open ? 1 : 0, transition: "opacity .35s var(--ease)", visibility: open ? "visible" : "hidden" }}
    >
      <button
        type="button"
        aria-label="Close the Scenario Lab"
        onClick={closeLab}
        className="absolute inset-0 bg-[rgba(35,30,27,.32)] backdrop-blur-[3px]"
        style={{ pointerEvents: open ? "auto" : "none" }}
      />

      <div
        className="panel grain pointer-events-auto relative flex h-full w-full flex-col overflow-hidden sm:h-[min(780px,94vh)] sm:w-[min(1160px,96vw)] sm:rounded-[4px]"
        style={{
          transform: open ? "none" : "scale(.98) translateY(10px)",
          transition: "transform .45s var(--ease)",
          pointerEvents: open ? "auto" : "none",
        }}
      >
        <div className="goldline absolute inset-x-0 top-0 h-px" />

        {/* header */}
        <header className="flex shrink-0 items-start justify-between gap-4 px-6 pb-3 pt-5">
          <div className="min-w-0">
            <div className="eyebrow text-[8.5px] text-[#A3927C]">
              Scenario Lab{situation ? ` · ${AGENTS[situation.agent].name}` : ""}
            </div>
            <h2 className="display mt-1 truncate text-[26px] leading-tight text-[var(--ink)]">
              {situation ? situation.headline : "Explore the plan"}
            </h2>
            {situation && (
              <p className="mt-1 max-w-[80ch] text-[11.5px] leading-relaxed text-[#8C7B66]">
                {situation.whyItMatters}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={closeLab}
            className="shrink-0 rounded-full p-2 text-[#A3927C] transition-colors hover:bg-[rgba(58,43,35,.06)] hover:text-[var(--espresso)]"
            aria-label="Close"
          >
            <svg width="13" height="13" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <GoldRule className="opacity-40" />

        {/* body */}
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[230px_1fr]">
          {/* scenario list */}
          <aside className="scroll-fine flex min-h-0 flex-col gap-1.5 overflow-y-auto border-b border-[rgba(58,43,35,.08)] p-3 md:border-b-0 md:border-r">
            <div className="eyebrow px-1 pb-1 text-[8px] text-[#A3927C]">Scenarios</div>
            {lab.scenarios.map((sc) => (
              <ScenarioRow key={sc.id} sc={sc} agent={situation?.agent} />
            ))}
            <button
              type="button"
              onClick={() => {
                const base = lab.scenarios.find((x) => x.locked) ?? lab.scenarios[0];
                if (!base) return;
                createScenario({
                  name: "My Custom Plan",
                  source: "user",
                  assumptions: {
                    ...base.assumptions,
                    staffing: { ...base.assumptions.staffing },
                    staged: { ...base.assumptions.staged },
                  },
                  note: "Started from the current plan.",
                });
              }}
              className="label mt-1 rounded-[3px] border border-dashed border-[rgba(58,43,35,.2)] px-2.5 py-2 text-[8.5px] text-[#8C7B66] transition-colors hover:border-[var(--gold)] hover:text-[var(--gold)]"
            >
              + New custom scenario
            </button>
            <div className="mt-auto px-1 pt-2">
              <p className="text-[9px] leading-relaxed text-[#B5A48E]">
                Drafts never touch the live district. The world keeps running the current
                plan until you apply one.
              </p>
            </div>
          </aside>

          {/* editor + compare */}
          <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] md:grid-rows-1 md:grid-cols-[minmax(320px,2fr)_minmax(360px,3fr)]">
            <section className="flex min-h-0 flex-col border-b border-[rgba(58,43,35,.08)] p-4 md:border-b-0 md:border-r">
              <div className="eyebrow pb-2 text-[8px] text-[#A3927C]">
                Draft — {active?.name ?? "none"}
              </div>
              {active ? (
                <DraftEditor sc={active} />
              ) : (
                <p className="text-[12px] text-[#9C8B76]">Select or create a scenario.</p>
              )}
            </section>

            <section className="flex min-h-0 flex-col p-4">
              <div className="eyebrow pb-2 text-[8px] text-[#A3927C]">
                Compare · vs current plan
              </div>
              <div className="min-h-0 flex-1 rounded-[3px] border border-[rgba(58,43,35,.08)] bg-[rgba(255,255,255,.45)]">
                <CompareTable />
              </div>
            </section>
          </div>
        </div>

        <footer className="shrink-0 border-t border-[rgba(58,43,35,.08)] px-6 py-2.5">
          <p className="text-[9.5px] leading-relaxed text-[#B5A48E]">
            Projections are deterministic simulations over fictional data — not guarantees.
            Different owners weigh cost, speed, customer experience and stability differently;
            the choice is yours. Applying changes only the demo.
          </p>
        </footer>
      </div>
    </div>
  );
}
