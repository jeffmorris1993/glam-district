"use client";

import { useId, type ReactNode } from "react";
import type { WorldStatus } from "@/lib/types";

/* ─────────────────────────────────────────────────────────────────
   Interface primitives. Editorial serif for figures, modern sans for
   everything operational.
   ───────────────────────────────────────────────────────────────── */

export const TONE: Record<WorldStatus, { fg: string; bg: string; dot: string; label: string }> = {
  healthy: { fg: "#5C6B54", bg: "rgba(142,156,133,.16)", dot: "#7E9072", label: "Healthy" },
  watch: { fg: "#9A6523", bg: "rgba(201,137,63,.16)", dot: "#C9893F", label: "Watch" },
  critical: { fg: "#9B4330", bg: "rgba(180,85,63,.15)", dot: "#B4553F", label: "Needs review" },
};

export function StatusPill({
  status,
  label,
  small,
}: {
  status: WorldStatus;
  label?: string;
  small?: boolean;
}) {
  const t = TONE[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-transparent ${
        small ? "px-2 py-[3px]" : "px-2.5 py-1"
      }`}
      style={{ background: t.bg, color: t.fg }}
    >
      <span className="h-[5px] w-[5px] rounded-full" style={{ background: t.dot }} />
      <span className="label" style={{ fontSize: small ? 9.5 : 10 }}>
        {label ?? t.label}
      </span>
    </span>
  );
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`eyebrow text-[var(--taupe)] ${className}`} style={{ color: "#9C8B76" }}>
      {children}
    </div>
  );
}

export function Rule({ className = "" }: { className?: string }) {
  return <div className={`h-px w-full bg-[var(--hairline-soft)] ${className}`} />;
}

export function GoldRule({ className = "" }: { className?: string }) {
  return <div className={`goldline h-px w-full ${className}`} />;
}

export function Stat({
  label,
  value,
  note,
  tone,
  size = "md",
  delta,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: WorldStatus;
  size?: "sm" | "md" | "lg";
  delta?: { value: string; dir: "up" | "down" | "flat" };
}) {
  const fs = size === "lg" ? 34 : size === "md" ? 25 : 19;
  return (
    <div className="min-w-0">
      <div className="label text-[10px] text-[#9C8B76]">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <div
          className="display num leading-none"
          style={{ fontSize: fs, color: tone ? TONE[tone].fg : "var(--espresso)" }}
        >
          {value}
        </div>
        {delta && (
          <span
            className="num text-[11px] font-medium"
            style={{
              color: delta.dir === "up" ? "#9B4330" : delta.dir === "down" ? "#5C6B54" : "#9C8B76",
            }}
          >
            {delta.dir === "up" ? "▲" : delta.dir === "down" ? "▼" : "—"} {delta.value}
          </span>
        )}
      </div>
      {note && <div className="mt-1 text-[11.5px] leading-tight text-[#8C7B66]">{note}</div>}
    </div>
  );
}

export function Meter({
  value,
  max = 1,
  tone = "healthy",
  height = 4,
  marker,
}: {
  value: number;
  max?: number;
  tone?: WorldStatus;
  height?: number;
  /** 0–1 position of a target marker */
  marker?: number;
}) {
  const p = Math.max(0, Math.min(1, value / max));
  return (
    <div
      className="relative w-full overflow-hidden rounded-full"
      style={{ height, background: "rgba(58,43,35,.09)" }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${p * 100}%`, background: TONE[tone].dot, transitionTimingFunction: "var(--ease)" }}
      />
      {marker !== undefined && (
        <div
          className="absolute top-0 h-full w-px"
          style={{ left: `${Math.min(1, marker) * 100}%`, background: "rgba(58,43,35,.4)" }}
        />
      )}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  hint?: string;
}) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="label text-[10px] text-[#8C7B66]">
          {label}
        </label>
        <span className="display num text-[15px] text-[var(--espresso)]">
          {format ? format(value) : value}
        </span>
      </div>
      <input
        id={id}
        className="lux mt-1"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ ["--pct" as string]: `${pct}%` }}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      {hint && <div className="-mt-0.5 text-[11px] text-[#9C8B76]">{hint}</div>}
    </div>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group flex w-full items-center justify-between gap-3 py-1 text-left"
    >
      <span>
        <span className="label block text-[10px] text-[#8C7B66]">{label}</span>
        {hint && <span className="mt-0.5 block text-[11px] text-[#9C8B76]">{hint}</span>}
      </span>
      <span
        className="relative h-[18px] w-[32px] shrink-0 rounded-full transition-colors duration-300"
        style={{ background: checked ? "var(--gold)" : "rgba(58,43,35,.16)" }}
      >
        <span
          className="absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-[left] duration-300"
          style={{ left: checked ? 16 : 2, transitionTimingFunction: "var(--ease)" }}
        />
      </span>
    </button>
  );
}

export function Btn({
  children,
  onClick,
  variant = "ghost",
  size = "md",
  disabled,
  className = "",
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "quiet" | "alert";
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full label transition-all duration-300 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap";
  const pad = size === "sm" ? "px-3 py-[6px] text-[9.5px]" : "px-4 py-[9px] text-[10px]";
  const styles: Record<string, string> = {
    primary:
      "text-[#FBF7F2] bg-[var(--espresso)] hover:bg-[var(--ink)] shadow-[0_1px_2px_rgba(35,30,27,.18),0_8px_20px_-8px_rgba(35,30,27,.5)] hover:shadow-[0_2px_4px_rgba(35,30,27,.2),0_12px_28px_-10px_rgba(35,30,27,.55)]",
    ghost:
      "text-[var(--espresso)] border border-[rgba(58,43,35,.18)] hover:border-[var(--gold)] hover:bg-[rgba(217,188,140,.1)]",
    quiet: "text-[#8C7B66] hover:text-[var(--espresso)] hover:bg-[rgba(58,43,35,.05)]",
    alert:
      "text-[#FBF7F2] bg-[var(--alert)] hover:brightness-110 shadow-[0_8px_20px_-10px_rgba(180,85,63,.8)]",
  };
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${pad} ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

/* ── Charts ───────────────────────────────────────────────────────── */

export function BarChart({
  data,
  tone,
  height = 86,
  labelFor,
  valueFor,
  highlight,
}: {
  data: { key: string; value: number; tone?: WorldStatus }[];
  tone?: WorldStatus;
  height?: number;
  labelFor?: (d: { key: string; value: number }) => string;
  valueFor?: (d: { key: string; value: number }) => string;
  highlight?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-[6px]" style={{ height }}>
      {data.map((d, i) => {
        const h = (d.value / max) * (height - 22);
        const t = d.tone ?? tone ?? "healthy";
        const hot = highlight === i;
        return (
          <div key={d.key} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="num text-[9.5px] tabular-nums text-[#8C7B66] opacity-0 transition-opacity group-hover:opacity-100">
              {valueFor ? valueFor(d) : d.value}
            </span>
            <div
              className="w-full origin-bottom rounded-[2px] transition-all duration-500"
              style={{
                height: Math.max(2, h),
                background: hot
                  ? TONE[t].dot
                  : `color-mix(in srgb, ${TONE[t].dot} 48%, #F4EEE6)`,
                borderTop: `2px solid ${TONE[t].dot}`,
                transitionTimingFunction: "var(--ease)",
              }}
            />
            <span className="label text-[9px] text-[#A3927C]">{labelFor ? labelFor(d) : d.key}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Horizontal ranked bars — reads well when one value dwarfs the rest. */
export function RankedBars({
  rows,
}: {
  rows: { key: string; label: string; value: number; display: string; tone: WorldStatus; hex?: string }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="grid gap-[7px]">
      {rows.map((r, i) => (
        <div key={r.key} className="grid grid-cols-[14px_1fr_auto] items-center gap-2">
          <span className="num text-[9.5px] text-[#C0AF98]">0{i + 1}</span>
          <span className="relative flex h-[18px] min-w-0 items-center">
            <span
              className="absolute inset-y-0 left-0 rounded-[2px] transition-[width] duration-700"
              style={{
                width: `${Math.max(2.5, (r.value / max) * 100)}%`,
                background: `color-mix(in srgb, ${TONE[r.tone].dot} 30%, #FBF7F2)`,
                borderLeft: `2px solid ${TONE[r.tone].dot}`,
                transitionTimingFunction: "var(--ease)",
              }}
            />
            <span className="relative z-10 flex min-w-0 items-center gap-1.5 pl-2">
              {r.hex && <Swatch hex={r.hex} size={7} />}
              <span className="truncate text-[11px] text-[var(--espresso)]">{r.label}</span>
            </span>
          </span>
          <span className="num shrink-0 text-[10.5px] text-[#8C7B66]">{r.display}</span>
        </div>
      ))}
    </div>
  );
}

export function Spark({
  values,
  tone = "healthy",
  width = 92,
  height = 26,
}: {
  values: number[];
  tone?: WorldStatus;
  width?: number;
  height?: number;
}) {
  const max = Math.max(...values, 0.001);
  const min = Math.min(...values);
  const span = Math.max(0.001, max - min);
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - 2 - ((v - min) / span) * (height - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const area = `0,${height} ${pts.join(" ")} ${width},${height}`;
  const id = useId().replace(/[:]/g, "");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={TONE[tone].dot} stopOpacity="0.22" />
          <stop offset="100%" stopColor={TONE[tone].dot} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#g${id})`} />
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={TONE[tone].dot}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={width}
        cy={height - 2 - ((values[values.length - 1] - min) / span) * (height - 4)}
        r="2"
        fill={TONE[tone].dot}
      />
    </svg>
  );
}

/* ── Data provenance chip ─────────────────────────────────────────── */

export function RefChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-[rgba(58,43,35,.1)] bg-[rgba(255,255,255,.5)] px-1.5 py-[2px] text-[9.5px] tracking-[0.04em] text-[#8C7B66]">
      <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden>
        <rect x="0.5" y="0.5" width="7" height="7" rx="1" fill="none" stroke="#B9A994" />
        <path d="M2 4h4M2 5.6h2.6" stroke="#B9A994" strokeWidth=".7" />
      </svg>
      {children}
    </span>
  );
}

export function Swatch({ hex, size = 10 }: { hex: string; size?: number }) {
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: hex,
        boxShadow: "inset 0 0 0 1px rgba(58,43,35,.14)",
      }}
    />
  );
}

export function Empty({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
        <circle cx="14" cy="14" r="11" fill="none" stroke="#DED3C6" strokeWidth="1" />
        <path d="M9 14h10" stroke="#DED3C6" strokeWidth="1" strokeLinecap="round" />
      </svg>
      <div className="display text-[17px] text-[var(--espresso)]">{title}</div>
      {note && <div className="max-w-[30ch] text-[12px] leading-relaxed text-[#9C8B76]">{note}</div>}
    </div>
  );
}
