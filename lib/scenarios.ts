import { byId } from "./catalog";
import { ASSUMPTIONS, derive, type LiveState } from "./sim";
import { compactMoney, days, money, n, pct } from "./fmt";
import type {
  AgentId,
  BuildingId,
  Metrics,
  SimState,
  WorldStatus,
} from "./types";
import type { FlowState } from "./engine";

/* ════════════════════════════════════════════════════════════════════
   THE DECISION ENGINE
   Situations are conditions the district has crossed into. For each,
   this module generates MULTIPLE reasonable approaches — never a single
   instruction — each a complete draft the owner can inspect, reshape
   with the sliders, compare, and choose to apply. Every projected
   number comes from derive(); the narrative around it is labeled
   commentary. No option is ranked as objectively best.
   ════════════════════════════════════════════════════════════════════ */

export interface DataRef {
  label: string;
  value: string;
  note?: string;
}

export interface Situation {
  key: string; // "fulfillment.backlog" | "inventory.stockout:<id>" | "boutique.inquiry-surge"
  agent: AgentId;
  building: BuildingId;
  headline: string;
  whyItMatters: string;
  evidence: DataRef[];
  tone: "watch" | "alert";
}

/** A draft plan. `assumptions` is a full SimState the sliders can edit. */
export interface ScenarioDraft {
  id: string;
  name: string;
  source: "baseline" | "agent" | "user";
  assumptions: SimState;
  /** agent commentary — narrative, never a computed figure's source */
  note?: string;
  pros?: string[];
  cons?: string[];
  customerImpact?: string;
  /** set only when the strict dominance rule holds — rare by design */
  preferredWhy?: string;
  createdAt: number; // sim minute
  locked?: boolean; // the baseline row
}

export type NewScenario = Omit<ScenarioDraft, "id" | "createdAt">;

/* ── Shared math ─────────────────────────────────────────────────── */

const cloneSim = (s: SimState): SimState => ({
  ...s,
  staffing: { ...s.staffing },
  staged: { ...s.staged },
});

export function project(assumptions: SimState, live: LiveState): Metrics {
  return derive(assumptions, live);
}

/** Smallest picker count that clears every promise, or null if out of range. */
export function pickersToClear(s: SimState, live: LiveState, max = 120): number | null {
  const risk = (p: number) =>
    derive({ ...s, staffing: { ...s.staffing, pickers: p } }, live).fulfillment.atRisk;
  if (risk(s.staffing.pickers) === 0) return s.staffing.pickers;
  if (risk(max) > 0) return null;
  let lo = s.staffing.pickers;
  let hi = max;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (risk(mid) === 0) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/* ── Situations ──────────────────────────────────────────────────── */

export function detectSituations(m: Metrics, s: SimState, flow: FlowState): Situation[] {
  const out: Situation[] = [];
  const f = m.fulfillment;
  const backlogDays = flow.queueUnits / Math.max(1, f.capacityUnits);

  if (backlogDays > 2.2 && f.atRisk > 0) {
    out.push({
      key: "fulfillment.backlog",
      agent: "analyst",
      building: "fulfillment",
      headline: `${n(f.atRisk)} orders will miss their promise at the current plan`,
      whyItMatters: `The queue holds ${days(backlogDays)} of work against ${n(f.capacityUnits)} units of daily capacity. ${compactMoney(f.atRiskValue)} of revenue ships late unless the plan changes — or you choose to accept it.`,
      evidence: [
        { label: "Queue", value: `${n(flow.queueUnits)} units` },
        { label: "Capacity", value: `${n(f.capacityUnits)}/day` },
        { label: "At risk", value: n(f.atRisk), note: compactMoney(f.atRiskValue) },
        { label: "On-time", value: pct(f.onTimeRate, 1) },
      ],
      tone: "alert",
    });
  }

  for (const item of m.inventory.critical) {
    if (item.suggestedReorder <= 0 || s.staged[item.product.id]) continue;
    out.push({
      key: `inventory.stockout:${item.product.id}`,
      agent: "strategist",
      building: "atelier",
      headline: `${item.product.name} sells through in ${item.stockoutInDays.toFixed(1)} days`,
      whyItMatters: `Replenishment needs ${item.leadTime} days, so a buy placed today still leaves a ${Math.max(0, item.leadTime - item.stockoutInDays).toFixed(0)}-day gap with nothing to sell — roughly ${compactMoney(Math.max(0, item.leadTime - item.stockoutInDays) * item.planVelocity * item.product.price)} of exposed revenue.`,
      evidence: [
        { label: "On hand", value: n(item.onHandEff), note: "units" },
        { label: "Selling", value: `${n(item.effVelocity)}/day` },
        { label: "Cover", value: `${item.stockoutInDays.toFixed(1)} days` },
        { label: "Lead time", value: `${item.leadTime} days` },
      ],
      tone: "alert",
    });
  }

  const b = m.boutique;
  const lowStock = m.inventory.items.filter((i) => b.availability[i.product.id] !== "In stock");
  // Low stock sharpens the story but is not required — a pure service surge
  // (questions outpacing sales) is a playbook decision in its own right.
  if (b.inquiries > ASSUMPTIONS.baseInquiries * 2) {
    out.push({
      key: "boutique.inquiry-surge",
      agent: "concierge",
      building: "boutique",
      headline: `Client questions are running ${(b.inquiries / ASSUMPTIONS.baseInquiries).toFixed(1)}× normal`,
      whyItMatters: lowStock.length
        ? `Most of the volume is availability questions on ${lowStock.map((i) => i.product.name).join(", ")}. How the concierge answers shapes whether scarce stock becomes disappointment or a waitlist relationship.`
        : "Question volume is running far ahead of sales — a service pressure, not an operations spike. The playbook decides whether clients get standard replies, proactive promise updates, or waitlist-first handling.",
      evidence: [
        { label: "Questions", value: `${n(b.inquiries)}/day`, note: `${n(ASSUMPTIONS.baseInquiries)} base` },
        ...(lowStock.length ? [{ label: "Low stock", value: n(lowStock.length), note: "styles" }] : []),
        { label: "Sessions", value: n(b.sessions) },
      ],
      tone: "watch",
    });
  }

  return out;
}

/* ── Option generation ───────────────────────────────────────────── */

function fulfillmentOptions(m: Metrics, s: SimState, live: LiveState): NewScenario[] {
  const f = m.fulfillment;
  const out: NewScenario[] = [];

  // 1. Hold course — accepting the backlog is a legitimate decision.
  out.push({
    name: "Hold course",
    source: "agent",
    assumptions: cloneSim(s),
    note: "Keep the current roster and let the queue work itself down.",
    pros: ["No additional labor cost", "No onboarding or coordination overhead"],
    cons: [
      `${n(f.atRisk)} orders ship after their promise (${compactMoney(f.atRiskValue)})`,
      `On-time rate holds near ${pct(f.onTimeRate, 0)} until the surge passes`,
    ],
    customerImpact: "Standard-tier clients feel the delay; VIP and Express stay protected by the current sequencing.",
  });

  // 2. Add temporary associates — sized to clear every promise.
  const clear = pickersToClear(s, live);
  if (clear !== null && clear > s.staffing.pickers) {
    const delta = clear - s.staffing.pickers;
    const alt = derive({ ...s, staffing: { ...s.staffing, pickers: clear } }, live);
    out.push({
      name: `Add ${delta} temporary associates`,
      source: "agent",
      assumptions: { ...cloneSim(s), staffing: { ...s.staffing, pickers: clear } },
      note: `The smallest roster that clears every promise in the book, found by projection.`,
      pros: [
        "Every order ships inside its promise window",
        `Backlog clears in ${days(alt.fulfillment.backlogDays)}`,
      ],
      cons: [
        `Labor rises ${money(alt.fulfillment.laborCostDay - f.laborCostDay)}/day`,
        "Temporary staff ramp up below the standing pick rate in practice",
      ],
      customerImpact: "Every tier ships on time; no client-facing change needed.",
    });

    // 2b. A cheaper middle path when the full clear is a big jump.
    if (delta > 12) {
      const mid = s.staffing.pickers + Math.ceil(delta / 2);
      const midAlt = derive({ ...s, staffing: { ...s.staffing, pickers: mid } }, live);
      out.push({
        name: `Add ${mid - s.staffing.pickers} temps (partial)`,
        source: "agent",
        assumptions: { ...cloneSim(s), staffing: { ...s.staffing, pickers: mid } },
        note: "Half the staffing jump — cheaper, clears most but not all of the risk.",
        pros: [
          `At-risk orders fall to ${n(midAlt.fulfillment.atRisk)}`,
          `Labor rises only ${money(midAlt.fulfillment.laborCostDay - f.laborCostDay)}/day`,
        ],
        cons: [`${n(midAlt.fulfillment.atRisk)} orders still ship late`],
        customerImpact: "Most clients ship on time; a smaller standard-tier cohort still waits.",
      });
    }
  }

  // 3. Second shift.
  if (!s.staffing.secondShift) {
    const alt = derive({ ...s, staffing: { ...s.staffing, secondShift: true } }, live);
    out.push({
      name: "Open a second shift",
      source: "agent",
      assumptions: { ...cloneSim(s), staffing: { ...s.staffing, secondShift: true } },
      note: "Same roster, doubled hours, at the modelled 8% off-shift productivity penalty.",
      pros: [
        `Capacity reaches ${n(alt.fulfillment.capacityUnits)} units/day`,
        `At-risk orders fall to ${n(alt.fulfillment.atRisk)}`,
      ],
      cons: [
        `The highest labor bill: ${money(alt.fulfillment.laborCostDay)}/day`,
        "Night operations carry supervision and quality overhead the model only hints at",
      ],
      customerImpact: "Fast recovery across every tier once the shift starts.",
    });
  }

  // 4. Reprioritize the queue.
  if (s.priorityPolicy === "promise-first") {
    const alt = derive({ ...s, priorityPolicy: "value-first" }, live);
    out.push({
      name: "Reprioritize: value first",
      source: "agent",
      assumptions: { ...cloneSim(s), priorityPolicy: "value-first" },
      note: "Same capacity, different order: the highest-value orders ship first.",
      pros: [
        `Protects the most revenue per shipped order`,
        "Zero additional cost",
      ],
      cons: [
        `At-risk count moves to ${n(alt.fulfillment.atRisk)} — more standard promises break`,
        "Trades customer commitments for revenue protection; a values decision, not a math one",
      ],
      customerImpact:
        "High-value clients ship sooner; more standard-tier clients miss their promised date. Review against your customer commitments before applying.",
    });
  }

  // 5. The owner's own hands.
  out.push({
    name: "My Custom Plan",
    source: "user",
    assumptions: cloneSim(s),
    note: "Start from the current plan and shape it with the sliders.",
  });

  return markPreferred(out, live);
}

function stockoutOptions(productId: string, m: Metrics, s: SimState): NewScenario[] {
  const item = m.inventory.items.find((i) => i.product.id === productId);
  if (!item) return [];
  const p = byId(productId);
  const perWeek = Math.max(p.casePack, Math.ceil((item.planVelocity * 7) / p.casePack) * p.casePack);
  const qty = item.suggestedReorder;
  const stagedWith = (units: number): SimState => ({
    ...cloneSim(s),
    staged: { ...s.staged, [productId]: units },
  });
  const gapDays = Math.max(0, item.leadTime - item.stockoutInDays);

  const out: NewScenario[] = [
    {
      name: "Hold — accept the stockout window",
      source: "agent",
      assumptions: cloneSim(s),
      note: "Place nothing and let the waitlist absorb the gap.",
      pros: ["No cash committed", "No overstock risk if the spike fades"],
      cons: [
        `≈${gapDays.toFixed(0)} days with nothing to sell`,
        `≈${compactMoney(gapDays * item.planVelocity * p.price)} of demand goes unserved`,
      ],
      customerImpact: "Clients hit the waitlist; the concierge manages expectations.",
    },
    {
      name: `Reorder ${n(qty)} units (suggested)`,
      source: "agent",
      assumptions: stagedWith(qty),
      note: `Sized to the ${item.leadTime}-day lead time plus ${s.coverDays} days of cover at planning velocity — not the spike rate.`,
      pros: [`Restores ${s.coverDays} days of cover beyond the lead time`],
      cons: [`Commits ${compactMoney(qty * p.cost)} of open-to-buy`],
      customerImpact: "The waitlist converts when the replenishment lands.",
    },
    {
      name: `Reorder lean (${n(Math.max(p.casePack, qty - perWeek))} units)`,
      source: "agent",
      assumptions: stagedWith(Math.max(p.casePack, qty - perWeek)),
      note: "A week less cover — cheaper, tighter.",
      pros: [`Saves ${compactMoney(Math.min(qty, perWeek) * p.cost)} vs. the suggestion`],
      cons: ["Thinner buffer if demand stays hot — a second stockout is plausible"],
      customerImpact: "Same recovery, less insurance.",
    },
    {
      name: `Reorder heavy (${n(qty + perWeek)} units)`,
      source: "agent",
      assumptions: stagedWith(qty + perWeek),
      note: "A week more cover than the suggestion.",
      pros: ["Covers the case where the spike settles slower than planned"],
      cons: [
        `Ties up ${compactMoney((qty + perWeek) * p.cost)}`,
        `If demand reverts to baseline, that is ${((item.onHandEff + qty + perWeek) / Math.max(1, p.velocity)).toFixed(0)} days of stock — markdown risk`,
      ],
      customerImpact: "Strongest availability; the cost is carried in inventory.",
    },
    {
      name: "My Custom Plan",
      source: "user",
      assumptions: cloneSim(s),
      note: "Set your own quantity and assumptions with the sliders.",
    },
  ];
  return out;
}

function inquiryOptions(m: Metrics, s: SimState): NewScenario[] {
  const mk = (
    playbook: SimState["conciergePlaybook"],
    name: string,
    note: string,
    pros: string[],
    cons: string[],
    customerImpact: string,
  ): NewScenario => ({
    name,
    source: "agent",
    assumptions: { ...cloneSim(s), conciergePlaybook: playbook },
    note,
    pros,
    cons,
    customerImpact,
  });

  return [
    mk(
      "standard",
      "Standard playbook",
      "Answer as usual: availability on request, ship window quoted live.",
      ["No change to review or roll out"],
      ["Scarce styles surface only when a client asks — surprise disappointment"],
      "Reactive; clients discover low stock at the moment they want to buy.",
    ),
    mk(
      "protect-promise",
      "Protect the promise",
      "Lead every scarce-style conversation with the honest ship window and suggest in-stock alternatives first.",
      ["Fewer broken expectations", "Shifts demand toward styles that can ship on time"],
      ["Softens demand on the hero style — by design"],
      "Clients hear the real timeline up front; alternatives are offered before the waitlist.",
    ),
    mk(
      "waitlist-first",
      "Waitlist first",
      "Proactively move scarce styles to a waitlist posture and notify when replenishment lands.",
      ["Captures demand instead of losing it", "Creates a committed audience for the restock"],
      ["Asks clients to wait — requires the reorder actually being placed"],
      "Clients opt into the wait; works best paired with a replenishment decision in the Atelier.",
    ),
  ];
  // Qualitative by design: playbooks change language, not derived numbers.
}

export function optionsFor(
  sit: Situation,
  m: Metrics,
  s: SimState,
  live: LiveState,
): NewScenario[] {
  if (sit.key === "fulfillment.backlog") return fulfillmentOptions(m, s, live);
  if (sit.key.startsWith("inventory.stockout:"))
    return stockoutOptions(sit.key.split(":")[1], m, s);
  if (sit.key === "boutique.inquiry-surge") return inquiryOptions(m, s);
  return [];
}

/* ── Preference: strict dominance only ───────────────────────────── */

function markPreferred(options: NewScenario[], live: LiveState): NewScenario[] {
  const scores = options.map((o) => {
    const f = project(o.assumptions, live).fulfillment;
    return { atRisk: f.atRisk, cost: f.costPerOrder, backlog: f.backlogDays, onTime: f.onTimeRate };
  });
  const idx = options.findIndex((_, i) =>
    scores.every((other, j) => {
      if (i === j) return true;
      const a = scores[i];
      const noWorse =
        a.atRisk <= other.atRisk && a.cost <= other.cost && a.backlog <= other.backlog && a.onTime >= other.onTime;
      const better =
        Number(a.atRisk < other.atRisk) +
        Number(a.cost < other.cost) +
        Number(a.backlog < other.backlog) +
        Number(a.onTime > other.onTime);
      return noWorse && better >= 3;
    }),
  );
  if (idx >= 0 && options.length > 1) {
    options[idx] = {
      ...options[idx],
      preferredWhy:
        "This option projects better on at least three of the four axes (orders at risk, cost per order, backlog, on-time rate) and worse on none — a rare case where the evidence points one way. The alternatives remain on the table.",
    };
  }
  return options;
}

/* ── Sensitivity ─────────────────────────────────────────────────── */

export interface SensitivityBand {
  /** backlog days under [pessimistic, optimistic] */
  backlog: [number, number];
  atRisk: [number, number];
  critical: [number, number];
  caption: string;
}

export function sensitivity(a: SimState, live: LiveState): SensitivityBand {
  const pess = derive(
    {
      ...a,
      demandMultiplier: a.demandMultiplier * 1.25,
      staffing: { ...a.staffing, unitsPerLaborHour: a.staffing.unitsPerLaborHour * 0.85 },
    },
    live,
  );
  const opt = derive(
    {
      ...a,
      demandMultiplier: a.demandMultiplier * 0.9,
      staffing: { ...a.staffing, unitsPerLaborHour: a.staffing.unitsPerLaborHour * 1.1 },
    },
    live,
  );
  const span = (lo: number, hi: number): [number, number] => [Math.min(lo, hi), Math.max(lo, hi)];
  return {
    backlog: span(opt.fulfillment.backlogDays, pess.fulfillment.backlogDays),
    atRisk: span(opt.fulfillment.atRisk, pess.fulfillment.atRisk),
    critical: span(opt.inventory.critical.length, pess.inventory.critical.length),
    caption: "Range: productivity −15% & demand +25% (pessimistic) ↔ productivity +10% & demand −10% (optimistic)",
  };
}

/* ── Comparison table model ──────────────────────────────────────── */

export interface CompareCell {
  value: string;
  /** raw figure for delta coloring; null on narrative rows */
  raw: number | null;
  range?: string;
  tone?: WorldStatus;
}
export interface CompareRow {
  label: string;
  /** when true, lower raw is better for tone */
  lowerIsBetter?: boolean;
  narrative?: boolean;
  cells: CompareCell[];
}

export function compareRows(
  scenarios: ScenarioDraft[],
  live: LiveState,
  withSensitivity = true,
): CompareRow[] {
  const proj = scenarios.map((sc) => project(sc.assumptions, live));
  const bands = withSensitivity ? scenarios.map((sc) => sensitivity(sc.assumptions, live)) : [];

  const metric = (
    label: string,
    val: (m: Metrics, i: number) => { value: string; raw: number; range?: string },
    lowerIsBetter: boolean,
  ): CompareRow => {
    const cells = proj.map((m, i) => {
      const c = val(m, i);
      const base = i === 0 ? null : val(proj[0], 0).raw;
      let tone: WorldStatus | undefined;
      if (base !== null && c.raw !== base) {
        const improved = lowerIsBetter ? c.raw < base : c.raw > base;
        tone = improved ? "healthy" : "critical";
      }
      return { ...c, tone };
    });
    return { label, lowerIsBetter, cells };
  };

  const rows: CompareRow[] = [
    metric("Capacity / day", (m) => ({ value: `${n(m.fulfillment.capacityUnits)} u`, raw: m.fulfillment.capacityUnits }), false),
    metric(
      "Orders at risk",
      (m, i) => ({
        value: n(m.fulfillment.atRisk),
        raw: m.fulfillment.atRisk,
        range: bands[i] ? `${n(bands[i].atRisk[0])}–${n(bands[i].atRisk[1])}` : undefined,
      }),
      true,
    ),
    metric(
      "Backlog",
      (m, i) => ({
        value: days(m.fulfillment.backlogDays),
        raw: m.fulfillment.backlogDays,
        range: bands[i]
          ? `${bands[i].backlog[0].toFixed(1)}–${bands[i].backlog[1].toFixed(1)}d`
          : undefined,
      }),
      true,
    ),
    metric("On-time rate", (m) => ({ value: pct(m.fulfillment.onTimeRate, 1), raw: m.fulfillment.onTimeRate }), false),
    metric("Labor / day", (m) => ({ value: money(m.fulfillment.laborCostDay), raw: m.fulfillment.laborCostDay }), true),
    metric("Cost / order", (m) => ({ value: money(m.fulfillment.costPerOrder, 2), raw: m.fulfillment.costPerOrder }), true),
    metric(
      "Open-to-buy left",
      (m) => ({
        value: compactMoney(m.inventory.openToBuy - m.inventory.stagedCost),
        raw: m.inventory.openToBuy - m.inventory.stagedCost,
      }),
      false,
    ),
    metric("Critical styles", (m) => ({ value: n(m.inventory.critical.length), raw: m.inventory.critical.length }), true),
    metric("Exposed revenue", (m) => ({ value: compactMoney(m.inventory.atRiskRevenue), raw: m.inventory.atRiskRevenue }), true),
    {
      label: "Customer impact",
      narrative: true,
      cells: scenarios.map((sc) => ({
        value: sc.customerImpact ?? "—",
        raw: null,
      })),
    },
  ];
  return rows;
}
