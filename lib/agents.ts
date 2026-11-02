import { HERO_ID, byId } from "./catalog";
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

export interface Brief {
  status: AgentStatus;
  task: string;
  monitoring: string[];
  findings: string[];
  recommendations: { title: string; detail: string; tone: "info" | "watch" | "alert" }[];
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
      findings: critical
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
      recommendations: critical
        ? [
            {
              title: `Add associates until capacity passes ${n(Math.ceil(f.openUnits / 2))} units/day`,
              detail: `Two days of promise coverage needs about ${n(Math.ceil(f.openUnits / 2))} units a day. Use the staffing control to test it — the queue re-plans live.`,
              tone: "alert",
            },
            {
              title: "Protect VIP and Express first",
              detail:
                "The queue already sorts by promise date, then tier, then order value. VIP orders stay inside day one at every staffing level tested.",
              tone: "info",
            },
          ]
        : [
            {
              title: "Hold the current plan",
              detail: `${n(f.shippedToday)} orders will ship today at ${money(f.costPerOrder, 2)} each. No intervention needed.`,
              tone: "info",
            },
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
        "Which orders need attention today?",
        "What happens if I add five workers?",
        "Can we handle another 2,000 orders?",
        "Create tomorrow's fulfillment plan.",
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
      findings: alarmed
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
      recommendations: alarmed
        ? [
            {
              title: `Place ${n(worst.suggestedReorder)} units of ${worst.product.name}`,
              detail: `Sized to ${worst.leadTime} days of lead time plus ${s.coverDays} days of cover at a planning velocity of ${n(worst.planVelocity)}/day — not at today's spike rate. Landed cost ${compactMoney(worst.suggestedReorder * worst.product.cost)}.`,
              tone: "alert",
            },
            {
              title: "Open a waitlist rather than oversell",
              detail:
                "The concierge switches to waitlist language automatically when a style drops below cover. This is a simulated planning scenario, not purchasing advice.",
              tone: "watch",
            },
          ]
        : [
            {
              title: "No buy required this week",
              detail: `Every style clears its lead time with cover to spare. Revisit when the demand assumption moves past ${(s.demandMultiplier + 0.3).toFixed(1)}×.`,
              tone: "info",
            },
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
        "Which products might sell out next?",
        "What should I reorder before the next drop?",
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
    findings: busy
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
    recommendations: busy
      ? [
          {
            title: "Offer the waitlist on the Soleil Mini",
            detail:
              "Rather than promising a date, the concierge offers the waitlist and names the replenishment window from the Buying Atelier's simulated lead time.",
            tone: "watch",
          },
          {
            title: "Lead with the Cassis Quilted for everyday requests",
            detail: `${byId("cassis-quilted").name} holds cover, sits at ${money(byId("cassis-quilted").price)} and answers the same brief.`,
            tone: "info",
          },
        ]
      : [
          {
            title: "Keep the current answers",
            detail: `Availability and the ${win.label} ship window both read clean. No language changes needed.`,
            tone: "info",
          },
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
      "Help me find an everyday bag under $100.",
      "What's a good gift?",
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
