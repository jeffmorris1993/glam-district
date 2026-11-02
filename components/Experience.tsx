"use client";

import dynamic from "next/dynamic";
import { Arrival } from "./ui/Arrival";
import { CornerCredit, EventFeed, Hint, ScenarioBar, Toast, TopBar } from "./ui/Chrome";
import { Workspace, ProductSheet } from "./ui/Workspace";
import { AgentPanel } from "./ui/AgentPanel";

const World = dynamic(() => import("./World"), {
  ssr: false,
  loading: () => <WorldLoading />,
});

function WorldLoading() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background:
          "radial-gradient(120% 90% at 50% 8%, #FFFCF8 0%, #F7F1E9 38%, #EDE2D6 68%, #E2D4C5 100%)",
      }}
    >
      <div className="flex flex-col items-center gap-5">
        <div className="display text-[clamp(32px,6vw,64px)] leading-none text-[var(--ink)] opacity-25">
          Glam <span className="display-it">District</span>
        </div>
        <div className="h-px w-32 overflow-hidden bg-[rgba(58,43,35,.1)]">
          <div
            className="h-full w-1/3 bg-[var(--gold)]"
            style={{ animation: "sweep 1.4s var(--ease) infinite" }}
          />
        </div>
        <div className="eyebrow text-[8.5px] text-[#B5A48E]">Building the district</div>
      </div>
    </div>
  );
}

export function Experience() {
  return (
    <main className="relative h-full w-full overflow-hidden">
      <World />

      <TopBar />
      <Hint />
      <EventFeed />
      <ScenarioBar />
      <CornerCredit />

      <Workspace />
      <AgentPanel />
      <ProductSheet />
      <Toast />

      <Arrival />
    </main>
  );
}
