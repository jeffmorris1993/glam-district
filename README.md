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

One control runs a four-stage event across the whole district. Only stage two moves
physical state; everything after it is consequence:

1. **Boutique** — sessions jump 4.2×. More shoppers arrive on the pavement. Nothing
   downstream has reacted yet.
2. **Fulfillment House** — the surge converts. 2,900 orders land in the queue, the pile
   at the packing stations jumps, and the status band turns red.
3. **Buying Atelier** — those units come out of racking. Cover on the hero style
   collapses below the 34-day lead time and the strategist moves to the trend wall.
4. **Glam Concierge** — inquiry volume triples; the concierge switches to low-stock
   language and quotes the ship window from the live pick plan.

Every building can be opened mid-event to investigate what changed, and the timeline
records each stage with its cause. **Reset Simulation** returns the whole world — clock,
queue, inventory and event log — to its opening state.

---

## The part that matters: one clock, one dataset

There is a single synthetic business state, and **everything else is a readout of it** —
both the dashboards and the 3D world.

- [`lib/sim.ts`](lib/sim.ts) is the pure calculation layer: `derive(state, live)` maps
  the control inputs and the live operational position to every metric on screen.
- [`lib/engine.ts`](lib/engine.ts) is the **district clock**. It advances the business
  five simulated minutes at a time, moves physical state, and emits discrete events.

```
intake    orders arrive around the clock        →  queueUnits +=
packing   capacity exists only during the shift →  queueUnits −=, staged +=
                                                   on-hand stock −= (by style)
dispatch  staged reaches a full 210-parcel load →  a van departs
receiving an open PO reaches its ETA            →  a van arrives, cover restored
```

Each loop produces events with their own causal explanation, and the world reads the
same state the dashboards do:

| In the world | Driven by |
| --- | --- |
| Conveyor speed and occupancy | live pack rate (stops when the shift closes) |
| Pile at the packing stations | `queueUnits` — one box ≈ 230 waiting units |
| Lit stations and packers | the staffing control |
| Pickers walking the aisles | the staffing control |
| Dock shutters open | shift state + staffing |
| Pile on the dock | staged parcels building toward the next load |
| A van pulling out | a **dispatch event** — never a timer |
| A van arriving | a purchase order reaching its ETA |
| Status band colour at each roofline | that building's computed status |
| Shoppers arriving at the boutique | session volume |
| Shoppers leaving with a bag | conversion |
| Concierge turning to the door | inquiry volume |
| Strategist at the trend wall vs. the desk | whether a style is below lead-time cover |

Ambient motion is limited to atmosphere that makes no business claim: tree sway, lamp
glow, still water, two people crossing the district.

**Nothing in the world runs on its own schedule.** Change the staffing slider and the
belt speeds up, the pile drains, loads complete sooner and vans leave more often. Close
the shift and the belt stops, the pile grows overnight and no van leaves at all.

### Click anything

Every animated system has a hit area. Clicking it opens an inspector with the live
figures, **what you are watching**, **why it is doing that**, and the most recent event
that drove it — conveyor, packing stations, the backlog pile, the dock, the fleet, the
racking, the boutique floor, the window display, the sample table and the trend wall.

### The district timeline

A running log across all three buildings, newest first — intake, dispatch, bottlenecks,
shift open/close, inventory crossings, replenishment landings, client conversations and
staffing changes. Each entry carries its magnitude and its cause, and clicking one jumps
to the object that produced it.

### Determinism

A seeded RNG (`mulberry32`) builds a stable order book once; `derive()` is pure. The
clock integrates that state forward. Agents narrate those numbers — they never invent
them. There is no model call and no API key anywhere in this prototype.

### The model, briefly

| Quantity | How it is computed |
| --- | --- |
| Daily capacity | `pickers × shiftHours × unitsPerLaborHour` (×2 and ×0.92 on a second shift) |
| Pack rate | capacity spread across the shift; zero outside it |
| Open book | the sequenced order book, truncated to the units still queued |
| Ship day | promise date → tier → value; cumulative units ÷ capacity |
| At risk | `shipDay > promiseInDays` |
| Cost per order | `(labour + fixed overhead) ÷ orders shipped + packaging` |
| On hand | catalogue stock minus units actually packed, attributed by sales mix |
| Days of cover | `(on hand + in transit) ÷ effective daily velocity` |
| Risk band | `cover < leadTime` → critical · `< leadTime + coverDays` → watch |
| Suggested reorder | `planVelocity × (leadTime + coverDays) − onHand − inbound`, to case pack |
| Ship window quoted | derived from the live backlog in the pick plan |

`planVelocity` deliberately assumes a spike **settles** (2.4× baseline, not 14×), so the
buy scenario is a plausible plan rather than an extrapolation of one good day.

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
- Every animation is a readout of the clock (see the table above); ambient motion is
  limited to tree sway, lamp glow and still water.
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
  sim.ts                 the pure calculation layer — derive(state, live)
  engine.ts              the district clock: ticks, events, inspector copy
  store.ts               shared state, the clock driver, viral-drop choreography
  agents.ts              agent identities and live briefs
  answers.ts             scripted response engine (with real what-if math)
components/
  World.tsx              canvas, tone mapping, backdrop
  world/                 palette, camera rig, ground, props, the three buildings,
                         miniature figures, hover nameplates, the fleet,
                         client traffic, inspectable hit areas
  ui/                    arrival screen, chrome, workspace, agent panel,
                         object inspector, district timeline,
                         interface primitives, the three operational panels
```

---

## Taking this further

The prototype is already structured the way the production app would be: the
3D world is a set of composable R3F components, the simulation is a pure
function, and the UI reads from one store. Natural next steps:

- Swap the hand-built geometry for authored glTF assets (same component
  boundaries, same scene graph) and add a lightmap bake for the interiors.
- Replace the clock in `lib/engine.ts` with a stream of real operational events,
  keeping `derive()` as the calculation layer so dashboards stay deterministic and the
  world keeps animating from the same state.
- Keep the agents reading computed metrics and let a model handle only language —
  the pattern this demo already follows, which is what keeps the numbers honest.

Unofficial concept work. Not affiliated with, endorsed by, or representative of
Glamaholic Lifestyle.
