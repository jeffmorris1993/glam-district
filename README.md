# Glam District

**An AI-powered world behind the business.**
A concept by **Sirrom Studios** for **Glamaholic Lifestyle**.

> **Concept demo — simulated data.** Every product, customer, order, cost, staffing
> figure and supplier term in this experience is fictional. No Shopify, carrier,
> warehouse, customer or financial system is connected. Nothing here places an
> order, sends a message, or triggers an external action.

---

## What this is

A miniature luxury business district, rendered in real-time 3D, where three AI
agents run the operations behind a fashion-accessories house. The 3D world **is**
the interface — buildings are the navigation, agents are the entry points, and the
operational workspaces layer over the living model rather than navigating away
from it.

| Destination | Agent | What it runs |
| --- | --- | --- |
| **The Fulfillment House** | Fulfillment Analyst | Open order book, pick capacity, the daily ship plan |
| **The Buying Atelier** | Inventory Strategist | Stock cover, sell-through, reorder scenarios |
| **The Glam Boutique** | Glam Concierge | Clients, availability, shipping and order look-ups |

### The hero moment — *Simulate a Viral Drop*

One control runs a four-stage event across the whole district:

1. **Boutique** — sessions jump 4.2×; one style starts moving.
2. **Fulfillment House** — 2,900 orders land; the pick plan re-runs and the
   warehouse status turns red.
3. **Buying Atelier** — the hero style's cover collapses to ~3 days against a
   34-day lead time; a reorder scenario is staged.
4. **Glam Concierge** — inquiry volume triples and the concierge switches to
   low-stock language, quoting the ship window from the live pick plan.

Every building can be opened mid-event to investigate what changed.
**Reset Simulation** returns the whole world to its opening state.

---

## The part that matters: one dataset, three views

There is a single synthetic business state in [`lib/sim.ts`](lib/sim.ts). All three
workspaces and all three agents read from it, so the story stays coherent:

```
a style sells  →  on-hand falls  →  days of cover drop   (Atelier)
               →  an order joins the queue               (Fulfillment)
               →  the book takes longer to clear         (Fulfillment)
               →  the quoted ship window moves           (Boutique)
               →  the concierge changes what it promises (Concierge)
```

**All figures are deterministic.** A seeded RNG (`mulberry32`) builds a stable
order book once; `derive(state)` is a pure function from the control inputs to
every metric on screen. Agents narrate those numbers — they never invent them.
There is no model call and no API key anywhere in this prototype.

### The model, briefly

| Quantity | How it is computed |
| --- | --- |
| Daily capacity | `pickers × shiftHours × unitsPerLaborHour` (×2 and ×0.92 on a second shift) |
| Ship day | Queue sorted by promise date → tier → value; cumulative units ÷ capacity |
| At risk | `shipDay > promiseInDays` |
| Cost per order | `(labour + fixed overhead) ÷ orders shipped + packaging` |
| Days of cover | `(on hand + in transit) ÷ effective daily velocity` |
| Risk band | `cover < leadTime` → critical · `< leadTime + coverDays` → watch |
| Suggested reorder | `planVelocity × (leadTime + coverDays) − onHand − inbound`, rounded to case pack |
| Ship window quoted | Derived from the live backlog in the pick plan |

`planVelocity` deliberately assumes a spike **settles** (2.4× baseline, not 14×),
so the buy scenario is a plausible plan rather than an extrapolation of one good day.

Every control is live and monotonic — move the staffing slider and the queue,
the risk count, the day-by-day chart and the cost per order all re-derive;
move the demand or lead-time assumption and every cover figure and reorder
quantity follows.

---

## Agent behaviour

Each agent has an identity, a live status (`Monitoring · Analyzing · Planning ·
Needs review · Completed`), a current task, what it is monitoring, what it found,
recommendations, the supporting data, an activity history, suggested questions and
a chat input.

Responses are **scripted intent matching** over the live simulation
([`lib/answers.ts`](lib/answers.ts)) — including real what-if computation. Asking
the Fulfillment Analyst *"what happens if I add five workers?"* re-derives the
entire plan at `pickers + 5` and binary-searches for the staffing level that would
clear the book. Asking the Inventory Strategist *"what happens if demand doubles?"*
re-derives the whole inventory position at 2× and reports the delta in the buy.

The Glam Concierge is constrained to the demo catalogue, the example policies and
three fictional order records. It will not invent a product, a tracking number or
a delivery date; when a style is short it offers the waitlist and names only the
replenishment window the simulated lead time supports.

Every answer carries data-reference chips naming what it was computed from.

---

## The 3D world

Real-time React Three Fiber, not a pre-rendered image.

- Orthographic isometric rig with eased target, zoom and screen-space pan; the
  camera reframes itself around the workspace panels so the focused building
  always stays clear of them.
- Roofs are **peeled back like an architectural model** so interiors read from
  above: racking, conveyor, packing stations, mood boards, vitrines, a chandelier.
- Materials: marble, warm stone, brushed champagne, warm glass, soft interior
  light, PCF shadows and a local lightformer environment (no network fetches).
- Animation represents the simulated state: the conveyor speeds up when the
  backlog grows, dock shutters open on busy bays, the boutique crowd grows during
  the event, agent beacons take the colour of their building's status, and a
  status band at each roofline turns sage → amber → red.
- Hovering a building raises it, draws a soft gold edge outline and a ground halo,
  and opens a nameplate with the live status.

### Performance & accessibility

- `dpr` capped (1.9 desktop / 1.5 compact), baked contact shadows, a single
  shadow-casting light, one environment bake.
- **Reduced motion** is honoured throughout: character and vehicle animation
  freezes, camera transitions become instant, agent "thinking" delays collapse,
  and all CSS animation is disabled.
- All three destinations and all three agents are reachable by keyboard through
  the top navigation and the workspace header; panels close on `Escape`; focus
  rings are gold and visible.
- Narrow screens get the same world with the workspaces as bottom sheets, a
  compact destination switcher, and a camera that lifts the model clear of the sheet.

---

## Running it

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
```

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 ·
React Three Fiber / three.js · Zustand · Bodoni Moda + Jost.

## Where things live

```
app/
  globals.css            design tokens, type scale, motion, reduced-motion
  layout.tsx             fonts + metadata
lib/
  catalog.ts             fictional products, policies, demo orders, name pools
  sim.ts                 the deterministic engine — every number starts here
  store.ts               shared state, viral-drop choreography, event log
  agents.ts              agent identities and live briefs
  answers.ts             scripted response engine (with real what-if math)
components/
  World.tsx              canvas, tone mapping, backdrop
  world/                 palette, camera rig, ground, props, the three buildings,
                         miniature figures, hover nameplates
  ui/                    arrival screen, chrome, workspace, agent panel,
                         interface primitives, the three operational panels
```

---

## Taking this further

The prototype is already structured the way the production app would be: the
3D world is a set of composable R3F components, the simulation is a pure
function, and the UI reads from one store. Natural next steps:

- Swap the hand-built geometry for authored glTF assets (same component
  boundaries, same scene graph) and add a lightmap bake for the interiors.
- Replace `lib/sim.ts` with a server boundary that reads real operational data,
  keeping `derive()` as the calculation layer so dashboards stay deterministic.
- Keep the agents reading computed metrics and let a model handle only language —
  the pattern this demo already follows, which is what keeps the numbers honest.

Unofficial concept work. Not affiliated with, endorsed by, or representative of
Glamaholic Lifestyle.
