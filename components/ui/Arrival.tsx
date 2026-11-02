"use client";

import { useStore } from "@/lib/store";
import { GoldRule } from "./bits";

/* ─────────────────────────────────────────────────────────────────
   SCREEN 1 — cinematic arrival. The world makes the first impression;
   the type sits quietly on top of it.
   ───────────────────────────────────────────────────────────────── */

export function Arrival() {
  const phase = useStore((s) => s.phase);
  const enter = useStore((s) => s.enter);
  const open = phase === "arrival";

  return (
    <div
      aria-hidden={!open}
      className="pointer-events-none absolute inset-0 z-30 transition-opacity duration-[900ms]"
      style={{
        opacity: open ? 1 : 0,
        transitionTimingFunction: "var(--ease)",
        visibility: open ? "visible" : "hidden",
      }}
    >
      {/* a soft wash so the wordmark holds against the model */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(249,245,239,.9) 0%, rgba(249,245,239,.4) 22%, rgba(247,242,236,0) 46%, rgba(243,236,228,.34) 78%, rgba(238,229,217,.82) 94%, rgba(232,222,209,.95) 100%)",
        }}
      />

      {/* a soft bloom behind the wordmark */}
      <div
        className="absolute inset-x-0 top-0 h-[56%]"
        style={{
          background:
            "radial-gradient(44% 56% at 50% 34%, rgba(252,249,245,.85) 0%, rgba(250,246,240,.45) 56%, rgba(250,246,240,0) 82%)",
        }}
      />

      <div className="absolute inset-0 flex flex-col items-center px-6 py-8 sm:py-10">
        {/* ── top: credit + demo mark ─────────────────────────── */}
        <div
          className="flex w-full max-w-[1400px] items-start justify-between"
          style={{ animation: open ? "fadeIn .9s var(--ease) .15s both" : undefined }}
        >
          <div className="eyebrow text-[#9C8B76]">A concept by Sirrom Studios</div>
          <div className="flex items-center gap-2 rounded-full border border-[rgba(58,43,35,.14)] bg-[rgba(253,251,248,.7)] px-3 py-1.5 backdrop-blur-md">
            <span className="h-[5px] w-[5px] rounded-full bg-[var(--gold)] a-breathe" />
            <span className="eyebrow text-[var(--espresso)]">Concept Demo — Simulated Data</span>
          </div>
        </div>

        {/* ── wordmark, held in the sky above the model ────────── */}
        <div className="mt-[5.5vh] flex flex-col items-center text-center sm:mt-[7vh]">
          <div
            className="eyebrow mb-5 text-[#A3927C]"
            style={{ animation: open ? "fadeUp .9s var(--ease) .3s both" : undefined }}
          >
            Glamaholic Lifestyle
          </div>

          <h1
            className="display select-none text-[clamp(40px,7vw,104px)] leading-[0.88] tracking-[-0.03em] text-[var(--ink)]"
            style={{ animation: open ? "fadeUp 1.1s var(--ease) .38s both" : undefined }}
          >
            Glam <span className="display-it">District</span>
          </h1>

          <div
            className="mt-4 w-[clamp(110px,16vw,210px)]"
            style={{ animation: open ? "fadeIn 1.2s var(--ease) .7s both" : undefined }}
          >
            <GoldRule />
          </div>

          <p
            className="mt-4 max-w-[42ch] text-[clamp(12px,1.2vw,15px)] font-light leading-relaxed tracking-[0.01em] text-[#5B4C40]"
            style={{ animation: open ? "fadeUp 1s var(--ease) .62s both" : undefined }}
          >
            An AI-powered world behind the business.
          </p>
        </div>

        <div className="flex-1" />

        {/* ── bottom: the one call to action ──────────────────── */}
        <div
          className="pointer-events-auto flex w-full max-w-[1400px] flex-col items-center gap-5"
          style={{ animation: open ? "fadeUp 1s var(--ease) .85s both" : undefined }}
        >
          <button
            type="button"
            onClick={enter}
            className="group relative overflow-hidden rounded-full bg-[var(--espresso)] px-9 py-[15px] text-[#FBF7F2] shadow-[0_2px_4px_rgba(35,30,27,.16),0_16px_40px_-14px_rgba(35,30,27,.6)] transition-all duration-500 hover:bg-[var(--ink)] hover:shadow-[0_4px_8px_rgba(35,30,27,.2),0_22px_50px_-16px_rgba(35,30,27,.7)]"
            style={{ transitionTimingFunction: "var(--ease)" }}
          >
            <span className="label relative z-10 flex items-center gap-3 text-[10.5px]">
              Explore the District
              <svg width="16" height="8" viewBox="0 0 16 8" fill="none" aria-hidden className="transition-transform duration-500 group-hover:translate-x-1">
                <path d="M0 4h14M10.5 .8 14 4l-3.5 3.2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span
              className="absolute inset-y-0 -left-full w-1/2 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(232,209,164,.35), transparent)",
                animation: "sweep 1.6s var(--ease) infinite",
              }}
            />
          </button>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-center">
            {["The Fulfillment House", "The Buying Atelier", "The Glam Boutique"].map((x, i) => (
              <span key={x} className="flex items-center gap-5">
                {i > 0 && <span className="h-[3px] w-[3px] rounded-full bg-[#CBBCA6]" />}
                <span className="eyebrow text-[#A3927C]">{x}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
