import { HERO_ID } from "./catalog";
import { ASSUMPTIONS, shipWindow } from "./sim";
import { compactMoney, days, money, n, pct } from "./fmt";
import type { AgentId, AgentStatus, BuildingId, Metrics, SimState } from "./types";

/* ════════════════════════════════════════════════════════════════════
   AGENT BRIEFS
   Each brief is assembled from the deterministic simulation. The agent
   narrates the numbers; it never produces them.
   ════════════════════════════════════════════════════════════════════ */

export interface AgentDef {
  id: AgentId;
  name: string;
  role: string;
  building: BuildingId;
  /** accent colour for the agent's identity */
  accent: string;
  mark: string;
  charter: string;
}

export const AGENTS: Record<AgentId, AgentDef> = {
  analyst: {
    id: "analyst",
    name: "Fulfillment Analyst",
    role: "Operations intelligence",
    building: "fulfillment",
    accent: "#3A2B23",
    mark: "FA",
    charter:
      "Watches the open order book against today's pick capacity and flags orders that will miss their promise.",
  },
  strategist: {
    id: "strategist",
    name: "Inventory Strategist",
    role: "Merchandise planning",
    building: "atelier",
    accent: "#64725C",
    mark: "IS",
    charter:
      "Watches sell-through against supplier lead times and proposes reorder scenarios before cover runs out.",
  },
  concierge: {
    id: "concierge",
    name: "Glam Concierge",
    role: "Client experience",
    building: "boutique",
    accent: "#A96C68",
    mark: "GC",
    charter:
      "Answers client questions using only the demo catalogue, example policies and the live simulated availability.",
  },
};

export interface DataRef {
  label: string;
  value: string;
  note?: string;
}

/**
 * A decision briefing, not an instruction. Answers, in order: what is
 * happening · why it matters · the trade-off axes · which assumptions could
 * change the results · what additional information would improve the
 * decision. Options themselves come from the Scenario Lab (lib/scenarios.ts).
 */
export interface Brief {
  status: AgentStatus;
  task: string;
  happening: string[];
  whyItMatters: string;
  tradeoffs: string;
  assumptions: string[];
  wouldHelp: string[];
  monitoring: string[];
  data: DataRef[];
  suggested: string[];
  history: { when: string; text: string; status: AgentStatus }[];
}

const STAGE_LABEL = ["", "01", "02", "03", "04"];

export function briefFor(id: AgentId, m: Metrics, s: SimState): Brief {
  const viral = s.scenario === "viral";
  const stage = s.viralStage;

  if (id === "analyst") {
    const f = m.fulfillment;
    const critical = f.status === "critical";
    const status: AgentStatus = critical ? "Needs review" : f.status === "watch" ? "Analyzing" : "Monitoring";
    return {
      status,
      task: critical
        ? `Re-planning the pick queue — ${n(f.atRisk)} orders will miss their promise at current staffing`
        : f.atRisk > 0
          ? `Watching ${n(f.atRisk)} orders with thin slack against their promise date`
          : `Monitoring the ${n(f.openOrders)}-order book against ${n(f.capacityPerDay)} orders/day of capacity`,
      monitoring: [
        "Open order book and promise dates",
        "Pick, pack and ship capacity by shift",
        "Carrier cut-off at 4:00pm",
        "Cost per order against the $4.60 target",
      ],
      happening: critical
        ? [
            `The book stands at ${n(f.openOrders)} orders / ${n(f.openUnits)} units. Today's plan clears ${n(f.capacityUnits)} units.`,
            `That is ${days(f.backlogDays)} of work in the queue — ${n(f.atRisk)} orders (${pct(f.atRisk / Math.max(1, f.openOrders))} of the book, ${compactMoney(f.atRiskValue)}) ship after their promise date.`,
            `Inflow is running at ${pct(f.utilization)} of capacity, so the queue is still growing.`,
          ]
        : f.atRisk > 0
          ? [
              `${n(f.atRisk)} orders are scheduled past their promise date, worth ${compactMoney(f.atRiskValue)}.`,
              `The book clears in ${days(f.backlogDays)} at the current plan.`,
            ]
          : [
              `Every order in the book is scheduled to ship on or before its promise date.`,
              `Capacity utilisation is ${pct(f.utilization)} — there is headroom for roughly ${n(Math.max(0, f.capacityUnits - Math.round(f.utilization * f.capacityUnits)))} more units a day.`,
            ],
      whyItMatters: critical
        ? `${compactMoney(f.atRiskValue)} of promised revenue ships late unless the plan changes — or you decide the delay is acceptable. Either way it should be a decision, not a drift.`
        : f.atRisk > 0
          ? `A small cohort is close to its promise date; a modest change now is cheaper than an apology later.`
          : `Nothing requires a decision — this is the picture a healthy floor should show.`,
      tradeoffs: critical
        ? `The levers trade against each other: temporary staffing buys on-time delivery with labor dollars; a second shift buys the most throughput at the highest cost; reprioritizing is free but breaks more standard promises; holding course spends customer goodwill instead of cash. Which matters most is your call — open the options to compare them.`
        : `With the book clean, the standing trade-off is cost per order vs. headroom: a leaner roster is cheaper per day but absorbs surges worse.`,
      assumptions: [
        `Pick rate ${s.staffing.unitsPerLaborHour} units/labour-hour — temps typically run below this at first`,
        `Demand assumption ${s.demandMultiplier.toFixed(2)}× — intake above it grows the queue faster than projected`,
        `Labor ${money(ASSUMPTIONS.laborRate, 2)}/hr fully loaded`,
      ],
      wouldHelp: [
        "Which customer commitments are hardest — dates or tiers?",
        "A ceiling for additional daily labor spend",
        "Whether temps can realistically start within the backlog window",
      ],
      data: [
        { label: "Open orders", value: n(f.openOrders), note: `${n(f.openUnits)} units` },
        { label: "Daily capacity", value: `${n(f.capacityUnits)} units`, note: `${n(f.capacityPerDay)} orders` },
        { label: "Backlog", value: days(f.backlogDays) },
        { label: "At risk", value: n(f.atRisk), note: compactMoney(f.atRiskValue) },
        { label: "On-time rate", value: pct(f.onTimeRate, 1) },
        { label: "Cost / order", value: money(f.costPerOrder, 2) },
      ],
      suggested: [
        "Give me the daily briefing.",
        "What's the cheapest approach?",
        "Compare a second shift against temporary staffing.",
        "What if I add only three workers?",
      ],
      history: [
        ...(viral && stage >= 2
          ? [
              {
                when: `Event ${STAGE_LABEL[2]}`,
                text: `${n(ASSUMPTIONS.surgeOrders)} orders arrived in under six hours. Pick plan re-run.`,
                status: "Needs review" as AgentStatus,
              },
            ]
          : []),
        { when: "08:14", text: "Carrier manifest reconciled — no exceptions.", status: "Completed" },
        { when: "07:02", text: "Overnight book ingested and sequenced by promise date.", status: "Completed" },
        { when: "06:30", text: "Shift roster confirmed against the day's forecast.", status: "Completed" },
      ],
    };
  }

  if (id === "strategist") {
    const inv = m.inventory;
    const hero = inv.items.find((i) => i.product.id === HERO_ID)!;
    const worst = inv.critical[0] ?? inv.watch[0];
    const alarmed = inv.critical.length > 0;
    const status: AgentStatus = alarmed
      ? viral && stage >= 3
        ? "Needs review"
        : "Analyzing"
      : inv.watch.length > 0
        ? "Planning"
        : "Monitoring";

    return {
      status,
      task: alarmed
        ? `Building a reorder scenario for ${inv.critical.length} ${inv.critical.length === 1 ? "style" : "styles"} that will sell through before replenishment lands`
        : inv.watch.length > 0
          ? `Watching ${inv.watch.length} styles drifting toward their reorder point`
          : `Monitoring ${inv.skuCount} styles against ${s.coverDays}-day cover targets`,
      monitoring: [
        "Units on hand and in transit by style",
        "Sell-through against the demand assumption",
        "Supplier lead times and open purchase orders",
        `Open-to-buy: ${compactMoney(inv.openToBuy)} for the next buy`,
      ],
      happening: alarmed
        ? [
            `${worst.product.name} is selling at ${n(worst.effVelocity)} units a day against ${n(worst.onHandEff)} on hand — that is ${worst.stockoutInDays.toFixed(1)} days of cover.`,
            `The supplier needs ${worst.leadTime} days, so there is a ${Math.max(0, worst.leadTime - worst.stockoutInDays).toFixed(0)}-day gap with nothing to sell.`,
            `Across flagged styles the exposed revenue is ${compactMoney(inv.atRiskRevenue)} at planning velocity.`,
          ]
        : inv.watch.length > 0
          ? [
              `${inv.watch.map((i) => i.product.name).join(" and ")} ${inv.watch.length === 1 ? "sits" : "sit"} just inside the reorder point.`,
              `Nothing stocks out before its replenishment window at the current demand assumption (${s.demandMultiplier.toFixed(2)}×).`,
            ]
          : [
              `All ${inv.skuCount} styles hold more than ${s.coverDays} days of cover beyond their lead time.`,
              `${compactMoney(inv.retailValue)} of inventory at retail, ${n(inv.unitsOnHand)} units.`,
            ],
      whyItMatters: alarmed
        ? `Every day below the lead-time line is demand the house cannot serve — roughly ${compactMoney(inv.atRiskRevenue)} exposed at planning velocity. Ordering too much carries the opposite risk: cash tied up in markdown-prone stock.`
        : inv.watch.length > 0
          ? `Styles inside the reorder window still have time, but the window only narrows.`
          : `Cover is comfortable everywhere — a good moment to pressure-test assumptions rather than place orders.`,
      tradeoffs: alarmed
        ? `The buy sizes against each other: lean protects cash but risks a second stockout; the suggested quantity restores the cover target; heavy insures against a slow settle at the cost of markdown exposure. Holding course costs no cash and the most goodwill. The right size depends on how you weigh cash against availability — compare them in the Lab.`
        : `The standing trade-off is cover vs. cash: every extra week of cover is capital sitting in racking.`,
      assumptions: [
        `Planning velocity assumes a spike settles to ${ASSUMPTIONS.spikeSettleMultiplier}× baseline — not today's rate`,
        `Lead times as quoted ${s.leadTimeAdj !== 0 ? `(shifted ${s.leadTimeAdj > 0 ? "+" : ""}${s.leadTimeAdj}d)` : ""} — slippage moves every window`,
        `Demand assumption ${s.demandMultiplier.toFixed(2)}×`,
      ],
      wouldHelp: [
        "Any supplier flexibility on partial or expedited shipments",
        "Whether the spike is organic or promo-driven (settles differently)",
        "A floor for acceptable weeks-of-stock after the buy",
      ],
      data: [
        { label: "Styles", value: n(inv.skuCount), note: `${n(inv.unitsOnHand)} units on hand` },
        { label: "Retail value", value: compactMoney(inv.retailValue) },
        { label: "Critical", value: n(inv.critical.length), note: "below lead time" },
        { label: "Watch", value: n(inv.watch.length), note: "below cover target" },
        {
          label: `${hero.product.name}`,
          value: `${hero.stockoutInDays.toFixed(1)} days`,
          note: `${n(hero.effVelocity)}/day`,
        },
        { label: "Open-to-buy", value: compactMoney(inv.openToBuy), note: `${compactMoney(inv.stagedCost)} staged` },
      ],
      suggested: [
        "Build me a buying plan.",
        "Which products might sell out next?",
        "What happens if demand doubles?",
        "What is the risk of ordering 500 more units?",
      ],
      history: [
        ...(viral && stage >= 3
          ? [
              {
                when: `Event ${STAGE_LABEL[3]}`,
                text: `${hero.product.name} cover fell to ${hero.stockoutInDays.toFixed(1)} days. Reorder scenario staged.`,
                status: "Needs review" as AgentStatus,
              },
            ]
          : []),
        { when: "09:40", text: "Sell-through refreshed against the 14-day trend.", status: "Completed" },
        { when: "08:55", text: "Supplier lead times re-confirmed for the autumn book.", status: "Completed" },
        { when: "Yesterday", text: "Ravenel Tote purchase order acknowledged — 1,400 units in transit.", status: "Completed" },
      ],
    };
  }

  // concierge
  const b = m.boutique;
  const inv = m.inventory;
  const win = shipWindow(m.fulfillment);
  const low = inv.items.filter((i) => b.availability[i.product.id] !== "In stock");
  const busy = viral && stage >= 4;
  const status: AgentStatus = busy ? "Analyzing" : low.length > 0 ? "Planning" : "Monitoring";

  return {
    status,
    task: busy
      ? `Handling ${n(b.inquiries)} client questions — mostly availability and shipping on the Soleil Mini`
      : `Greeting ${n(b.sessions)} sessions and answering ${n(b.inquiries)} questions from the demo catalogue`,
    monitoring: [
      "Live simulated availability by style",
      "Ship window from the fulfillment pick plan",
      "Example shipping, returns and restock policies",
      "Three fictional order records for status look-ups",
    ],
    happening: busy
      ? [
          `Question volume is ${ASSUMPTIONS.inquirySpike}× normal at ${n(b.inquiries)} today.`,
          `${low.length} ${low.length === 1 ? "style is" : "styles are"} no longer quoted as in stock: ${low.map((i) => i.product.name).join(", ")}.`,
          `The quoted ship window moved to ${win.label} because the pick queue now stands at ${days(m.fulfillment.backlogDays)}.`,
        ]
      : low.length > 0
        ? [
            `${low.map((i) => i.product.name).join(", ")} ${low.length === 1 ? "is" : "are"} being described as low stock.`,
            `Ship window quoted: ${win.label}.`,
          ]
        : [
            `All ${inv.skuCount} styles are quoted as in stock.`,
            `Ship window quoted: ${win.label}. Conversion is tracking ${pct(b.conversion, 2)}.`,
          ],
    whyItMatters: busy
      ? `Each availability question is a client at the moment of decision. The playbook decides whether scarcity reads as disappointment or as a waitlist relationship — and it should match whatever the ops and buying decisions are.`
      : low.length > 0
        ? `A few styles are being quoted as low stock; language is doing quiet work.`
        : `Conversations are routine — the playbook question is dormant.`,
    tradeoffs: busy
      ? `Three postures trade against each other: the standard playbook keeps answers reactive; protect-the-promise leads with honest timelines and steers to in-stock styles (softening hero demand by design); waitlist-first captures demand for the restock but asks clients to wait. None is objectively right — it depends how you want scarcity to feel.`
      : `The standing trade-off is candour vs. conversion: earlier honesty costs a few impulse orders and saves later service load.`,
    assumptions: [
      `Availability language derives from live simulated stock and the ${s.coverDays}-day cover target`,
      `Ship window quoted from the live pick plan — it moves with the queue`,
      `Question volume scales with sessions and with scarcity`,
    ],
    wouldHelp: [
      "Brand guardrails: how candid may availability language be?",
      "Whether a restock date can be promised once a reorder is applied",
      "Which clients merit proactive outreach vs. reactive answers",
    ],
    data: [
      { label: "Sessions today", value: n(b.sessions) },
      { label: "Orders today", value: n(b.ordersToday), note: pct(b.conversion, 2) },
      { label: "Average order", value: money(b.aov) },
      { label: "Revenue today", value: compactMoney(b.revenueToday) },
      { label: "Questions", value: n(b.inquiries) },
      { label: "Ship window", value: win.label },
    ],
    suggested: [
      "How are inquiries trending?",
      "Help me find an everyday bag under $100.",
      "When will the Soleil Mini restock?",
      "Where is my order?",
    ],
    history: [
      ...(viral && stage >= 4
        ? [
            {
              when: `Event ${STAGE_LABEL[4]}`,
              text: `Availability language updated on ${low.length} ${low.length === 1 ? "style" : "styles"} from live simulated stock.`,
              status: "Completed" as AgentStatus,
            },
          ]
        : []),
      { when: "10:12", text: "Order GL-48217 status quoted from the demo records.", status: "Completed" },
      { when: "09:48", text: "Gift edit refreshed — four styles under $100.", status: "Completed" },
      { when: "09:05", text: "Shipping policy answers re-checked against the pick plan.", status: "Completed" },
    ],
  };
}
