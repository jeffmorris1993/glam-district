import {
  CITIES,
  FIRST_NAMES,
  HERO_ID,
  LAST_INITIALS,
  PRODUCTS,
} from "./catalog";
import type {
  BoutiqueMetrics,
  PriorityPolicy,
  FulfillmentMetrics,
  InventoryMetrics,
  Metrics,
  Order,
  ProductMetrics,
  ScheduledOrder,
  SimState,
  WorldStatus,
} from "./types";

/* ════════════════════════════════════════════════════════════════════
   DETERMINISTIC SIMULATION
   Every number in this demo is computed here from a fixed seed and the
   user's control inputs. No model output is ever used as an operational
   figure — the agents read these values, they do not invent them.
   ════════════════════════════════════════════════════════════════════ */

/* ── Seeded RNG (mulberry32) ─────────────────────────────────────── */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── Fixed assumptions (fictional) ───────────────────────────────── */
export const ASSUMPTIONS = {
  baseOpenOrders: 1240,
  surgeOrders: 2900,
  baseSessions: 28_300,
  baseConversion: 0.029,
  /** fully-loaded labor rate, $/hour */
  laborRate: 21.5,
  /** packaging + pick consumables per order, $ */
  packagingPerOrder: 1.85,
  /** fixed daily facility overhead, $ */
  fixedOverheadDay: 980,
  /** how much of the spike the planner assumes persists for the hero style */
  spikeSettleMultiplier: 2.4,
  /** halo lift on non-hero styles during the event */
  haloMultiplier: 1.15,
  /** live demand multiple on the hero style during the event */
  heroSpikeMultiplier: 14,
  /** session lift during the event */
  sessionSpike: 4.2,
  /** open-to-buy budget for the next buy, $ */
  openToBuy: 750_000,
  baseInquiries: 184,
  inquirySpike: 3.6,
} as const;

export const DEFAULT_STATE: SimState = {
  scenario: "baseline",
  viralStage: 0,
  demandMultiplier: 1,
  coverDays: 14,
  staffing: { pickers: 14, shiftHours: 8, unitsPerLaborHour: 14, secondShift: false },
  leadTimeAdj: 0,
  staged: {},
  priorityPolicy: "promise-first",
  conciergePlaybook: "standard",
};

/* ── Order book generation (memoized, seed-stable) ───────────────── */

export const MIX: [string, number][] = [
  ["soleil-mini", 0.22],
  ["praline-case", 0.17],
  ["cassis-quilted", 0.14],
  ["etoile-scarf", 0.11],
  ["lumiere-clutch", 0.1],
  ["ravenel-tote", 0.09],
  ["avenue-hobo", 0.09],
  ["monroe-satchel", 0.08],
];

/** Add-on lines attached to surge orders (the hero style is always the primary line). */
export const SURGE_MIX: [string, number][] = [
  ["praline-case", 0.42],
  ["etoile-scarf", 0.33],
  ["lumiere-clutch", 0.15],
  ["cassis-quilted", 0.1],
];

function pickWeighted(mix: [string, number][], r: number) {
  let acc = 0;
  for (const [id, w] of mix) {
    acc += w;
    if (r <= acc) return id;
  }
  return mix[mix.length - 1][0];
}

function buildOrders(count: number, seed: number, surge: boolean): Order[] {
  const rand = rng(seed);
  const orders: Order[] = [];
  for (let i = 0; i < count; i++) {
    const first = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
    const last = LAST_INITIALS[Math.floor(rand() * LAST_INITIALS.length)];
    const [city, state] = CITIES[Math.floor(rand() * CITIES.length)];

    const mix = surge ? SURGE_MIX : MIX;
    const lines: Order["lines"] = [];
    const primary = surge ? HERO_ID : pickWeighted(mix, rand());
    lines.push({ productId: primary, qty: rand() > 0.9 ? 2 : 1 });
    // ~38% of baseline orders and ~30% of surge orders attach a second line
    if (rand() < (surge ? 0.3 : 0.38)) {
      const second = pickWeighted(mix, rand());
      if (second !== primary) lines.push({ productId: second, qty: 1 });
    }

    const units = lines.reduce((n, l) => n + l.qty, 0);
    const value = lines.reduce((n, l) => {
      const p = PRODUCTS.find((x) => x.id === l.productId)!;
      return n + p.price * l.qty;
    }, 0);

    const t = rand();
    const tier = t > 0.93 ? "VIP" : t > 0.74 ? "Express" : "Standard";
    // The house promises "ships within 2 business days" on standard orders.
    const promiseInDays = tier === "Standard" ? (rand() < 0.8 ? 2 : 3) : 1;

    orders.push({
      id: `GL-${(surge ? 60000 : 48000) + i * 3 + Math.floor(rand() * 3)}`,
      customer: `${first} ${last}`,
      city,
      state,
      tier,
      lines,
      units,
      value: Math.round(value),
      promiseInDays,
      placedHoursAgo: surge ? Math.round(rand() * 6 * 10) / 10 : Math.round(rand() * 38 * 10) / 10,
      surge: surge || undefined,
    });
  }
  return orders;
}

export const BASE_BOOK = buildOrders(ASSUMPTIONS.baseOpenOrders, 20260211, false);
export const SURGE_BOOK = buildOrders(ASSUMPTIONS.surgeOrders, 77713, true);

/** Units of each product consumed by the surge order book. */
export const SURGE_UNITS: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  for (const o of SURGE_BOOK) for (const l of o.lines) m[l.productId] = (m[l.productId] ?? 0) + l.qty;
  return m;
})();

const TIER_RANK = { VIP: 0, Express: 1, Standard: 2 } as const;

/* Sequencing is a plannable lever. promise-first is the house rule; the
   others trade standard-order promises for revenue or tier protection. */
const COMPARATORS: Record<PriorityPolicy, (a: Order, b: Order) => number> = {
  "promise-first": (a, b) =>
    a.promiseInDays - b.promiseInDays || TIER_RANK[a.tier] - TIER_RANK[b.tier] || b.value - a.value,
  "value-first": (a, b) =>
    b.value - a.value || a.promiseInDays - b.promiseInDays || TIER_RANK[a.tier] - TIER_RANK[b.tier],
  "express-first": (a, b) =>
    TIER_RANK[a.tier] - TIER_RANK[b.tier] || a.promiseInDays - b.promiseInDays || b.value - a.value,
};

export const sequence = (book: Order[], policy: PriorityPolicy) =>
  book.slice().sort(COMPARATORS[policy]);

const VIRAL_BOOK = [...BASE_BOOK, ...SURGE_BOOK];
const SEQ_CACHE: Record<"base" | "viral", Partial<Record<PriorityPolicy, Order[]>>> = {
  base: {},
  viral: {},
};
function sequenced(viral: boolean, policy: PriorityPolicy): Order[] {
  const slot = SEQ_CACHE[viral ? "viral" : "base"];
  return (slot[policy] ??= sequence(viral ? VIRAL_BOOK : BASE_BOOK, policy));
}

/**
 * Live state owned by the clock in lib/engine.ts. When present the order
 * book is truncated to the units still waiting, and on-hand inventory is
 * reduced by what has actually been packed — so the dashboards show the
 * same world the district is animating.
 */
export interface LiveState {
  queueUnits?: number;
  sold?: Record<string, number>;
  /** units landed from applied-plan purchase orders, by style */
  received?: Record<string, number>;
}

/* ── Fulfillment ─────────────────────────────────────────────────── */

function deriveFulfillment(s: SimState, live?: LiveState): FulfillmentMetrics {
  const viral = s.scenario === "viral" && s.viralStage >= 2;
  const sorted = sequenced(viral, s.priorityPolicy);

  const { pickers, shiftHours, unitsPerLaborHour, secondShift } = s.staffing;
  // A second shift adds hours but carries a small productivity penalty.
  const laborHours = pickers * shiftHours * (secondShift ? 2 : 1);
  const capacityUnits = Math.round(laborHours * unitsPerLaborHour * (secondShift ? 0.92 : 1));

  // The book is whatever the clock says is still waiting to be packed.
  const limit = live?.queueUnits;
  const queue: ScheduledOrder[] = [];
  let taken = 0;
  for (const o of sorted) {
    if (limit !== undefined && taken >= limit) break;
    queue.push({ ...o, shipDay: 0, atRisk: false, slack: 0 });
    taken += o.units;
  }

  let cum = 0;
  let atRisk = 0;
  let atRiskValue = 0;
  const byDayMap = new Map<number, number>();
  for (const o of queue) {
    cum += o.units;
    const shipDay = Math.max(1, Math.ceil(cum / Math.max(1, capacityUnits)));
    o.shipDay = shipDay;
    o.slack = o.promiseInDays - shipDay;
    o.atRisk = shipDay > o.promiseInDays;
    if (o.atRisk) {
      atRisk++;
      atRiskValue += o.value;
    }
    byDayMap.set(shipDay, (byDayMap.get(shipDay) ?? 0) + 1);
  }

  const openUnits = cum;
  const openOrders = queue.length;
  const avgUnits = openUnits / Math.max(1, openOrders);

  // Daily inflow of new work, in units.
  const baseInflowUnits = PRODUCTS.reduce((n, p) => n + p.velocity, 0) * s.demandMultiplier;
  const inflowUnits = viral
    ? baseInflowUnits * ASSUMPTIONS.haloMultiplier + SURGE_BOOK.reduce((n, o) => n + o.units, 0)
    : baseInflowUnits;

  const utilization = inflowUnits / Math.max(1, capacityUnits);
  const backlogDays = openUnits / Math.max(1, capacityUnits);
  const shippedToday = Math.min(openOrders, Math.round(capacityUnits / Math.max(1, avgUnits)));
  const laborCostDay = Math.round(laborHours * ASSUMPTIONS.laborRate);
  const costPerOrder =
    Math.round(
      ((laborCostDay + ASSUMPTIONS.fixedOverheadDay) / Math.max(1, shippedToday) +
        ASSUMPTIONS.packagingPerOrder) *
        100,
    ) / 100;

  const byDay = Array.from({ length: 6 }, (_, i) => ({
    day: i + 1,
    orders: byDayMap.get(i + 1) ?? 0,
  }));
  const beyond = [...byDayMap.entries()].reduce((n, [d, c]) => (d > 6 ? n + c : n), 0);
  byDay[5].orders += beyond;

  const riskShare = atRisk / Math.max(1, openOrders);
  const status: WorldStatus =
    riskShare > 0.18 || backlogDays > 2.2 ? "critical" : riskShare > 0.06 || backlogDays > 1.6 ? "watch" : "healthy";

  return {
    openOrders,
    openUnits,
    surgeOrders: viral ? SURGE_BOOK.length : 0,
    capacityPerDay: Math.round(capacityUnits / Math.max(1, avgUnits)),
    capacityUnits,
    utilization,
    backlogDays,
    atRisk,
    atRiskValue,
    shippedToday,
    onTimeRate: 1 - riskShare,
    queue,
    byDay,
    costPerOrder,
    laborCostDay,
    status,
  };
}

/* ── Inventory ───────────────────────────────────────────────────── */

function trendFor(id: string, viral: boolean, hero: boolean) {
  const rand = rng(id.length * 7919 + id.charCodeAt(0) * 131);
  const out: number[] = [];
  for (let i = 0; i < 14; i++) out.push(0.78 + rand() * 0.42);
  if (viral) {
    const lift = hero ? ASSUMPTIONS.heroSpikeMultiplier : ASSUMPTIONS.haloMultiplier;
    out[12] = out[12] * (1 + (lift - 1) * 0.35);
    out[13] = out[13] * lift;
  }
  return out;
}

function deriveInventory(s: SimState, live?: LiveState): InventoryMetrics {
  const depleted = s.scenario === "viral" && s.viralStage >= 2;
  const noticed = s.scenario === "viral" && s.viralStage >= 3;

  const items: ProductMetrics[] = PRODUCTS.map((product) => {
    const hero = !!product.hero;
    const spike = depleted ? (hero ? ASSUMPTIONS.heroSpikeMultiplier : ASSUMPTIONS.haloMultiplier) : 1;
    const effVelocity = Math.round(product.velocity * s.demandMultiplier * spike);
    const unitsSoldToday = effVelocity;

    // Units that have actually left the building, tracked by the clock.
    const consumed = live?.sold
      ? live.sold[product.id] ?? 0
      : depleted
        ? SURGE_UNITS[product.id] ?? 0
        : 0;
    const onHandEff = Math.max(
      0,
      product.onHand - consumed + (live?.received?.[product.id] ?? 0),
    );
    const leadTime = Math.max(7, product.leadTimeDays + s.leadTimeAdj);

    const inboundUsable = product.inbound;
    const stockoutInDays = (onHandEff + inboundUsable) / Math.max(1, effVelocity);
    const daysOfStock = onHandEff / Math.max(1, effVelocity);

    // Forward planning velocity: the planner does not assume a spike lasts forever.
    const planSpike = depleted
      ? hero
        ? ASSUMPTIONS.spikeSettleMultiplier
        : ASSUMPTIONS.haloMultiplier
      : 1;
    const planVelocity = product.velocity * s.demandMultiplier * planSpike;
    const target = planVelocity * (leadTime + s.coverDays);
    const rawReorder = target - onHandEff - inboundUsable;
    const suggestedReorder =
      rawReorder > 0 ? Math.ceil(rawReorder / product.casePack) * product.casePack : 0;

    const risk: ProductMetrics["risk"] =
      stockoutInDays < leadTime ? "critical" : stockoutInDays < leadTime + s.coverDays ? "watch" : "healthy";

    return {
      product,
      effVelocity,
      planVelocity: Math.round(planVelocity),
      onHandEff,
      unitsSoldToday,
      daysOfStock,
      weeksCover: stockoutInDays / 7,
      leadTime,
      stockoutInDays,
      risk,
      suggestedReorder,
      revenue7d: Math.round(effVelocity * 7 * product.price),
      sellThrough:
        (effVelocity * 7) / Math.max(1, onHandEff + inboundUsable + effVelocity * 7),
      trend: trendFor(product.id, depleted, hero),
    };
  });

  const critical = items.filter((i) => i.risk === "critical").sort((a, b) => a.stockoutInDays - b.stockoutInDays);
  const watch = items.filter((i) => i.risk === "watch").sort((a, b) => a.stockoutInDays - b.stockoutInDays);

  const stagedUnits = Object.values(s.staged).reduce((n, q) => n + q, 0);
  const stagedCost = Object.entries(s.staged).reduce((n, [id, q]) => {
    const p = PRODUCTS.find((x) => x.id === id);
    return n + (p ? p.cost * q : 0);
  }, 0);

  const status: WorldStatus = critical.length > 0 ? (noticed ? "critical" : "watch") : watch.length >= 3 ? "watch" : "healthy";

  return {
    items,
    critical,
    watch,
    skuCount: items.length,
    unitsOnHand: items.reduce((n, i) => n + i.onHandEff, 0),
    retailValue: items.reduce((n, i) => n + i.onHandEff * i.product.price, 0),
    atRiskRevenue: critical.reduce(
      (n, i) => n + Math.max(0, i.leadTime - i.stockoutInDays) * i.planVelocity * i.product.price,
      0,
    ),
    openToBuy: ASSUMPTIONS.openToBuy,
    stagedUnits,
    stagedCost,
    status,
  };
}

/* ── Boutique ────────────────────────────────────────────────────── */

function deriveBoutique(s: SimState, inv: InventoryMetrics, ful: FulfillmentMetrics): BoutiqueMetrics {
  const traffic = s.scenario === "viral" && s.viralStage >= 1;
  const inquiryWave = s.scenario === "viral" && s.viralStage >= 4;
  // A customer-service surge: question volume spikes without a sales spike.
  const serviceSurge = s.scenario === "service-surge";

  const sessions = Math.round(
    ASSUMPTIONS.baseSessions *
      s.demandMultiplier *
      (traffic ? ASSUMPTIONS.sessionSpike : serviceSurge ? 1.25 : 1),
  );
  const unitsToday = inv.items.reduce((n, i) => n + i.unitsSoldToday, 0);
  const revenueToday = inv.items.reduce((n, i) => n + i.unitsSoldToday * i.product.price, 0);
  const avgUnits = ful.openUnits / Math.max(1, ful.openOrders);
  const ordersToday = Math.round(unitsToday / Math.max(1, avgUnits));
  const conversion = ordersToday / Math.max(1, sessions);

  const availability: BoutiqueMetrics["availability"] = {};
  for (const i of inv.items) {
    availability[i.product.id] =
      i.onHandEff <= 0
        ? "Waitlist"
        : i.risk === "critical" || i.daysOfStock < 10
          ? "Low stock"
          : "In stock";
  }

  const top = inv.items.slice().sort((a, b) => b.unitsSoldToday * b.product.price - a.unitsSoldToday * a.product.price)[0];

  const lowStock = Object.values(availability).some((a) => a !== "In stock");
  const status: WorldStatus =
    inquiryWave || serviceSurge || lowStock || ful.status === "critical" ? "watch" : "healthy";

  return {
    sessions,
    conversion,
    ordersToday,
    aov: revenueToday / Math.max(1, ordersToday),
    revenueToday,
    inquiries: Math.round(
      ASSUMPTIONS.baseInquiries *
        s.demandMultiplier *
        (inquiryWave || serviceSurge ? ASSUMPTIONS.inquirySpike : traffic ? 1.5 : 1),
    ),
    topProduct: top,
    availability,
    status,
  };
}

/* ── Public entry point ──────────────────────────────────────────── */

export function derive(s: SimState, live?: LiveState): Metrics {
  const fulfillment = deriveFulfillment(s, live);
  const inventory = deriveInventory(s, live);
  const boutique = deriveBoutique(s, inventory, fulfillment);
  return { fulfillment, inventory, boutique };
}

/** Shipping promise the concierge is allowed to quote, from the live plan. */
export function shipWindow(ful: FulfillmentMetrics) {
  const lo = Math.max(1, Math.round(ful.backlogDays));
  const hi = lo + (ful.status === "critical" ? 2 : 1);
  return { lo, hi, label: lo === hi ? `${lo} business day` : `${lo}–${hi} business days` };
}
