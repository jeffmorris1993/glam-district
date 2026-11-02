import { HERO_ID, PRODUCTS, byId } from "./catalog";
import { ASSUMPTIONS, MIX, SURGE_MIX } from "./sim";
import { compactMoney, n, pct } from "./fmt";
import type { AgentId, BuildingId, Metrics, SimState } from "./types";

/* ════════════════════════════════════════════════════════════════════
   THE DISTRICT CLOCK
   A single operational loop advances the business minute by minute.
   Everything the world animates — belt speed, pile height, worker count,
   truck departures, shopper arrivals — is read out of this state, and
   every discrete change emits an event with its own explanation.

   No animation in this demo runs on its own schedule.
   ════════════════════════════════════════════════════════════════════ */

/** real milliseconds per tick */
export const TICK_MS = 620;
/** simulated minutes advanced per tick */
export const TICK_MINUTES = 5;
/** average units in a packed parcel */
export const PARCEL_UNITS = 1.35;
/** parcels a van takes before it departs */
export const TRUCK_LOAD = 210;
/** the floor opens at 07:00 */
export const SHIFT_START_MIN = 7 * 60;

export type EventKind =
  | "shift.open"
  | "shift.close"
  | "orders.received"
  | "units.packed"
  | "truck.departed"
  | "truck.arrived"
  | "queue.rising"
  | "queue.cleared"
  | "staffing.changed"
  | "assumption.changed"
  | "inventory.watch"
  | "inventory.critical"
  | "reorder.staged"
  | "client.conversations"
  | "agent.query"
  | "scenario.stage"
  | "plan.applied"
  | "plan.reverted";

/** Anything in the world that can be clicked for its story. */
export type FocusKey =
  | "conveyor"
  | "packline"
  | "queue"
  | "dock"
  | "racking"
  | "fleet"
  | "floor"
  | "vitrine"
  | "samples"
  | "trendwall"
  | "inbound";

export interface DistrictEvent {
  id: string;
  /** simulated minutes since 00:00 on day one */
  minute: number;
  kind: EventKind;
  building: BuildingId;
  agent?: AgentId;
  title: string;
  detail: string;
  /** the causal explanation — why this happened now */
  why: string;
  tone: "info" | "good" | "watch" | "alert";
  magnitude?: number;
  focus?: FocusKey;
}

export type NewEvent = Omit<DistrictEvent, "id">;

export interface FlowState {
  /** simulated minutes since 00:00 on day one */
  minute: number;
  inShift: boolean;
  /** units sequenced and waiting to be packed */
  queueUnits: number;
  /** parcels staged on the dock, waiting for a van */
  stagedParcels: number;
  /** cumulative units that have left the building, by style */
  sold: Record<string, number>;

  packedToday: number;
  receivedToday: number;
  shippedToday: number;
  trucksToday: number;
  conversationsToday: number;

  /** live rates the world animates against, units (or arrivals) per minute */
  packRate: number;
  inflowRate: number;
  shopperRate: number;
  checkoutRate: number;

  /** monotonic tickets — the world launches one vehicle per increment */
  departures: number;
  arrivals: number;

  /** simulated purchase orders placed by an applied plan, landing later */
  openPOs: { id: string; productId: string; units: number; landsOnMinute: number }[];
  /** cumulative units landed from applied-plan POs, by style */
  received: Record<string, number>;

  /** accumulators for aggregate event emission */
  sinceOrderReport: number;
  ordersSinceReport: number;
  sinceChatReport: number;
  chatsSinceReport: number;
  /** days of inbound purchase orders already landed */
  landedPOs: string[];
  /** risk band last reported per style, so crossings emit once */
  riskSeen: Record<string, string>;
  backlogAlarm: boolean;
}

export function initialFlow(openUnits: number): FlowState {
  return {
    minute: SHIFT_START_MIN + 95, // the district opens mid-morning
    inShift: true,
    queueUnits: openUnits,
    stagedParcels: 64,
    sold: {},
    packedToday: 0,
    receivedToday: 0,
    shippedToday: 0,
    trucksToday: 0,
    conversationsToday: 0,
    packRate: 0,
    inflowRate: 0,
    shopperRate: 0,
    checkoutRate: 0,
    departures: 0,
    arrivals: 0,
    openPOs: [],
    received: {},
    sinceOrderReport: 0,
    ordersSinceReport: 0,
    sinceChatReport: 0,
    chatsSinceReport: 0,
    landedPOs: [],
    riskSeen: {},
    backlogAlarm: false,
  };
}

export const clockLabel = (minute: number) => {
  const day = Math.floor(minute / 1440) + 1;
  const m = Math.floor(minute % 1440);
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(Math.floor(m % 60)).padStart(2, "0");
  return { day, time: `${hh}:${mm}`, label: `Day ${day} · ${hh}:${mm}` };
};

/* ── Attribution: which styles the packed units belonged to ──────── */

function mixFor(s: SimState): [string, number][] {
  if (s.scenario !== "viral" || s.viralStage < 2) return MIX;
  // During the event the hero style dominates what is moving.
  const heroShare = 0.62;
  const rest: [string, number][] = SURGE_MIX.map(([id, w]) => [id, w * (1 - heroShare) * 0.6]);
  const base: [string, number][] = MIX.filter(([id]) => id !== HERO_ID).map(([id, w]) => [
    id,
    w * (1 - heroShare) * 0.4,
  ]);
  const out: [string, number][] = [[HERO_ID, heroShare], ...rest, ...base];
  const total = out.reduce((a, [, w]) => a + w, 0);
  return out.map(([id, w]) => [id, w / total]);
}

/* ── One tick ────────────────────────────────────────────────────── */

export function stepFlow(
  flow: FlowState,
  s: SimState,
  m: Metrics,
): { flow: FlowState; events: NewEvent[] } {
  const events: NewEvent[] = [];
  const next: FlowState = { ...flow, sold: { ...flow.sold } };

  const prevMinute = flow.minute;
  next.minute = flow.minute + TICK_MINUTES;
  const minOfDay = next.minute % 1440;
  const crossedMidnight = Math.floor(next.minute / 1440) > Math.floor(prevMinute / 1440);

  /* ── the shift window ─────────────────────────────────────────── */
  const shiftLen = s.staffing.shiftHours * 60 * (s.staffing.secondShift ? 2 : 1);
  const inShift = minOfDay >= SHIFT_START_MIN && minOfDay < SHIFT_START_MIN + shiftLen;

  if (inShift && !flow.inShift) {
    events.push({
      minute: next.minute,
      kind: "shift.open",
      building: "fulfillment",
      agent: "analyst",
      title: "Shift opened",
      detail: `${s.staffing.pickers} associates on an ${s.staffing.shiftHours}-hour shift — ${n(m.fulfillment.capacityUnits)} units of capacity for the day.`,
      why: "Packing capacity only exists while the floor is staffed; overnight the queue grows with no one to work it.",
      tone: "good",
      focus: "packline",
    });
  }
  if (!inShift && flow.inShift) {
    events.push({
      minute: next.minute,
      kind: "shift.close",
      building: "fulfillment",
      agent: "analyst",
      title: "Shift closed",
      detail: `${n(Math.round(flow.packedToday))} units packed and ${flow.trucksToday} ${flow.trucksToday === 1 ? "van" : "vans"} dispatched today. ${n(Math.round(flow.queueUnits))} units remain in the queue.`,
      why: "The belt stops when the floor closes. Orders keep arriving overnight, so the queue climbs until the next shift opens.",
      tone: flow.queueUnits > m.fulfillment.capacityUnits * 2 ? "watch" : "info",
      focus: "queue",
    });
  }
  next.inShift = inShift;

  if (crossedMidnight) {
    next.packedToday = 0;
    next.receivedToday = 0;
    next.shippedToday = 0;
    next.trucksToday = 0;
    next.conversationsToday = 0;
  }

  /* ── intake: orders arrive around the clock ───────────────────── */
  const dailyInflowUnits = PRODUCTS.reduce((a, p) => a + p.velocity, 0) * s.demandMultiplier;
  const viralHalo =
    s.scenario === "viral" && s.viralStage >= 2 ? ASSUMPTIONS.haloMultiplier : 1;
  const inflowPerMin = (dailyInflowUnits * viralHalo) / 1440;
  const inflowUnits = inflowPerMin * TICK_MINUTES;

  next.inflowRate = inflowPerMin;
  next.queueUnits = flow.queueUnits + inflowUnits;
  next.receivedToday = flow.receivedToday + inflowUnits / PARCEL_UNITS;
  next.ordersSinceReport = flow.ordersSinceReport + inflowUnits / PARCEL_UNITS;
  next.sinceOrderReport = flow.sinceOrderReport + TICK_MINUTES;

  if (next.sinceOrderReport >= 60) {
    const orders = Math.round(next.ordersSinceReport);
    events.push({
      minute: next.minute,
      kind: "orders.received",
      building: "fulfillment",
      agent: "analyst",
      title: `${n(orders)} orders received`,
      detail: `An hour of trading added ${n(orders)} orders (${n(Math.round(next.ordersSinceReport * PARCEL_UNITS))} units) to the pick queue.`,
      why: `Intake tracks the boutique: ${n(m.boutique.sessions)} sessions a day converting at ${pct(m.boutique.conversion, 2)}${viralHalo > 1 ? ", lifted by the drop" : ""}.`,
      tone: "info",
      magnitude: orders,
      focus: "conveyor",
    });
    next.sinceOrderReport = 0;
    next.ordersSinceReport = 0;
  }

  /* ── packing: capacity only exists during the shift ───────────── */
  const packPerMin = inShift ? m.fulfillment.capacityUnits / Math.max(1, shiftLen) : 0;
  const packed = Math.min(next.queueUnits, packPerMin * TICK_MINUTES);
  next.packRate = inShift ? packed / TICK_MINUTES : 0;
  next.queueUnits = Math.max(0, next.queueUnits - packed);
  next.packedToday = flow.packedToday + packed;
  next.stagedParcels = flow.stagedParcels + packed / PARCEL_UNITS;

  // attribute what was packed to styles, so inventory actually falls
  if (packed > 0) {
    for (const [id, share] of mixFor(s)) {
      next.sold[id] = (next.sold[id] ?? 0) + packed * share;
    }
  }

  /* ── dispatch: a van leaves when a load is complete ───────────── */
  while (next.stagedParcels >= TRUCK_LOAD) {
    next.stagedParcels -= TRUCK_LOAD;
    next.departures += 1;
    next.trucksToday += 1;
    next.shippedToday += TRUCK_LOAD;
    events.push({
      minute: next.minute,
      kind: "truck.departed",
      building: "fulfillment",
      agent: "analyst",
      title: `Van dispatched — ${TRUCK_LOAD} parcels`,
      detail: `Load ${next.trucksToday} of the day left the dock. ${n(Math.round(next.shippedToday))} parcels have shipped since midnight.`,
      why: `Parcels stage on the dock as they are packed; a van departs each time the staged pile reaches a full ${TRUCK_LOAD}-parcel load.`,
      tone: "good",
      magnitude: TRUCK_LOAD,
      focus: "fleet",
    });
  }

  /* ── bottleneck detection ─────────────────────────────────────── */
  const backlogDays = next.queueUnits / Math.max(1, m.fulfillment.capacityUnits);
  if (!flow.backlogAlarm && backlogDays > 2.2) {
    next.backlogAlarm = true;
    events.push({
      minute: next.minute,
      kind: "queue.rising",
      building: "fulfillment",
      agent: "analyst",
      title: "Packing bottleneck forming",
      detail: `${n(Math.round(next.queueUnits))} units are waiting against ${n(m.fulfillment.capacityUnits)} units of daily capacity — ${backlogDays.toFixed(1)} days of work.`,
      why: `Orders are arriving at ${n(Math.round(inflowPerMin * 1440))} units a day while the floor can clear ${n(m.fulfillment.capacityUnits)}. Until capacity exceeds intake the pile grows.`,
      tone: "alert",
      magnitude: Math.round(next.queueUnits),
      focus: "queue",
    });
  }
  if (flow.backlogAlarm && backlogDays < 1.5) {
    next.backlogAlarm = false;
    events.push({
      minute: next.minute,
      kind: "queue.cleared",
      building: "fulfillment",
      agent: "analyst",
      title: "Bottleneck cleared",
      detail: `The queue is back to ${backlogDays.toFixed(1)} days — ${n(Math.round(next.queueUnits))} units waiting.`,
      why: `Pack capacity has been running ahead of intake, so the pile at the stations has drained.`,
      tone: "good",
      focus: "queue",
    });
  }

  /* ── inbound replenishment landing ────────────────────────────── */
  const dayIndex = Math.floor(next.minute / 1440);
  for (const p of PRODUCTS) {
    if (p.inbound <= 0) continue;
    // Purchase orders land on their ETA, compressed so one sim day ≈ one week of lead time.
    const landsOnDay = Math.max(1, Math.round(p.inboundEta / 7));
    const key = `${p.id}-${landsOnDay}`;
    if (dayIndex >= landsOnDay && !flow.landedPOs.includes(key)) {
      next.landedPOs = [...next.landedPOs, key];
      next.arrivals += 1;
      events.push({
        minute: next.minute,
        kind: "truck.arrived",
        building: "atelier",
        agent: "strategist",
        title: `${n(p.inbound)} units of ${p.name} landed`,
        detail: `An open purchase order arrived at the dock and moved into racking.`,
        why: `This order was placed ${p.leadTimeDays} days ago against a ${p.inboundEta}-day transit. It restores ${(p.inbound / p.velocity).toFixed(0)} days of cover.`,
        tone: "good",
        magnitude: p.inbound,
        focus: "inbound",
      });
    }
  }

  /* ── applied-plan purchase orders landing ─────────────────────── */
  const due = flow.openPOs.filter((po) => next.minute >= po.landsOnMinute);
  if (due.length) {
    next.openPOs = flow.openPOs.filter((po) => next.minute < po.landsOnMinute);
    next.received = { ...flow.received };
    for (const po of due) {
      next.received[po.productId] = (next.received[po.productId] ?? 0) + po.units;
      next.arrivals += 1;
      const prod = byId(po.productId);
      events.push({
        minute: next.minute,
        kind: "truck.arrived",
        building: "atelier",
        agent: "strategist",
        title: `${n(po.units)} units of ${prod.name} landed`,
        detail: `The reorder from your applied plan arrived at the dock and moved into racking.`,
        why: `You approved this buy in the Scenario Lab; it travelled on the simulated supplier lead time and has now restored cover. Simulated stock only.`,
        tone: "good",
        magnitude: po.units,
        focus: "inbound",
      });
    }
  }

  /* ── inventory risk crossings ─────────────────────────────────── */
  for (const item of m.inventory.items) {
    const seen = flow.riskSeen[item.product.id];
    if (seen === item.risk) continue;
    next.riskSeen = { ...next.riskSeen, [item.product.id]: item.risk };
    if (!seen) continue; // first observation, nothing crossed
    if (item.risk === "critical") {
      events.push({
        minute: next.minute,
        kind: "inventory.critical",
        building: "atelier",
        agent: "strategist",
        title: `${item.product.name} will sell through in ${item.stockoutInDays.toFixed(1)} days`,
        detail: `${n(item.onHandEff)} units on hand against ${n(item.effVelocity)} selling a day, with a ${item.leadTime}-day lead time.`,
        why: `Cover fell below the supplier lead time, so a replenishment ordered now would land after the shelf is empty. The Inventory Strategist has staged a reorder scenario.`,
        tone: "alert",
        magnitude: item.suggestedReorder,
        focus: "trendwall",
      });
    } else if (item.risk === "watch" && seen === "healthy") {
      events.push({
        minute: next.minute,
        kind: "inventory.watch",
        building: "atelier",
        agent: "strategist",
        title: `${item.product.name} dropped below cover`,
        detail: `${item.stockoutInDays.toFixed(0)} days of cover against a ${item.leadTime}-day lead time plus a ${s.coverDays}-day buffer.`,
        why: `Units packed today reduced on-hand stock past the reorder point. It is still replenishable, but the window is narrowing.`,
        tone: "watch",
        focus: "samples",
      });
    } else if (item.risk === "healthy" && seen !== "healthy") {
      events.push({
        minute: next.minute,
        kind: "inventory.watch",
        building: "atelier",
        agent: "strategist",
        title: `${item.product.name} back in cover`,
        detail: `${item.stockoutInDays.toFixed(0)} days of cover restored.`,
        why: `A replenishment landed, or the demand assumption was lowered.`,
        tone: "good",
        focus: "samples",
      });
    }
  }

  /* ── boutique: arrivals, checkouts and client questions ───────── */
  const sessionMultiple = m.boutique.sessions / ASSUMPTIONS.baseSessions;
  // Representative, not one figure per real session.
  next.shopperRate = 0.05 * sessionMultiple;
  next.checkoutRate = next.shopperRate * (m.boutique.conversion / ASSUMPTIONS.baseConversion) * 0.55;

  const inquiriesPerMin = m.boutique.inquiries / 1440;
  next.chatsSinceReport = flow.chatsSinceReport + inquiriesPerMin * TICK_MINUTES;
  next.sinceChatReport = flow.sinceChatReport + TICK_MINUTES;
  next.conversationsToday = flow.conversationsToday + inquiriesPerMin * TICK_MINUTES;

  if (next.sinceChatReport >= 90) {
    const handled = Math.max(1, Math.round(next.chatsSinceReport));
    const low = m.inventory.items.filter((i) => m.boutique.availability[i.product.id] !== "In stock");
    events.push({
      minute: next.minute,
      kind: "client.conversations",
      building: "boutique",
      agent: "concierge",
      title: `${n(handled)} client questions handled`,
      detail: low.length
        ? `Mostly availability on ${low.map((i) => i.product.name).join(", ")}, answered with the live simulated stock position.`
        : `Styling and shipping questions, answered from the demo catalogue and the ${Math.max(1, Math.round(backlogDays))}-day ship window.`,
      why: `Question volume tracks boutique traffic — ${n(m.boutique.sessions)} sessions a day${low.length ? `, and clients ask about anything flagged low stock` : ""}.`,
      tone: low.length ? "watch" : "info",
      magnitude: handled,
      focus: "floor",
    });
    next.sinceChatReport = 0;
    next.chatsSinceReport = 0;
  }

  return { flow: next, events };
}

/* ── Inspector copy: what a clicked object is showing ────────────── */

export interface Inspection {
  title: string;
  system: string;
  building: BuildingId;
  agent?: AgentId;
  what: string;
  why: string;
  metrics: { label: string; value: string; note?: string }[];
}

export function inspect(
  key: FocusKey,
  m: Metrics,
  flow: FlowState,
  s: SimState,
): Inspection {
  const f = m.fulfillment;
  const backlogDays = flow.queueUnits / Math.max(1, f.capacityUnits);
  const hero = m.inventory.items.find((i) => i.product.id === HERO_ID)!;

  switch (key) {
    case "conveyor":
      return {
        title: "Intake conveyor",
        system: "Order intake",
        building: "fulfillment",
        agent: "analyst",
        what: `Parcels move down the belt at the rate the floor is actually packing. The belt stops when the shift closes.`,
        why: `Belt speed is ${n(Math.round(flow.packRate * 60))} units an hour, which is this shift's capacity spread across its hours. Orders arrive separately, at ${n(Math.round(flow.inflowRate * 1440))} units a day — the gap between those two numbers is what builds or drains the pile at the stations.`,
        metrics: [
          { label: "Intake", value: `${n(Math.round(flow.inflowRate * 1440))}/day`, note: "units" },
          { label: "Pack rate", value: flow.inShift ? `${n(Math.round(flow.packRate * 60))}/hr` : "Stopped", note: flow.inShift ? "units" : "off shift" },
          { label: "Received today", value: n(Math.round(flow.receivedToday)), note: "orders" },
          { label: "Packed today", value: n(Math.round(flow.packedToday)), note: "units" },
        ],
      };

    case "packline":
      return {
        title: "Packing stations",
        system: "Pick, pack and ship",
        building: "fulfillment",
        agent: "analyst",
        what: `${Math.max(1, Math.min(5, Math.round(s.staffing.pickers / 7)))} stations are lit, representing ${s.staffing.pickers} associates. Add staffing and more stations come alive; the belt and the dock follow.`,
        why: `Capacity is ${s.staffing.pickers} associates × ${s.staffing.shiftHours}h × ${s.staffing.unitsPerLaborHour} units per labour-hour${s.staffing.secondShift ? " × 2 shifts at a 8% productivity penalty" : ""} = ${n(f.capacityUnits)} units a day. Everything downstream is paced by that one number.`,
        metrics: [
          { label: "Associates", value: n(s.staffing.pickers) },
          { label: "Capacity", value: `${n(f.capacityUnits)}/day`, note: "units" },
          { label: "Utilisation", value: pct(f.utilization), note: "intake vs capacity" },
          { label: "Cost / order", value: `$${f.costPerOrder.toFixed(2)}` },
        ],
      };

    case "queue":
      return {
        title: "Pick queue",
        system: "Backlog",
        building: "fulfillment",
        agent: "analyst",
        what: `Each box in the pile stands for roughly 230 units still waiting to be packed. The pile grows whenever intake outruns capacity, and overnight while the floor is dark.`,
        why:
          backlogDays > 2.2
            ? `The queue is ${backlogDays.toFixed(1)} days deep. At ${n(f.capacityUnits)} units a day against ${n(Math.round(flow.inflowRate * 1440))} arriving, it cannot clear without more capacity — ${n(f.atRisk)} orders will miss their promise.`
            : `The queue is ${backlogDays.toFixed(1)} days deep and draining: the floor clears ${n(f.capacityUnits)} units a day against ${n(Math.round(flow.inflowRate * 1440))} arriving.`,
        metrics: [
          { label: "Waiting", value: n(Math.round(flow.queueUnits)), note: "units" },
          { label: "Open orders", value: n(f.openOrders) },
          { label: "Backlog", value: `${backlogDays.toFixed(1)} days` },
          { label: "At risk", value: n(f.atRisk), note: f.atRisk ? compactMoney(f.atRiskValue) : "none" },
        ],
      };

    case "dock":
      return {
        title: "Loading dock",
        system: "Dispatch staging",
        building: "fulfillment",
        agent: "analyst",
        what: `Packed parcels stage here until a full load is ready. When the pile reaches ${TRUCK_LOAD} parcels a van pulls out — that is the only thing that makes a van leave in this demo.`,
        why: `${n(Math.round(flow.stagedParcels))} parcels are staged, ${Math.max(0, Math.round(TRUCK_LOAD - flow.stagedParcels))} short of a load. At the current pack rate the next departure is about ${Math.max(1, Math.round(((TRUCK_LOAD - flow.stagedParcels) * PARCEL_UNITS) / Math.max(0.01, flow.packRate)))} simulated minutes away.`,
        metrics: [
          { label: "Staged", value: n(Math.round(flow.stagedParcels)), note: `of ${TRUCK_LOAD}` },
          { label: "Vans today", value: n(flow.trucksToday) },
          { label: "Parcels shipped", value: n(Math.round(flow.shippedToday)), note: "today" },
          { label: "Ship window", value: `${Math.max(1, Math.round(backlogDays))}–${Math.max(2, Math.round(backlogDays) + 1)} days` },
        ],
      };

    case "fleet":
      return {
        title: "Delivery van",
        system: "Dispatch",
        building: "fulfillment",
        agent: "analyst",
        what: `This van is carrying a completed ${TRUCK_LOAD}-parcel load off the dock. It was dispatched by a packing event, not on a timer.`,
        why: `${flow.trucksToday} ${flow.trucksToday === 1 ? "load has" : "loads have"} gone out today. Raise staffing and loads complete sooner, so vans leave more often; close the shift and departures stop entirely.`,
        metrics: [
          { label: "Load", value: n(TRUCK_LOAD), note: "parcels" },
          { label: "Vans today", value: n(flow.trucksToday) },
          { label: "Pack rate", value: `${n(Math.round(flow.packRate * 60))}/hr` },
          { label: "On-time rate", value: pct(f.onTimeRate, 1) },
        ],
      };

    case "racking":
      return {
        title: "Storage racking",
        system: "On-hand inventory",
        building: "fulfillment",
        agent: "strategist",
        what: `Every unit packed on the floor comes out of this racking, so on-hand stock falls as the district runs.`,
        why: `${n(m.inventory.unitsOnHand)} units remain across ${m.inventory.skuCount} styles, ${compactMoney(m.inventory.retailValue)} at retail. ${m.inventory.critical.length ? `${m.inventory.critical.length} ${m.inventory.critical.length === 1 ? "style is" : "styles are"} below lead-time cover.` : "Nothing is below lead-time cover."}`,
        metrics: [
          { label: "Units on hand", value: n(m.inventory.unitsOnHand) },
          { label: "Sold today", value: n(Math.round(flow.packedToday)), note: "units" },
          { label: "Critical", value: n(m.inventory.critical.length) },
          { label: "On watch", value: n(m.inventory.watch.length) },
        ],
      };

    case "inbound":
      return {
        title: "Inbound replenishment",
        system: "Open purchase orders",
        building: "atelier",
        agent: "strategist",
        what: `Units already in transit against orders placed earlier. They land on their ETA and move straight into racking.`,
        why: `${PRODUCTS.filter((p) => p.inbound > 0).map((p) => `${n(p.inbound)} × ${p.name} in ${p.inboundEta} days`).join(" · ") || "Nothing in transit."}`,
        metrics: PRODUCTS.filter((p) => p.inbound > 0).map((p) => ({
          label: p.line,
          value: n(p.inbound),
          note: `${p.inboundEta}d out`,
        })),
      };

    case "floor":
      return {
        title: "Boutique floor",
        system: "Client traffic",
        building: "boutique",
        agent: "concierge",
        what: `Arrivals represent session volume and departures carrying a bag represent conversion. Figures are a sample of aggregate traffic, not one person per session.`,
        why: `${n(m.boutique.sessions)} sessions a day converting at ${pct(m.boutique.conversion, 2)} gives ${n(m.boutique.ordersToday)} orders — which is exactly what feeds the pick queue next door.`,
        metrics: [
          { label: "Sessions", value: n(m.boutique.sessions), note: "today" },
          { label: "Orders", value: n(m.boutique.ordersToday), note: pct(m.boutique.conversion, 2) },
          { label: "Average order", value: `$${m.boutique.aov.toFixed(0)}` },
          { label: "Questions", value: n(Math.round(flow.conversationsToday)), note: "handled today" },
        ],
      };

    case "vitrine":
      return {
        title: "Window display",
        system: "Merchandising",
        building: "boutique",
        agent: "concierge",
        what: `The window carries the styles the concierge leads with. Availability language changes with the live simulated stock position.`,
        why: `${hero.product.name} is ${m.boutique.availability[hero.product.id].toLowerCase()} — ${n(hero.onHandEff)} units on hand selling ${n(hero.effVelocity)} a day, ${hero.stockoutInDays.toFixed(1)} days of cover.`,
        metrics: [
          { label: hero.product.name, value: m.boutique.availability[hero.product.id] },
          { label: "On hand", value: n(hero.onHandEff), note: "units" },
          { label: "Selling", value: `${n(hero.effVelocity)}/day` },
          { label: "Cover", value: `${hero.stockoutInDays.toFixed(1)} days` },
        ],
      };

    case "samples":
      return {
        title: "Sample table",
        system: "Buying review",
        building: "atelier",
        agent: "strategist",
        what: `The styles currently under review. A style moves onto the table when its cover drops toward the reorder point.`,
        why: m.inventory.watch.length || m.inventory.critical.length
          ? `${[...m.inventory.critical, ...m.inventory.watch].map((i) => `${i.product.name} (${i.stockoutInDays.toFixed(0)}d)`).join(", ")} ${m.inventory.critical.length + m.inventory.watch.length === 1 ? "is" : "are"} inside the reorder window at ${s.demandMultiplier.toFixed(2)}× demand.`
          : `Nothing is inside the reorder window at ${s.demandMultiplier.toFixed(2)}× demand, so the table is a standing assortment review.`,
        metrics: [
          { label: "Styles", value: n(m.inventory.skuCount) },
          { label: "Critical", value: n(m.inventory.critical.length) },
          { label: "On watch", value: n(m.inventory.watch.length) },
          { label: "Open-to-buy", value: compactMoney(m.inventory.openToBuy - m.inventory.stagedCost), note: "remaining" },
        ],
      };

    case "trendwall":
      return {
        title: "Trend wall",
        system: "Demand planning",
        building: "atelier",
        agent: "strategist",
        what: `Where the Inventory Strategist works. It moves to the wall when a style crosses into risk and back to the desk when the book is clean.`,
        why: m.inventory.critical.length
          ? `${m.inventory.critical[0].product.name} is ${m.inventory.critical[0].stockoutInDays.toFixed(1)} days from selling through against a ${m.inventory.critical[0].leadTime}-day lead time. A ${n(m.inventory.critical[0].suggestedReorder)}-unit scenario is staged for review.`
          : `No style is below lead-time cover, so the strategist is running the standing weekly review rather than an exception.`,
        metrics: [
          { label: "Demand", value: `${s.demandMultiplier.toFixed(2)}×` },
          { label: "Cover target", value: `${s.coverDays} days` },
          { label: "Exposed", value: compactMoney(m.inventory.atRiskRevenue) },
          { label: "Staged buy", value: compactMoney(m.inventory.stagedCost) },
        ],
      };
  }
}

/** A short, human label for an event kind — used by the timeline. */
export const KIND_LABEL: Record<EventKind, string> = {
  "shift.open": "Shift",
  "shift.close": "Shift",
  "orders.received": "Intake",
  "units.packed": "Packing",
  "truck.departed": "Dispatch",
  "truck.arrived": "Receiving",
  "queue.rising": "Bottleneck",
  "queue.cleared": "Recovery",
  "staffing.changed": "Staffing",
  "assumption.changed": "Assumption",
  "inventory.watch": "Inventory",
  "inventory.critical": "Inventory",
  "reorder.staged": "Buying",
  "client.conversations": "Clients",
  "agent.query": "Agent",
  "scenario.stage": "Event",
  "plan.applied": "Decision",
  "plan.reverted": "Revert",
};

export const PRODUCT_LABEL = (id: string) => byId(id).name;
