"use client";

import { useEffect, useRef, useState } from "react";
import { AGENTS, briefFor } from "@/lib/agents";
import { respond } from "@/lib/answers";
import { DEMO_ORDERS, byId } from "@/lib/catalog";
import { useSim, useStore, type ChatMessage } from "@/lib/store";
import { money } from "@/lib/fmt";
import { usePrefersReducedMotion } from "@/lib/motion";
import type { AgentStatus, WorldStatus } from "@/lib/types";
import { Btn, RefChip, Rule, StatusPill, Swatch, TONE } from "./bits";
import { ProductCard } from "./panels/Boutique";

const STATUS_TONE: Record<AgentStatus, WorldStatus> = {
  Monitoring: "healthy",
  Analyzing: "watch",
  Planning: "healthy",
  "Needs review": "critical",
  Completed: "healthy",
};

let seq = 0;
const nextId = () => `m${++seq}`;

export function AgentPanel() {
  const openAgent = useStore((s) => s.openAgent);
  const close = useStore((s) => s.openAgentPanel);
  const metrics = useStore((s) => s.metrics);
  const sim = useSim();
  const threads = useStore((s) => s.threads);
  const push = useStore((s) => s.pushMessage);
  const replace = useStore((s) => s.replaceLastMessage);
  const clear = useStore((s) => s.clearThread);
  const reduced = usePrefersReducedMotion();

  const [thinking, setThinking] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const id = openAgent;
  const agent = id ? AGENTS[id] : null;
  const brief = id ? briefFor(id, metrics, sim) : null;
  const thread = id ? threads[id] : [];

  useEffect(() => {
    if (!scroller.current) return;
    scroller.current.scrollTo({ top: scroller.current.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  }, [thread.length, thinking, reduced]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && useStore.getState().openAgent) close(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  function ask(q: string) {
    const target = useStore.getState().openAgent;
    if (!target || !q.trim() || thinking) return;
    push(target, { id: nextId(), role: "user", text: q.trim() });
    setThinking(true);
    push(target, { id: nextId(), role: "agent", text: "", pending: true });

    const delay = reduced ? 120 : 520 + Math.min(900, q.length * 11);
    window.setTimeout(() => {
      const s = useStore.getState();
      const reply = respond(target, q, s.metrics, {
        scenario: s.scenario,
        viralStage: s.viralStage,
        demandMultiplier: s.demandMultiplier,
        coverDays: s.coverDays,
        staffing: s.staffing,
        leadTimeAdj: s.leadTimeAdj,
        staged: s.staged,
      });
      replace(target, {
        id: nextId(),
        role: "agent",
        text: reply.text,
        refs: reply.refs,
        products: reply.products,
        order: reply.order,
      });
      setThinking(false);
    }, delay);
  }

  const open = !!id;

  return (
    <aside
      aria-hidden={!open}
      className="pointer-events-none absolute inset-x-0 bottom-0 top-[18%] z-40 flex justify-end sm:inset-y-0 sm:left-auto sm:right-0 sm:top-0 sm:w-[min(430px,92vw)] xl:right-[clamp(400px,33vw,520px)] xl:w-[clamp(340px,27vw,430px)]"
    >
      <div
        className="panel grain pointer-events-auto relative flex h-full w-full flex-col overflow-hidden rounded-t-[14px] border-t sm:rounded-none sm:border-l sm:border-t-0"
        style={{
          transform: open ? "none" : "var(--ap-closed, translateY(106%))",
          opacity: open ? 1 : 0,
          // A closed panel must not sit over the one behind it.
          pointerEvents: open ? "auto" : "none",
          transition: "transform .68s var(--ease), opacity .4s var(--ease)",
          borderColor: "rgba(58,43,35,.1)",
        }}
      >
        {agent && brief && id && (
          <>
            {/* ── identity ─────────────────────────────────────── */}
            <div className="relative shrink-0 px-5 pb-4 pt-5">
              <div className="goldline absolute inset-x-0 top-0 h-px" />
              <div className="flex items-start gap-3">
                <span
                  className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[12px] font-medium tracking-[0.06em] text-[#FBF7F2]"
                  style={{ background: agent.accent }}
                >
                  {agent.mark}
                  <span
                    className="absolute -bottom-[1px] -right-[1px] h-[11px] w-[11px] rounded-full border-2 border-[#FBF7F2]"
                    style={{ background: TONE[STATUS_TONE[brief.status]].dot }}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="display text-[20px] leading-tight text-[var(--ink)]">{agent.name}</div>
                      <div className="eyebrow mt-[3px] text-[8.5px] text-[#A3927C]">{agent.role}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => close(null)}
                      className="-mr-1 -mt-1 rounded-full p-1.5 text-[#A3927C] transition-colors hover:bg-[rgba(58,43,35,.06)] hover:text-[var(--espresso)]"
                      aria-label="Close agent panel"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                        <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                  <div className="mt-2">
                    <StatusPill status={STATUS_TONE[brief.status]} label={brief.status} small />
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-[2px] border border-[rgba(58,43,35,.08)] bg-[rgba(255,255,255,.5)] px-3 py-2.5">
                <div className="label text-[8.5px] text-[#A3927C]">Current task</div>
                <div className="mt-1 text-[12px] leading-relaxed text-[var(--espresso)]">{brief.task}</div>
              </div>
            </div>

            {/* ── scrollable body ──────────────────────────────── */}
            <div ref={scroller} className="scroll-fine min-h-0 flex-1 overflow-y-auto">
              {thread.length === 0 && <Brief brief={brief} />}

              {thread.length > 0 && (
                <div className="flex flex-col gap-4 px-5 py-5">
                  {thread.map((msg) => (
                    <Bubble key={msg.id} msg={msg} accent={agent.accent} mark={agent.mark} />
                  ))}
                </div>
              )}
            </div>

            {/* ── composer ─────────────────────────────────────── */}
            <div className="shrink-0 border-t border-[rgba(58,43,35,.08)] bg-[rgba(253,251,248,.7)] px-5 py-4">
              <div className="scroll-fine -mx-1 mb-2.5 flex gap-1.5 overflow-x-auto px-1 pb-1">
                {brief.suggested.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => ask(q)}
                    disabled={thinking}
                    className="shrink-0 rounded-full border border-[rgba(58,43,35,.14)] px-3 py-[6px] text-[10.5px] text-[#6E5C4D] transition-all duration-300 hover:border-[var(--gold)] hover:bg-[rgba(217,188,140,.12)] disabled:opacity-40"
                  >
                    {q}
                  </button>
                ))}
              </div>

              <Composer
                key={id}
                placeholder={`Ask the ${agent.name.split(" ").slice(-1)[0]}…`}
                disabled={thinking}
                onSend={ask}
              />

              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[9.5px] leading-tight text-[#B5A48E]">
                  Scripted responses computed from the simulated dataset.
                </span>
                {thread.length > 0 && (
                  <Btn size="sm" variant="quiet" onClick={() => clear(id)}>
                    Clear
                  </Btn>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

function Composer({
  placeholder,
  disabled,
  onSend,
}: {
  placeholder: string;
  disabled: boolean;
  onSend: (q: string) => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!draft.trim() || disabled) return;
        onSend(draft);
        setDraft("");
      }}
      className="flex items-center gap-2 rounded-full border border-[rgba(58,43,35,.14)] bg-white/70 px-1.5 py-1.5 transition-colors focus-within:border-[var(--gold)]"
    >
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent px-2.5 text-[12.5px] text-[var(--espresso)] outline-none placeholder:text-[#B5A48E]"
      />
      <button
        type="submit"
        disabled={!draft.trim() || disabled}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--espresso)] text-[#FBF7F2] transition-all duration-300 hover:bg-[var(--ink)] disabled:opacity-25"
        aria-label="Send"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path d="M1 6h9M7 2.6 10.4 6 7 9.4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </form>
  );
}

/* ── The standing brief, shown before a conversation starts ───────── */

function Brief({ brief }: { brief: ReturnType<typeof briefFor> }) {
  return (
    <div className="px-5 pb-6 pt-1">
      <Block title="Monitoring">
        <ul className="grid gap-1.5">
          {brief.monitoring.map((x) => (
            <li key={x} className="flex gap-2 text-[11.5px] leading-relaxed text-[#6E5C4D]">
              <span className="mt-[7px] h-[3px] w-[3px] shrink-0 rounded-full bg-[#C4B29A]" />
              {x}
            </li>
          ))}
        </ul>
      </Block>

      <Block title="What it found">
        <div className="grid gap-2">
          {brief.findings.map((f, i) => (
            <p key={i} className="text-[12px] leading-relaxed text-[#5F5043]">
              {f}
            </p>
          ))}
        </div>
      </Block>

      <Block title="Recommendations">
        <div className="grid gap-2">
          {brief.recommendations.map((r) => {
            const tone: WorldStatus = r.tone === "alert" ? "critical" : r.tone === "watch" ? "watch" : "healthy";
            return (
              <div
                key={r.title}
                className="rounded-[2px] border px-3 py-2.5"
                style={{ borderColor: `${TONE[tone].dot}44`, background: TONE[tone].bg }}
              >
                <div className="text-[12px] font-medium leading-snug" style={{ color: TONE[tone].fg }}>
                  {r.title}
                </div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-[#6E5C4D]">{r.detail}</p>
              </div>
            );
          })}
        </div>
      </Block>

      <Block title="Supporting data">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {brief.data.map((d) => (
            <div key={d.label} className="min-w-0">
              <div className="label text-[8.5px] text-[#A3927C]">{d.label}</div>
              <div className="display num mt-0.5 truncate text-[16px] text-[var(--ink)]">{d.value}</div>
              {d.note && <div className="truncate text-[10px] text-[#A3927C]">{d.note}</div>}
            </div>
          ))}
        </div>
      </Block>

      <Block title="Activity">
        <ol className="relative grid gap-3 pl-4">
          <span className="absolute left-[3px] top-1.5 h-[calc(100%-12px)] w-px bg-[rgba(58,43,35,.1)]" />
          {brief.history.map((h, i) => (
            <li key={i} className="relative">
              <span
                className="absolute -left-4 top-[5px] h-[7px] w-[7px] rounded-full border-2 border-[#FBF7F2]"
                style={{ background: TONE[STATUS_TONE[h.status]].dot }}
              />
              <div className="flex items-baseline gap-2">
                <span className="num text-[9.5px] text-[#B5A48E]">{h.when}</span>
                <span className="label text-[8px]" style={{ color: TONE[STATUS_TONE[h.status]].fg }}>
                  {h.status}
                </span>
              </div>
              <div className="mt-0.5 text-[11.5px] leading-snug text-[#6E5C4D]">{h.text}</div>
            </li>
          ))}
        </ol>
      </Block>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="pt-5 first:pt-4">
      <div className="mb-2.5 flex items-center gap-2.5">
        <span className="eyebrow text-[8.5px] text-[#A3927C]">{title}</span>
        <span className="h-px flex-1 bg-[rgba(58,43,35,.08)]" />
      </div>
      {children}
    </section>
  );
}

/* ── Chat bubbles ─────────────────────────────────────────────────── */

function Bubble({ msg, accent, mark }: { msg: ChatMessage; accent: string; mark: string }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[86%] rounded-[3px] rounded-tr-none bg-[var(--espresso)] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-[#F7F2EC]">
          {msg.text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5">
      <span
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[8px] font-medium tracking-[0.05em] text-[#FBF7F2]"
        style={{ background: accent }}
      >
        {mark}
      </span>
      <div className="min-w-0 flex-1">
        {msg.pending ? (
          <div className="flex items-center gap-1.5 py-2">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-[5px] w-[5px] rounded-full bg-[#C4B29A]"
                style={{ animation: `breathe 1.2s ease-in-out ${i * 0.18}s infinite` }}
              />
            ))}
          </div>
        ) : (
          <>
            <div className="whitespace-pre-wrap rounded-[3px] rounded-tl-none border border-[rgba(58,43,35,.08)] bg-white/65 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-[#4F4238]">
              {msg.text}
            </div>

            {msg.products && msg.products.length > 0 && (
              <div className="mt-2 grid gap-1.5">
                {msg.products.map((p) => (
                  <ProductCard key={p} id={p} compact />
                ))}
              </div>
            )}

            {msg.order && <OrderCard id={msg.order} />}

            {msg.refs && msg.refs.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {msg.refs.map((r) => (
                  <RefChip key={r}>{r}</RefChip>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function OrderCard({ id }: { id: string }) {
  const o = DEMO_ORDERS.find((x) => x.id === id);
  if (!o) return null;
  const steps = ["Preparing", "Packed", "In transit", "Delivered"] as const;
  const at = steps.indexOf(o.state);
  return (
    <div className="card mt-2 rounded-[2px] p-3">
      <div className="flex items-baseline justify-between">
        <span className="num text-[12px] font-medium text-[var(--espresso)]">{o.id}</span>
        <span className="num text-[10px] text-[#A3927C]">{o.placed}</span>
      </div>

      <div className="mt-2.5 flex items-center">
        {steps.map((s, i) => (
          <div key={s} className="flex flex-1 items-center last:flex-none">
            <span
              className="h-[7px] w-[7px] shrink-0 rounded-full transition-colors"
              style={{ background: i <= at ? "var(--gold)" : "rgba(58,43,35,.14)" }}
            />
            {i < steps.length - 1 && (
              <span
                className="h-px flex-1"
                style={{ background: i < at ? "var(--champagne)" : "rgba(58,43,35,.12)" }}
              />
            )}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between">
        <span className="label text-[8px] text-[var(--gold)]">{o.state}</span>
        <span className="text-[10px] text-[#A3927C]">{o.eta}</span>
      </div>

      <Rule className="my-2.5" />
      <div className="grid gap-1">
        {o.items.map((it) => {
          const p = byId(it.productId);
          return (
            <div key={it.productId} className="flex items-center gap-2 text-[11px] text-[#6E5C4D]">
              <Swatch hex={p.hex} size={8} />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="num text-[#A3927C]">×{it.qty}</span>
              <span className="num text-[var(--espresso)]">{money(p.price * it.qty)}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-[9.5px] text-[#B5A48E]">
        Fictional record · {o.carrier}{o.tracking !== "—" ? ` · ${o.tracking}` : ""}
      </div>
    </div>
  );
}
