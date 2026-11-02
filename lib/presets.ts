import type { NewEvent } from "./engine";
import type { SimState } from "./types";

/* ════════════════════════════════════════════════════════════════════
   PRESENTER SCENARIO PRESETS
   Each preset is a reset to DEFAULT_STATE plus the assumption changes
   below — no hidden machinery. The viral drop additionally arms the
   four-stage choreography; everything else cascades organically out of
   the deterministic engine (risk bands, backlog alarms, situations).
   ════════════════════════════════════════════════════════════════════ */

export type PresetId = "normal" | "viral-drop" | "inventory-risk" | "service-surge";

export interface Preset {
  id: PresetId;
  name: string;
  blurb: string;
  /** applied over DEFAULT_STATE after a full reset */
  state: Partial<SimState>;
  /** presets that use the staged viral choreography */
  arm?: "viral";
  /** a narrated opener for the activity feed */
  opener?: Omit<NewEvent, "minute">;
}

export const PRESETS: Preset[] = [
  {
    id: "normal",
    name: "Normal Business Day",
    blurb: "The baseline: steady trading, a clean book, nothing on fire.",
    state: {},
  },
  {
    id: "viral-drop",
    name: "Viral Product Drop",
    blurb: "A social moment hits the Soleil Mini — four stages ripple across the district.",
    state: {},
    arm: "viral",
  },
  {
    id: "inventory-risk",
    name: "Inventory Risk",
    blurb: "Suppliers slip ten days while demand runs a fifth hot — cover erodes across the book.",
    state: { scenario: "inventory-risk", leadTimeAdj: 10, demandMultiplier: 1.2 },
    opener: {
      kind: "assumption.changed",
      building: "atelier",
      agent: "strategist",
      title: "Supplier lead times slipped ten days",
      detail:
        "Every maker is quoting +10 days while demand runs 1.2× the baseline. Two styles just fell below their replenishment window; six more are drifting toward it.",
      why: "A presenter preset: the same deterministic planning math, under stress. Watch the risk bands, the reorder windows and the Strategist's briefing react.",
      tone: "watch",
      focus: "trendwall",
    },
  },
  {
    id: "service-surge",
    name: "Customer Service Surge",
    blurb: "Question volume spikes 3.6× without a matching sales spike.",
    state: { scenario: "service-surge" },
    opener: {
      kind: "assumption.changed",
      building: "boutique",
      agent: "concierge",
      title: "Client questions running 3.6× normal",
      detail:
        "Inquiry volume has surged ahead of sales — sessions are up only 1.25×. The concierge desk is the pressure point, not the warehouse.",
      why: "A presenter preset: service load without an operations spike. Watch the concierge playbook options and the boutique status react.",
      tone: "watch",
      focus: "floor",
    },
  },
];

export const presetById = (id: PresetId) => PRESETS.find((p) => p.id === id)!;

/** Short label for whatever non-baseline scenario is running. */
export const SCENARIO_LABEL: Record<SimState["scenario"], string> = {
  baseline: "Baseline",
  viral: "Viral Drop",
  "inventory-risk": "Inventory Risk",
  "service-surge": "Service Surge",
};
