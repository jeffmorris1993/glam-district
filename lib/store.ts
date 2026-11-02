"use client";

import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { DEFAULT_STATE, derive } from "./sim";
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

export interface WorldEvent {
  id: string;
  stage: number;
  building: BuildingId;
  agent: AgentId;
  title: string;
  detail: string;
  tone: "info" | "watch" | "alert";
}

interface UIState {
  phase: Phase;
  hovered: BuildingId | null;
  focus: BuildingId | null;
  openAgent: AgentId | null;
  /** boutique product detail */
  openProduct: string | null;
  events: WorldEvent[];
  threads: Record<AgentId, ChatMessage[]>;
  running: boolean;
  /** monotonic token so late timers from a cancelled run are ignored */
  runToken: number;
  toast: { id: string; title: string; detail: string; tone: WorldEvent["tone"] } | null;
}

interface Actions {
  enter: () => void;
  focusBuilding: (b: BuildingId | null) => void;
  setHovered: (b: BuildingId | null) => void;
  openAgentPanel: (a: AgentId | null) => void;
  openProductPanel: (id: string | null) => void;
  setStaffing: (p: Partial<Staffing>) => void;
  setDemand: (n: number) => void;
  setCover: (n: number) => void;
  setLeadAdj: (n: number) => void;
  stageReorder: (productId: string, qty: number) => void;
  clearStaged: () => void;
  runViralDrop: () => void;
  resetSimulation: () => void;
  pushMessage: (a: AgentId, m: ChatMessage) => void;
  replaceLastMessage: (a: AgentId, m: ChatMessage) => void;
  clearThread: (a: AgentId) => void;
  dismissToast: () => void;
}

export type Store = SimState & UIState & Actions & { metrics: Metrics };

const emptyThreads = (): Record<AgentId, ChatMessage[]> => ({
  analyst: [],
  strategist: [],
  concierge: [],
});

const INITIAL_UI: UIState = {
  phase: "arrival",
  hovered: null,
  focus: null,
  openAgent: null,
  openProduct: null,
  events: [],
  threads: emptyThreads(),
  running: false,
  runToken: 0,
  toast: null,
};

/* ── Viral drop choreography ─────────────────────────────────────── */

const STAGE_EVENTS: Omit<WorldEvent, "id">[] = [
  {
    stage: 1,
    building: "boutique",
    agent: "concierge",
    title: "Demand spike on the Soleil Mini",
    detail:
      "Boutique sessions up 4.2×. The champagne Soleil Mini Shoulder is being added to carts faster than any style this quarter.",
    tone: "info",
  },
  {
    stage: 2,
    building: "fulfillment",
    agent: "analyst",
    title: "2,900 orders landed in the queue",
    detail:
      "The Fulfillment Analyst re-ran the pick plan. At 14 associates the book now takes 3.8 days to clear — 2,254 orders will miss their promise.",
    tone: "alert",
  },
  {
    stage: 3,
    building: "atelier",
    agent: "strategist",
    title: "Soleil Mini will sell through in 3 days",
    detail:
      "The Inventory Strategist flagged a stockout 31 days before replenishment can land. A reorder scenario is staged for review.",
    tone: "alert",
  },
  {
    stage: 4,
    building: "boutique",
    agent: "concierge",
    title: "Availability questions up 3.6×",
    detail:
      "The Glam Concierge switched the Soleil Mini to low-stock language and is quoting the updated ship window from the live pick plan.",
    tone: "watch",
  },
];

const STAGE_DELAYS = [0, 2600, 5400, 8000];

export const useStore = create<Store>()((set, get) => ({
  ...DEFAULT_STATE,
  ...INITIAL_UI,
  metrics: derive(DEFAULT_STATE),

  enter: () => set({ phase: "district" }),

  focusBuilding: (b) =>
    set((s) => ({
      focus: b,
      phase: b ? "building" : "district",
      hovered: null,
      openAgent: b ? s.openAgent : null,
      openProduct: null,
    })),

  setHovered: (b) => set({ hovered: b }),
  openAgentPanel: (a) => set({ openAgent: a }),
  openProductPanel: (id) => set({ openProduct: id }),

  setStaffing: (p) =>
    set((s) => {
      const next = { ...s, staffing: { ...s.staffing, ...p } };
      return { staffing: next.staffing, metrics: derive(next) };
    }),

  setDemand: (n) =>
    set((s) => {
      const next = { ...s, demandMultiplier: n };
      return { demandMultiplier: n, metrics: derive(next) };
    }),

  setCover: (n) =>
    set((s) => {
      const next = { ...s, coverDays: n };
      return { coverDays: n, metrics: derive(next) };
    }),

  setLeadAdj: (n) =>
    set((s) => {
      const next = { ...s, leadTimeAdj: n };
      return { leadTimeAdj: n, metrics: derive(next) };
    }),

  stageReorder: (productId, qty) =>
    set((s) => {
      const staged = { ...s.staged };
      if (qty <= 0) delete staged[productId];
      else staged[productId] = qty;
      const next = { ...s, staged };
      return { staged, metrics: derive(next) };
    }),

  clearStaged: () =>
    set((s) => {
      const next = { ...s, staged: {} };
      return { staged: {}, metrics: derive(next) };
    }),

  runViralDrop: () => {
    const token = get().runToken + 1;
    set((s) => ({
      runToken: token,
      running: true,
      scenario: "viral",
      viralStage: 0,
      events: [],
      toast: null,
      metrics: derive({ ...s, scenario: "viral", viralStage: 0 }),
    }));

    STAGE_EVENTS.forEach((ev, i) => {
      window.setTimeout(() => {
        if (get().runToken !== token) return;
        const stage = ev.stage;
        set((s) => {
          const next: SimState = { ...s, scenario: "viral", viralStage: stage };
          const event: WorldEvent = { ...ev, id: `${token}-${stage}` };
          return {
            viralStage: stage,
            events: [...s.events, event],
            toast: { id: event.id, title: ev.title, detail: ev.detail, tone: ev.tone },
            metrics: derive(next),
            running: i < STAGE_EVENTS.length - 1,
          };
        });
      }, STAGE_DELAYS[i]);
    });
  },

  resetSimulation: () =>
    set((s) => ({
      ...DEFAULT_STATE,
      runToken: s.runToken + 1,
      running: false,
      events: [],
      toast: null,
      threads: emptyThreads(),
      openProduct: null,
      metrics: derive(DEFAULT_STATE),
    })),

  pushMessage: (a, m) =>
    set((s) => ({ threads: { ...s.threads, [a]: [...s.threads[a], m] } })),

  replaceLastMessage: (a, m) =>
    set((s) => {
      const t = s.threads[a].slice();
      t[t.length - 1] = m;
      return { threads: { ...s.threads, [a]: t } };
    }),

  clearThread: (a) => set((s) => ({ threads: { ...s.threads, [a]: [] } })),

  dismissToast: () => set({ toast: null }),
}));

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

/** Hypothetical re-derive without committing to the store — used by agents. */
export function whatIf(patch: Partial<SimState>): Metrics {
  const s = useStore.getState();
  const base: SimState = {
    scenario: s.scenario,
    viralStage: s.viralStage,
    demandMultiplier: s.demandMultiplier,
    coverDays: s.coverDays,
    staffing: s.staffing,
    leadTimeAdj: s.leadTimeAdj,
    staged: s.staged,
  };
  return derive({ ...base, ...patch, staffing: { ...base.staffing, ...patch.staffing } });
}
