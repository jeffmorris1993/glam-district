import type { BuildingId, WorldStatus } from "@/lib/types";

export const C = {
  ivory: "#DCCEB9",
  porcelain: "#FBF7F2",
  marble: "#F4EEE6",
  linen: "#C9B79C",
  stone: "#D5C8B5",
  warmStone: "#C2B099",
  taupe: "#AD9C85",
  taupeDeep: "#877664",
  blush: "#E9D3CD",
  rose: "#C98E88",
  roseDeep: "#A96C68",
  champagne: "#D9BC8C",
  gold: "#B8914F",
  goldBright: "#E8D1A4",
  espresso: "#3A2B23",
  espressoLight: "#4E3B31",
  charcoal: "#2A2320",
  sage: "#7E9072",
  sageDeep: "#55674F",
  olive: "#6D8060",
  glass: "#CBD8D6",
  interior: "#FFE9C8",
  asphalt: "#564C43",
  asphaltLight: "#5D544B",
  amber: "#C9893F",
  alert: "#B4553F",
} as const;

export const STATUS_COLOR: Record<WorldStatus, string> = {
  healthy: C.sage,
  watch: C.amber,
  critical: C.alert,
};

export interface Site {
  id: BuildingId;
  name: string;
  subtitle: string;
  agentName: string;
  agentRole: string;
  /** world-space position of the building origin */
  pos: [number, number, number];
  /** label anchor height */
  labelY: number;
  /** camera target when focused */
  target: [number, number, number];
  zoom: number;
}

export const SITES: Record<BuildingId, Site> = {
  fulfillment: {
    id: "fulfillment",
    name: "The Fulfillment House",
    subtitle: "Warehouse operations",
    agentName: "Fulfillment Analyst",
    agentRole: "Operations intelligence",
    pos: [-9.6, 0, -1.6],
    labelY: 4.4,
    target: [-9.6, 1.4, -1.6],
    zoom: 60,
  },
  atelier: {
    id: "atelier",
    name: "The Buying Atelier",
    subtitle: "Inventory planning",
    agentName: "Inventory Strategist",
    agentRole: "Merchandise planning",
    pos: [2.2, 0, -6.8],
    labelY: 5.3,
    target: [2.2, 1.7, -6.8],
    zoom: 66,
  },
  boutique: {
    id: "boutique",
    name: "The Glam Boutique",
    subtitle: "Client experience",
    agentName: "Glam Concierge",
    agentRole: "Client experience",
    pos: [10.4, 0, 2.6],
    labelY: 4.9,
    target: [10.4, 1.5, 2.6],
    zoom: 66,
  },
};

export const DISTRICT_VIEW = {
  target: [-0.6, 1.7, 1.1] as [number, number, number],
  zoom: 33,
};

export const ARRIVAL_VIEW = {
  target: [-0.6, 2.4, 0.8] as [number, number, number],
  zoom: 25,
};
