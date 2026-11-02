"use client";

import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { DEFAULT_STATE, SURGE_UNITS, derive, type LiveState } from "./sim";
import {
  TICK_MS,
  initialFlow,
  stepFlow,
  type DistrictEvent,
  type FlowState,
  type FocusKey,
  type NewEvent,
} from "./engine";
import { n } from "./fmt";
import type { AgentId, BuildingId, Metrics, SimState, Staffing } from "./types";

export type Phase = "arrival" | "district" | "building";

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  /** data references the answer was computed from */
  refs?: string[];
  /** product ids to render as cards beneath the message */
  products?: string[];
  /** demo order id to render as a status card */
  order?: string;
  pending?: boolean;
}

interface UIState {
  phase: Phase;
  hovered: BuildingId | null;
  focus: BuildingId | null;
  openAgent: AgentId | null;
  openProduct: string | null;
  /** the world object the user clicked into */
  inspecting: FocusKey | null;
  timelineOpen: boolean;
  events: DistrictEvent[];
  threads: Record<AgentId, ChatMessage[]>;
  running: boolean;
  runToken: number;
  toast: { id: string; title: string; detail: string; tone: DistrictEvent["tone"] } | null;
}

interface Actions {
  enter: () => void;
  focusBuilding: (b: BuildingId | null) => void;
  setHovered: (b: BuildingId | null) => void;
  openAgentPanel: (a: AgentId | null) => void;
  openProductPanel: (id: string | null) => void;
  inspectObject: (k: FocusKey | null) => void;
  toggleTimeline: () => void;
  setStaffing: (p: Partial<Staffing>) => void;
  setDemand: (v: number) => void;
  setCover: (v: number) => void;
  setLeadAdj: (v: number) => void;
  stageReorder: (productId: string, qty: number) => void;
  clearStaged: () => void;
  runViralDrop: () => void;
  resetSimulation: () => void;
  tick: () => void;
  pushMessage: (a: AgentId, m: ChatMessage) => void;
  replaceLastMessage: (a: AgentId, m: ChatMessage) => void;
  clearThread: (a: AgentId) => void;
  noteAgentQuery: (a: AgentId, question: string) => void;
  dismissToast: () => void;
}

export type Store = SimState &
  UIState &
  Actions & { metrics: Metrics; flow: FlowState; eventSeq: number };

const emptyThreads = (): Record<AgentId, ChatMessage[]> => ({
  analyst: [],
  strategist: [],
  concierge: [],
});

const liveOf = (f: FlowState): LiveState => ({ queueUnits: f.queueUnits, sold: f.sold });

const BOOT_METRICS = derive(DEFAULT_STATE);
const BOOT_FLOW = initialFlow(BOOT_METRICS.fulfillment.openUnits);

const INITIAL_UI: UIState = {
  phase: "arrival",
  hovered: null,
  focus: null,
  openAgent: null,
  openProduct: null,
  inspecting: null,
  timelineOpen: false,
  events: [],
  threads: emptyThreads(),
  running: false,
  runToken: 0,
  toast: null,
};

/* ── Viral drop choreography ─────────────────────────────────────── */

const STAGE_COPY: Omit<NewEvent, "minute">[] = [
  {
    kind: "scenario.stage",
    building: "boutique",
    agent: "concierge",
    title: "Demand spike on the Soleil Mini",
    detail:
      "Boutique sessions up 4.2×. The champagne Soleil Mini Shoulder is being added to carts faster than any style this quarter.",
    why: "A simulated social moment. Traffic to the boutique multiplies — that is the only thing that has changed so far. Nothing downstream has reacted yet.",
    tone: "info",
    focus: "floor",
  },
  {
    kind: "scenario.stage",
    building: "fulfillment",
    agent: "analyst",
    title: "2,900 orders landed in the queue",
    detail:
      "The surge converted. Those orders are now sequenced in the pick queue and the pile at the packing stations has jumped.",
    why: "Boutique traffic converts into orders, and orders become units in the queue. Pack capacity has not changed, so the backlog is now several days deep.",
    tone: "alert",
    focus: "queue",
  },
  {
    kind: "scenario.stage",
    building: "atelier",
    agent: "strategist",
    title: "Soleil Mini will sell through in days",
    detail:
      "Units leaving the floor come out of racking. The Inventory Strategist flagged a stockout well before replenishment can land.",
    why: "Every unit packed next door reduces on-hand stock here. At the spike rate, cover fell below the 34-day supplier lead time — a gap with nothing to sell.",
    tone: "alert",
    focus: "trendwall",
  },
  {
    kind: "scenario.stage",
    building: "boutique",
    agent: "concierge",
    title: "Availability questions up 3.6×",
    detail:
      "The concierge switched the Soleil Mini to low-stock language and is quoting the updated ship window from the live pick plan.",
    why: "Clients ask about what is scarce. The concierge reads the same inventory the Atelier plans against and the same queue the warehouse is working, so its answers moved on their own.",
    tone: "watch",
    focus: "vitrine",
  },
];

const STAGE_DELAYS = [0, 3000, 6200, 9200];

/** Units the surge injects — the same book the dashboards sequence. */
const SURGE_TOTAL_UNITS = Object.values(SURGE_UNITS).reduce((a, b) => a + b, 0);

export const useStore = create<Store>()((set, get) => ({
  ...DEFAULT_STATE,
  ...INITIAL_UI,
  metrics: BOOT_METRICS,
  flow: BOOT_FLOW,
  eventSeq: 0,

  /* ── navigation ────────────────────────────────────────────── */

  enter: () => set({ phase: "district" }),

  focusBuilding: (b) =>
    set((s) => ({
      focus: b,
      phase: b ? "building" : "district",
      hovered: null,
      openAgent: b ? s.openAgent : null,
      openProduct: null,
      inspecting: b ? s.inspecting : null,
    })),

  setHovered: (b) => set({ hovered: b }),
  openAgentPanel: (a) => set((s) => ({ openAgent: a, inspecting: a ? null : s.inspecting })),
  openProductPanel: (id) => set({ openProduct: id }),
  inspectObject: (k) => set((s) => ({ inspecting: k, openAgent: k ? null : s.openAgent })),
  toggleTimeline: () => set((s) => ({ timelineOpen: !s.timelineOpen })),

  /* ── the clock ─────────────────────────────────────────────── */

  tick: () =>
    set((s) => {
      const sim = simOf(s);
      const { flow, events } = stepFlow(s.flow, sim, s.metrics);
      const metrics = derive(sim, liveOf(flow));

      if (!events.length) return { flow, metrics };

      let seq = s.eventSeq;
      const added: DistrictEvent[] = events.map((e) => ({ ...e, id: `e${++seq}` }));
      return {
        flow,
        metrics,
        eventSeq: seq,
        events: [...added.reverse(), ...s.events].slice(0, 80),
      };
    }),

  /* ── controls ──────────────────────────────────────────────── */

  setStaffing: (p) =>
    set((s) => {
      const staffing = { ...s.staffing, ...p };
      const metrics = derive({ ...simOf(s), staffing }, liveOf(s.flow));
      const before = s.metrics.fulfillment.capacityUnits;
      const after = metrics.fulfillment.capacityUnits;
      if (before === after) return { staffing, metrics };

      const seq = s.eventSeq + 1;
      const up = after > before;
      const ev: DistrictEvent = {
        id: `e${seq}`,
        minute: s.flow.minute,
        kind: "staffing.changed",
        building: "fulfillment",
        agent: "analyst",
        title: up ? "Capacity increased" : "Capacity reduced",
        detail: `The floor now turns ${n(after)} units a day instead of ${n(before)} — ${staffing.pickers} associates × ${staffing.shiftHours}h${staffing.secondShift ? " × 2 shifts" : ""}.`,
        why: up
          ? `More capacity drains the queue faster, so loads complete sooner and vans leave more often. At-risk orders move to ${n(metrics.fulfillment.atRisk)}.`
          : `Less capacity means the pile at the stations grows. At-risk orders move to ${n(metrics.fulfillment.atRisk)}.`,
        tone: up ? "good" : "watch",
        magnitude: Math.abs(after - before),
        focus: "packline",
      };
      return { staffing, metrics, eventSeq: seq, events: [ev, ...s.events].slice(0, 80) };
    }),

  setDemand: (v) =>
    set((s) => ({
      demandMultiplier: v,
      metrics: derive({ ...simOf(s), demandMultiplier: v }, liveOf(s.flow)),
    })),

  setCover: (v) =>
    set((s) => ({ coverDays: v, metrics: derive({ ...simOf(s), coverDays: v }, liveOf(s.flow)) })),

  setLeadAdj: (v) =>
    set((s) => ({ leadTimeAdj: v, metrics: derive({ ...simOf(s), leadTimeAdj: v }, liveOf(s.flow)) })),

  stageReorder: (productId, qty) =>
    set((s) => {
      const staged = { ...s.staged };
      if (qty <= 0) delete staged[productId];
      else staged[productId] = qty;
      const metrics = derive({ ...simOf(s), staged }, liveOf(s.flow));
      if (qty <= 0) return { staged, metrics };

      const item = metrics.inventory.items.find((i) => i.product.id === productId);
      const seq = s.eventSeq + 1;
      const cost = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(qty * (item?.product.cost ?? 0));
      const ev: DistrictEvent = {
        id: `e${seq}`,
        minute: s.flow.minute,
        kind: "reorder.staged",
        building: "atelier",
        agent: "strategist",
        title: `${n(qty)} units of ${item?.product.name ?? productId} staged`,
        detail: `A reorder scenario worth ${cost} was added to the buy.`,
        why: `Sized to the ${item?.leadTime ?? 0}-day lead time plus ${s.coverDays} days of cover at planning velocity — not at today's spike rate. Simulated planning scenario only.`,
        tone: "info",
        magnitude: qty,
        focus: "samples",
      };
      return { staged, metrics, eventSeq: seq, events: [ev, ...s.events].slice(0, 80) };
    }),

  clearStaged: () =>
    set((s) => ({ staged: {}, metrics: derive({ ...simOf(s), staged: {} }, liveOf(s.flow)) })),

  /* ── the hero scenario ─────────────────────────────────────── */

  runViralDrop: () => {
    const token = get().runToken + 1;
    set({ runToken: token, running: true, scenario: "viral", viralStage: 0, toast: null });

    STAGE_COPY.forEach((copy, i) => {
      window.setTimeout(() => {
        if (get().runToken !== token) return;
        const stage = i + 1;
        set((s) => {
          const sim: SimState = { ...simOf(s), scenario: "viral", viralStage: stage };

          // Stage two is the only stage that moves physical state: the surge
          // book lands in the queue, and its units come out of racking.
          const flow: FlowState =
            stage === 2
              ? { ...s.flow, queueUnits: s.flow.queueUnits + SURGE_TOTAL_UNITS }
              : s.flow;

          const seq = s.eventSeq + 1;
          const ev: DistrictEvent = { ...copy, id: `e${seq}`, minute: flow.minute };
          return {
            viralStage: stage,
            flow,
            metrics: derive(sim, liveOf(flow)),
            eventSeq: seq,
            events: [ev, ...s.events].slice(0, 80),
            toast: { id: ev.id, title: ev.title, detail: ev.detail, tone: ev.tone },
            running: i < STAGE_COPY.length - 1,
          };
        });
      }, STAGE_DELAYS[i]);
    });
  },

  resetSimulation: () =>
    set((s) => {
      const metrics = derive(DEFAULT_STATE);
      return {
        ...DEFAULT_STATE,
        runToken: s.runToken + 1,
        running: false,
        events: [],
        eventSeq: 0,
        toast: null,
        threads: emptyThreads(),
        openProduct: null,
        inspecting: null,
        metrics,
        flow: initialFlow(metrics.fulfillment.openUnits),
      };
    }),

  /* ── conversations ─────────────────────────────────────────── */

  pushMessage: (a, m) => set((s) => ({ threads: { ...s.threads, [a]: [...s.threads[a], m] } })),

  replaceLastMessage: (a, m) =>
    set((s) => {
      const t = s.threads[a].slice();
      t[t.length - 1] = m;
      return { threads: { ...s.threads, [a]: t } };
    }),

  clearThread: (a) => set((s) => ({ threads: { ...s.threads, [a]: [] } })),

  /** A real question to an agent is itself an event in the district. */
  noteAgentQuery: (a, question) =>
    set((s) => {
      const seq = s.eventSeq + 1;
      const building: BuildingId =
        a === "analyst" ? "fulfillment" : a === "strategist" ? "atelier" : "boutique";
      const ev: DistrictEvent = {
        id: `e${seq}`,
        minute: s.flow.minute,
        kind: a === "concierge" ? "client.conversations" : "agent.query",
        building,
        agent: a,
        title: a === "concierge" ? "Client conversation opened" : "Question put to the agent",
        detail: question.length > 90 ? `${question.slice(0, 88)}…` : question,
        why: "Answered from the live simulated state — the same figures shown on this building's workspace.",
        tone: "info",
        focus: a === "concierge" ? "floor" : a === "analyst" ? "packline" : "trendwall",
      };
      return {
        eventSeq: seq,
        events: [ev, ...s.events].slice(0, 80),
        flow: { ...s.flow, conversationsToday: s.flow.conversationsToday + 1 },
      };
    }),

  dismissToast: () => set({ toast: null }),
}));

const simOf = (s: SimState): SimState => ({
  scenario: s.scenario,
  viralStage: s.viralStage,
  demandMultiplier: s.demandMultiplier,
  coverDays: s.coverDays,
  staffing: s.staffing,
  leadTimeAdj: s.leadTimeAdj,
  staged: s.staged,
});

/* ── The clock driver ────────────────────────────────────────────
   The district runs from the moment the module loads in the browser,
   so the world is already alive when the visitor arrives.
   ───────────────────────────────────────────────────────────────── */

const CLOCK_HANDLE = "__glamDistrictClock";

export function startClock() {
  if (typeof window === "undefined") return;
  const w = window as unknown as Record<string, number | undefined>;
  if (w[CLOCK_HANDLE] !== undefined) window.clearInterval(w[CLOCK_HANDLE]);
  // Background tabs throttle intervals on their own; the clock keeps the
  // district consistent rather than freezing it whenever focus moves away.
  w[CLOCK_HANDLE] = window.setInterval(() => useStore.getState().tick(), TICK_MS);
}

export function stopClock() {
  if (typeof window === "undefined") return;
  const w = window as unknown as Record<string, number | undefined>;
  if (w[CLOCK_HANDLE] !== undefined) {
    window.clearInterval(w[CLOCK_HANDLE]);
    w[CLOCK_HANDLE] = undefined;
  }
}

startClock();

/* ── Selectors ───────────────────────────────────────────────────── */

export const useMetrics = () => useStore((s) => s.metrics);

export const useSim = (): SimState =>
  useStore(
    useShallow((s) => ({
      scenario: s.scenario,
      viralStage: s.viralStage,
      demandMultiplier: s.demandMultiplier,
      coverDays: s.coverDays,
      staffing: s.staffing,
      leadTimeAdj: s.leadTimeAdj,
      staged: s.staged,
    })),
  );

export const currentSim = (): SimState => simOf(useStore.getState());
export const currentLive = (): LiveState => liveOf(useStore.getState().flow);

/** Hypothetical re-derive without committing to the store — used by agents. */
export function whatIf(patch: Partial<SimState>): Metrics {
  const base = currentSim();
  return derive(
    { ...base, ...patch, staffing: { ...base.staffing, ...patch.staffing } },
    currentLive(),
  );
}
