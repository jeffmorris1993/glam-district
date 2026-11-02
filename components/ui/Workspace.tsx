"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { AGENTS } from "@/lib/agents";
import { SITES } from "@/components/world/palette";
import { shipWindow } from "@/lib/sim";
import { money, n } from "@/lib/fmt";
import type { BuildingId, WorldStatus } from "@/lib/types";
import { Btn, Rule, StatusPill, Swatch, TONE } from "./bits";
import { FulfillmentPanel } from "./panels/Fulfillment";
import { AtelierPanel } from "./panels/Atelier";
import { BoutiquePanel } from "./panels/Boutique";

/* ─────────────────────────────────────────────────────────────────
   SCREEN 3 — the workspace. A layered panel over the living district,
   never a navigation away from it.
   ───────────────────────────────────────────────────────────────── */

const AGENT_OF: Record<BuildingId, "analyst" | "strategist" | "concierge"> = {
  fulfillment: "analyst",
  atelier: "strategist",
  boutique: "concierge",
};

export function Workspace() {
  const focus = useStore((s) => s.focus);
  const phase = useStore((s) => s.phase);
  const metrics = useStore((s) => s.metrics);
  const focusBuilding = useStore((s) => s.focusBuilding);
  const openAgentPanel = useStore((s) => s.openAgentPanel);
  const openAgent = useStore((s) => s.openAgent);

  const open = phase === "building" && !!focus;
  const body = useRef<HTMLDivElement>(null);

  // A new destination always opens at the top of its workspace.
  useEffect(() => {
    body.current?.scrollTo({ top: 0 });
  }, [focus]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      if (e.key !== "Escape") return;
      if (s.openAgent) return; // the agent panel handles its own escape
      if (s.phase === "building") s.focusBuilding(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const site = focus ? SITES[focus] : null;
  const agent = focus ? AGENTS[AGENT_OF[focus]] : null;
  const status: WorldStatus = !focus
    ? "healthy"
    : focus === "fulfillment"
      ? metrics.fulfillment.status
      : focus === "atelier"
        ? metrics.inventory.status
        : metrics.boutique.status;

  return (
    <section
      aria-hidden={!open}
      className="pointer-events-none absolute inset-x-0 bottom-0 top-[42%] z-30 sm:inset-y-0 sm:left-auto sm:right-0 sm:top-0 sm:w-[clamp(400px,33vw,520px)]"
    >
      <div
        className="panel grain pointer-events-auto flex h-full flex-col overflow-hidden rounded-t-[14px] border-t sm:rounded-none sm:border-l sm:border-t-0"
        style={{
          transform: open ? "none" : "var(--ws-closed, translateY(104%))",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "transform .7s var(--ease), opacity .45s var(--ease)",
          borderColor: "rgba(58,43,35,.1)",
        }}
      >
        {site && agent && focus && (
          <>
            {/* ── header ───────────────────────────────────────── */}
            <header className="relative shrink-0 px-6 pb-5 pt-5 sm:px-7">
              <div className="goldline absolute inset-x-0 top-0 h-px" />

              <button
                type="button"
                onClick={() => focusBuilding(null)}
                className="label group mb-3 flex items-center gap-2 text-[9px] text-[#A3927C] transition-colors hover:text-[var(--espresso)]"
              >
                <svg
                  width="13"
                  height="7"
                  viewBox="0 0 14 7"
                  fill="none"
                  aria-hidden
                  className="transition-transform duration-300 group-hover:-translate-x-1"
                >
                  <path d="M14 3.5H2M5.2 .6 2 3.5l3.2 2.9" stroke="currentColor" strokeWidth=".9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                The District
              </button>

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="eyebrow text-[8.5px] text-[#A3927C]">{site.subtitle}</div>
                  <h2 className="display mt-1.5 text-[clamp(26px,3vw,34px)] leading-[0.98] text-[var(--ink)]">
                    {site.name.replace("The ", "The ")}
                  </h2>
                </div>
                <StatusPill status={status} />
              </div>

              <button
                type="button"
                onClick={() => openAgentPanel(openAgent === agent.id ? null : agent.id)}
                className="group mt-4 flex w-full items-center gap-3 rounded-[2px] border border-[rgba(58,43,35,.1)] bg-[rgba(255,255,255,.5)] px-3 py-2.5 text-left transition-all duration-300 hover:border-[var(--champagne)] hover:bg-[rgba(217,188,140,.1)]"
              >
                <span
                  className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[9.5px] font-medium tracking-[0.06em] text-[#FBF7F2]"
                  style={{ background: agent.accent }}
                >
                  {agent.mark}
                  <span
                    className="absolute -bottom-px -right-px h-[9px] w-[9px] rounded-full border-2 border-[#FBF7F2]"
                    style={{ background: TONE[status].dot }}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium text-[var(--espresso)]">{agent.name}</span>
                  <span className="mt-[1px] block truncate text-[10.5px] text-[#9C8B76]">{agent.charter}</span>
                </span>
                <span className="label shrink-0 text-[8.5px] text-[var(--gold)]">
                  {openAgent === agent.id ? "Close" : "Open"}
                </span>
              </button>
            </header>

            <Rule />

            {/* ── body ─────────────────────────────────────────── */}
            <div ref={body} className="scroll-fine min-h-0 flex-1 overflow-y-auto">
              {focus === "fulfillment" && <FulfillmentPanel />}
              {focus === "atelier" && <AtelierPanel />}
              {focus === "boutique" && <BoutiquePanel />}

              <div className="px-6 pb-8 pt-2 sm:px-7">
                <Rule className="mb-4" />
                <p className="text-[10.5px] leading-relaxed text-[#B5A48E]">
                  Concept demo — simulated data. Products, customers, orders, staffing, costs and supplier terms are
                  fictional. No Shopify, carrier, warehouse, customer or financial system is connected, and nothing
                  here places an order or sends a message.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/* ── Product detail, opened from a catalogue card ─────────────────── */

export function ProductSheet() {
  const id = useStore((s) => s.openProduct);
  const close = useStore((s) => s.openProductPanel);
  const inv = useStore((s) => s.metrics.inventory);
  const f = useStore((s) => s.metrics.fulfillment);
  const avail = useStore((s) => s.metrics.boutique.availability);
  const openAgentPanel = useStore((s) => s.openAgentPanel);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && useStore.getState().openProduct) close(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const item = id ? inv.items.find((i) => i.product.id === id) : null;
  const open = !!item;
  const win = shipWindow(f);

  return (
    <div
      aria-hidden={!open}
      className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center p-5"
      style={{ opacity: open ? 1 : 0, transition: "opacity .4s var(--ease)" }}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={() => close(null)}
        className="absolute inset-0 bg-[rgba(35,30,27,.28)] backdrop-blur-[3px]"
        style={{ pointerEvents: open ? "auto" : "none" }}
      />
      {item && (
        <div
          className="panel grain pointer-events-auto relative w-[min(420px,100%)] overflow-hidden rounded-[3px]"
          style={{
            transform: open ? "none" : "scale(.97) translateY(8px)",
            transition: "transform .5s var(--ease)",
          }}
        >
          <div className="goldline absolute inset-x-0 top-0 h-px" />
          <div
            className="relative h-[190px]"
            style={{
              background: `linear-gradient(155deg, ${item.product.hex}, color-mix(in srgb, ${item.product.hex} 60%, #3A2B23))`,
            }}
          >
            <div className="absolute inset-0 grain" />
            <button
              type="button"
              onClick={() => close(null)}
              className="absolute right-3 top-3 rounded-full bg-[rgba(253,251,248,.75)] p-2 text-[var(--espresso)] backdrop-blur-md transition-transform hover:scale-105"
              aria-label="Close"
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
            {/* a suggestion of the silhouette */}
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden>
              <rect x="33" y="44" width="34" height="26" rx="4" fill="rgba(255,250,240,.16)" />
              <path d="M41 44v-5a9 9 0 0 1 18 0v5" fill="none" stroke="rgba(255,247,230,.55)" strokeWidth="1.6" />
              <rect x="46" y="52" width="8" height="4" rx="1.2" fill="rgba(255,247,230,.45)" />
            </svg>
          </div>

          <div className="px-6 pb-6 pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="eyebrow text-[8.5px] text-[#A3927C]">{item.product.line} · {item.product.category}</div>
                <h3 className="display mt-1.5 text-[26px] leading-tight text-[var(--ink)]">{item.product.name}</h3>
                <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[#8C7B66]">
                  <Swatch hex={item.product.hex} size={9} />
                  {item.product.colorway}
                  <span className="text-[#CFC0AA]">·</span>
                  <span className="num">
                    {item.product.rating}★ {n(item.product.reviews)} reviews
                  </span>
                </div>
              </div>
              <div className="display num shrink-0 text-[26px] text-[var(--ink)]">{money(item.product.price)}</div>
            </div>

            <p className="mt-3.5 text-[12.5px] leading-relaxed text-[#6E5C4D]">{item.product.blurb}</p>

            <Rule className="my-4" />

            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Field label="Availability">
                <StatusPill
                  status={avail[item.product.id] === "In stock" ? "healthy" : avail[item.product.id] === "Low stock" ? "watch" : "critical"}
                  label={avail[item.product.id]}
                  small
                />
              </Field>
              <Field label="Ships in">
                <span className="num text-[13px] text-[var(--espresso)]">{win.label}</span>
              </Field>
              <Field label="Selling">
                <span className="num text-[13px] text-[var(--espresso)]">{n(item.effVelocity)} / day</span>
              </Field>
              <Field label="Cover">
                <span className="num text-[13px] text-[var(--espresso)]">
                  {item.stockoutInDays.toFixed(1)} days
                </span>
              </Field>
            </div>

            <div className="mt-5 flex gap-2">
              <Btn variant="primary" onClick={() => openAgentPanel("concierge")} className="flex-1">
                Ask the Concierge
              </Btn>
              <Btn variant="ghost" onClick={() => close(null)}>
                Close
              </Btn>
            </div>

            <p className="mt-3 text-[9.5px] leading-relaxed text-[#B5A48E]">
              Fictional product in a concept demo. Nothing can be purchased and no inventory system is connected.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label text-[8.5px] text-[#A3927C]">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
