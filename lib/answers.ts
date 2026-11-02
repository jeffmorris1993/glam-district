import { DEMO_ORDERS, HERO_ID, POLICIES, PRODUCTS, byId } from "./catalog";
import { ASSUMPTIONS, derive, shipWindow, type LiveState } from "./sim";
import { pickersToClear, type Situation } from "./scenarios";
import type { FlowState } from "./engine";
import { clockLabel } from "./engine";
import { compactMoney, days, money, n, pct } from "./fmt";
import type { AgentId, Metrics, SimState } from "./types";

/* ════════════════════════════════════════════════════════════════════
   SCRIPTED AGENT RESPONSES
   Intent matching over a fixed set of behaviours. Every figure quoted
   is read from, or re-derived through, the deterministic simulation —
   nothing here is free-text invention.
   ════════════════════════════════════════════════════════════════════ */

/** Deterministic Scenario Lab operations a reply can carry. */
export interface LabOps {
  create?: { name: string; patch: Partial<SimState>; note?: string }[];
  /** scenario names (or fresh creations) to place side-by-side */
  compareNames?: string[];
  open?: boolean;
}

export interface ReplyCtx {
  flow?: FlowState;
  situations?: Situation[];
}

export interface AgentReply {
  text: string;
  refs: string[];
  products?: string[];
  order?: string;
  labOps?: LabOps;
}

const WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, fifty: 50, hundred: 100,
  dozen: 12, "a couple": 2, "a few": 3,
};

function firstNumber(q: string): number | null {
  const digits = q.replace(/,/g, "").match(/\d+(\.\d+)?/);
  if (digits) return parseFloat(digits[0]);
  for (const [w, v] of Object.entries(WORDS)) {
    if (new RegExp(`\\b${w}\\b`).test(q)) return v;
  }
  return null;
}

const has = (q: string, ...terms: string[]) => terms.some((t) => q.includes(t));

function matchProduct(q: string) {
  const l = q.toLowerCase();
  return (
    PRODUCTS.find((p) => l.includes(p.name.toLowerCase())) ??
    PRODUCTS.find((p) => l.includes(p.line.toLowerCase())) ??
    null
  );
}

/* ── Fulfillment Analyst ─────────────────────────────────────────── */

function analystReply(q: string, m: Metrics, s: SimState, live: LiveState): AgentReply {
  const f = m.fulfillment;
  const avgUnits = f.openUnits / Math.max(1, f.openOrders);
  const plan = `Pick plan · ${s.staffing.pickers} associates × ${s.staffing.shiftHours}h${s.staffing.secondShift ? " × 2 shifts" : ""}`;
  const labor = (p: number, second = s.staffing.secondShift) =>
    derive({ ...s, staffing: { ...s.staffing, pickers: p, secondShift: second } }, live).fulfillment;

  // "compare a second shift against temporary staffing" — before the staffing
  // branch, which would otherwise swallow the word "staffing".
  if (has(q, "compare") && has(q, "second shift")) {
    const clear = pickersToClear(s, live) ?? Math.min(48, s.staffing.pickers + 10);
    const temps = labor(clear);
    const shift = labor(s.staffing.pickers, true);
    return {
      text:
        `Side by side, from the same book:\n\n` +
        `• Temporary staffing (${clear} associates) — ${n(temps.capacityUnits)} units/day, at-risk ${n(temps.atRisk)}, labor ${money(temps.laborCostDay)}/day, ${money(temps.costPerOrder, 2)}/order.\n` +
        `• Second shift (same roster, doubled hours at the 8% penalty) — ${n(shift.capacityUnits)} units/day, at-risk ${n(shift.atRisk)}, labor ${money(shift.laborCostDay)}/day, ${money(shift.costPerOrder, 2)}/order.\n\n` +
        `Temps are the cheaper path to clearing the book; the second shift buys more throughput than you need at a higher bill — but ramps nothing (your existing team, after hours). I've put both in the Scenario Lab so you can weigh them.`,
      refs: [plan, `Projections · derive() on the live book`],
      labOps: {
        create: [
          {
            name: `Add ${Math.max(0, clear - s.staffing.pickers)} temps`,
            patch: { staffing: { ...s.staffing, pickers: clear } },
            note: "Sized to clear every promise.",
          },
          {
            name: "Second shift",
            patch: { staffing: { ...s.staffing, secondShift: true } },
            note: "Same roster, doubled hours, 8% off-shift penalty.",
          },
        ],
        compareNames: [`Add ${Math.max(0, clear - s.staffing.pickers)} temps`, "Second shift"],
        open: true,
      },
    };
  }

  // "what's the cheapest approach?"
  if (has(q, "cheapest", "lowest cost", "least expensive", "cheapest option")) {
    const clear = pickersToClear(s, live);
    const candidates: { name: string; f: ReturnType<typeof labor>; patch: Partial<SimState> }[] = [
      { name: "Hold course", f, patch: {} },
    ];
    if (clear && clear > s.staffing.pickers)
      candidates.push({
        name: `Add ${clear - s.staffing.pickers} temps`,
        f: labor(clear),
        patch: { staffing: { ...s.staffing, pickers: clear } },
      });
    if (!s.staffing.secondShift)
      candidates.push({
        name: "Second shift",
        f: labor(s.staffing.pickers, true),
        patch: { staffing: { ...s.staffing, secondShift: true } },
      });
    if (s.priorityPolicy === "promise-first")
      candidates.push({
        name: "Reprioritize: value first",
        f: derive({ ...s, priorityPolicy: "value-first" }, live).fulfillment,
        patch: { priorityPolicy: "value-first" },
      });
    const ranked = candidates.slice().sort((a, b) => a.f.laborCostDay - b.f.laborCostDay);
    return {
      text:
        `Ranked purely by daily labor cost:\n\n` +
        ranked
          .map(
            (c, i) =>
              `${i + 1}. ${c.name} — ${money(c.f.laborCostDay)}/day, at-risk ${n(c.f.atRisk)}, on-time ${pct(c.f.onTimeRate, 0)}`,
          )
          .join("\n") +
        `\n\nCheapest is not free: every dollar saved here is paid in late promises or customer experience. ` +
        `If cost is your binding constraint, the top of this list is your answer — compare before you commit.`,
      refs: [plan, "Ranking · laborCostDay ascending, deterministic"],
      labOps: {
        create: ranked
          .filter((c) => c.name !== "Hold course")
          .slice(0, 2)
          .map((c) => ({ name: c.name, patch: c.patch, note: "Created from your cost question." })),
        open: false,
      },
    };
  }

  // "what option protects the most customers?"
  if (has(q, "protect", "most customers", "customer experience", "least late")) {
    const clear = pickersToClear(s, live);
    const options: { name: string; f: ReturnType<typeof labor> }[] = [
      { name: "Hold course", f },
      ...(clear && clear > s.staffing.pickers
        ? [{ name: `Add ${clear - s.staffing.pickers} temps`, f: labor(clear) }]
        : []),
      ...(!s.staffing.secondShift ? [{ name: "Second shift", f: labor(s.staffing.pickers, true) }] : []),
      {
        name: "Reprioritize: value first",
        f: derive({ ...s, priorityPolicy: "value-first" }, live).fulfillment,
      },
    ];
    const ranked = options.slice().sort((a, b) => a.f.atRisk - b.f.atRisk || a.f.laborCostDay - b.f.laborCostDay);
    const best = ranked[0];
    return {
      text:
        `Measured by promises kept (fewest orders at risk):\n\n` +
        ranked
          .map((o, i) => `${i + 1}. ${o.name} — ${n(o.f.atRisk)} at risk, ${pct(o.f.onTimeRate, 0)} on-time, ${money(o.f.laborCostDay)}/day`)
          .join("\n") +
        `\n\n${best.name} protects the most customers on this book. Note that value-first ranks ${ranked.findIndex((o) => o.name.includes("value")) + 1} of ${ranked.length} here — it protects revenue, not promises. The trade is yours to make.`,
      refs: [plan, "Ranking · atRisk ascending, deterministic"],
    };
  }

  // "launch readiness" — before the handle-another branch ("another drop").
  if (has(q, "launch", "readiness", "ready for a drop", "another drop", "drop-ready")) {
    const hypoQueue = (live.queueUnits ?? f.openUnits) + 4000;
    const hypo = derive({ ...s, demandMultiplier: s.demandMultiplier * 2 }, { ...live, queueUnits: hypoQueue });
    const need = pickersToClear({ ...s, demandMultiplier: s.demandMultiplier * 2 }, { ...live, queueUnits: hypoQueue });
    const headroom = Math.max(0, 1 - f.utilization);
    return {
      text:
        `Stress-testing a hypothetical drop — demand at ${(s.demandMultiplier * 2).toFixed(1)}× and ~4,000 surge units landing on today's queue:\n\n` +
        `• Current headroom: ${pct(headroom, 0)} of capacity unused.\n` +
        `• Under the drop: backlog reaches ${days(hypo.fulfillment.backlogDays)}, ${n(hypo.fulfillment.atRisk)} orders at risk at today's roster.\n` +
        `• Staffing to hold promises through it: ${need ? `${need} associates (${need - s.staffing.pickers > 0 ? "+" : ""}${need - s.staffing.pickers} vs. today)` : "beyond 120 — a second shift becomes necessary"}.\n\n` +
        `I've staged a drop-ready roster in the Scenario Lab — a simulated readiness check, not a commitment.`,
      refs: [plan, "Hypothetical · 2× demand + 4,000 surge units"],
      labOps: need
        ? {
            create: [
              {
                name: "Drop-ready staffing",
                patch: { staffing: { ...s.staffing, pickers: need } },
                note: "Sized to hold every promise through a hypothetical viral drop.",
              },
            ],
          }
        : undefined,
    };
  }

  // "create another option with a lower budget"
  if (has(q, "lower budget", "cheaper option", "smaller budget", "less money", "lower cost option")) {
    const clear = pickersToClear(s, live) ?? Math.min(48, s.staffing.pickers + 10);
    const cap = labor(clear).laborCostDay * 0.8;
    let best = s.staffing.pickers;
    for (let p = clear; p >= s.staffing.pickers; p--) {
      if (labor(p).laborCostDay <= cap) {
        best = p;
        break;
      }
    }
    const bf = labor(best);
    return {
      text:
        `Working to roughly 80% of the full-clear budget (${money(cap)}/day): the best plan inside it is ${best} associates — ` +
        `${n(bf.capacityUnits)} units/day, at-risk ${n(bf.atRisk)}, ${money(bf.laborCostDay)}/day. ` +
        (bf.atRisk > 0
          ? `That leaves ${n(bf.atRisk)} orders past their promise — the price of the smaller budget, stated plainly.`
          : `It still clears every promise.`) +
        ` It's in the Lab for comparison.`,
      refs: [plan, `Budget cap · ${money(cap)}/day (80% of full clear)`],
      labOps: {
        create: [
          {
            name: `Budget plan (${best} associates)`,
            patch: { staffing: { ...s.staffing, pickers: best } },
            note: "Constrained to ~80% of the full-clear labor budget.",
          },
        ],
        open: true,
      },
    };
  }

  // "what happens if I add five workers" / staffing changes
  if (has(q, "add", "hire", "more worker", "more associate", "more picker", "staff", "headcount", "remove", "cut")) {
    const delta = firstNumber(q) ?? 5;
    const dir = has(q, "remove", "cut", "fewer", "lose") ? -1 : 1;
    const next = Math.max(1, Math.min(60, s.staffing.pickers + dir * delta));
    const alt = derive({ ...s, staffing: { ...s.staffing, pickers: next } }, live).fulfillment;
    const clear = pickersToClear(s, live);
    const riskDelta = f.atRisk - alt.atRisk;
    return {
      text:
        `At ${next} associates the floor turns ${n(alt.capacityUnits)} units a day instead of ${n(f.capacityUnits)}. ` +
        `The book clears in ${days(alt.backlogDays)} rather than ${days(f.backlogDays)}, and orders at risk move from ` +
        `${n(f.atRisk)} to ${n(alt.atRisk)}${riskDelta > 0 ? ` — ${n(riskDelta)} orders recovered, ${compactMoney(f.atRiskValue - alt.atRiskValue)} of revenue` : ""}. ` +
        `Labour goes from ${money(f.laborCostDay)} to ${money(alt.laborCostDay)} a day, which lands cost per order at ${money(alt.costPerOrder, 2)}. ` +
        (alt.atRisk > 0
          ? clear
            ? `To clear the book entirely you need ${clear} associates — ${clear - s.staffing.pickers} more than today.`
            : `Even at 60 associates some orders miss; a second shift would be the next lever.`
          : `That clears every promise in the book.`) +
        ` I've added this as a draft in the Scenario Lab so you can compare it.`,
      refs: [plan, `Open book · ${n(f.openOrders)} orders`, `Labour rate · ${money(ASSUMPTIONS.laborRate, 2)}/hr`],
      labOps: {
        create: [
          {
            name: `${dir > 0 ? "Add" : "Cut"} ${delta} associates`,
            patch: { staffing: { ...s.staffing, pickers: next } },
            note: "Created from your what-if question.",
          },
        ],
      },
    };
  }

  // "can we handle another 2,000 orders"
  if (has(q, "another", "handle", "absorb", "take on", "extra order", "more order")) {
    const extra = firstNumber(q) ?? 2000;
    const extraUnits = extra * avgUnits;
    const newUnits = f.openUnits + extraUnits;
    const newBacklog = newUnits / f.capacityUnits;
    const needed = Math.ceil(newUnits / 2 / (s.staffing.shiftHours * s.staffing.unitsPerLaborHour));
    return {
      text:
        `${n(extra)} more orders is about ${n(extraUnits)} units at the current ${avgUnits.toFixed(2)} units per order. ` +
        `That takes the book to ${n(newUnits)} units, or ${days(newBacklog)} at today's ${n(f.capacityUnits)} units/day. ` +
        (newBacklog <= 2
          ? `Standard orders are promised in two days, so yes — the current plan absorbs it.`
          : `Standard orders are promised in two days, so no, not at this staffing. Holding a two-day promise needs roughly ${needed} associates (${needed - s.staffing.pickers} more than today), or the same floor running a second shift.`),
      refs: [plan, `Open book · ${n(f.openUnits)} units`, `Promise · 2 business days standard`],
    };
  }

  // "which orders need attention"
  if (has(q, "attention", "at risk", "risk", "late", "miss", "behind", "problem", "today")) {
    const top = f.queue.filter((o) => o.atRisk).slice(0, 3);
    if (f.atRisk === 0) {
      return {
        text:
          `Nothing needs intervention. All ${n(f.openOrders)} open orders are scheduled on or before their promise date, ` +
          `and the floor is running at ${pct(f.utilization)} of capacity. ` +
          `The tightest cohort is the ${n(f.byDay[1].orders)} orders sequenced for day two — they have about ${days(2 - f.backlogDays)} of slack.`,
        refs: [plan, `Queue · sorted by promise date, tier, value`],
      };
    }
    return {
      text:
        `${n(f.atRisk)} orders will miss their promise at the current plan — ${compactMoney(f.atRiskValue)} of revenue, ` +
        `${pct(f.atRisk / f.openOrders)} of the book. They are all standard-tier orders promised in two days that the queue pushes to day ${f.byDay.findIndex((d) => d.orders > 0 && d.day > 2) + 1 || 3}. ` +
        (top.length
          ? `The first three by value: ${top.map((o) => `${o.id} (${o.customer}, ${o.city} — ${money(o.value)})`).join("; ")}. `
          : "") +
        `VIP and Express are unaffected; the queue protects them first.`,
      refs: [plan, `At-risk cohort · ${n(f.atRisk)} orders`, `Queue · promise date → tier → value`],
    };
  }

  // "create tomorrow's plan"
  if (has(q, "plan", "tomorrow", "schedule", "shift", "roster", "next day")) {
    const clear = pickersToClear(s, live);
    const target = clear ?? s.staffing.pickers;
    const alt = derive({ ...s, staffing: { ...s.staffing, pickers: target } }, live).fulfillment;
    return {
      text:
        `Tomorrow's plan, computed from the current book:\n\n` +
        `• Staff ${target} associates on an ${s.staffing.shiftHours}-hour shift — ${n(alt.capacityUnits)} units of capacity.\n` +
        `• Sequence by promise date, then tier, then order value. That puts ${n(alt.byDay[0].orders)} orders out tomorrow and ${n(alt.byDay[1].orders)} the day after.\n` +
        `• ${alt.atRisk === 0 ? "No orders breach their promise." : `${n(alt.atRisk)} orders still breach; escalate those to Express at the carrier.`}\n` +
        `• Labour runs ${money(alt.laborCostDay)}, landing cost per order at ${money(alt.costPerOrder, 2)}.\n\n` +
        `This is a simulated plan against demo data — it is not a staffing instruction.`,
      refs: [plan, `Capacity model · ${s.staffing.unitsPerLaborHour} units/labour-hour`, `Open book · ${n(f.openOrders)} orders`],
    };
  }

  // cost
  if (has(q, "cost", "spend", "budget", "labour", "labor", "margin")) {
    return {
      text:
        `Labour is ${money(f.laborCostDay)} a day (${s.staffing.pickers} associates × ${s.staffing.shiftHours}h at ${money(ASSUMPTIONS.laborRate, 2)}), ` +
        `plus ${money(ASSUMPTIONS.fixedOverheadDay)} of fixed facility overhead and ${money(ASSUMPTIONS.packagingPerOrder, 2)} of packaging per order. ` +
        `Against ${n(f.shippedToday)} orders shipped that is ${money(f.costPerOrder, 2)} per order. ` +
        `Adding capacity lowers the fixed-cost share: the same question at ${s.staffing.pickers + 6} associates gives ` +
        `${money(derive({ ...s, staffing: { ...s.staffing, pickers: s.staffing.pickers + 6 } }, live).fulfillment
        .costPerOrder, 2)}.`,
      refs: [plan, `Cost model · labour + overhead + packaging`],
    };
  }

  return {
    text:
      `The book is ${n(f.openOrders)} orders / ${n(f.openUnits)} units against ${n(f.capacityUnits)} units of capacity — ` +
      `${days(f.backlogDays)} of work, ${pct(f.onTimeRate, 1)} on-time, ${n(f.atRisk)} orders at risk. ` +
      `Ask me what happens if you change staffing, whether the floor can absorb more volume, or for tomorrow's plan.`,
    refs: [plan, `Open book · ${n(f.openOrders)} orders`],
  };
}

/* ── Inventory Strategist ────────────────────────────────────────── */

function strategistReply(q: string, m: Metrics, s: SimState, live: LiveState): AgentReply {
  const inv = m.inventory;
  const assume = `Assumptions · ${s.demandMultiplier.toFixed(2)}× demand, ${s.coverDays}-day cover`;
  const named = matchProduct(q);

  // "what happens if demand doubles" / halves
  if (has(q, "double", "doubles", "triple", "halve", "half", "demand", "forecast", "if sales")) {
    const factor = has(q, "triple") ? 3 : has(q, "halve", "half") ? 0.5 : 2;
    const alt = derive({ ...s, demandMultiplier: s.demandMultiplier * factor }, live).inventory;
    const gone = alt.critical.slice(0, 4).map((i) => `${i.product.name} (${i.stockoutInDays.toFixed(0)}d)`);
    return {
      text:
        `At ${(s.demandMultiplier * factor).toFixed(2)}× demand the picture changes sharply. ` +
        `${alt.critical.length} ${alt.critical.length === 1 ? "style falls" : "styles fall"} below their lead time versus ${inv.critical.length} today` +
        (gone.length ? `: ${gone.join(", ")}. ` : ". ") +
        `Total forward cover drops from ${(inv.unitsOnHand / Math.max(1, inv.items.reduce((a, i) => a + i.effVelocity, 0))).toFixed(0)} days to ` +
        `${(alt.unitsOnHand / Math.max(1, alt.items.reduce((a, i) => a + i.effVelocity, 0))).toFixed(0)} days. ` +
        `The buy needed to restore ${s.coverDays}-day cover goes from ${compactMoney(inv.items.reduce((a, i) => a + i.suggestedReorder * i.product.cost, 0))} to ` +
        `${compactMoney(alt.items.reduce((a, i) => a + i.suggestedReorder * i.product.cost, 0))} — against an open-to-buy of ${compactMoney(inv.openToBuy)}. ` +
        `Move the demand slider to hold this scenario and the whole district re-plans against it.`,
      refs: [assume, `Scenario · ${factor}× demand`, `Open-to-buy · ${compactMoney(inv.openToBuy)}`],
    };
  }

  // "risk of ordering 500 more units"
  if (has(q, "risk of", "what if i order", "order 5", "ordering", "overbuy", "too many", "units of")) {
    const qty = firstNumber(q) ?? 500;
    const p = named ?? (inv.critical[0]?.product ?? byId(HERO_ID));
    const item = inv.items.find((i) => i.product.id === p.id)!;
    const cash = qty * p.cost;
    const weeksAdded = qty / Math.max(1, item.planVelocity * 7);
    const totalCover = (item.onHandEff + item.product.inbound + qty) / Math.max(1, item.planVelocity);
    const sell60 = Math.min(1, (item.planVelocity * 60) / Math.max(1, item.onHandEff + qty));
    return {
      text:
        `Ordering ${n(qty)} more ${p.name} ties up ${compactMoney(cash)} of landed cost and adds ${weeksAdded.toFixed(1)} weeks of cover ` +
        `at the planning velocity of ${n(item.planVelocity)} units a day. Total cover would reach ${totalCover.toFixed(0)} days against a ${item.leadTime}-day lead time.\n\n` +
        (totalCover > item.leadTime + s.coverDays * 2.5
          ? `That is long. The downside is markdown exposure: if demand settles back to the ${n(p.velocity)}/day baseline, you would hold ${((item.onHandEff + qty) / p.velocity).toFixed(0)} days of stock and likely discount the tail.`
          : `That sits inside a reasonable band — roughly ${pct(sell60)} sell-through in 60 days at planning velocity.`) +
        `\n\nThis is a simulated planning scenario on demo data, not purchasing advice.`,
      refs: [assume, `${p.name} · ${n(item.onHandEff)} on hand`, `Unit cost · ${money(p.cost, 2)}`],
    };
  }

  // "what should I reorder"
  if (has(q, "reorder", "re-order", "buy", "purchase", "order before", "drop", "po")) {
    const list = inv.items.filter((i) => i.suggestedReorder > 0).sort((a, b) => a.stockoutInDays - b.stockoutInDays);
    if (!list.length) {
      return {
        text:
          `Nothing needs a buy this week. Every style holds its ${s.coverDays}-day cover beyond its lead time at ${s.demandMultiplier.toFixed(2)}× demand. ` +
          `The closest is ${inv.items.slice().sort((a, b) => a.stockoutInDays - b.stockoutInDays)[0].product.name} at ` +
          `${inv.items.slice().sort((a, b) => a.stockoutInDays - b.stockoutInDays)[0].stockoutInDays.toFixed(0)} days of cover.`,
        refs: [assume, `Cover target · lead time + ${s.coverDays} days`],
      };
    }
    const total = list.reduce((a, i) => a + i.suggestedReorder * i.product.cost, 0);
    return {
      text:
        `Before the next drop I would place ${list.length} ${list.length === 1 ? "order" : "orders"}, ${compactMoney(total)} of landed cost against ` +
        `${compactMoney(inv.openToBuy)} of open-to-buy:\n\n` +
        list
          .slice(0, 4)
          .map(
            (i) =>
              `• ${i.product.name} — ${n(i.suggestedReorder)} units (${compactMoney(i.suggestedReorder * i.product.cost)}). ` +
              `${i.stockoutInDays.toFixed(0)} days of cover now, ${i.leadTime}-day lead time.`,
          )
          .join("\n") +
        `\n\nQuantities are sized to lead time plus ${s.coverDays} days at planning velocity, rounded to case packs. ` +
        `I've staged the full plan as a draft in the Scenario Lab — compare it against a leaner cut before applying. Simulated scenario only.`,
      refs: [assume, `Open-to-buy · ${compactMoney(inv.openToBuy)}`, `Case packs · 25–100 units`],
      products: list.slice(0, 3).map((i) => i.product.id),
      labOps: {
        create: [
          {
            name: "Proposed buying plan",
            patch: {
              staged: {
                ...s.staged,
                ...Object.fromEntries(list.map((i) => [i.product.id, i.suggestedReorder])),
              },
            },
            note: `Every open reorder window filled at the suggested quantity — ${compactMoney(total)} of the ${compactMoney(inv.openToBuy)} open-to-buy.`,
          },
        ],
        open: true,
      },
    };
  }

  // "which products might sell out next"
  if (has(q, "sell out", "sellout", "stock out", "stockout", "run out", "next", "sell through", "low")) {
    const ranked = inv.items.slice().sort((a, b) => a.stockoutInDays - b.stockoutInDays).slice(0, 3);
    return {
      text:
        (inv.critical.length
          ? `${inv.critical.length} ${inv.critical.length === 1 ? "style sells" : "styles sell"} through before replenishment can land. `
          : `Nothing sells through before replenishment at the current assumption. `) +
        `Ranked by days of cover:\n\n` +
        ranked
          .map(
            (i) =>
              `• ${i.product.name} — ${i.stockoutInDays.toFixed(1)} days of cover at ${n(i.effVelocity)}/day, ` +
              `${i.leadTime}-day lead time. ${i.risk === "critical" ? "Critical." : i.risk === "watch" ? "Watch." : "Healthy."}`,
          )
          .join("\n") +
        (inv.critical.length ? `\n\nExposed revenue over the replenishment gap: ${compactMoney(inv.atRiskRevenue)}.` : ""),
      refs: [assume, `Cover = (on hand + in transit) ÷ daily velocity`],
      products: ranked.map((i) => i.product.id),
    };
  }

  // lead times
  if (has(q, "lead time", "supplier", "factory", "transit", "how long")) {
    const longest = inv.items.slice().sort((a, b) => b.leadTime - a.leadTime)[0];
    return {
      text:
        `Lead times in this demo run ${Math.min(...inv.items.map((i) => i.leadTime))}–${Math.max(...inv.items.map((i) => i.leadTime))} days, ` +
        `${longest.product.name} being the longest at ${longest.leadTime}. ` +
        (s.leadTimeAdj !== 0
          ? `You have the supplier assumption shifted by ${s.leadTimeAdj > 0 ? "+" : ""}${s.leadTimeAdj} days, which puts ${inv.critical.length} ${inv.critical.length === 1 ? "style" : "styles"} below cover. `
          : `Shift the lead-time assumption to see how much slack the plan really has. `) +
        `${n(inv.items.filter((i) => i.product.inbound > 0).length)} styles have units already in transit.`,
      refs: [assume, `Lead-time assumption · ${s.leadTimeAdj >= 0 ? "+" : ""}${s.leadTimeAdj} days`],
    };
  }

  if (named) {
    const i = inv.items.find((x) => x.product.id === named.id)!;
    return {
      text:
        `${named.name}: ${n(i.onHandEff)} units on hand${named.inbound ? `, ${n(named.inbound)} in transit landing in ${named.inboundEta} days` : ""}. ` +
        `Selling ${n(i.effVelocity)} a day, which is ${i.stockoutInDays.toFixed(1)} days of cover against a ${i.leadTime}-day lead time — ${i.risk}. ` +
        (i.suggestedReorder
          ? `Suggested reorder ${n(i.suggestedReorder)} units at ${compactMoney(i.suggestedReorder * named.cost)}.`
          : `No buy required.`),
      refs: [assume, `${named.name} · ${n(i.onHandEff)} units`],
      products: [named.id],
    };
  }

  return {
    text:
      `${inv.skuCount} styles, ${n(inv.unitsOnHand)} units, ${compactMoney(inv.retailValue)} at retail. ` +
      `${inv.critical.length} critical, ${inv.watch.length} on watch at ${s.demandMultiplier.toFixed(2)}× demand. ` +
      `Ask me what might sell out, what to reorder, or what a change in demand does to the plan.`,
    refs: [assume],
  };
}

/* ── Glam Concierge ──────────────────────────────────────────────── */

function conciergeReply(q: string, m: Metrics, s: SimState, ctx?: ReplyCtx): AgentReply {
  const inv = m.inventory;
  const avail = m.boutique.availability;
  const win = shipWindow(m.fulfillment);

  // "how are inquiries trending?"
  if (has(q, "trend", "inquiry volume", "inquiries", "question volume", "how many questions")) {
    const b = m.boutique;
    const multiple = b.inquiries / ASSUMPTIONS.baseInquiries;
    const low = inv.items.filter((i) => avail[i.product.id] !== "In stock");
    const handled = ctx?.flow ? Math.round(ctx.flow.conversationsToday) : null;
    const playbook = s.conciergePlaybook;
    return {
      text:
        `Question volume is running ${multiple.toFixed(1)}× the ${n(ASSUMPTIONS.baseInquiries)}-a-day baseline` +
        (handled !== null ? ` — ${n(handled)} handled so far today` : "") +
        `. ` +
        (low.length
          ? `The drivers are availability questions on ${low.map((i) => i.product.name).join(", ")} — scarcity always asks twice. `
          : `Nothing unusual is driving it; the mix is styling, shipping and order status. `) +
        `The current playbook is “${playbook}”.` +
        (low.length
          ? ` When scarcity drives volume, the playbook is the real decision — the options are in the Scenario Lab if you want to compare how we handle it.`
          : ""),
      refs: [
        `Inquiries · ${n(b.inquiries)}/day vs ${n(ASSUMPTIONS.baseInquiries)} base`,
        `Low stock · ${low.length} styles`,
        `Playbook · ${playbook}`,
      ],
      labOps: low.length ? { open: true } : undefined,
    };
  }
  const named = matchProduct(q);
  const budget = firstNumber(q);

  const availLine = (id: string) => {
    const a = avail[id];
    const i = inv.items.find((x) => x.product.id === id)!;
    if (a === "In stock") return "in stock";
    if (a === "Low stock") return `low stock — about ${Math.max(1, Math.floor(i.daysOfStock))} days at the current pace`;
    return "on the waitlist";
  };

  // order status
  if (has(q, "my order", "where is", "track", "tracking", "shipped", "gl-", "order status")) {
    const idMatch = q.toUpperCase().match(/GL-?\d{5}/);
    const found = idMatch
      ? DEMO_ORDERS.find((o) => o.id.replace("-", "") === idMatch[0].replace("-", ""))
      : DEMO_ORDERS[0];
    if (!found) {
      return {
        text:
          `I couldn't find that number in the demo records. This concept demo carries three fictional orders: ` +
          `${DEMO_ORDERS.map((o) => o.id).join(", ")}. Try one of those and I'll read it back.`,
        refs: ["Demo order records · 3 fictional orders"],
      };
    }
    return {
      text:
        `${found.id}, placed ${found.placed} for ${found.customer}: ${found.items.map((it) => `${it.qty} × ${byId(it.productId).name}`).join(", ")}. ` +
        `Status is ${found.state.toLowerCase()}${found.tracking !== "—" ? ` with ${found.carrier}, tracking ${found.tracking}` : ` in the Fulfillment House`}. ` +
        `Estimated arrival ${found.eta.toLowerCase()}. ` +
        `New orders placed today are quoting ${win.label} to ship, because the pick queue currently stands at ${days(m.fulfillment.backlogDays)}. ` +
        `These are fictional records for the demo — no real order system is connected.`,
      refs: [`Demo order · ${found.id}`, `Pick plan · ${days(m.fulfillment.backlogDays)} backlog`],
      order: found.id,
    };
  }

  // restock
  if (has(q, "restock", "back in stock", "waitlist", "when will", "sold out", "available again")) {
    const p = named ?? byId(HERO_ID);
    const i = inv.items.find((x) => x.product.id === p.id)!;
    const a = avail[p.id];
    return {
      text:
        a === "In stock"
          ? `Good news — the ${p.name} is in stock right now, ${money(p.price)} in ${p.colorway}. At the current pace there are about ${Math.floor(i.daysOfStock)} days of it on the shelf.`
          : `The ${p.name} is moving quickly — ${availLine(p.id)}. ` +
            (p.inbound > 0
              ? `There are ${n(p.inbound)} units already in transit, landing in about ${p.inboundEta} days. `
              : `The house's buying team works on a ${i.leadTime}-day lead time with this maker, so a replenishment ordered today would land in roughly ${i.leadTime} days. `) +
            `I can add you to the waitlist — that list is emailed first when the restock arrives. I won't promise a date beyond what the simulated lead time supports.`,
      refs: [`${p.name} · ${availLine(p.id)}`, `Lead time · ${i.leadTime} days`, "Example restock policy"],
      products: [p.id],
    };
  }

  // shipping / returns / care / gifting policy
  if (has(q, "shipping", "ship", "delivery", "deliver", "how fast", "express")) {
    return {
      text: `${POLICIES.shipping}\n\nRight now orders are quoting ${win.label} to leave the Fulfillment House, because the pick queue stands at ${days(m.fulfillment.backlogDays)}.`,
      refs: ["Example shipping policy", `Pick plan · ${days(m.fulfillment.backlogDays)} backlog`],
    };
  }
  if (has(q, "return", "refund", "exchange")) {
    return { text: POLICIES.returns, refs: ["Example returns policy"] };
  }
  if (has(q, "care", "clean", "leather", "look after")) {
    return { text: POLICIES.care, refs: ["Example care guidance"] };
  }
  if (has(q, "wrap", "packaging", "box", "card")) {
    return { text: POLICIES.gifting, refs: ["Example gifting policy"] };
  }

  // gift
  if (has(q, "gift", "present", "birthday", "holiday", "christmas", "anniversary")) {
    const gifts = PRODUCTS.filter((p) => p.tags.includes("gift")).sort((a, b) => a.price - b.price);
    const top = gifts.slice(0, 3);
    return {
      text:
        `My three favourites to give, all under ${money(Math.max(...top.map((p) => p.price)))}:\n\n` +
        top
          .map((p) => `• ${p.name}, ${money(p.price)} in ${p.colorway} — ${p.blurb} Currently ${availLine(p.id)}.`)
          .join("\n") +
        `\n\nThe ${byId("praline-case").name} is the house's most-gifted piece; it wraps beautifully with the ${byId("etoile-scarf").name} tied to a handle.`,
      refs: ["Demo catalogue · gift edit", "Live simulated availability"],
      products: top.map((p) => p.id),
    };
  }

  // budget / everyday
  if (has(q, "under", "less than", "budget", "cheap", "afford", "$") || budget !== null) {
    const cap = budget ?? 100;
    const everyday = has(q, "everyday", "every day", "daily", "work", "casual");
    let list = PRODUCTS.filter((p) => p.price <= cap);
    if (everyday) {
      const e = list.filter((p) => p.tags.includes("everyday"));
      if (e.length) list = e;
    }
    list = list.sort((a, b) => b.rating - a.rating).slice(0, 3);
    if (!list.length) {
      return {
        text:
          `Nothing in the demo catalogue sits under ${money(cap)} — the entry piece is the ${byId("praline-case").name} at ${money(38)}. ` +
          `If you can stretch, the ${byId("lumiere-clutch").name} is ${money(72)}.`,
        refs: ["Demo catalogue · 8 styles"],
        products: ["praline-case", "lumiere-clutch"],
      };
    }
    return {
      text:
        `${everyday ? "For everyday" : "Under " + money(cap)}, these three are where I'd start:\n\n` +
        list
          .map(
            (p) =>
              `• ${p.name}, ${money(p.price)} in ${p.colorway} — ${p.blurb} ${p.rating}★ from ${n(p.reviews)} reviews, currently ${availLine(p.id)}.`,
          )
          .join("\n") +
        `\n\nTell me how you carry — on the shoulder, crossbody, or in the hand — and I'll narrow it to one.`,
      refs: ["Demo catalogue · 8 styles", "Live simulated availability"],
      products: list.map((p) => p.id),
    };
  }

  // a named product
  if (named) {
    const i = inv.items.find((x) => x.product.id === named.id)!;
    return {
      text:
        `The ${named.name} — ${money(named.price)} in ${named.colorway}. ${named.blurb} ` +
        `${named.rating}★ from ${n(named.reviews)} reviews. It is ${availLine(named.id)}, and orders are shipping in ${win.label}. ` +
        (i.risk === "critical" ? `I'd move quickly on this one, or let me add you to the waitlist.` : ``),
      refs: [`${named.name} · ${availLine(named.id)}`, `Ship window · ${win.label}`],
      products: [named.id],
    };
  }

  // style guidance
  if (has(q, "work", "office", "laptop", "commute")) {
    return {
      text:
        `For work, the ${byId("ravenel-tote").name} at ${money(148)} — architectural saffiano, holds a 14-inch laptop in a suede sleeve. ` +
        `It is ${availLine("ravenel-tote")}. Pair it with the ${byId("praline-case").name} so your cards live somewhere findable.`,
      refs: ["Demo catalogue · work edit", "Live simulated availability"],
      products: ["ravenel-tote", "praline-case"],
    };
  }
  if (has(q, "evening", "event", "party", "wedding", "dinner", "occasion")) {
    return {
      text:
        `For evening, the ${byId("lumiere-clutch").name} at ${money(72)} — slim gold leaf with a concealed wrist chain, ${availLine("lumiere-clutch")}. ` +
        `If you want something that works past the event, the ${byId("monroe-satchel").name} at ${money(168)} carries beautifully by day too.`,
      refs: ["Demo catalogue · occasion edit", "Live simulated availability"],
      products: ["lumiere-clutch", "monroe-satchel"],
    };
  }

  return {
    text:
      `Happy to help. I can shop the demo catalogue with you — eight styles from ${money(38)} to ${money(168)} — look up one of three fictional orders, ` +
      `or answer shipping, returns and restock questions from the example policies. ` +
      `Orders are currently quoting ${win.label}. What are you looking for?`,
    refs: ["Demo catalogue · 8 styles", `Ship window · ${win.label}`],
  };
}

/* ── The daily briefing: any agent can give the cross-district read ── */

function briefingReply(m: Metrics, s: SimState, ctx?: ReplyCtx): AgentReply {
  const f = m.fulfillment;
  const inv = m.inventory;
  const b = m.boutique;
  const flow = ctx?.flow;
  const open = (ctx?.situations ?? []).length;
  const when = flow ? clockLabel(flow.minute).label : "today";

  return {
    text:
      `The district as of ${when}:\n\n` +
      `• Fulfillment — ${n(f.openOrders)} orders open, ${days(f.backlogDays)} of backlog, ${pct(f.onTimeRate, 0)} on-time` +
      (f.atRisk ? ` with ${n(f.atRisk)} at risk (${compactMoney(f.atRiskValue)})` : "") +
      (flow ? `. ${n(Math.round(flow.packedToday))} units packed and ${flow.trucksToday} ${flow.trucksToday === 1 ? "van" : "vans"} dispatched so far today.` : ".") +
      `\n• Buying — ${inv.critical.length} ${inv.critical.length === 1 ? "style" : "styles"} critical, ${inv.watch.length} on watch; ${compactMoney(inv.retailValue)} on hand at retail; ${compactMoney(inv.openToBuy - inv.stagedCost)} of open-to-buy uncommitted.` +
      `\n• Boutique — ${n(b.sessions)} sessions converting at ${pct(b.conversion, 2)}, ${n(b.inquiries)} client questions` +
      (flow ? ` (${n(Math.round(flow.conversationsToday))} handled so far today)` : "") +
      `.\n\n` +
      (open > 0
        ? `${open} ${open === 1 ? "situation is" : "situations are"} waiting on a decision in the Decision Desk — each comes with options to compare before you commit.`
        : `Nothing is waiting on a decision. A quiet book is a fine time to pressure-test assumptions in the Scenario Lab.`),
    refs: [
      `District clock · ${when}`,
      `Open decisions · ${open}`,
      "All figures · live simulated state",
    ],
  };
}

/* ── Entry point ─────────────────────────────────────────────────── */

export function respond(
  agent: AgentId,
  question: string,
  m: Metrics,
  s: SimState,
  live: LiveState,
  ctx?: ReplyCtx,
): AgentReply {
  const q = question.toLowerCase().trim();
  if (has(q, "briefing", "daily brief", "run me through", "how are things", "how is the business", "summary of the"))
    return briefingReply(m, s, ctx);
  if (agent === "analyst") return analystReply(q, m, s, live);
  if (agent === "strategist") return strategistReply(q, m, s, live);
  return conciergeReply(q, m, s, ctx);
}
