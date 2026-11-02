export type BuildingId = "fulfillment" | "atelier" | "boutique";
export type AgentId = "analyst" | "strategist" | "concierge";

export type AgentStatus =
  | "Monitoring"
  | "Analyzing"
  | "Planning"
  | "Needs review"
  | "Completed";

export type Category = "Handbag" | "Crossbody" | "Clutch" | "Tote" | "Accessory";

export interface Product {
  id: string;
  name: string;
  line: string;
  category: Category;
  colorway: string;
  /** hex used for both the product card swatch and the miniature 3D display */
  hex: string;
  price: number;
  /** fictional landed unit cost */
  cost: number;
  onHand: number;
  inbound: number;
  inboundEta: number; // days
  leadTimeDays: number;
  casePack: number;
  /** baseline units sold per day */
  velocity: number;
  rating: number;
  reviews: number;
  tags: string[];
  blurb: string;
  hero?: boolean;
}

export type OrderTier = "Standard" | "Express" | "VIP";

export interface OrderLine {
  productId: string;
  qty: number;
}

export interface Order {
  id: string;
  customer: string;
  city: string;
  state: string;
  tier: OrderTier;
  lines: OrderLine[];
  units: number;
  value: number;
  /** days from today the order is promised to ship by */
  promiseInDays: number;
  placedHoursAgo: number;
  surge?: boolean;
}

/** An order enriched with the scheduling result of the current plan. */
export interface ScheduledOrder extends Order {
  /** 1-indexed day the order ships under current capacity */
  shipDay: number;
  atRisk: boolean;
  slack: number;
}

export interface Staffing {
  pickers: number;
  shiftHours: number;
  unitsPerLaborHour: number;
  secondShift: boolean;
}

export type Scenario = "baseline" | "viral" | "inventory-risk" | "service-surge";

/** How the pick queue is sequenced — a plannable lever, not a constant. */
export type PriorityPolicy = "promise-first" | "value-first" | "express-first";

/** Reviewable concierge playbook — narrative only, no numeric derive impact. */
export type ConciergePlaybook = "standard" | "protect-promise" | "waitlist-first";

export interface SimState {
  scenario: Scenario;
  /** 0 = not running · 1 boutique · 2 fulfillment · 3 atelier · 4 concierge */
  viralStage: number;
  /** global demand assumption, 0.6 – 2.5 */
  demandMultiplier: number;
  /** days of forward cover the buying team wants to hold */
  coverDays: number;
  staffing: Staffing;
  /** supplier lead-time assumption override in days */
  leadTimeAdj: number;
  /** product ids the planner has staged a reorder for */
  staged: Record<string, number>;
  priorityPolicy: PriorityPolicy;
  conciergePlaybook: ConciergePlaybook;
}

export interface ProductMetrics {
  product: Product;
  effVelocity: number;
  /** forward velocity used for buy planning (assumes a spike settles) */
  planVelocity: number;
  onHandEff: number;
  unitsSoldToday: number;
  daysOfStock: number;
  weeksCover: number;
  leadTime: number;
  stockoutInDays: number;
  risk: "healthy" | "watch" | "critical";
  suggestedReorder: number;
  revenue7d: number;
  sellThrough: number;
  trend: number[];
}

export interface FulfillmentMetrics {
  openOrders: number;
  openUnits: number;
  surgeOrders: number;
  capacityPerDay: number;
  capacityUnits: number;
  utilization: number;
  backlogDays: number;
  atRisk: number;
  atRiskValue: number;
  shippedToday: number;
  onTimeRate: number;
  queue: ScheduledOrder[];
  byDay: { day: number; orders: number }[];
  costPerOrder: number;
  laborCostDay: number;
  status: WorldStatus;
}

export interface InventoryMetrics {
  items: ProductMetrics[];
  critical: ProductMetrics[];
  watch: ProductMetrics[];
  skuCount: number;
  unitsOnHand: number;
  retailValue: number;
  atRiskRevenue: number;
  openToBuy: number;
  stagedUnits: number;
  stagedCost: number;
  status: WorldStatus;
}

export interface BoutiqueMetrics {
  sessions: number;
  conversion: number;
  ordersToday: number;
  aov: number;
  revenueToday: number;
  inquiries: number;
  topProduct: ProductMetrics;
  availability: Record<string, "In stock" | "Low stock" | "Waitlist">;
  status: WorldStatus;
}

export type WorldStatus = "healthy" | "watch" | "critical";

export interface Metrics {
  fulfillment: FulfillmentMetrics;
  inventory: InventoryMetrics;
  boutique: BoutiqueMetrics;
}

export interface DemoOrder {
  id: string;
  customer: string;
  placed: string;
  items: { productId: string; qty: number }[];
  state: "Preparing" | "Packed" | "In transit" | "Delivered";
  carrier: string;
  tracking: string;
  eta: string;
}
