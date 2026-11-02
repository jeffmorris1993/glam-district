"use client";

import { useMemo, useState } from "react";
import { PRODUCTS } from "@/lib/catalog";
import { shipWindow } from "@/lib/sim";
import { useStore } from "@/lib/store";
import { compactMoney, money, n, pct } from "@/lib/fmt";
import type { Product } from "@/lib/types";
import { Btn, Empty, Rule, Stat, StatusPill, Swatch, TONE } from "../bits";
import { Section, SubHead } from "./shell";

const AVAIL_TONE = {
  "In stock": "healthy",
  "Low stock": "watch",
  Waitlist: "critical",
} as const;

const CATEGORIES = ["All", "Handbag", "Tote", "Crossbody", "Clutch", "Accessory"] as const;
const PRICE_BANDS = [
  { key: "any", label: "Any price", test: () => true },
  { key: "u50", label: "Under $50", test: (p: Product) => p.price < 50 },
  { key: "u100", label: "Under $100", test: (p: Product) => p.price < 100 },
  { key: "o100", label: "$100+", test: (p: Product) => p.price >= 100 },
] as const;

export function ProductCard({ id, compact }: { id: string; compact?: boolean }) {
  const inv = useStore((s) => s.metrics.inventory);
  const avail = useStore((s) => s.metrics.boutique.availability);
  const open = useStore((s) => s.openProductPanel);
  const item = inv.items.find((i) => i.product.id === id);
  if (!item) return null;
  const p = item.product;
  const a = avail[id];

  return (
    <button
      type="button"
      onClick={() => open(id)}
      className="card group flex w-full gap-3 rounded-[2px] p-2.5 text-left transition-all duration-300 hover:-translate-y-px hover:border-[var(--champagne)]"
    >
      <span
        className="relative block shrink-0 overflow-hidden rounded-[2px]"
        style={{
          width: compact ? 44 : 56,
          height: compact ? 54 : 68,
          background: `linear-gradient(150deg, ${p.hex}, color-mix(in srgb, ${p.hex} 66%, #3A2B23))`,
          boxShadow: "inset 0 0 0 1px rgba(58,43,35,.14)",
        }}
      >
        {/* a hint of hardware so the swatch reads as a bag */}
        <span
          className="absolute left-1/2 top-[18%] block h-[22%] w-[42%] -translate-x-1/2 rounded-t-full border"
          style={{ borderColor: "rgba(255,247,230,.6)", borderBottom: "none" }}
        />
        <span
          className="absolute inset-x-[18%] bottom-[22%] block h-[2px] rounded-full"
          style={{ background: "rgba(255,247,230,.5)" }}
        />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            <span className="block truncate text-[12.5px] font-medium text-[var(--espresso)]">{p.name}</span>
            <span className="mt-[2px] flex items-center gap-1.5 text-[10px] text-[#A3927C]">
              <Swatch hex={p.hex} size={7} />
              {p.colorway}
            </span>
          </span>
          <span className="display num shrink-0 text-[15px] text-[var(--ink)]">{money(p.price)}</span>
        </span>

        <span className="mt-1.5 flex items-center gap-2">
          <StatusPill status={AVAIL_TONE[a]} label={a} small />
          <span className="num text-[9.5px] text-[#B5A48E]">
            {p.rating}★ {n(p.reviews)}
          </span>
        </span>

        {!compact && (
          <span className="mt-1.5 block line-clamp-2 text-[11px] leading-snug text-[#8C7B66]">{p.blurb}</span>
        )}
      </span>
    </button>
  );
}

export function BoutiquePanel() {
  const b = useStore((s) => s.metrics.boutique);
  const f = useStore((s) => s.metrics.fulfillment);
  const openAgentPanel = useStore((s) => s.openAgentPanel);
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("All");
  const [band, setBand] = useState<(typeof PRICE_BANDS)[number]["key"]>("any");

  const win = shipWindow(f);
  const list = useMemo(() => {
    const t = PRICE_BANDS.find((x) => x.key === band)!;
    return PRODUCTS.filter((p) => (cat === "All" || p.category === cat) && t.test(p));
  }, [cat, band]);

  return (
    <>
      <Section>
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Sessions today" value={n(b.sessions)} note={`${pct(b.conversion, 2)} conversion`} size="lg" />
          <Stat label="Orders today" value={n(b.ordersToday)} note={`${money(b.aov)} average`} size="lg" />
          <Stat label="Revenue today" value={compactMoney(b.revenueToday)} note={`${n(b.inquiries)} questions`} size="lg" />
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 rounded-[2px] border border-[rgba(58,43,35,.08)] bg-[rgba(255,255,255,.5)] px-3.5 py-2.5">
          <div>
            <div className="label text-[9px] text-[#8C7B66]">Quoted ship window</div>
            <div className="display mt-0.5 text-[16px] text-[var(--ink)]">{win.label}</div>
          </div>
          <div className="text-right text-[10.5px] leading-snug text-[#A3927C]">
            read live from the
            <br />
            Fulfillment House pick plan
          </div>
        </div>
      </Section>

      <Rule />

      {/* ── the concierge entry ────────────────────────────────── */}
      <Section>
        <button
          type="button"
          onClick={() => openAgentPanel("concierge")}
          className="group relative block w-full overflow-hidden rounded-[2px] border border-[rgba(58,43,35,.1)] bg-gradient-to-br from-[rgba(233,211,205,.3)] to-[rgba(253,251,248,.6)] p-5 text-left transition-all duration-500 hover:border-[var(--champagne)]"
        >
          <div className="goldline absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
          <div className="flex items-start gap-3.5">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[11px] font-medium tracking-[0.06em] text-[#FBF7F2]"
              style={{ background: "#A96C68" }}
            >
              GC
            </span>
            <div className="min-w-0">
              <div className="display text-[20px] leading-tight text-[var(--ink)]">Speak with the Glam Concierge</div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-[#7C6B59]">
                Shop the demo catalogue, check availability, ask about shipping or look up one of three fictional
                orders. Answers come from the live simulated state — never invented.
              </p>
              <span className="label mt-3 inline-flex items-center gap-1.5 text-[9px] text-[var(--gold)]">
                Open the conversation
                <svg width="12" height="7" viewBox="0 0 14 7" fill="none" aria-hidden className="transition-transform duration-500 group-hover:translate-x-1">
                  <path d="M0 3.5h12M8.8 .6 12 3.5 8.8 6.4" stroke="currentColor" strokeWidth=".9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
          </div>
        </button>
      </Section>

      <Rule />

      {/* ── the edit ───────────────────────────────────────────── */}
      <Section>
        <SubHead title="The edit" note={`${PRODUCTS.length} styles · availability from live simulated stock`} />

        <div className="mt-3.5 flex flex-wrap gap-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className="label rounded-full px-2.5 py-[5px] text-[9px] transition-colors duration-300"
              style={{
                background: cat === c ? "var(--espresso)" : "rgba(58,43,35,.05)",
                color: cat === c ? "#FBF7F2" : "#7C6B59",
              }}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {PRICE_BANDS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setBand(p.key)}
              className="label rounded-full border px-2.5 py-[5px] text-[9px] transition-colors duration-300"
              style={{
                borderColor: band === p.key ? "var(--gold)" : "rgba(58,43,35,.12)",
                color: band === p.key ? "var(--gold)" : "#9C8B76",
                background: band === p.key ? "rgba(217,188,140,.12)" : "transparent",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-2">
          {list.length ? (
            list.map((p) => <ProductCard key={p.id} id={p.id} />)
          ) : (
            <Empty
              title="Nothing in this edit"
              note="Loosen the price band or choose another category — the demo catalogue holds eight styles."
            />
          )}
        </div>
      </Section>

      <Rule />

      <Section>
        <SubHead title="What the concierge is allowed to say" />
        <div className="mt-3 grid gap-2">
          {[
            ["Catalogue", "Eight fictional styles, $38–$168, with prices, colourways and copy from the demo data."],
            ["Availability", "In stock, low stock or waitlist — derived from the same inventory the Atelier plans against."],
            ["Shipping", `Example policy plus the live ${win.label} window from the pick plan.`],
            ["Orders", "Three fictional order records. No real order, tracking or carrier system is connected."],
          ].map(([t, d]) => (
            <div key={t} className="flex gap-3 rounded-[2px] border border-[rgba(58,43,35,.07)] bg-[rgba(255,255,255,.45)] px-3.5 py-2.5">
              <span className="mt-[6px] h-[5px] w-[5px] shrink-0 rounded-full" style={{ background: TONE.healthy.dot }} />
              <div className="min-w-0">
                <div className="label text-[9px] text-[#8C7B66]">{t}</div>
                <div className="mt-1 text-[11.5px] leading-relaxed text-[#6E5C4D]">{d}</div>
              </div>
            </div>
          ))}
        </div>
        <Btn variant="ghost" size="sm" className="mt-4" onClick={() => openAgentPanel("concierge")}>
          Ask the Glam Concierge
        </Btn>
      </Section>
    </>
  );
}
