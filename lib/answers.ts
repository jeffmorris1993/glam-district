import { DEMO_ORDERS, HERO_ID, POLICIES, PRODUCTS, byId } from "./catalog";
import { ASSUMPTIONS, derive, shipWindow } from "./sim";
import { compactMoney, days, money, n, pct } from "./fmt";
import type { AgentId, Metrics, SimState } from "./types";

/* ════════════════════════════════════════════════════════════════════
   SCRIPTED AGENT RESPONSES
   Intent matching over a fixed set of behaviours. Every figure quoted
   is read from, or re-derived through, the deterministic simulation —
   nothing here is free-text invention.
   ════════════════════════════════════════════════════════════════════ */

export interface AgentReply {
  text: string;
  refs: string[];
  products?: string[];
  order?: string;
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

/** Smallest picker count that clears every promise, or null if out of range. */
function pickersToClear(s: SimState, max = 120): number | null {
  const risk = (p: number) => derive({ ...s, staffing: { ...s.staffing, pickers: p } }).fulfillment.atRisk;
  if (risk(s.staffing.pickers) === 0) return s.staffing.pickers;
  if (risk(max) > 0) return null;
  let lo = s.staffing.pickers;
  let hi = max;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (risk(mid) === 0) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

function matchProduct(q: string) {
  const l = q.toLowerCase();
  return (
    PRODUCTS.find((p) => l.includes(p.name.toLowerCase())) ??
    PRODUCTS.find((p) => l.includes(p.line.toLowerCase())) ??
    null
  );
}

/* ── Fulfillment Analyst ─────────────────────────────────────────── */

function analystReply(q: string, m: Metrics, s: SimState): AgentReply {
  const f = m.fulfillment;
  const avgUnits = f.openUnits / Math.max(1, f.openOrders);
  const plan = `Pick plan · ${s.staffing.pickers} associates × ${s.staffing.shiftHours}h${s.staffing.secondShift ? " × 2 shifts" : ""}`;

  // "what happens if I add five workers" / staffing changes
  if (has(q, "add", "hire", "more worker", "more associate", "more picker", "staff", "headcount", "remove", "cut")) {
    const delta = firstNumber(q) ?? 5;
    const dir = has(q, "remove", "cut", "fewer", "lose") ? -1 : 1;
    const next = Math.max(1, Math.min(60, s.staffing.pickers + dir * delta));
    const alt = derive({ ...s, staffing: { ...s.staffing, pickers: next } }).fulfillment;
    const clear = pickersToClear(s);
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
          : `That clears every promise in the book.`),
      refs: [plan, `Open book · ${n(f.openOrders)} orders`, `Labour rate · ${money(ASSUMPTIONS.laborRate, 2)}/hr`],
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
    const clear = pickersToClear(s);
    const target = clear ?? s.staffing.pickers;
    const alt = derive({ ...s, staffing: { ...s.staffing, pickers: target } }).fulfillment;
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
        `${money(derive({ ...s, staffing: { ...s.staffing, pickers: s.staffing.pickers + 6 } }).fulfillment.costPerOrder, 2)}.`,
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

function strategistReply(q: string, m: Metrics, s: SimState): AgentReply {
  const inv = m.inventory;
  const assume = `Assumptions · ${s.demandMultiplier.toFixed(2)}× demand, ${s.coverDays}-day cover`;
  const named = matchProduct(q);

  // "what happens if demand doubles" / halves
  if (has(q, "double", "doubles", "triple", "halve", "half", "demand", "forecast", "if sales")) {
    const factor = has(q, "triple") ? 3 : has(q, "halve", "half") ? 0.5 : 2;
    const alt = derive({ ...s, demandMultiplier: s.demandMultiplier * factor }).inventory;
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
        `Stage any of them in the reorder table to see the open-to-buy move. Simulated scenario only.`,
      refs: [assume, `Open-to-buy · ${compactMoney(inv.openToBuy)}`, `Case packs · 25–100 units`],
      products: list.slice(0, 3).map((i) => i.product.id),
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

function conciergeReply(q: string, m: Metrics): AgentReply {
  const inv = m.inventory;
  const avail = m.boutique.availability;
  const win = shipWindow(m.fulfillment);
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

/* ── Entry point ─────────────────────────────────────────────────── */

export function respond(agent: AgentId, question: string, m: Metrics, s: SimState): AgentReply {
  const q = question.toLowerCase().trim();
  if (agent === "analyst") return analystReply(q, m, s);
  if (agent === "strategist") return strategistReply(q, m, s);
  return conciergeReply(q, m);
}
