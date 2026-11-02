"use client";

import { Html } from "@react-three/drei";
import { useStore } from "@/lib/store";
import { AGENTS } from "@/lib/agents";
import { TONE } from "@/components/ui/bits";
import type { BuildingId, WorldStatus } from "@/lib/types";
import { SITES } from "./palette";

/* ─────────────────────────────────────────────────────────────────
   Hover nameplates, anchored to each building in world space.
   ───────────────────────────────────────────────────────────────── */

const AGENT_OF: Record<BuildingId, keyof typeof AGENTS> = {
  fulfillment: "analyst",
  atelier: "strategist",
  boutique: "concierge",
};

const BLURB: Record<BuildingId, string> = {
  fulfillment: "Orders, pick capacity and the daily ship plan.",
  atelier: "Stock cover, sell-through and the next buy.",
  boutique: "Clients, availability and the concierge.",
};

function Plate({ id }: { id: BuildingId }) {
  const site = SITES[id];
  const agent = AGENTS[AGENT_OF[id]];
  const metrics = useStore((s) => s.metrics);
  const status: WorldStatus =
    id === "fulfillment" ? metrics.fulfillment.status : id === "atelier" ? metrics.inventory.status : metrics.boutique.status;
  const tone = TONE[status];

  const headline =
    id === "fulfillment"
      ? `${metrics.fulfillment.openOrders.toLocaleString()} orders open · ${metrics.fulfillment.backlogDays.toFixed(1)}d backlog`
      : id === "atelier"
        ? `${metrics.inventory.critical.length} critical · ${metrics.inventory.watch.length} on watch`
        : `${metrics.boutique.ordersToday.toLocaleString()} orders today · ${metrics.boutique.inquiries} questions`;

  return (
    <Html
      position={[site.pos[0], site.labelY, site.pos[2]]}
      center
      zIndexRange={[24, 20]}
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      <div
        className="a-fadeUp"
        style={{
          width: 252,
          transform: "translateY(-46%)",
          fontFamily: "var(--font-jost), sans-serif",
        }}
      >
        <div className="panel grain relative overflow-hidden rounded-[3px]">
          <div className="goldline absolute inset-x-0 top-0 h-px" />
          <div className="px-4 pb-3.5 pt-3">
            <div className="flex items-center justify-between gap-2">
              <div
                className="eyebrow truncate"
                style={{ color: "#A3927C", fontSize: 8, letterSpacing: "0.16em" }}
              >
                {site.subtitle}
              </div>
              <span
                className="flex items-center gap-1 rounded-full px-1.5 py-[2px]"
                style={{ background: tone.bg, color: tone.fg }}
              >
                <span className="h-[4px] w-[4px] rounded-full" style={{ background: tone.dot }} />
                <span className="label" style={{ fontSize: 8 }}>
                  {tone.label}
                </span>
              </span>
            </div>

            <div
              className="display mt-1.5 leading-[1.05]"
              style={{ fontSize: 20, color: "var(--ink)" }}
            >
              {site.name}
            </div>

            <div className="mt-1.5 text-[11px] leading-snug" style={{ color: "#8C7B66" }}>
              {BLURB[id]}
            </div>

            <div className="mt-2.5 h-px w-full" style={{ background: "rgba(58,43,35,.08)" }} />

            <div className="mt-2 flex items-center gap-2">
              <span
                className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-[8px] font-semibold tracking-[0.06em] text-[#FBF7F2]"
                style={{ background: agent.accent }}
              >
                {agent.mark}
              </span>
              <span className="text-[11px] font-medium" style={{ color: "var(--espresso)" }}>
                {agent.name}
              </span>
            </div>

            <div className="num mt-2 text-[10.5px]" style={{ color: "#9C8B76" }}>
              {headline}
            </div>

            <div
              className="label mt-3 flex items-center gap-1.5"
              style={{ fontSize: 9, color: "var(--gold)" }}
            >
              Enter
              <svg width="12" height="7" viewBox="0 0 14 7" fill="none" aria-hidden>
                <path d="M0 3.5h12M8.8 .6 12 3.5 8.8 6.4" stroke="currentColor" strokeWidth=".9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
        {/* leader line down to the roof */}
        <div className="mx-auto h-5 w-px" style={{ background: "linear-gradient(var(--gold), transparent)" }} />
      </div>
    </Html>
  );
}

export function SiteLabels() {
  const hovered = useStore((s) => s.hovered);
  const phase = useStore((s) => s.phase);
  if (phase !== "district" || !hovered) return null;
  return <Plate id={hovered} />;
}
