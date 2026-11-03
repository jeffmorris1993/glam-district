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
import { presetById, type PresetId } from "./presets";
import {
  detectSituations,
  optionsFor,
  type NewScenario,
  type ScenarioDraft,
  type Situation,
} from "./scenarios";
import { byId } from "./catalog";
import type { AgentId, BuildingId, Metrics, SimState } from "./types";

export type Phase = "arrival" | "district" | "building";
export type Mode = "observe" | "interact" | "present";

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
  /** which experience is active — observe (TV wall) / interact / present */
  mode: Mode;
  /** simulation clock control — the interval always runs; tick() gates */
  clock: { paused: boolean; speed: 1 | 2 };
  /** when false, the presenter advances viral-drop stages by hand */
  scenarioAuto: boolean;
  /** when true, newly detected situations stay hidden until the presenter reveals them */
  holdSituations: boolean;
  /** the last scenario preset applied — drives the presenter bar's active pill */
  activePreset: PresetId;
  actionCenterOpen: boolean;

  /** conditions the district has crossed into, awaiting a decision */
  situations: (Situation & { revealed: boolean })[];
  /** dedupe + dismissed-cooldown log, keyed by situation key */
  situationLog: Record<string, { status: "open" | "dismissed"; minute: number }>;
  sinceSituationScan: number;

  /** the Scenario Lab — drafts only; nothing here touches live state */
  lab: {
    open: boolean;
    building: BuildingId | null;
    situationKey: string | null;
    scenarios: ScenarioDraft[];
    activeId: string | null;
    compareIds: string[];
  };
  labSeq: number;
  /** Observe-mode camera pull toward where something just happened */
  attention: { building: BuildingId; until: number } | null;
  /** real-clock ms before the next attention pull may fire */
  attentionCoolUntil: number;
  /** applied plans, newest first — the durable decision record */
  appliedPlans: AppliedPlan[];
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
  setMode: (m: Mode) => void;
  pauseClock: () => void;
  resumeClock: () => void;
  setSpeed: (v: 1 | 2) => void;
  /** advance exactly one tick, even while paused */
  stepOnce: () => void;
  setScenarioAuto: (v: boolean) => void;
  /** step the armed viral drop forward one stage (presenter + timeouts both call this) */
  advanceScenario: () => void;
  applyPreset: (id: PresetId) => void;
  setHoldSituations: (v: boolean) => void;
  releaseSituations: () => void;
  dismissSituation: (key: string) => void;
  toggleActionCenter: () => void;
  openLab: (building: BuildingId | null, situationKey?: string) => void;
  closeLab: () => void;
  createScenario: (draft: NewScenario) => string;
  updateDraft: (id: string, patch: Partial<SimState>) => void;
  renameScenario: (id: string, name: string) => void;
  duplicateScenario: (id: string) => void;
  discardScenario: (id: string) => void;
  setCompare: (ids: string[]) => void;
  /** "Apply to Demo" — the only mutation of live sim state besides revert */
  applyScenario: (id: string) => void;
  revertPlan: () => void;
  focusBuilding: (b: BuildingId | null) => void;
  setHovered: (b: BuildingId | null) => void;
  openAgentPanel: (a: AgentId | null) => void;
  openProductPanel: (id: string | null) => void;
  inspectObject: (k: FocusKey | null) => void;
  toggleTimeline: () => void;
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

export interface AppliedPlan {
  id: string;
  label: string;
  minute: number;
  prev: SimState;
  applied: SimState;
  /** headline deltas frozen at apply time */
  deltas: string;
  /** simulated POs this plan placed (removed again on revert) */
  poIds: string[];
  landedAt?: number;
}

const emptyThreads = (): Record<AgentId, ChatMessage[]> => ({
  analyst: [],
  strategist: [],
  concierge: [],
});

const liveOf = (f: FlowState): LiveState => ({
  queueUnits: f.queueUnits,
  sold: f.sold,
  received: f.received,
  minute: f.minute,
  packedCumulative: f.packedCumulative,
});

const BOOT_METRICS = derive(DEFAULT_STATE);
const BOOT_FLOW = initialFlow(BOOT_METRICS.fulfillment.openUnits);

const INITIAL_UI: UIState = {
  phase: "arrival",
  mode: "interact",
  clock: { paused: false, speed: 1 },
  scenarioAuto: true,
  holdSituations: false,
  activePreset: "normal",
  actionCenterOpen: false,
  situations: [],
  situationLog: {},
  sinceSituationScan: 0,
  lab: { open: false, building: null, situationKey: null, scenarios: [], activeId: null, compareIds: [] },
  labSeq: 0,
  attention: null,
  attentionCoolUntil: 0,
  appliedPlans: [],
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

/** How long an Observe-mode camera pull lasts, and how rarely one may fire. */
const ATTENTION_HOLD_MS = 9000;
const ATTENTION_COOLDOWN_MS = 30000;

/**
 * Decide whether a batch of events earns an Observe-mode camera pull:
 * alerts, scenario stages and applied plans are worth the glance; routine
 * dispatches are not. Rate-limited so the wall stays calm.
 */
function attentionFrom(
  s: Pick<Store, "attention" | "attentionCoolUntil">,
  evs: Pick<NewEvent, "tone" | "kind" | "building">[],
): Partial<Pick<Store, "attention" | "attentionCoolUntil">> {
  const now = Date.now();
  if (now < s.attentionCoolUntil) return {};
  const notable = evs.find(
    (e) => e.tone === "alert" || e.kind === "scenario.stage" || e.kind === "plan.applied",
  );
  if (!notable) return {};
  return {
    attention: { building: notable.building, until: now + ATTENTION_HOLD_MS },
    attentionCoolUntil: now + ATTENTION_COOLDOWN_MS,
  };
}

/**
 * The single choke point for event appends: assigns ids, prepends newest-first,
 * holds the 80-entry cap, and flags Observe-mode attention.
 */
function withEvents(
  s: Pick<Store, "events" | "eventSeq" | "flow" | "attention" | "attentionCoolUntil">,
  evs: NewEvent[],
): Pick<Store, "events" | "eventSeq"> & Partial<Pick<Store, "attention" | "attentionCoolUntil">> {
  if (!evs.length) return { events: s.events, eventSeq: s.eventSeq };
  let seq = s.eventSeq;
  const added: DistrictEvent[] = evs.map((e) => ({ ...e, id: `e${++seq}` }));
  return {
    eventSeq: seq,
    events: [...added.reverse(), ...s.events].slice(0, 80),
    ...attentionFrom(s, evs),
  };
}

/** One event appended at the current sim minute — the common non-tick case. */
function withEvent(
  s: Pick<Store, "events" | "eventSeq" | "flow" | "attention" | "attentionCoolUntil">,
  ev: Omit<NewEvent, "minute">,
): ReturnType<typeof withEvents> {
  return withEvents(s, [{ ...ev, minute: s.flow.minute }]);
}

/** One-day cooldown before a dismissed situation may re-surface. */
const DISMISS_COOLDOWN_MIN = 1440;

/**
 * Re-detect situations against fresh metrics, preserving reveal state and
 * honoring the dismissed cooldown. Pure over its inputs.
 */
function reconcileSituations(
  s: Pick<Store, "situations" | "situationLog" | "holdSituations" | "attention" | "attentionCoolUntil">,
  metrics: Metrics,
  sim: SimState,
  flow: FlowState,
): Pick<Store, "situations" | "situationLog"> &
  Partial<Pick<Store, "attention" | "attentionCoolUntil">> {
  const detected = detectSituations(metrics, sim, flow);
  const log = { ...s.situationLog };
  const next: Store["situations"] = [];

  for (const sit of detected) {
    const prior = s.situations.find((x) => x.key === sit.key);
    const logged = log[sit.key];
    if (logged?.status === "dismissed" && flow.minute - logged.minute < DISMISS_COOLDOWN_MIN) {
      continue; // still in its quiet period
    }
    next.push({ ...sit, revealed: prior ? prior.revealed : !s.holdSituations });
    log[sit.key] = { status: "open", minute: logged?.minute ?? flow.minute };
  }
  // Conditions that cleared on their own leave the log so a re-cross reads as new.
  for (const key of Object.keys(log)) {
    if (log[key].status === "open" && !detected.some((d) => d.key === key)) delete log[key];
  }
  // A freshly revealed situation is worth an Observe-mode glance of its own.
  const fresh = next.find((x) => x.revealed && !s.situations.some((p) => p.key === x.key));
  return {
    situations: next,
    situationLog: log,
    ...(fresh ? attentionFrom(s, [{ tone: "alert", kind: "queue.rising", building: fresh.building }]) : {}),
  };
}

/**
 * Advance the clock by n ticks. All simulation time flows through here —
 * the interval, stepOnce, and 2× speed are just different callers.
 */
function advanceTicks(s: Store, ticks: number): Partial<Store> {
  let flow = s.flow;
  let sim = simOf(s);
  const collected: NewEvent[] = [];

  for (let i = 0; i < ticks; i++) {
    const r = stepFlow(flow, sim, s.metrics);
    flow = r.flow;
    collected.push(...r.events);
  }

  // Applied-plan POs that landed this tick: the staged scenario became real
  // stock, so clear it from the buy and stamp the plan's verify line.
  const landed = s.flow.openPOs.filter((po) => !flow.openPOs.some((q) => q.id === po.id));
  let appliedPlans = s.appliedPlans;
  if (landed.length) {
    const staged = { ...sim.staged };
    for (const po of landed) delete staged[po.productId];
    sim = { ...sim, staged };
    appliedPlans = s.appliedPlans.map((ap) =>
      ap.landedAt === undefined && landed.some((po) => ap.poIds.includes(po.id))
        ? { ...ap, landedAt: flow.minute }
        : ap,
    );
  }

  const metrics = derive(sim, liveOf(flow));

  // Situations rescan: whenever something happened, else hourly.
  let scan = s.sinceSituationScan + ticks;
  let situationsPatch: Partial<Store> = {};
  if (collected.length || landed.length || scan >= 12) {
    scan = 0;
    situationsPatch = reconcileSituations(s, metrics, sim, flow);
  }

  return {
    flow,
    metrics,
    sinceSituationScan: scan,
    ...(landed.length ? { staged: sim.staged, appliedPlans } : {}),
    ...situationsPatch,
    ...withEvents(s, collected),
  };
}

export const useStore = create<Store>()((set, get) => ({
  ...DEFAULT_STATE,
  ...INITIAL_UI,
  metrics: BOOT_METRICS,
  flow: BOOT_FLOW,
  eventSeq: 0,

  /* ── navigation ────────────────────────────────────────────── */

  enter: () => set({ phase: "district" }),

  setMode: (m) =>
    set((s) => {
      if (m === s.mode) return {};
      if (m === "observe") {
        // A TV never sits on the arrival screen or inside a half-open panel.
        return {
          mode: m,
          phase: "district",
          focus: null,
          hovered: null,
          openAgent: null,
          openProduct: null,
          inspecting: null,
          timelineOpen: false,
          actionCenterOpen: false,
          lab: { ...s.lab, open: false },
          toast: null,
          attention: null,
        };
      }
      // interact ↔ present keep all context so a presenter can flip mid-demo.
      return { mode: m };
    }),

  pauseClock: () => set((s) => ({ clock: { ...s.clock, paused: true } })),
  resumeClock: () => set((s) => ({ clock: { ...s.clock, paused: false } })),
  setSpeed: (v) => set((s) => ({ clock: { ...s.clock, speed: v } })),
  stepOnce: () => set((s) => advanceTicks(s, 1)),

  // Reaching for anything on the wall IS the decision to engage — observe
  // escalates to interact on the first meaningful click.
  focusBuilding: (b) =>
    set((s) => ({
      focus: b,
      phase: b ? "building" : "district",
      hovered: null,
      openAgent: b ? s.openAgent : null,
      openProduct: null,
      inspecting: b ? s.inspecting : null,
      ...(b && s.mode === "observe" ? { mode: "interact" as Mode } : {}),
    })),

  setHovered: (b) => set({ hovered: b }),
  openAgentPanel: (a) =>
    set((s) => ({
      openAgent: a,
      inspecting: a ? null : s.inspecting,
      ...(a && s.mode === "observe" ? { mode: "interact" as Mode } : {}),
    })),
  openProductPanel: (id) => set({ openProduct: id }),
  inspectObject: (k) =>
    set((s) => ({
      inspecting: k,
      openAgent: k ? null : s.openAgent,
      ...(k && s.mode === "observe" ? { mode: "interact" as Mode } : {}),
    })),
  toggleTimeline: () =>
    set((s) => ({ timelineOpen: !s.timelineOpen, actionCenterOpen: false })),

  /* ── the clock ─────────────────────────────────────────────── */

  tick: () => set((s) => (s.clock.paused ? {} : advanceTicks(s, s.clock.speed))),

  /* ── controls ──────────────────────────────────────────────── */

  /* ── the hero scenario ─────────────────────────────────────── */

  setScenarioAuto: (v) => set({ scenarioAuto: v }),

  advanceScenario: () =>
    set((s) => {
      if (s.scenario !== "viral" || s.viralStage >= STAGE_COPY.length) return {};
      const stage = s.viralStage + 1;
      const sim: SimState = { ...simOf(s), viralStage: stage };

      // Stage two is the only stage that moves physical state: the surge
      // book lands in the queue (and counts as intake, so the day's
      // arrived-vs-packed reconciliation stays exact).
      const flow: FlowState =
        stage === 2
          ? {
              ...s.flow,
              queueUnits: s.flow.queueUnits + SURGE_TOTAL_UNITS,
              arrivedUnitsToday: s.flow.arrivedUnitsToday + SURGE_TOTAL_UNITS,
            }
          : s.flow;

      const appended = withEvents({ ...s, flow }, [
        { ...STAGE_COPY[stage - 1], minute: flow.minute },
      ]);
      const ev = appended.events[0];
      return {
        viralStage: stage,
        flow,
        metrics: derive(sim, liveOf(flow)),
        ...appended,
        toast: { id: ev.id, title: ev.title, detail: ev.detail, tone: ev.tone },
        running: stage < STAGE_COPY.length && s.scenarioAuto,
      };
    }),

  runViralDrop: () => {
    const token = get().runToken + 1;
    const auto = get().scenarioAuto;
    set((s) => ({
      runToken: token,
      running: auto,
      scenario: "viral",
      activePreset: "viral-drop",
      viralStage: 0,
      toast: null,
      metrics: derive({ ...simOf(s), scenario: "viral", viralStage: 0 }, liveOf(s.flow)),
    }));
    if (!auto) return; // the presenter advances stages by hand
    STAGE_DELAYS.forEach((d) => {
      window.setTimeout(() => {
        if (get().runToken !== token) return;
        get().advanceScenario();
      }, d);
    });
  },

  applyPreset: (id) => {
    const preset = presetById(id);
    set((s) => {
      const base: SimState = { ...DEFAULT_STATE, ...preset.state };
      const metrics = derive(base);
      const flow = initialFlow(metrics.fulfillment.openUnits);
      const fresh = {
        ...base,
        activePreset: id,
        runToken: s.runToken + 1,
        running: false,
        events: [] as DistrictEvent[],
        eventSeq: 0,
        toast: null,
        threads: emptyThreads(),
        openProduct: null,
        inspecting: null as FocusKey | null,
        clock: { paused: false, speed: 1 } as const,
        situations: [] as Store["situations"],
        situationLog: {} as Store["situationLog"],
        sinceSituationScan: 0,
        lab: {
          open: false,
          building: null,
          situationKey: null,
          scenarios: [] as ScenarioDraft[],
          activeId: null,
          compareIds: [] as string[],
        },
        appliedPlans: [] as AppliedPlan[],
        attention: null,
        attentionCoolUntil: 0,
        metrics,
        flow,
      };

      // Some presets open mid-morning: fast-forward the same deterministic
      // clock so the floor arrives with real history (packed units, staged
      // parcels, dispatched vans, a populated timeline) — not fabricated.
      const warmed = preset.warmupTicks
        ? advanceTicks({ ...s, ...fresh } as Store, preset.warmupTicks)
        : {};
      const afterFlow = warmed.flow ?? flow;
      const afterEvents = warmed.events ?? fresh.events;
      const afterSeq = warmed.eventSeq ?? fresh.eventSeq;

      if (!preset.opener) return { ...fresh, ...warmed };
      const appended = withEvents(
        {
          events: afterEvents,
          eventSeq: afterSeq,
          flow: afterFlow,
          attention: null,
          attentionCoolUntil: 0,
        },
        [{ ...preset.opener, minute: afterFlow.minute }],
      );
      const ev = appended.events[0];
      return {
        ...fresh,
        ...warmed,
        ...appended,
        toast: { id: ev.id, title: ev.title, detail: ev.detail, tone: ev.tone },
      };
    });
    if (preset.arm === "viral") get().runViralDrop();
    // A fresh preset re-detects from scratch.
    set((s) => reconcileSituations({ ...s, situations: [], situationLog: {} }, s.metrics, simOf(s), s.flow));
  },

  /* ── situations ────────────────────────────────────────────── */

  setHoldSituations: (v) => set({ holdSituations: v }),

  releaseSituations: () =>
    set((s) => ({ situations: s.situations.map((x) => ({ ...x, revealed: true })) })),

  dismissSituation: (key) =>
    set((s) => ({
      situations: s.situations.filter((x) => x.key !== key),
      situationLog: { ...s.situationLog, [key]: { status: "dismissed", minute: s.flow.minute } },
    })),

  toggleActionCenter: () =>
    set((s) => ({ actionCenterOpen: !s.actionCenterOpen, timelineOpen: false })),

  /* ── the Scenario Lab (drafts only — never live state) ───────── */

  openLab: (building, situationKey) =>
    set((s) => {
      const sim = simOf(s);
      const live = liveOf(s.flow);
      let seq = s.labSeq;
      const mk = (d: NewScenario): ScenarioDraft => ({
        ...d,
        id: `sc${++seq}`,
        createdAt: s.flow.minute,
      });

      // The live plan is always row one, locked, re-snapshotted on open.
      const baseline = mk({
        name: "Current Plan",
        source: "baseline",
        assumptions: { ...sim, staffing: { ...sim.staffing }, staged: { ...sim.staged } },
        note: "The plan the district is running right now.",
        locked: true,
      });

      // User drafts survive re-opens; agent options are regenerated fresh.
      const kept = s.lab.scenarios.filter((x) => x.source === "user" && !x.locked);

      const sit = situationKey ? s.situations.find((x) => x.key === situationKey) : undefined;
      const generated = sit ? optionsFor(sit, s.metrics, sim, live).map(mk) : [];

      const scenarios = [baseline, ...generated, ...kept].slice(0, 9);
      const agentIds = generated.filter((x) => x.source === "agent").map((x) => x.id);
      return {
        lab: {
          open: true,
          building: building ?? sit?.building ?? null,
          situationKey: situationKey ?? null,
          scenarios,
          activeId: generated[0]?.id ?? kept[0]?.id ?? baseline.id,
          compareIds: agentIds.slice(0, 2),
        },
        labSeq: seq,
        ...(s.mode === "observe" ? { mode: "interact" as Mode } : {}),
      };
    }),

  closeLab: () => set((s) => ({ lab: { ...s.lab, open: false } })),

  createScenario: (draft) => {
    const id = `sc${get().labSeq + 1}`;
    set((s) => ({
      labSeq: s.labSeq + 1,
      lab: {
        ...s.lab,
        scenarios: [...s.lab.scenarios, { ...draft, id, createdAt: s.flow.minute }].slice(0, 9),
        activeId: id,
      },
    }));
    return id;
  },

  updateDraft: (id, patch) =>
    set((s) => ({
      lab: {
        ...s.lab,
        scenarios: s.lab.scenarios.map((sc) =>
          sc.id === id && !sc.locked
            ? {
                ...sc,
                assumptions: {
                  ...sc.assumptions,
                  ...patch,
                  staffing: { ...sc.assumptions.staffing, ...patch.staffing },
                  staged: patch.staged ?? sc.assumptions.staged,
                },
              }
            : sc,
        ),
      },
    })),

  renameScenario: (id, name) =>
    set((s) => ({
      lab: {
        ...s.lab,
        scenarios: s.lab.scenarios.map((sc) => (sc.id === id && !sc.locked ? { ...sc, name } : sc)),
      },
    })),

  duplicateScenario: (id) =>
    set((s) => {
      const src = s.lab.scenarios.find((sc) => sc.id === id);
      if (!src) return {};
      const nid = `sc${s.labSeq + 1}`;
      const copy: ScenarioDraft = {
        ...src,
        id: nid,
        name: src.locked ? "My Custom Plan" : `${src.name} (copy)`,
        source: "user",
        locked: false,
        preferredWhy: undefined,
        createdAt: s.flow.minute,
        assumptions: {
          ...src.assumptions,
          staffing: { ...src.assumptions.staffing },
          staged: { ...src.assumptions.staged },
        },
      };
      return {
        labSeq: s.labSeq + 1,
        lab: { ...s.lab, scenarios: [...s.lab.scenarios, copy].slice(0, 9), activeId: nid },
      };
    }),

  discardScenario: (id) =>
    set((s) => {
      const scenarios = s.lab.scenarios.filter((sc) => sc.id !== id || sc.locked);
      return {
        lab: {
          ...s.lab,
          scenarios,
          activeId: s.lab.activeId === id ? (scenarios[1]?.id ?? scenarios[0]?.id ?? null) : s.lab.activeId,
          compareIds: s.lab.compareIds.filter((x) => x !== id),
        },
      };
    }),

  setCompare: (ids) => set((s) => ({ lab: { ...s.lab, compareIds: ids.slice(0, 3) } })),

  /* ── Decide → Apply → Verify ─────────────────────────────────── */

  applyScenario: (id) =>
    set((s) => {
      const sc = s.lab.scenarios.find((x) => x.id === id);
      if (!sc || sc.locked) return {};

      const prev = simOf(s);
      const next: SimState = {
        ...sc.assumptions,
        staffing: { ...sc.assumptions.staffing },
        staged: { ...sc.assumptions.staged },
      };

      // New staged quantities become simulated POs that land on the (compressed)
      // supplier lead time — the Verify half of the loop.
      const pos = [...s.flow.openPOs];
      const poIds: string[] = [];
      for (const [pid, qty] of Object.entries(next.staged)) {
        const delta = qty - (prev.staged[pid] ?? 0);
        if (delta <= 0) continue;
        const prod = byId(pid);
        const effLead = Math.max(7, prod.leadTimeDays + next.leadTimeAdj);
        const poId = `po-${pid}-${s.flow.minute}`;
        poIds.push(poId);
        pos.push({
          id: poId,
          productId: pid,
          units: delta,
          landsOnMinute: s.flow.minute + Math.max(1, Math.round(effLead / 7)) * 1440,
        });
      }

      const flow: FlowState = { ...s.flow, openPOs: pos };
      const metrics = derive(next, liveOf(flow));

      const bf = s.metrics.fulfillment;
      const af = metrics.fulfillment;
      const parts: string[] = [];
      if (af.capacityUnits !== bf.capacityUnits)
        parts.push(`capacity ${n(bf.capacityUnits)} → ${n(af.capacityUnits)}/day`);
      if (af.atRisk !== bf.atRisk) parts.push(`at-risk ${n(bf.atRisk)} → ${n(af.atRisk)}`);
      if (poIds.length) parts.push(`${poIds.length} simulated ${poIds.length === 1 ? "PO" : "POs"} placed`);
      if (next.priorityPolicy !== prev.priorityPolicy) parts.push(`queue policy → ${next.priorityPolicy}`);
      if (next.conciergePlaybook !== prev.conciergePlaybook)
        parts.push(`concierge playbook → ${next.conciergePlaybook}`);
      const deltas = parts.length ? parts.join(" · ") : "assumptions updated";

      const plan: AppliedPlan = {
        id: `ap${s.appliedPlans.length + 1}-${s.flow.minute}`,
        label: sc.name,
        minute: s.flow.minute,
        prev,
        applied: next,
        deltas,
        poIds,
      };

      const appended = withEvent(
        { ...s, flow },
        {
          kind: "plan.applied",
          building: s.lab.building ?? "fulfillment",
          agent: sc.source === "agent" ? s.situations.find((x) => x.key === s.lab.situationKey)?.agent : undefined,
          title: `Plan applied: ${sc.name}`,
          detail: deltas.charAt(0).toUpperCase() + deltas.slice(1) + ".",
          why: `${sc.note ?? "Chosen in the Scenario Lab."} You compared the options and made this call — the district now runs your plan. Simulated action only.`,
          tone: "good",
        },
      );
      const ev = appended.events[0];

      return {
        ...next,
        flow,
        metrics,
        appliedPlans: [plan, ...s.appliedPlans].slice(0, 10),
        lab: { ...s.lab, open: false },
        ...appended,
        toast: { id: ev.id, title: ev.title, detail: ev.detail, tone: ev.tone },
        ...reconcileSituations(s, metrics, next, flow),
      };
    }),

  revertPlan: () =>
    set((s) => {
      const plan = s.appliedPlans[0];
      if (!plan) return {};
      const prev: SimState = {
        ...plan.prev,
        staffing: { ...plan.prev.staffing },
        staged: { ...plan.prev.staged },
      };
      // Un-place any POs this plan created that haven't landed yet.
      const flow: FlowState = {
        ...s.flow,
        openPOs: s.flow.openPOs.filter((po) => !plan.poIds.includes(po.id)),
      };
      const metrics = derive(prev, liveOf(flow));
      const appended = withEvent(
        { ...s, flow },
        {
          kind: "plan.reverted",
          building: "fulfillment",
          title: `Reverted: ${plan.label}`,
          detail: `The district returned to the plan that was running before ${plan.label.toLowerCase()} was applied.`,
          why: "Reverting restores the previous assumptions and withdraws any simulated POs that had not yet landed.",
          tone: "info",
        },
      );
      return {
        ...prev,
        flow,
        metrics,
        appliedPlans: s.appliedPlans.slice(1),
        ...appended,
        ...reconcileSituations(s, metrics, prev, flow),
      };
    }),

  resetSimulation: () =>
    set((s) => {
      const metrics = derive(DEFAULT_STATE);
      return {
        ...DEFAULT_STATE,
        activePreset: "normal" as PresetId,
        runToken: s.runToken + 1,
        running: false,
        events: [],
        eventSeq: 0,
        toast: null,
        threads: emptyThreads(),
        openProduct: null,
        inspecting: null,
        clock: { paused: false, speed: 1 } as const,
        situations: [],
        situationLog: {},
        sinceSituationScan: 0,
        lab: { open: false, building: null, situationKey: null, scenarios: [], activeId: null, compareIds: [] },
        appliedPlans: [],
        attention: null,
        attentionCoolUntil: 0,
        actionCenterOpen: false,
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
      const building: BuildingId =
        a === "analyst" ? "fulfillment" : a === "strategist" ? "atelier" : "boutique";
      const ev: Omit<NewEvent, "minute"> = {
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
        ...withEvent(s, ev),
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
  priorityPolicy: s.priorityPolicy,
  conciergePlaybook: s.conciergePlaybook,
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
      priorityPolicy: s.priorityPolicy,
      conciergePlaybook: s.conciergePlaybook,
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
